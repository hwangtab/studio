import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, contracts, orders } from '../../db/schema';
import { fetchBusyRanges } from '../booking/gcal';
import { runLeadRateCheck } from './leadRateCheck';

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

export const runHealthCheck = async (now: Date = new Date()): Promise<HealthReport> => {
  const db = getDb();
  const issues: HealthIssue[] = [];

  const calendar = await checkCalendar(now);
  if (calendar) issues.push(calendar);

  /**
   * 카카오 전환율 급락 — 2026-08-13~23 사고(트래픽 정상인데 전환율만 7.5%→1.1%로
   * 붕괴, 원인 불명·무알림) 재발 방지. GA4 env가 없으면 skip(정상), GA4 호출 자체가
   * 죽으면 "점검이 죽은 것"이므로 throw해 기존 catch 경로가 운영자에게 알리게 둔다.
   */
  const leadRate = await runLeadRateCheck();
  issues.push(...leadRate.issues);

  /**
   * 결제·확정은 정상인데 구글 캘린더에 이벤트가 없는 예약. 운영자 캘린더에는 그 시간이
   * 비어 있으므로, 그대로 두면 같은 시간에 전화 예약을 받아 오프라인 이중예약이 난다.
   */
  const gcalFailed = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(isNotNull(bookings.gcalError), eq(bookings.status, 'confirmed')));

  if (gcalFailed.length > 0) {
    issues.push({
      severity: 'high',
      title: `구글 캘린더에 등록되지 않은 확정 예약 ${gcalFailed.length}건`,
      detail:
        '결제는 정상이지만 캘린더에는 이 시간이 비어 있습니다. 같은 시간에 전화 예약을 받으면 겹칩니다.\n' +
        '관리자 > 예약에서 재시도하거나 캘린더에 직접 넣어 주세요.',
    });
  }

  /**
   * 확인 메일이 실패한 예약. 고객은 예약 확인·취소 링크를 받지 못한 상태다
   * (완료 화면에도 링크를 띄우도록 고쳤지만, 그 화면을 닫은 뒤에는 메일이 유일한 경로다).
   */
  const orderMailFailed = await db
    .select({ orderNo: orders.orderNo })
    .from(orders)
    .where(isNotNull(orders.notificationError));

  if (orderMailFailed.length > 0) {
    issues.push({
      severity: 'medium',
      title: `확인 메일이 나가지 않은 예약 ${orderMailFailed.length}건`,
      detail: `주문번호: ${sample(orderMailFailed.map((row) => row.orderNo))}`,
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
      title: `서명 기한이 지난 계약 ${staleUnsigned.length}건`,
      detail:
        `대상: ${sample(staleUnsigned.map((row) => row.customerName))}\n` +
        '고객이 링크를 놓쳤을 수 있습니다. 재발송하거나 계약을 취소해 주세요.',
    });
  }

  const order = { high: 0, medium: 1 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return { issues, checkedAt: now };
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
