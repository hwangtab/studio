import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { isNotificationSentinel } from './notificationSentinel';
import { bookings, contracts, fundingPledges, fundingProjectPayouts, fundingProjects, orders, payments, refunds, subscriptionPayments, subscriptions } from '../../db/schema';
import { calendarForService, calendarIdFor, fetchBusyRanges, isCalendarActive, roomCalendarEnvKey, type BookingCalendar } from '../booking/gcal';
import { PRACTICE_ROOM_HOURLY_ROOMS } from '../booking/products';
import { REFUND_PENDING_ORDER_STATUSES } from '../funding/policy';
import { buildFundingPayoutPreview } from '../funding/payout';
import { getAllFundingProjects } from '../funding/projects';
import { LIVE_FUNDING_ORDER_STATUSES } from '../funding/refundable';
import { ORDER_LEGAL_RETENTION_YEARS } from '../privacy/orderRetention';
import {
  SUBSCRIPTION_DORMANCY_YEARS,
  dormancyWarningBoundary,
  dormantActivityCondition,
} from '../privacy/orderRetention';
import { runLeadRateCheck } from './leadRateCheck';
import { checkMigrationDrift } from './migrationDrift';
import {
  FIELD_CRYPTO_KEY_ENV, FIELD_CRYPTO_VERSION, FieldCryptoError,
  decryptField, deriveKeyId, encryptField, parseFieldKey,
} from '../crypto/fieldCrypto';
import { ENCRYPTED_FIELD_TARGETS } from '../crypto/fieldKeyRotation';

/**
 * 조용히 실패한 것들을 하루 한 번 훑어 운영자에게 알린다.
 *
 * 이 저장소의 실패 처리 원칙은 "결제·서명은 이미 끝났으므로 후속 실패를 삼키되 반드시
 * 기록한다"다. 기록은 잘 되고 있었는데 **읽는 사람이 없었다** — 배너는 관리자가 그 화면을
 * 열 때만 보이고, Vercel 런타임 로그는 24시간만 남는다. 결제·서명처럼 드문 이벤트의
 * 실패는 그 창을 놓치면 영영 확인할 수 없다.
 *
 * Sentry 같은 외부 모니터링을 들이지 않은 것은 의도다. 필요한 신호가 이미 DB 컬럼과
 * 관리자 화면의 판정식으로 존재하므로, 없는 것은 "주기적으로 읽어서 알려주는 일" 하나뿐이다.
 * 기존 크론·Resend 경로를 그대로 쓴다(backup-contracts와 같은 패턴).
 *
 * 이상이 없으면 아무것도 보내지 않는다. 매일 "정상입니다"를 보내면 사람이 곧 안 읽게 되고,
 * 정작 문제가 생긴 날의 메일도 같이 묻힌다.
 */

export interface HealthIssue {
  /** 운영자가 무엇을 해야 하는지 한 줄로. */
  title: string;
  detail: string;
  /** 높을수록 먼저 보여준다. */
  severity: 'high' | 'medium';
  /** 관리자 화면에서 이 항목을 처리하러 갈 곳. 메일 본문에는 싣지 않는다. */
  href?: string;
}

export interface HealthReport {
  issues: HealthIssue[];
  checkedAt: Date;
}

/** 목록에 실을 최대 건수 — 메일이 수백 줄이 되면 아무도 안 읽는다. */
const SAMPLE_LIMIT = 10;

const sample = (values: string[]): string =>
  values.length <= SAMPLE_LIMIT
    ? values.join(', ')
    : `${values.slice(0, SAMPLE_LIMIT).join(', ')} 외 ${values.length - SAMPLE_LIMIT}건`;

/**
 * 구글 캘린더가 살아 있는지. 죽으면 예약 슬롯 조회가 전부 503이 되어 **예약 퍼널 전체가
 * 멈추는데**, 그 사실은 아무 데도 기록되지 않는다(고객 화면에 회색 문구 한 줄이 전부다).
 * 다른 점검과 달리 DB에 흔적이 없어서, 여기서 직접 찔러 보는 것 말고는 알 방법이 없다.
 */
/** 점검할 캘린더 목록 — 녹음실, 연습실 공용, 그리고 방별 env가 따로 있는 방. */
const calendarsToCheck = (): Array<{ which: BookingCalendar; room: string | null; label: string; env: string }> => {
  const list: Array<{ which: BookingCalendar; room: string | null; label: string; env: string }> = [
    { which: 'studio', room: null, label: '녹음실', env: 'BOOKING_GCAL_ID' },
  ];
  const shared = calendarIdFor('practice-room');
  if (shared) list.push({ which: 'practice-room', room: null, label: '연습실', env: 'PRACTICE_ROOM_GCAL_ID' });
  for (const room of PRACTICE_ROOM_HOURLY_ROOMS) {
    const own = process.env[roomCalendarEnvKey(room)];
    if (own && own !== shared) list.push({ which: 'practice-room', room, label: `연습실 ${room}`, env: roomCalendarEnvKey(room) });
  }
  return list;
};

const checkCalendar = async (now: Date): Promise<HealthIssue[]> => {
  const issues: HealthIssue[] = [];
  for (const cal of calendarsToCheck()) {
    try {
      await fetchBusyRanges(now, new Date(now.getTime() + 24 * 60 * 60 * 1000), cal.which, cal.room);
    } catch (error: unknown) {
      issues.push({
        severity: 'high',
        title: `${cal.label} 예약 캘린더를 조회할 수 없습니다 — ${cal.label} 예약 퍼널이 멈춰 있습니다`,
        detail:
          '고객이 날짜를 골라도 시간대가 뜨지 않습니다(전 슬롯 503). ' +
          `${cal.env}·GOOGLE_SA_EMAIL·GOOGLE_SA_PRIVATE_KEY와 캘린더 공유 설정을 확인해 주세요.\n` +
          `사유: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  return issues;
};

/**
 * 필드 암호화 키가 실제로 쓸 수 있는 상태인지 — 정산 계좌와 주민등록번호를 저장·조회하는
 * 유일한 수단이다.
 *
 * 키가 없거나 형식이 틀리면 개설자의 정산 정보 저장이 `encryption_unavailable`로 통째로
 * 거부되고(`savePayoutSection` — 계좌만 고치는 저장도 마찬가지다), 이미 저장된 값은 운영자가
 * 조회해도 안 열린다.
 * **그 사실이 DB 어디에도 남지 않는다** — 개설자가 "저장이 안 된다"고 연락해 줄 때까지
 * 아무도 모른다. 캘린더 점검과 같은 이유로 여기서 직접 찔러 본다.
 *
 * 찌르는 방법은 고정 문자열 왕복이다. env 길이만 재면 키가 base64로는 32바이트인데 암호
 * 모듈이 거부하는 경우를 놓친다 — 실제 경로를 그대로 지나야 "쓸 수 있는 키"를 확인한 것이다.
 *
 * **값은 어디에도 적지 않는다.** 키도, 왕복에 쓴 문자열도, 암호문도 메일에 넣지 않는다 —
 * 운영자가 알아야 하는 것은 "설정됨 / 없음 / 형식 이상" 셋뿐이다.
 */
const FIELD_KEY_PROBE = 'health-check';

export const checkFieldCryptoKey = (): HealthIssue | null => {
  try {
    if (decryptField(encryptField(FIELD_KEY_PROBE)) !== FIELD_KEY_PROBE) {
      return {
        severity: 'high',
        title: `필드 암호화 키(${FIELD_CRYPTO_KEY_ENV})로 암호화한 값이 원래대로 돌아오지 않습니다`,
        detail:
          '정산 계좌·주민등록번호 저장·조회가 정상 동작한다고 볼 수 없는 상태입니다. 배포 판본과 환경 변수를 확인해 주세요.',
      };
    }
    return null;
  } catch (error: unknown) {
    const code = error instanceof FieldCryptoError ? error.code : 'unknown';
    const state = code === 'missing_key' ? '없음' : code === 'invalid_key' ? '형식 이상' : '확인 실패';
    return {
      severity: 'high',
      title: `필드 암호화 키(${FIELD_CRYPTO_KEY_ENV}) ${state} — 정산 계좌·주민등록번호를 저장·조회할 수 없습니다`,
      detail: [
        `상태: ${state} (code=${code})`,
        '개설자의 정산 정보 저장이 전부 거부됩니다 — 계좌(은행명·계좌번호·예금주)도 주민등록번호도 ' +
          '암호화해서만 저장하므로, 계좌만 고치는 저장도 키 없이는 되지 않습니다. 이미 저장된 값은 ' +
          '운영자 조회에서 열리지 않고, 그 개설자의 정산 기록은 payout_account_unreadable · ' +
          'resident_number_unreadable로 막힙니다 — 값이 아예 없을 때 나오는 no_payout_account · ' +
          'no_resident_number와 다른 코드입니다.',
        `Vercel 환경 변수와 로컬 .env.local의 ${FIELD_CRYPTO_KEY_ENV}(base64 32바이트)를 확인해 주세요.`,
        '**이미 저장된 값이 있다면 키를 새로 만들지 마세요** — 옛 키로만 복호화됩니다. ' +
          '옛 키를 되찾을 수 없으면 개설자에게 다시 등록을 요청하는 것 외에 방법이 없습니다.',
      ].join('\n'),
    };
  }
};

/** 옛 키 자리. 이 값이 있으면 회전이 진행 중이라는 뜻으로 읽는다. */
const FIELD_CRYPTO_OLD_KEY_ENV = 'FUNDING_FIELD_KEY_OLD';

/**
 * **지금 키로 열리지 않는 행이 몇 개인가.**
 *
 * `checkFieldCryptoKey`는 같은 키로 왕복만 찔러 본다 — 절반만 회전된 DB에서도 통과한다.
 * 그런데 회전이 멈춘 채 방치되면 결국 누군가 `FUNDING_FIELD_KEY_OLD`를 지우고, 그 행들은
 * 영구히 잠긴다. 회전 스크립트가 "아무것도 안 했는데 끝난 것처럼" 보이는 경로를 막아 놨어도
 * 이쪽이 열려 있으면 같은 사고가 난다.
 *
 * **복호화하지 않는다.** 저장 형식 v2가 `v2:<keyId>:...`이므로 앞 11글자만 비교하면 된다 —
 * 크론이 평문을 만들 일도, 평문을 어딘가에 흘릴 일도 없다. 쿼리는 대상당 `count(*)` 하나이고
 * 값은 서버로 나오지 않는다. v1 값은 접두사가 `v1:`이라 자연히 "열리지 않는 쪽"으로 센다
 * (v1은 지금 키로 열릴 수도 있지만, 어차피 회전 대상이라 남아 있으면 안 된다).
 *
 * 키가 없거나 형식이 틀리면 **비교 기준 자체가 없으므로** 이 집계는 건너뛴다 —
 * 그 상태는 `checkFieldCryptoKey`가 이미 high로 보고하고 있다.
 */
export const checkFieldKeyRotationPending = async (): Promise<HealthIssue | null> => {
  let expectedPrefix: string;
  try {
    expectedPrefix = `${FIELD_CRYPTO_VERSION}:${deriveKeyId(parseFieldKey(process.env[FIELD_CRYPTO_KEY_ENV]))}`;
  } catch {
    return null;
  }

  const db = getDb();
  const counts: Array<{ label: string; count: number }> = [];
  for (const target of ENCRYPTED_FIELD_TARGETS) {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(target.table)
      .where(
        and(
          isNotNull(target.valueColumn),
          sql`substr(${target.valueColumn}, 1, ${expectedPrefix.length}) <> ${expectedPrefix}`,
        ),
      );
    const count = Number(row?.count ?? 0);
    if (count > 0) counts.push({ label: target.label, count });
  }

  const total = counts.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) return null;

  const breakdown = counts.map((c) => `${c.label}: ${c.count}건`).join('\n');
  const rotating = Boolean(process.env[FIELD_CRYPTO_OLD_KEY_ENV]?.trim());

  /**
   * 두 경우는 운영자가 할 일이 정반대라 문구를 가른다.
   * - 옛 키가 환경에 있다 → 회전이 **진행 중**이다. 정상 경과이고, 남은 건수를 0으로 만들면 된다.
   * - 옛 키가 없다 → 옛 키로 잠긴 값이 있는데 **그 키가 환경에 없다.** 사고이고, 옛 키를
   *   되찾는 것이 먼저다. 이 상태에서 그 값들을 지우면 복구 경로가 사라진다.
   */
  return rotating
    ? {
        severity: 'medium',
        title: `필드 암호화 키 회전이 진행 중입니다 — 아직 옛 키로 잠긴 값 ${total}건`,
        detail: [
          breakdown,
          `${FIELD_CRYPTO_OLD_KEY_ENV}가 설정돼 있어 회전 중으로 읽었습니다. 남은 건수가 0이 되면 이 알림은 사라집니다.`,
          '회전을 마저 돌려 주세요 — scripts/rotate-field-key.mjs (CLAUDE.md "키 회전 절차").',
          `**건수가 0이 되기 전에 ${FIELD_CRYPTO_OLD_KEY_ENV}를 지우지 마세요.** 지우면 이 값들을 열 수단이 사라집니다.`,
        ].join('\n'),
      }
    : {
        severity: 'high',
        title: `지금 키로 열리지 않는 암호화 값 ${total}건 — 옛 키가 환경에 없습니다`,
        detail: [
          breakdown,
          `${FIELD_CRYPTO_KEY_ENV}가 아닌 다른 키로 잠긴 값입니다. 조회는 key_mismatch로 막히고, `
            + '원천징수 대상 개설자의 정산 기록은 resident_number_unreadable로 막힙니다.',
          `${FIELD_CRYPTO_OLD_KEY_ENV}가 비어 있습니다 — 회전이 중간에 멈춘 채 옛 키가 지워졌거나, `
            + `${FIELD_CRYPTO_KEY_ENV}가 의도치 않게 바뀐 것입니다.`,
          '**값을 지우거나 개설자에게 재등록을 요청하기 전에 옛 키를 되찾을 수 있는지부터 확인해 주세요.** '
            + `되찾으면 ${FIELD_CRYPTO_OLD_KEY_ENV}에 넣고 회전을 돌리면 그대로 복구됩니다.`,
        ].join('\n'),
      };
};

/**
 * DB에 흔적이 남는 점검 전부 — 크론 메일과 관리자 첫 화면이 **같은 판정식**을 쓴다.
 *
 * 화면에는 캘린더·GA4 같은 외부 호출을 붙이지 않는다. 첫 화면을 열 때마다 구글을 찌르면
 * 느리고, 그쪽 장애가 관리자 화면까지 막는다. 그 둘은 하루 한 번 크론(runHealthCheck)이 본다.
 */
export const collectDbIssues = async (now: Date): Promise<HealthIssue[]> => {
  const db = getDb();
  const issues: HealthIssue[] = [];

  /**
   * 로컬에 커밋된 마이그레이션이 운영 DB에 아직 적용되지 않은 경우 — 2026-09-21
   * 사고(셀프 개설 0017~0019가 사흘간 미적용 배포) 재발 방지. 판정 자체는
   * lib/ops/migrationDrift.ts. env가 없으면 'unknown'을 돌려주는데, 이 화면·크론이
   * 실행되는 시점엔 이미 getDb() 위 줄이 같은 env로 성공했으므로 여기서 'unknown'이
   * 나올 일은 없다 — 그래도 값으로 구분해 오해를 막는다.
   *
   * 밀린 상태는 이미 공개 경로가 조용히 깨져 있다는 뜻이라(폴백이 있는 경로는 옛 동작으로,
   * 없는 경로는 500으로) severity는 high로 둔다.
   */
  const rotationPending = await checkFieldKeyRotationPending();
  if (rotationPending) issues.push(rotationPending);

  const migrationDrift = await checkMigrationDrift();
  if (migrationDrift.status === 'drift') {
    issues.push({
      severity: 'high',
      title: `운영 DB에 적용되지 않은 마이그레이션 ${migrationDrift.pendingCount}건`,
      detail:
        `로컬 저장소에 커밋된 마이그레이션이 운영 DB보다 ${migrationDrift.pendingCount}개 앞서 있습니다: ` +
        `${migrationDrift.pendingTags.join(', ')}\n` +
        '이 스키마 변경을 전제로 코드가 이미 배포돼 있다면, 해당 기능의 관리자·API 경로가 500을 내거나 ' +
        '(safeDb류 폴백이 있는 경로는) 조용히 옛 동작으로 돌아가 있을 수 있습니다.\n' +
        '`npm run db:migrate`로 적용해 주세요.',
    });
  }

  /**
   * 결제·확정은 정상인데 구글 캘린더에 이벤트가 없는 예약. 운영자 캘린더에는 그 시간이
   * 비어 있으므로, 그대로 두면 같은 시간에 전화 예약을 받아 오프라인 이중예약이 난다.
   *
   * 두 갈래를 **한 점검으로** 본다. 운영자가 할 일이 "관리자 > 예약 상세에서 캘린더 재시도"
   * 하나로 같고, 갈라서 두 건으로 세면 한 예약이 두 번 세어져(재시도 실패로 gcal_error가
   * 남은 채 이벤트 id가 여전히 NULL인 건이 양쪽에 모두 걸린다) 규모를 오해한다.
   * - **시도했다가 실패**: gcal_error에 사유가 남아 있다.
   * - **시도 자체가 없음**: gcal_event_id·gcal_error가 둘 다 NULL. 확정 트랜잭션이 커밋된
   *   직후 ensureBookingEvent 전에 함수가 죽은 경우다(후처리 센티널 선점 직후 사망).
   *   예전 조건은 `gcal_error IS NOT NULL`이라 이 예약을 **영원히** 못 잡았고, 그 사이
   *   운영자가 알림 배너를 보고 "알림 재발송"을 누르면 남은 신호(notification_error 센티널)
   *   까지 지워져 무증상 이중예약으로 되돌아갔다.
   *
   * 확정 직후 후처리가 **정상 진행 중**인 몇 초 동안도 event_id는 NULL이다. 이 점검은 크론이
   * 하루 한 번 돌리므로 그 창에 걸릴 확률은 무시할 수준이고, 걸려도 다음 날 자동으로 사라진다 —
   * 과소보고(무증상 이중예약)보다 훨씬 안전한 방향이다.
   */
  // 캘린더가 비활성인 연습실 예약(공용도 방별도 env 없음)은 등록 대상이 아니다 — confirm.ts가
  // 같은 판정(isCalendarActive(which, room))으로 건너뛴다. 그 행을 "미등록"으로 세면 매일
  // 꺼지지 않는 긴급 메일이 된다. 판정은 행별 room_number로 한다 — 공용만 보면 방별 env만
  // 있는 구성에서 실제로 쓰는 예약까지 통째로 빠진다.
  const gcalGapRows = await db
    .select({
      id: bookings.id, gcalError: bookings.gcalError, gcalEventId: bookings.gcalEventId,
      serviceType: bookings.serviceType, roomNumber: bookings.roomNumber,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, 'confirmed'),
        or(isNotNull(bookings.gcalError), isNull(bookings.gcalEventId)),
      ),
    );
  const gcalGap = gcalGapRows.filter((row) => isCalendarActive(calendarForService(row.serviceType), row.roomNumber));

  if (gcalGap.length > 0) {
    const untried = gcalGap.filter((row) => row.gcalError === null && row.gcalEventId === null);
    const failed = gcalGap.length - untried.length;
    issues.push({
      severity: 'high',
      href: '/admin/bookings',
      title: `구글 캘린더에 등록되지 않은 확정 예약 ${gcalGap.length}건`,
      detail: [
        '결제는 정상이지만 캘린더에는 이 시간이 비어 있습니다. 같은 시간에 전화 예약을 받으면 겹칩니다.',
        ...(failed > 0
          ? [`- 등록을 시도했다가 실패: ${failed}건 (사유는 예약 상세의 캘린더 오류에 있습니다)`]
          : []),
        ...(untried.length > 0
          ? [
              `- 등록 시도 자체가 없음: ${untried.length}건 ` +
                '(확정 직후 후처리가 중단된 건이라 오류 기록도 남지 않습니다)',
            ]
          : []),
        '관리자 > 예약 상세에서 “캘린더 재시도”를 누르거나 캘린더에 직접 넣어 주세요.',
      ].join('\n'),
    });
  }

  /**
   * 확인 메일이 나가지 않은 주문. 고객은 예약 확인·취소 링크를 받지 못한 상태다
   * (완료 화면에도 링크를 띄우도록 고쳤지만, 그 화면을 닫은 뒤에는 메일이 유일한 경로다).
   *
   * 이 컬럼에는 실제 실패 사유만 들어오는 게 아니다. 확정 후처리 소유권을 CAS로 정하면서
   * `send_pending`(발송 시작 전)·`send_inflight`(발송 중)가 같은 칸을 쓴다. 셋을 뭉뚱그려
   * "실패"라고 보고하면, 웹훅이 곧 처리할 건까지 사고로 읽혀 운영자가 매번 헛걸음한다 —
   * 건수는 함께 세되 본문에서 갈라 말한다.
   */
  const orderMailFailed = await db
    .select({ orderNo: orders.orderNo, notificationError: orders.notificationError })
    .from(orders)
    .where(isNotNull(orders.notificationError));

  if (orderMailFailed.length > 0) {
    const stuck = orderMailFailed.filter((row) => isNotificationSentinel(row.notificationError));
    const failed = orderMailFailed.filter((row) => !isNotificationSentinel(row.notificationError));
    issues.push({
      severity: 'medium',
      title: `확인 메일이 나가지 않은 주문 ${orderMailFailed.length}건`,
      detail: [
        ...(failed.length > 0
          ? [`- 발송 실패: ${failed.length}건 (${sample(failed.map((row) => row.orderNo))})`]
          : []),
        ...(stuck.length > 0
          ? [
              `- 발송이 시작되지 않았거나 도중에 멈춤: ${stuck.length}건 `
                + `(${sample(stuck.map((row) => row.orderNo))})`,
            ]
          : []),
        '관리자 > 예약·펀딩 상세에서 재발송할 수 있습니다.',
      ].join('\n'),
    });
  }

  /**
   * 해지·종료된 구독에 돈이 들어온 건 — **환불 판단이 필요한데 아무도 모르는 상태.**
   *
   * 청구 실패 → 고객 셀프 해지 → 수 시간 뒤 토스 DONE 웹훅이 도착하는 순서로 생긴다.
   * 승인 반영은 구독 상태를 보고 되살리지 않으므로(lib/billing/service.ts) 결제 기록만
   * paid로 남고 이용기간은 전진하지 않는다. 고객은 한 달치를 냈는데 이용은 끝나 있다.
   *
   * 그 순간 운영자에게 메일이 한 통 나가지만(alertLateApproval) 메일은 실패하거나 묻힐 수
   * 있다. 이 저장소가 PR #59에서 이미 배운 것이 그것이다 — 되돌림 경로가 한 겹뿐이면
   * 조용히 새고, 전자상거래법상 환불 기한은 그 사이에도 돈다. 여기가 두 번째 겹이다.
   *
   * **판정은 "종료 뒤에 들어온 돈"이다.** 상태만 보면(해지·종료 + paid 회차) 정상적으로
   * 끝난 구독도 종료 전에 정상 청구된 과거 회차 때문에 매일 다시 잡힌다 — 환불할 것이
   * 없는데 꺼지지 않는 경보이고, 방치 구독을 ended로 넘기는 경로가 생긴 뒤로는
   * (closeDormantSubscriptions, lib/privacy/orderRetention.ts) 그런 건이 계속 늘어난다.
   * 그래서 결제 시각(paid_at, 없으면 attempted_at)이 **구독이 끝난 시각보다 뒤**인 건만 센다.
   *
   * 끝난 시각은 `cancelled_at`, 없으면 `ends_at`, 그것도 없으면 `updated_at`이다. 셋째 폴백이
   * 필요한 이유: `closeDormantSubscriptions`는 앞의 둘을 **일부러 채우지 않는다**. 예전에는
   * `coalesce(cancelled_at, ends_at)`가 NULL이 되어 비교식 전체가 NULL이 되고, 방치로 종료한
   * 구독은 이 검사에서 **영구히** 빠졌다. "그 구독의 결제는 3년 넘게 전의 것"이라는 정당화는
   * 비교하는 값과 맞지 않았다 — 왼쪽은 `paid_at`이고, 뒤늦은 승인에서 그 값은 **지금**이다.
   * 실제 경로: `paused` 구독이 NETWORK_ERROR로 `pending` 회차를 남긴 채 방치 → `ended`로 전이
   * → 뒤늦은 토스 DONE 도착 → `reconcileSubscriptionPaymentFromToss`가 `paid_at = now`로 쓴다.
   * 구독 되살리기는 가드에 막혀 0행이라, 남는 것은 묻힐 수 있는 메일 한 통뿐이었다 —
   * 이 검사가 두 번째 겹으로 존재하는 이유가 바로 그 메일을 못 믿어서다.
   *
   * `updated_at`이 올바른 "끝난 시각"인 이유: `closeDormantSubscriptions`가 그 값을 갱신하지
   * 않으므로 마지막 활동 시각 그대로 남는다. 오탐도 늘지 않는다 — 정상 해지는 `cancelled_at`이
   * 있어 셋째 폴백에 닿지 않고, 정상 청구는 같은 `now`로 `subscriptions.updated_at`을 함께
   * 쓰므로 `paid_at > updated_at`이 성립하지 않는다.
   *
   * 해소 조건: 전액 환불하면 orders.status가 refunded로 바뀌어 빠진다(부분환불은 잔액이 남아 계속 뜬다).
   * 되살릴 이유가 있었다면 구독이 다시 active가 되어 역시 빠진다.
   */
  const lateApproval = await db
    .select({ orderNo: orders.orderNo, customerName: subscriptions.customerName, status: subscriptions.status })
    .from(subscriptionPayments)
    .innerJoin(orders, eq(orders.id, subscriptionPayments.orderId))
    .innerJoin(subscriptions, eq(subscriptions.id, subscriptionPayments.subscriptionId))
    // partially_refunded도 본다 — 관리자가 회차를 임의 금액으로 환불할 수 있게 되면서, 1원만 환불해도
    // paid에서 벗어나 경보가 꺼지는 구멍이 생겼다. 잔액이 남아 있는 한 고객 돈은 아직 우리에게 있다.
    .where(and(
      inArray(orders.status, ['paid', 'partially_refunded']),
      inArray(subscriptions.status, ['cancelled', 'ended']),
      // 셋째 폴백 `updated_at`이 방치 종료 구독을 받는다(위 주석). 세 값이 모두 NULL인 구독은
      // 없다 — `updated_at`은 NOT NULL에 기본값이 있다(db/schema.ts).
      sql`coalesce(${subscriptionPayments.paidAt}, ${subscriptionPayments.attemptedAt}) > coalesce(${subscriptions.cancelledAt}, ${subscriptions.endsAt}, ${subscriptions.updatedAt})`,
    ));

  if (lateApproval.length > 0) {
    issues.push({
      severity: 'high',
      href: '/admin/subscriptions',
      title: `구독이 끝난 뒤에 들어온 결제 ${lateApproval.length}건 — 환불 판단 필요`,
      detail:
        `주문번호: ${sample(lateApproval.map((row) => row.orderNo))}\n` +
        '고객은 한 달치를 냈는데 구독은 끝나 있습니다. 관리자 > 구독 상세의 회차 이력에서 환불할 수 있습니다.\n' +
        '전액 환불하면 이 항목은 자동으로 사라집니다.',
    });
  }

  /**
   * 자동 재개 안내가 나가지 못하고 있다 — **예고 없는 청구로 이어진다.**
   *
   * 정지 기한이 끝나 자동 재개된 구독은 다음 정기 청구일에 청구된다. 그 날짜를 적은 안내
   * 메일이 청구보다 먼저 나가는 것이 "예고 없이 카드를 긁지 않는다"의 전부다
   * (`lib/billing/service.ts`의 `resumeExpiredPauses`). 발송은 매일 재시도되지만,
   * 계속 실패하면 첫 청구일이 그대로 온다.
   *
   * ## 기준이 하루인 이유 — **크론 두 개의 시각 차까지 계산에 넣는다**
   *
   * 처음엔 `MIN_RESUME_NOTICE_DAYS`(3일)로 잡았는데, 그러면 **정작 가장 위험한 경우에만
   * 안 떴다.** 이 점검은 08:00 KST, 청구는 09:00 KST에 돈다(`vercel.json`). 최소 예고
   * 바닥에 걸려 첫 청구가 재개 +3일인 구독은 표시가 D+0 09:00에 찍히므로, D+3 08:00
   * 점검에서 기준선(D+0 08:00)보다 **한 시간 뒤**라 걸리지 않는다. 한 시간 뒤 09:00 청구가
   * 그대로 긁고, 성공하면 표시가 지워져 경보는 영영 안 뜬다.
   *
   * 하루로 잡으면 산수가 닫힌다. 표시 시각을 T라 하면 첫 청구는 아무리 빨라도 T+3일이고
   * (`MIN_RESUME_NOTICE_DAYS`), 이 점검은 매일 돌므로 T+1일을 넘는 첫 실행은 늦어도
   * T+2일이다. **청구까지 최소 하루가 남는다.** 그 시점이면 첫 발송과 다음 날 재시도가
   * 둘 다 실패한 뒤라 일시적 오류로 보기도 어렵다.
   *
   * 심각도가 `high`인 이유는 남은 수습 수단이 사람뿐이기 때문이다(운영자가 직접 연락하거나
   * 다시 정지한다).
   */
  const RESUME_NOTICE_STALE_DAYS = 1;
  const staleResumeNotices = await db
    .select({ id: subscriptions.id, nextBillingAt: subscriptions.nextBillingAt })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'active'),
        isNotNull(subscriptions.resumeNoticePendingAt),
        lt(subscriptions.resumeNoticePendingAt, new Date(now.getTime() - RESUME_NOTICE_STALE_DAYS * 24 * 60 * 60 * 1000)),
      ),
    );

  if (staleResumeNotices.length > 0) {
    issues.push({
      severity: 'high',
      href: '/admin/subscriptions',
      title: `자동 재개 안내가 나가지 못한 구독 ${staleResumeNotices.length}건 — 예고 없이 청구됩니다`,
      detail: [
        `구독 id: ${sample(staleResumeNotices.map((row) => row.id))}`,
        '정지 기한이 끝나 자동으로 재개됐지만 "다음 결제 예정일" 안내 메일이 계속 실패하고 있습니다. '
          + '청구 크론이 매일 다시 시도하는데도 남아 있다는 뜻입니다.',
        '고객에게 직접 알리거나, 지금은 청구하지 않아야 하면 관리자 > 구독 상세에서 다시 정지해 주세요.',
      ].join('\n'),
    });
  }

  /**
   * 운영자가 세워 둔 구독이 곧 방치로 자동 종료된다 — **되돌릴 수 없는 유일한 전이**다.
   *
   * `closeDormantSubscriptions`(`lib/privacy/orderRetention.ts`)는 3년 넘게 아무 활동이 없는
   * `paused`를 `ended`로 넘긴다. 결제 실패로 세워진 구독에는 맞는 처리지만, 운영자가 청구만
   * 멈춰 둔 구독은 카드가 살아 있는 정상 구독이다. 한 번 `ended`가 되면 `resumeSubscription`은
   * `paused`만 받고 관리자 '결제' 버튼도 `ended`를 제외해 **되살릴 길이 없다.**
   *
   * 그렇다고 운영자 정지를 방치 대상에서 빼면 그 구독의 개인정보가 기한 없이 남아 개인정보
   * 보호법 제21조①에 어긋난다. 그래서 대상에서 빼는 대신 **닫히기 전에 알린다** — 이 항목이
   * 그 알림이고, 여기가 유일한 방어다.
   *
   * 판정은 파기 쪽과 **같은 식**을 쓴다 — 기준선은 `dormancyWarningBoundary`, 활동 조건
   * 넷은 `dormantActivityCondition`이고 둘 다 `lib/privacy/orderRetention.ts`가 준다.
   * 상태와 사유만 이 검사가 따로 건다(파기는 `pending_card`도 닫지만 그것은 알릴 일이 아니다).
   * 조건식이 갈라져 있으면 `updated_at`을 올리지 않는 전이가 하나 생기는 날 두 집합이
   * 어긋난다 — 경보 없는 종료가 되거나, 파기되지 않아 **끌 수 없는 매일 경보**가 된다.
   *
   * **`paused_reason`이 NULL인 행도 함께 본다.** 컬럼 도입 전에 정지된 행에는 값이 없고 어느
   * 쪽이었는지 되살릴 방법이 없다(`db/schema.ts`). 틀렸을 때의 대가가 한쪽으로만 크다 —
   * 놓치면 살아 있는 구독이 경고 없이 닫히고, 반대로 틀리면 이미 죽은 구독의 경보가 한 줄
   * 더 뜰 뿐이다.
   *
   * 파기 크론은 한 달에 한 번(`/api/cron/purge-orders`, 매달 3일) 돌고 이 점검은 매일 도므로,
   * 경보는 실제 종료보다 최소 `SUBSCRIPTION_DORMANCY_WARNING_DAYS`일 먼저 뜬다. 해소 조건은
   * 재개·해지 — 어느 쪽이든 `updated_at`이 올라 방치 판정에서 빠진다.
   *
   * **고객 이름·연락처는 싣지 않는다.** 운영자가 갈 곳(구독 id)만 있으면 되고, 메일 본문에
   * 평문 개인정보를 늘릴 이유가 없다.
   *
   * ## `paused_until`이 생긴 뒤에도 이 경보를 남겨 두는 이유
   *
   * 이제 운영자 정지는 만료일을 필수로 받고 그날 `resumeExpiredPauses`가 되돌리므로
   * (`lib/billing/service.ts`), 새로 만들어지는 정지가 3년 방치에 닿는 일은 사실상 없다.
   * 그래도 남는 길이 둘이다 — 만료일 없이 세워진 **옛 행**, 그리고 자동 재개가 계속 실패해
   * 정지가 풀리지 않는 경우(그 실패는 청구 cron 요약 메일로도 뜨지만, 메일 한 통을 놓치면
   * 여기가 다시 유일한 방어다). 자동화가 생겼다고 마지막 방어를 걷으면 그 자동화가 멈춘
   * 날에 예전 사고가 그대로 돌아온다.
   */
  const dormancyWarning = await db
    .select({ id: subscriptions.id, pausedReason: subscriptions.pausedReason })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'paused'),
        or(eq(subscriptions.pausedReason, 'operator'), isNull(subscriptions.pausedReason)),
        dormantActivityCondition(dormancyWarningBoundary(now)),
      ),
    );

  if (dormancyWarning.length > 0) {
    const unknown = dormancyWarning.filter((row) => row.pausedReason === null).length;
    issues.push({
      severity: 'high',
      href: '/admin/subscriptions',
      title: `곧 자동 종료되는 정지 구독 ${dormancyWarning.length}건 — 되살릴 수 없습니다`,
      detail: [
        `구독 id: ${sample(dormancyWarning.map((row) => row.id))}`,
        `마지막 활동으로부터 ${SUBSCRIPTION_DORMANCY_YEARS}년이 지나면 방치로 보고 자동 종료합니다 `
          + `(개인정보 파기 크론, 매달 3일). 종료된 구독은 재개도 수동 결제도 할 수 없습니다.`,
        ...(unknown > 0
          ? [
              `- 이 중 ${unknown}건은 정지 사유가 기록되기 전에 정지된 구독이라 결제 실패인지 `
                + '운영자 정지인지 알 수 없습니다. 놓치는 쪽이 위험해 함께 알립니다.',
            ]
          : []),
        '계속 쓸 구독이면 관리자 > 구독 상세에서 재개하고, 끝난 구독이면 해지해 주세요. 어느 쪽이든 이 항목은 사라집니다.',
      ].join('\n'),
    });
  }

  /** 계약 알림 실패 — 고객이 서명 요청이나 완료 메일을 못 받았다. */
  const contractMailFailed = await db
    .select({ id: contracts.id, customerName: contracts.customerName })
    .from(contracts)
    .where(isNotNull(contracts.notificationError));

  if (contractMailFailed.length > 0) {
    issues.push({
      severity: 'medium',
      href: '/admin/contracts',
      title: `알림이 나가지 않은 계약 ${contractMailFailed.length}건`,
      detail:
        `대상: ${sample(contractMailFailed.map((row) => row.customerName))}\n` +
        '관리자 > 계약 상세에서 재발송할 수 있습니다.',
    });
  }

  /**
   * 돈은 들어왔는데 주문이 미결제로 남은 건. 관리자 목록의 mismatch와 같은 판정이며,
   * 토스 콘솔과 대조해야 하는 유일한 유형이라 별도로 센다.
   */
  const paymentMismatch = await db
    .select({ orderNo: orders.orderNo })
    .from(orders)
    .where(
      and(
        sql`${orders.status} in ('pending', 'failed', 'expired')`,
        sql`exists (select 1 from payments where payments.order_id = ${orders.id})`,
      ),
    );

  if (paymentMismatch.length > 0) {
    issues.push({
      severity: 'high',
      title: `결제 기록과 주문 상태가 어긋난 주문 ${paymentMismatch.length}건`,
      detail:
        `주문번호: ${sample(paymentMismatch.map((row) => row.orderNo))}\n` +
        '토스 콘솔에서 실제 결제·취소 상태를 확인한 뒤 처리해 주세요.',
    });
  }

  /**
   * 무통장 후원자가 셀프 취소를 요청했는데 돈이 아직 안 나간 건. 무통장은 자동 환불
   * 경로가 없어 refundRequestedAt만 찍히고 orders.status는 paid로 남으므로(설계상 옳다 —
   * 운영자가 계좌로 송금해야 한다), 아무도 안 보면 약관 제10조가 약속한 "청약철회
   * 접수일부터 3영업일 이내 환불"을 조용히 넘긴다. 그 사이 이 건은 발송 CSV에도 실린다.
   *
   * 기한 계산은 영업일이 아니라 48시간으로 한다. 저장소에 영업일·공휴일 계산이 아예
   * 없고(한국 공휴일표가 필요하다), 여기서 필요한 것은 정확한 법정 기한이 아니라
   * **3영업일을 넘기기 전에 울리는 알람**이다. 이 점검은 크론이 하루 한 번 돌리므로
   * 실제 경보 시점은 48~72시간 사이다 — 금요일 접수 건이 최악(토·일이 영업일이 아니라
   * 3영업일 기한은 수요일인데 경보는 일요일)이고, 어느 요일이든 기한 전에 울린다.
   * 대기 중(medium) 항목은 48시간 전에도 매일 보고되므로 첫 알림은 그보다 빠르다.
   *
   * 대상 상태는 REFUND_PENDING_ORDER_STATUSES 하나에서 온다 — 관리자 목록 배지·배너와
   * 같은 집합이어야 화면과 메일이 같은 건수를 말한다.
   */
  const REFUND_DUE_MS = 48 * 60 * 60 * 1000;
  const refundPending = await db
    .select({ orderNo: orders.orderNo, requestedAt: fundingPledges.refundRequestedAt })
    .from(fundingPledges)
    .innerJoin(orders, eq(orders.id, fundingPledges.orderId))
    .where(and(isNotNull(fundingPledges.refundRequestedAt), inArray(orders.status, [...REFUND_PENDING_ORDER_STATUSES])));

  if (refundPending.length > 0) {
    const overdue = refundPending.filter(
      (row) => row.requestedAt !== null && now.getTime() - row.requestedAt.getTime() >= REFUND_DUE_MS,
    );
    issues.push({
      severity: overdue.length > 0 ? 'high' : 'medium',
      href: '/admin/funding',
      title:
        overdue.length > 0
          ? `환불 기한이 임박한 취소 요청 ${overdue.length}건 (대기 ${refundPending.length}건)`
          : `계좌 환불을 기다리는 취소 요청 ${refundPending.length}건`,
      detail:
        `주문번호: ${sample((overdue.length > 0 ? overdue : refundPending).map((row) => row.orderNo))}\n` +
        '무통장이라 돈이 자동으로 나가지 않습니다. 관리자 > 펀딩 상세에서 환불을 처리해 주세요.\n' +
        '처리 전까지 이 펀딩은 발송 대상이 아닙니다 — 관리자 CSV의 shipHold 칸과 개설자 배송 목록·CSV의 ' +
        '"발송 금지" 칸에 "발송금지"로 나오고, ' +
        '발송 상태 변경은 API에서 막힙니다.',
    });
  }

  /**
   * **환불액이 결제액에 닿았는데 주문은 아직 살아 있는 건.**
   *
   * 이 상태는 저절로 생긴다. 셀프 취소가 주문을 refunded로 선점한 뒤 토스 호출이
   * 타임아웃하면 되돌리는데, 그 사이 CANCELED 웹훅이 진짜 환불을 기록했을 수 있다.
   * 지금은 되돌림에 가드가 있어(lib/funding/cancel.ts) 그 조합을 막지만, 가드가 닿지
   * 않는 경로로도 같은 어긋남은 생길 수 있다 — 토스 콘솔에서 손으로 취소하면 웹훅만
   * 환불을 남기고 우리 상태는 paid 그대로다.
   *
   * 어긋난 채 남으면 아무도 모른다. 공개 모금액에 환불된 돈이 계속 잡히고, 그 후원자가
   * 음원을 계속 받고(isLiveFundingOrderStatus가 참), 발송 명단에도 남는다. 관리자 목록의
   * 불일치 배지는 이걸 못 본다 — 거기 허용 목록에 paid가 들어 있다.
   */
  const refundedButLive = await db
    .select({ orderNo: orders.orderNo, status: orders.status, totalAmount: orders.totalAmount, refunded: sql<number>`COALESCE(SUM(${refunds.amount}), 0)` })
    .from(orders)
    .innerJoin(fundingPledges, eq(fundingPledges.orderId, orders.id))
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .innerJoin(refunds, and(eq(refunds.paymentId, payments.id), eq(refunds.status, 'done')))
    .where(inArray(orders.status, [...LIVE_FUNDING_ORDER_STATUSES]))
    .groupBy(orders.id)
    .having(sql`COALESCE(SUM(${refunds.amount}), 0) >= ${orders.totalAmount}`);

  if (refundedButLive.length > 0) {
    issues.push({
      severity: 'high',
      href: '/admin/funding',
      title: `전액 환불됐는데 주문이 살아 있는 펀딩 ${refundedButLive.length}건`,
      detail:
        `주문번호: ${sample(refundedButLive.map((row) => row.orderNo))}\n` +
        '환불 기록은 결제액에 닿았는데 주문 상태가 아직 paid/partially_refunded입니다. ' +
        '이 상태로 두면 공개 모금액에 환불된 돈이 남고, 그 서포터가 음원을 계속 받으며, 발송 명단에도 남습니다.\n' +
        '토스 콘솔에서 실제 취소 여부를 확인한 뒤 관리자 > 펀딩 상세에서 상태를 맞춰 주세요.',
    });
  }

  /**
   * **같은 slug가 파일과 DB에 둘 다 있는 프로젝트.**
   *
   * 읽는 입구(lib/funding/repository.ts)에서 파일이 이긴다. 승인된 DB 프로젝트와 같은
   * slug의 md가 나중에 추가되면 파일이 그 자리를 가져가는데, 후원 집계는 문자열
   * `fp.project_slug`로 도므로 기존 후원의 모금액·실명·응원 메시지가 새 파일 프로젝트에
   * 합산된다. 리워드 id가 다르면 한정 재고가 0에서 재시작해 초과 판매되고, 기존 후원자는
   * 후원 확인 페이지에서 내려받기를 잃는다. 개설자 저장·관리자 승인의 충돌 가드는
   * DB→파일 방향뿐이라 이 순서를 막지 못한다.
   *
   * **CI에는 DB가 없어 검사할 수 없다** — 그래서 여기서 본다. 오류도 안 나고 화면도
   * 멀쩡해 보이므로, 알리지 않으면 아무도 모른다.
   */
  const fileSlugs = new Set(getAllFundingProjects().map((project) => project.slug));
  if (fileSlugs.size > 0) {
    const approvedDbSlugs = await db
      .select({ slug: fundingProjects.slug })
      .from(fundingProjects)
      .where(eq(fundingProjects.reviewStatus, 'approved'));
    const collided = approvedDbSlugs.map((row) => row.slug).filter((slug) => fileSlugs.has(slug));
    if (collided.length > 0) {
      issues.push({
        severity: 'high',
        href: '/admin/funding/projects',
        title: `같은 slug가 파일과 DB에 둘 다 있는 펀딩 프로젝트 ${collided.length}건`,
        detail:
          `slug: ${sample(collided)}\n` +
          '읽는 입구에서 파일이 이깁니다. 기존 후원의 모금액·실명·응원 메시지가 파일 프로젝트에 합산되고, ' +
          '리워드 id가 다르면 한정 재고가 0에서 재시작해 초과 판매됩니다. 기존 후원자는 내려받기를 잃습니다.\n' +
          'content/funding/<slug>.md를 지우거나 한쪽 slug를 바꿔 주세요 — 후원이 이미 들어온 쪽의 slug는 바꾸지 마세요.',
      });
    }
  }

  /**
   * **아직 안 보낸 리워드인데 고객 연락처가 곧 지워질 펀딩.**
   *
   * 두 파기가 서로 다른 것을 본다 — lib/funding/retention.ts는 delivered_at이 없으면(아직
   * 안 보냈으면) 배송지를 지우지 않는다. lib/privacy/orderRetention.ts의
   * purgeExpiredOrderCustomerData는 그것과 무관하게 결제 5년 뒤 orders의 고객 이름·연락처·
   * 이메일을 지운다(펀딩만이 아니라 모든 주문 타입이 쓰는 공용 함수라 펀딩만 예외를 두면
   * booking·contracts에 회귀 위험이 생긴다 — 그래서 그 함수는 건드리지 않는다).
   *
   * 둘이 만나면 "배송지는 있는데 연락할 방법이 없는" 행이 생긴다 — 보낼 수도, 환불
   * 여부를 물어볼 수도 없다. 결제 후 5년이 다가오도록 안 보낸 리워드가 있다는 뜻이므로,
   * 고객 정보가 지워지기 전에 사람이 판단해야 한다(지금이라도 보내거나, 환불하거나,
   * 손으로 남겨 두거나). 90일 여유를 두는 이유는 이 점검이 하루 한 번만 돌기 때문이다.
   */
  const CUSTOMER_PURGE_DUE_MS = ORDER_LEGAL_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000;
  const CUSTOMER_PURGE_WARNING_MS = 90 * 24 * 60 * 60 * 1000;
  const undeliveredNearingPurge = await db
    .select({ orderNo: orders.orderNo, paidAt: fundingPledges.paidAt })
    .from(fundingPledges)
    .innerJoin(orders, eq(orders.id, fundingPledges.orderId))
    .where(
      and(
        isNull(fundingPledges.deliveredAt),
        isNotNull(fundingPledges.paidAt),
        inArray(orders.status, [...LIVE_FUNDING_ORDER_STATUSES]),
        lt(fundingPledges.paidAt, new Date(now.getTime() - CUSTOMER_PURGE_DUE_MS + CUSTOMER_PURGE_WARNING_MS)),
      ),
    );

  if (undeliveredNearingPurge.length > 0) {
    issues.push({
      severity: 'medium',
      href: '/admin/funding',
      title: `아직 발송하지 않은 채 고객 정보 파기가 다가온 펀딩 ${undeliveredNearingPurge.length}건`,
      detail:
        `주문번호: ${sample(undeliveredNearingPurge.map((row) => row.orderNo))}\n` +
        `결제 후 ${ORDER_LEGAL_RETENTION_YEARS}년이 되면 고객 이름·연락처·이메일이 지워집니다. ` +
        '아직 리워드를 안 보낸 상태로 그 시점이 90일 안으로 다가왔습니다 — ' +
        '지금 발송하거나, 환불하거나, 계속 보관할지 관리자 > 펀딩 상세에서 판단해 주세요.',
    });
  }

  /**
   * **기록된 정산액과 지금 계산한 값이 어긋난 프로젝트.**
   *
   * `funding_project_payouts`는 불변이다(기록 시점의 숫자가 이체 근거다). 그런데 기록 뒤에
   * 환불이 들어오면 실제로 나가야 할 돈이 줄어드는데, 그 차이를 보여 주는 곳이 관리자 상세
   * 패널 하나뿐이었다 — 이체 대기 중인 정산을 기록값대로 보내면 과다 이체가 된다.
   *
   * 판정은 화면과 같은 함수(`buildFundingPayoutPreview`)로 다시 계산한 `netAmount`다. 한
   * 프로젝트씩 조회하므로 정산이 기록된 프로젝트 수만큼 도는데, 이 표는 프로젝트당 한 행이고
   * 지금 몇 건 규모다 — 수백 건이 되면 집계 쿼리 한 방으로 바꿀 자리다.
   *
   * **`pending`인 정산만 본다.** 이미 이체한(`paid`) 정산 뒤에 환불이 들어오면 이 항목은
   * 끌 수단이 없어 매일 영구히 울린다 — 경보 피로로 신호가 죽는 것이 이 저장소가 반복해서
   * 막아 온 실패 모드다. 그리고 그건 다른 문제다: 이체 전이면 "보낼 금액을 고쳐라"이고,
   * 이체 뒤면 "과다 지급한 몫을 회수하라"다. 후자를 알리려면 회수 진행 상태를 담는 자리가
   * 먼저 있어야 하는데 그런 컬럼이 없다. 여기서 섞지 않는다.
   */
  const recordedPayouts = await db
    .select({ projectId: fundingProjectPayouts.projectId, netAmount: fundingProjectPayouts.netAmount })
    .from(fundingProjectPayouts)
    .where(eq(fundingProjectPayouts.status, 'pending'));
  const payoutDrift: string[] = [];
  for (const row of recordedPayouts) {
    const preview = await buildFundingPayoutPreview(row.projectId);
    if (!preview) continue;
    if (preview.netAmount !== row.netAmount) {
      payoutDrift.push(
        `${preview.projectSlug}: 기록 ${row.netAmount.toLocaleString('ko-KR')}원 → 현재 ${preview.netAmount.toLocaleString('ko-KR')}원`,
      );
    }
  }

  if (payoutDrift.length > 0) {
    issues.push({
      severity: 'high',
      href: '/admin/funding',
      title: `기록된 정산액과 현재 계산값이 다른 프로젝트 ${payoutDrift.length}건`,
      detail:
        `${sample(payoutDrift)}
` +
        // 원인을 단정하지 않는다 — 환불 말고 세금 유형 변경으로도 갈린다(savePayoutSection은
        // 원천징수액이 0인 정산만 있는 개설자의 invoice→withholding 전환을 막지 않는다).
        '기록 뒤 환불 또는 세금 유형 변경으로 계산값이 달라졌습니다. 기록값 그대로 이체하면 ' +
        '금액이 어긋납니다 — 관리자 > 펀딩 상세의 정산 패널에서 차이를 확인하고 이체 금액을 ' +
        '판단해 주세요.',
    });
  }

  /**
   * 발송했는데 서명되지 않은 채 기한이 지난 계약. 고객이 링크를 놓쳤을 수 있는데,
   * 지금은 관리자가 목록을 열어야만 보인다.
   */
  const staleUnsigned = await db
    .select({ customerName: contracts.customerName })
    .from(contracts)
    .where(and(eq(contracts.status, 'sent'), lt(contracts.expiresAt, now)));

  if (staleUnsigned.length > 0) {
    issues.push({
      severity: 'medium',
      href: '/admin/contracts',
      title: `서명 기한이 지난 계약 ${staleUnsigned.length}건`,
      detail:
        `대상: ${sample(staleUnsigned.map((row) => row.customerName))}\n` +
        '고객이 링크를 놓쳤을 수 있습니다. 재발송하거나 계약을 취소해 주세요.',
    });
  }

  return sortBySeverity(issues);
};

const sortBySeverity = (issues: HealthIssue[]): HealthIssue[] => {
  const order = { high: 0, medium: 1 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
};

export const runHealthCheck = async (now: Date = new Date()): Promise<HealthReport> => {
  const issues: HealthIssue[] = [];

  issues.push(...(await checkCalendar(now)));

  const fieldKey = checkFieldCryptoKey();
  if (fieldKey) issues.push(fieldKey);

  /**
   * 카카오 전환율 급락 — 2026-08-13~23 사고(트래픽 정상인데 전환율만 7.5%→1.1%로
   * 붕괴, 원인 불명·무알림) 재발 방지. GA4 env가 없으면 skip(정상), GA4 호출 자체가
   * 죽으면 "점검이 죽은 것"이므로 throw해 기존 catch 경로가 운영자에게 알리게 둔다.
   */
  const leadRate = await runLeadRateCheck();
  issues.push(...leadRate.issues);

  issues.push(...(await collectDbIssues(now)));

  return { issues: sortBySeverity(issues), checkedAt: now };
};

/** 메일 본문. 이상이 없으면 호출하지 않는다. */
export const formatHealthReport = (report: HealthReport): string => {
  const lines = report.issues.map((issue, index) => {
    const mark = issue.severity === 'high' ? '[긴급]' : '[확인]';
    return `${index + 1}. ${mark} ${issue.title}\n   ${issue.detail.replace(/\n/g, '\n   ')}`;
  });

  return [
    '스튜디오 놀 운영 점검에서 처리가 필요한 항목을 찾았습니다.',
    '',
    ...lines,
    '',
    // 운영자가 읽는 메일이므로 UTC ISO가 아니라 KST로 적는다.
    `점검 시각: ${new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(report.checkedAt)} (KST)`,
    '이 메일은 이상이 있을 때만 발송됩니다.',
  ].join('\n');
};
