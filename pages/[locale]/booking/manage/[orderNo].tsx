/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 관리 토큰·paymentKey·orderId가 실린다)의 이탈 링크는 next/link가
 * 아니라 문서 이동이어야 한다. 클라 전환으로 공개 페이지에 나갔다 뒤로가기 하면, 그 사이
 * mount된 gtag가 살아 있는 채로 비밀값이 붙은 URL에 돌아와 page_view를 보낸다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트:
 * tests/pages/privateLinkNavigation.test.ts
 */
import { useState } from 'react';
import { withI18nServerProps } from '../../../../lib/getStatic';
import Head from 'next/head';

import { Button } from '../../../../components/ui/Button';
import { Badge, type BadgeTone } from '../../../../components/ui/Badge';
import { Notice } from '../../../../components/ui/Notice';
import { Panel } from '../../../../components/ui/Panel';
import { PageHeader, PageShell } from '../../../../components/ui/PageHeader';
import PriceBreakdown from '../../../../components/booking/PriceBreakdown';
import { formatPriceAmount } from '../../../../data/pricing';
import { getMixingProduct } from '../../../../lib/booking/mixing-products';
import { getProduct } from '../../../../lib/booking/products';
import { computeRefund, refundPolicyFor, REFUND_POLICY_LINES } from '../../../../lib/booking/refund-policy';
import { findOrderByOrderNo } from '../../../../lib/booking/service';
import { isTokenMatch } from '../../../../lib/booking/token';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { bookingDepositGuideProps } from '../../../../lib/booking/bankDeposit';
import { bankDepositStateOf, type BankDepositState } from '../../../../lib/payments/bankDeposit';
import BankDepositGuide from '../../../../components/payments/BankDepositGuide';
import RefundAccountFields, {
  EMPTY_REFUND_ACCOUNT,
  isRefundAccountFilled,
  type RefundAccountValue,
} from '../../../../components/payments/RefundAccountFields';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';
type WorkOrderStatus = 'pending' | 'received' | 'in_progress' | 'delivered' | 'cancelled';

interface RefundQuote {
  daysBefore: number;
  rate: number;
  refundAmount: number;
}

/**
 * 계좌 입금 — 세션·믹싱 공통 props. `bankDeposit`은 서버(취소 API)와 같은 bankDepositStateOf로 판정한다.
 * 입금 대기면 `depositGuide`로 계좌 안내를 그리고 "입금 전 신청 취소"를 두며, 입금이 확인된 주문의 취소는
 * 환불 계좌를 함께 받는다(토스에 돌려줄 결제가 없다).
 */
interface BankDepositProps {
  bankDeposit: BankDepositState | null;
  depositGuide: { amount: number; deadline: string; customerName: string; applicantLabel: string } | null;
}

interface SessionManageProps {
  kind: 'session';
  orderNo: string;
  /** 쿼리에서 받은 토큰을 그대로 취소 요청에 재사용한다 — order.manageToken 자체는 절대 내려보내지 않는다. */
  token: string;
  productName: string;
  /** Date는 getServerSideProps props로 직렬화할 수 없어 ISO 문자열로 내린다. */
  startAt: string;
  durationHours: number;
  itemAmount: number;
  vatAmount: number;
  totalAmount: number;
  bookingStatus: BookingStatus;
  /** SSR 시점 기준 "지금 취소 가능"(confirmed && 미래). 취소 성공 이후 화면 전환은 status로만 판단한다. */
  canCancel: boolean;
  refundQuote: RefundQuote | null;
  /** 상품별 환불 규정 — 위저드·취소 계산과 같은 refundPolicyFor()에서 온다. */
  refundLines: readonly string[];
}
type SessionPageProps = SessionManageProps & BankDepositProps;

interface MixingManageProps {
  kind: 'mixing';
  orderNo: string;
  token: string;
  productName: string;
  songCount: number;
  vocalTuning: boolean;
  itemAmount: number;
  vatAmount: number;
  totalAmount: number;
  workOrderStatus: WorkOrderStatus;
  /** 착수 전(received)에만 고객 셀프 취소 가능 — 계획서 §3. */
  canCancel: boolean;
  refundQuote: RefundQuote | null;
}
type MixingPageProps = MixingManageProps & BankDepositProps;

type ManagePageProps = SessionPageProps | MixingPageProps;

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: '결제 대기',
  confirmed: '예약 확정',
  completed: '이용 완료',
  no_show: '노쇼 처리',
  cancelled: '취소됨',
};

const STATUS_NOTICES: Record<Exclude<BookingStatus, 'confirmed'>, string> = {
  pending: '결제가 아직 확인되지 않았습니다. 결제가 완료되면 예약이 확정됩니다.',
  completed: '이용이 완료된 예약입니다.',
  no_show: '노쇼로 처리된 예약입니다. 문의사항은 아래 연락처로 연락해 주세요.',
  cancelled: '이 예약은 취소되었습니다.',
};

const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending: '결제 대기',
  received: '접수됨',
  in_progress: '작업 중',
  delivered: '납품 완료',
  cancelled: '취소됨',
};

const WORK_ORDER_STATUS_NOTICES: Record<Exclude<WorkOrderStatus, 'received'>, string> = {
  pending: '결제가 아직 확인되지 않았습니다. 결제가 완료되면 주문이 접수됩니다.',
  in_progress: '작업이 시작되어 온라인 취소가 불가합니다. 문의 010-4255-7893',
  delivered: '납품이 완료된 주문입니다.',
  cancelled: '이 주문은 취소되었습니다.',
};

/** 상태 배지 색 — 살아 있는 예약·주문은 success, 돈을 기다리는 상태는 warning, 끝난 것은 neutral. */
const BOOKING_STATUS_TONES: Record<BookingStatus, BadgeTone> = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'neutral',
  no_show: 'neutral',
  cancelled: 'neutral',
};
const WORK_ORDER_STATUS_TONES: Record<WorkOrderStatus, BadgeTone> = {
  pending: 'warning',
  received: 'success',
  in_progress: 'info',
  delivered: 'neutral',
  cancelled: 'neutral',
};

/**
 * '2026-09-10T05:00:00.000Z' → '2026.09.10 (목) 14:00'
 * 한국은 DST가 없어 +9시간 고정 오프셋으로 충분하다(lib/booking/email.ts kstTimeLabel과 동일 방식).
 * 예약 시작 시각은 항상 정시라 분은 표기하지 않는다.
 */
const formatKstDateTime = (isoString: string): string => {
  const kst = new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][kst.getUTCDay()];
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  return `${y}.${m}.${d} (${weekday}) ${hh}:00`;
};

/**
 * 취소 API 호출·환불 안내·에러 처리 — 세션·믹싱 공용(pages/api/bookings/cancel.ts).
 * 계좌 입금 주문(`viaAccount`)은 환불 계좌를 함께 보낸다.
 */
function useCancelFlow(orderNo: string, token: string, refundQuote: RefundQuote | null, viaAccount: boolean) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [refundResult, setRefundResult] = useState<number | null>(null);
  const [refundAccount, setRefundAccount] = useState<RefundAccountValue>(EMPTY_REFUND_ACCOUNT);

  const cancel = async (onSuccess: () => void) => {
    const confirmMessage = refundQuote
      ? `취소하시겠습니까?\n환불 예정 금액: ${formatPriceAmount(refundQuote.refundAmount)}원${viaAccount && refundQuote.refundAmount > 0 ? `\n환불 계좌: ${refundAccount.bankName.trim()} ${refundAccount.accountHolder.trim()}` : ''}\n(실제 환불 금액은 취소 처리 시점 기준으로 다시 계산됩니다)`
      : '취소하시겠습니까?';
    if (!window.confirm(confirmMessage)) return;

    setCancelling(true);
    setCancelError(null);

    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo, token, ...(viaAccount ? { refundAccount } : {}) }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.message || '취소 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }

      setRefundResult(typeof result.refundAmount === 'number' ? result.refundAmount : 0);
      onSuccess();
    } catch (err: unknown) {
      setCancelError(
        err instanceof Error ? err.message : '취소 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setCancelling(false);
    }
  };

  return { cancelling, cancelError, refundResult, cancel, refundAccount, setRefundAccount };
}

/** 입금 전 신청 취소 — 받은 돈이 없어 환불이 아니다. 시간대·주문을 바로 풀고 메일은 가지 않는다. */
function useWithdraw(orderNo: string, token: string) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const withdraw = async (onSuccess: () => void) => {
    if (!window.confirm('입금 전 신청을 취소할까요? 이미 입금하셨다면 취소하지 말고 010-4255-7893으로 연락 주세요.')) return;
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNo, token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || '취소하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      onSuccess();
    } catch (err: unknown) {
      setWithdrawError(err instanceof Error ? err.message : '취소하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setWithdrawing(false);
    }
  };
  return { withdrawing, withdrawError, withdraw };
}

/**
 * 계좌 입금 대기 화면 — 계좌 안내(BankDepositGuide, 펀딩과 같은 부품)와 "입금 전 신청 취소". 취소하면
 * 안내를 걷고 닫힌 신청 문구로 바꾼다.
 */
function DepositWaitingSection({ orderNo, token, guide, kindLabel }: {
  orderNo: string; token: string; guide: NonNullable<BankDepositProps['depositGuide']>; kindLabel: string;
}) {
  const [closed, setClosed] = useState(false);
  const { withdrawing, withdrawError, withdraw } = useWithdraw(orderNo, token);
  if (closed) {
    return (
      <Notice tone="neutral" role="status" className="mt-6">
        신청을 취소했습니다. 받은 돈이 없어 환불할 금액은 없습니다.
      </Notice>
    );
  }
  return (
    <div className="mt-2">
      <BankDepositGuide amount={guide.amount} deadline={guide.deadline} customerName={guide.customerName} applicantLabel={guide.applicantLabel} />
      {withdrawError && <Notice tone="error" className="mt-4">{withdrawError}</Notice>}
      <Button type="button" variant="outline" fullWidth className="mt-8" disabled={withdrawing} onClick={() => withdraw(() => setClosed(true))}>
        {withdrawing ? '처리 중...' : `입금 전 ${kindLabel} 취소`}
      </Button>
    </div>
  );
}

const DEPOSIT_CLOSED_NOTICE =
  '이 계좌 입금 신청은 입금 전에 취소되었습니다. 이미 입금하셨다면 010-4255-7893 · hello@studionol.co.kr로 알려 주세요 — 확인해 돌려드립니다.';

/** 취소 완료 문구 — 토스 결제는 결제 수단으로, 계좌 입금은 적어 주신 계좌로 3영업일 이내. */
const refundDoneMessage = (amount: number, viaAccount: boolean): string =>
  viaAccount
    ? amount > 0
      ? `취소가 완료되었습니다. 환불 금액 ${formatPriceAmount(amount)}원을 적어 주신 계좌로 접수일부터 3영업일 이내에 보내 드립니다.`
      : '취소가 완료되었습니다. 환불 규정에 따라 돌려드릴 금액이 없습니다.'
    : `취소가 완료되었습니다. 환불 금액: ${formatPriceAmount(amount)}원 (결제 수단으로 환불, 카드사에 따라 3~5영업일 소요됩니다)`;

function CancelSection({
  refundQuote,
  cancelling,
  cancelError,
  onCancel,
  // 상품별 규정. 세션 뷰가 refundPolicyFor()로 넘긴다. 기본값은 예전 동작(세션 규정) 보존용.
  refundLines = REFUND_POLICY_LINES,
  account,
}: {
  refundQuote: RefundQuote;
  cancelling: boolean;
  cancelError: string | null;
  onCancel: () => void;
  refundLines?: readonly string[];
  /** 계좌 입금 주문 — 돌려줄 돈이 있으면 환불 계좌를 받는다(채우기 전에는 버튼이 닫힌다). */
  account?: { value: RefundAccountValue; onChange: (next: RefundAccountValue) => void } | null;
}) {
  const needsAccount = Boolean(account) && refundQuote.refundAmount > 0;
  return (
    <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        지금 취소하면 {formatPriceAmount(refundQuote.refundAmount)}원 환불
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        실제 환불 금액은 취소 처리 시점 기준으로 다시 계산됩니다.
      </p>

      <Panel title="환불 규정" className="mt-3">
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-600 dark:text-gray-400">
          {refundLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Panel>

      {needsAccount && account && (
        <div className="mt-4">
          <RefundAccountFields idPrefix="booking-refund" value={account.value} onChange={account.onChange} />
        </div>
      )}

      {cancelError && <Notice tone="error" className="mt-4">{cancelError}</Notice>}

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          disabled={cancelling || (needsAccount && !!account && !isRefundAccountFilled(account.value))}
          onClick={onCancel}
        >
          {cancelling ? '취소 처리 중...' : needsAccount ? '이 계좌로 환불받고 취소' : '주문 취소'}
        </Button>
      </div>
    </div>
  );
}

function SessionManageView(props: SessionPageProps) {
  const { orderNo, token, productName, startAt, durationHours, itemAmount, vatAmount, totalAmount, bookingStatus, canCancel, refundQuote, refundLines, bankDeposit, depositGuide } = props;
  const [status, setStatus] = useState<BookingStatus>(bookingStatus);
  const viaAccount = bankDeposit === 'paid';
  const { cancelling, cancelError, refundResult, cancel, refundAccount, setRefundAccount } = useCancelFlow(orderNo, token, refundQuote, viaAccount);
  const showCancelSection = status === 'confirmed' && canCancel;

  return (
    <>
      <Head>
        <title>예약 확인 · {orderNo} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>

      <PageShell>
        {/* 사이트 헤더를 두르지 않는 화면이라(components/Layout.tsx의 isPrivatePaymentPage)
            여기가 브랜드를 밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 어디서 온
            화면인지 알 수 있어야 한다. */}
        <p className="typo-card-meta">스튜디오 놀</p>
        <PageHeader title="예약 확인" meta={<span>주문번호 {orderNo}</span>} />

        <section className="glass-card rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="typo-card-subtitle text-gray-900 dark:text-white">{productName}</h2>
            <Badge size="md" tone={depositGuide ? 'warning' : BOOKING_STATUS_TONES[status]} className="shrink-0">
              {depositGuide ? '입금 대기' : STATUS_LABELS[status]}
            </Badge>
          </div>

          {depositGuide && <DepositWaitingSection orderNo={orderNo} token={token} guide={depositGuide} kindLabel="예약 신청" />}

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">이용 일시</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{formatKstDateTime(startAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">이용 시간</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{durationHours}시간</dd>
            </div>
          </dl>

          <PriceBreakdown amounts={{ itemAmount, vatAmount, totalAmount }} label={productName} className="mt-6" />

          {status !== 'confirmed' && !depositGuide &&
            (refundResult !== null ? (
              <Notice tone="success" className="mt-6">{refundDoneMessage(refundResult, viaAccount)}</Notice>
            ) : (
              <Notice tone="neutral" className="mt-6">
                {bankDeposit === 'cancelled' ? DEPOSIT_CLOSED_NOTICE : STATUS_NOTICES[status]}
              </Notice>
            ))}

          {status === 'confirmed' && !canCancel && (
            <Notice tone="neutral" className="mt-6">
              이용 일시가 지난 예약입니다. 변경·취소가 필요하면 아래 연락처로 문의해 주세요.
            </Notice>
          )}

          {showCancelSection && refundQuote && (
            <CancelSection
              refundQuote={refundQuote}
              refundLines={refundLines}
              cancelling={cancelling}
              cancelError={cancelError}
              onCancel={() => cancel(() => setStatus('cancelled'))}
              account={viaAccount ? { value: refundAccount, onChange: setRefundAccount } : null}
            />
          )}
        </section>

        <ManageFooter />
      </PageShell>
    </>
  );
}

/** 카드 아래 연락처와 이탈 링크 — 세션·믹싱 뷰가 같은 꼬리를 쓴다. */
function ManageFooter() {
  return (
    <>
      <p className="mt-6 typo-card-meta">문의: 스튜디오 놀 010-4255-7893</p>
      {/* 이탈 링크 두 가지 규칙(lib/analytics/privatePaths.ts):
          1. 문서 이동(`<a href>`) — next/link 클라 전환으로 나갔다가 뒤로가기를 누르면,
             그 사이 mount된 gtag가 비밀값이 붙은 이 URL로 page_view를 보낸다.
          2. 공개 목적지에는 `rel="noreferrer"` — 사이트 Referrer-Policy가
             strict-origin-when-cross-origin이라 **동일 출처 이동에는 전체 URL**을 보낸다.
             없으면 도착지 gtag가 page_referrer에 토큰·paymentKey를 실어 보낸다.
             private→private 링크(관리·입금 안내)는 도착지도 측정 대상이 아니라 불필요. */}
      <Button asChild variant="ghost" size="sm" className="mt-2 -ml-3">
        <a href="/ko" rel="noreferrer">홈으로</a>
      </Button>
    </>
  );
}

function MixingManageView(props: MixingPageProps) {
  const { orderNo, token, productName, songCount, vocalTuning, itemAmount, vatAmount, totalAmount, workOrderStatus, canCancel, refundQuote, bankDeposit, depositGuide } = props;
  const [status, setStatus] = useState<WorkOrderStatus>(workOrderStatus);
  const viaAccount = bankDeposit === 'paid';
  const { cancelling, cancelError, refundResult, cancel, refundAccount, setRefundAccount } = useCancelFlow(orderNo, token, refundQuote, viaAccount);
  const showCancelSection = status === 'received' && canCancel;

  return (
    <>
      <Head>
        <title>주문 확인 · {orderNo} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>

      <PageShell>
        {/* 사이트 헤더를 두르지 않는 화면이라(components/Layout.tsx의 isPrivatePaymentPage)
            여기가 브랜드를 밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 어디서 온
            화면인지 알 수 있어야 한다. */}
        <p className="typo-card-meta">스튜디오 놀</p>
        <PageHeader title="주문 확인" meta={<span>주문번호 {orderNo}</span>} />

        <section className="glass-card rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="typo-card-subtitle text-gray-900 dark:text-white">{productName}</h2>
            <Badge size="md" tone={depositGuide ? 'warning' : WORK_ORDER_STATUS_TONES[status]} className="shrink-0">
              {depositGuide ? '입금 대기' : WORK_ORDER_STATUS_LABELS[status]}
            </Badge>
          </div>

          {depositGuide && <DepositWaitingSection orderNo={orderNo} token={token} guide={depositGuide} kindLabel="주문 신청" />}

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">상품</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{productName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">곡 수</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{songCount}곡</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">보컬 튜닝</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{vocalTuning ? '포함' : '미포함'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">진행 상태</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{WORK_ORDER_STATUS_LABELS[status]}</dd>
            </div>
          </dl>

          <PriceBreakdown amounts={{ itemAmount, vatAmount, totalAmount }} label={productName} className="mt-6" />

          {status !== 'received' && !depositGuide &&
            (refundResult !== null ? (
              <Notice tone="success" className="mt-6">{refundDoneMessage(refundResult, viaAccount)}</Notice>
            ) : (
              <Notice tone="neutral" className="mt-6">
                {bankDeposit === 'cancelled' ? DEPOSIT_CLOSED_NOTICE : WORK_ORDER_STATUS_NOTICES[status]}
              </Notice>
            ))}

          {showCancelSection && refundQuote && (
            <CancelSection
              refundQuote={refundQuote}
              cancelling={cancelling}
              cancelError={cancelError}
              onCancel={() => cancel(() => setStatus('cancelled'))}
              account={viaAccount ? { value: refundAccount, onChange: setRefundAccount } : null}
            />
          )}
        </section>

        <ManageFooter />
      </PageShell>
    </>
  );
}

export default function BookingManagePage(props: ManagePageProps) {
  return props.kind === 'mixing' ? <MixingManageView {...props} /> : <SessionManageView {...props} />;
}

export const getServerSideProps = withI18nServerProps<ManagePageProps>(async (context) => {
  // 예약 관리 페이지는 개인정보(일시·금액·연락 상태)를 담는다. next.config.mjs의
  // `/:locale(ko|en|zh|es|vi|th|uz)/:path*` 규칙이 이 경로에도 공유 캐시 헤더를 붙이므로
  // (contracts sign 페이지와 같은 문제 — lib/contracts/page-cache.ts 주석 참조) 렌더 이전에
  // 덮어써야 한다. 구현이 순수하게 헤더만 세팅하는 범용 함수라 도메인을 넘어 재사용한다.
  denyContractPageCaching(context.res);

  const { locale, orderNo } = context.params as { locale: string; orderNo: string };
  if (locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { token } = context.query;

  // 토큰 없음·불일치·주문 부재를 전부 같은 notFound로 답한다 — 구분해 알려주면 orderNo
  // 존재 여부를 토큰 없이도 확인하는 창구가 된다(pages/api/bookings/cancel.ts와 동일 원칙).
  if (typeof orderNo !== 'string' || orderNo.trim() === '' || typeof token !== 'string' || token.trim() === '') {
    return { notFound: true };
  }

  const order = await findOrderByOrderNo(orderNo);
  if (!order || !isTokenMatch(order.manageToken, token)) {
    return { notFound: true };
  }

  const now = new Date();
  // 계좌 입금 — 취소 API(pages/api/bookings/cancel.ts)와 같은 판정. 입금 대기면 금액·기한을 서버가 다시 읽는다.
  const bankDeposit = bankDepositStateOf(order);
  const depositGuide = bankDeposit === 'awaiting' ? bookingDepositGuideProps(order) : null;

  if (order.type === 'mixing') {
    const workOrder = order.workOrders[0];
    if (!workOrder) return { notFound: true };

    const product = getMixingProduct(workOrder.productId);
    // 착수 전(received)에만 고객 셀프 취소 — 계획서 §3(작업 착수 후 온라인 취소 불가).
    const canCancel = workOrder.status === 'received';
    // 전액 환불 — 날짜 기준 단계가 없어 REFUND_TIERS(computeRefund)를 쓰지 않는다.
    const refundQuote = canCancel
      ? { daysBefore: 0, rate: 1, refundAmount: order.totalAmount }
      : null;

    return {
      props: {
        kind: 'mixing',
        orderNo: order.orderNo,
        token,
        productName: product?.nameKo ?? workOrder.serviceType,
        songCount: workOrder.songCount,
        vocalTuning: workOrder.vocalTuning,
        itemAmount: order.itemAmount,
        vatAmount: order.vatAmount,
        totalAmount: order.totalAmount,
        workOrderStatus: workOrder.status,
        canCancel,
        refundQuote,
        bankDeposit,
        depositGuide,
      },
    };
  }

  const booking = order.bookings[0];
  if (!booking) {
    return { notFound: true };
  }

  const product = getProduct(booking.productId);
  const canCancel = booking.status === 'confirmed' && booking.startAt.getTime() > now.getTime();
  const refundPolicy = refundPolicyFor(product);
  const refundQuote = canCancel ? computeRefund(order.totalAmount, booking.startAt, now, refundPolicy.tiers) : null;

  return {
    props: {
      kind: 'session',
      orderNo: order.orderNo,
      token,
      productName: product?.nameKo ?? booking.serviceType,
      startAt: booking.startAt.toISOString(),
      durationHours: booking.durationHours,
      itemAmount: order.itemAmount,
      vatAmount: order.vatAmount,
      totalAmount: order.totalAmount,
      bookingStatus: booking.status,
      canCancel,
      refundQuote,
      refundLines: [...refundPolicy.lines],
      bankDeposit,
      depositGuide,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
BookingManagePage.designEdition = 'v2';
