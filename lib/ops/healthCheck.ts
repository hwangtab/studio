import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { isNotificationSentinel } from './notificationSentinel';
import { bookings, contracts, fundingPledges, orders, payments, refunds, subscriptionPayments, subscriptions } from '../../db/schema';
import { fetchBusyRanges } from '../booking/gcal';
import { REFUND_PENDING_ORDER_STATUSES } from '../funding/policy';
import { LIVE_FUNDING_ORDER_STATUSES } from '../funding/refundable';
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
const checkCalendar = async (now: Date): Promise<HealthIssue | null> => {
  try {
    await fetchBusyRanges(now, new Date(now.getTime() + 24 * 60 * 60 * 1000));
    return null;
  } catch (error: unknown) {
    return {
      severity: 'high',
      title: '예약 캘린더를 조회할 수 없습니다 — 예약 퍼널이 멈춰 있습니다',
      detail:
        '고객이 날짜를 골라도 시간대가 뜨지 않습니다(전 슬롯 503). ' +
        'BOOKING_GCAL_ID·GOOGLE_SA_EMAIL·GOOGLE_SA_PRIVATE_KEY와 캘린더 공유 설정을 확인해 주세요.\n' +
        `사유: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * 필드 암호화 키가 실제로 쓸 수 있는 상태인지 — 주민등록번호를 저장·조회하는 유일한 수단이다.
 *
 * 키가 없거나 형식이 틀리면 원천징수 대상 개설자의 정산 정보 저장이 `encryption_unavailable`로
 * 통째로 거부되고(`savePayoutSection`), 이미 저장된 번호는 운영자가 조회해도 안 열린다.
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
          '주민등록번호 저장·조회가 정상 동작한다고 볼 수 없는 상태입니다. 배포 판본과 환경 변수를 확인해 주세요.',
      };
    }
    return null;
  } catch (error: unknown) {
    const code = error instanceof FieldCryptoError ? error.code : 'unknown';
    const state = code === 'missing_key' ? '없음' : code === 'invalid_key' ? '형식 이상' : '확인 실패';
    return {
      severity: 'high',
      title: `필드 암호화 키(${FIELD_CRYPTO_KEY_ENV}) ${state} — 주민등록번호를 저장·조회할 수 없습니다`,
      detail: [
        `상태: ${state} (code=${code})`,
        '개설자가 주민등록번호를 실제로 입력해 저장하면 그 저장이 계좌를 포함해 전부 거부됩니다 ' +
          '(칸을 비운 채 계좌만 고치는 저장은 키 없이도 됩니다). 이미 저장된 번호는 운영자 조회에서 ' +
          '열리지 않고, 그 개설자의 정산 기록은 resident_number_unreadable로 막힙니다 — 번호가 아예 ' +
          '없을 때 나오는 no_resident_number와 다른 코드입니다.',
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
  const gcalGap = await db
    .select({ id: bookings.id, gcalError: bookings.gcalError, gcalEventId: bookings.gcalEventId })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, 'confirmed'),
        or(isNotNull(bookings.gcalError), isNull(bookings.gcalEventId)),
      ),
    );

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
   * 구독은 이 검사에서 **영구히** 빠졌다. "그 구독의 결제는 1년 넘게 전의 것"이라는 정당화는
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
        '처리 전까지 이 펀딩은 발송 대상이 아닙니다 — 배송 CSV의 shipHold 칸에 "발송금지"로 나오고, ' +
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

  const calendar = await checkCalendar(now);
  if (calendar) issues.push(calendar);

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
