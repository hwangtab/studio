import { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { Button } from '../../../../components/ui/Button';
import { formatPriceAmount } from '../../../../data/pricing';
import { getMixingProduct } from '../../../../lib/booking/mixing-products';
import { getProduct } from '../../../../lib/booking/products';
import { computeRefund, REFUND_POLICY_LINES } from '../../../../lib/booking/refund-policy';
import { findOrderByOrderNo } from '../../../../lib/booking/service';
import { isTokenMatch } from '../../../../lib/booking/token';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';
type WorkOrderStatus = 'pending' | 'received' | 'in_progress' | 'delivered' | 'cancelled';

interface RefundQuote {
  daysBefore: number;
  rate: number;
  refundAmount: number;
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
}

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

type ManagePageProps = SessionManageProps | MixingManageProps;

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

/** 취소 API 호출·환불 안내·에러 처리 — 세션·믹싱 공용(pages/api/bookings/cancel.ts 인터페이스 불변). */
function useCancelFlow(orderNo: string, token: string, refundQuote: RefundQuote | null) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [refundResult, setRefundResult] = useState<number | null>(null);

  const cancel = async (onSuccess: () => void) => {
    const confirmMessage = refundQuote
      ? `취소하시겠습니까?\n환불 예정 금액: ${formatPriceAmount(refundQuote.refundAmount)}원\n(실제 환불 금액은 취소 처리 시점 기준으로 다시 계산됩니다)`
      : '취소하시겠습니까?';
    if (!window.confirm(confirmMessage)) return;

    setCancelling(true);
    setCancelError(null);

    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo, token }),
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

  return { cancelling, cancelError, refundResult, cancel };
}

function PriceBox({ itemAmount, vatAmount, totalAmount }: { itemAmount: number; vatAmount: number; totalAmount: number }) {
  return (
    <div className="mt-6 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-700 dark:text-gray-300">
      <p>
        상품가 {formatPriceAmount(itemAmount)}원 + VAT {formatPriceAmount(vatAmount)}원 ={' '}
        <span className="font-semibold text-gray-900 dark:text-white">
          합계 {formatPriceAmount(totalAmount)}원
        </span>
      </p>
    </div>
  );
}

function CancelSection({
  refundQuote,
  cancelling,
  cancelError,
  onCancel,
}: {
  refundQuote: RefundQuote;
  cancelling: boolean;
  cancelError: string | null;
  onCancel: () => void;
}) {
  return (
    <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        지금 취소하면 {formatPriceAmount(refundQuote.refundAmount)}원 환불
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        실제 환불 금액은 취소 처리 시점 기준으로 다시 계산됩니다.
      </p>

      <div className="mt-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">환불 규정</p>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
          {REFUND_POLICY_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {cancelError && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300"
        >
          {cancelError}
        </p>
      )}

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          disabled={cancelling}
          onClick={onCancel}
        >
          {cancelling ? '취소 처리 중...' : '주문 취소'}
        </Button>
      </div>
    </div>
  );
}

function SessionManageView(props: SessionManageProps) {
  const { orderNo, token, productName, startAt, durationHours, itemAmount, vatAmount, totalAmount, bookingStatus, canCancel, refundQuote } = props;
  const [status, setStatus] = useState<BookingStatus>(bookingStatus);
  const { cancelling, cancelError, refundResult, cancel } = useCancelFlow(orderNo, token, refundQuote);
  const showCancelSection = status === 'confirmed' && canCancel;

  return (
    <>
      <Head>
        <title>예약 확인 · {orderNo} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <h1 className="typo-page-title">예약 확인</h1>
        <p className="mt-1 mb-8 text-sm text-gray-500 dark:text-gray-400">주문번호 {orderNo}</p>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="typo-card-subtitle text-gray-900 dark:text-white">{productName}</h2>
            <span className="shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
              {STATUS_LABELS[status]}
            </span>
          </div>

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

          <PriceBox itemAmount={itemAmount} vatAmount={vatAmount} totalAmount={totalAmount} />

          {status !== 'confirmed' &&
            (refundResult !== null ? (
              <div className="mt-6 rounded-md bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-800 dark:text-green-300">
                취소가 완료되었습니다. 환불 금액: {formatPriceAmount(refundResult)}원 (결제 수단으로 환불,
                카드사에 따라 3~5영업일 소요됩니다)
              </div>
            ) : (
              <div className="mt-6 rounded-md bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-600 dark:text-gray-300">
                {STATUS_NOTICES[status]}
              </div>
            ))}

          {status === 'confirmed' && !canCancel && (
            <div className="mt-6 rounded-md bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-600 dark:text-gray-300">
              이용 일시가 지난 예약입니다. 변경·취소가 필요하면 아래 연락처로 문의해 주세요.
            </div>
          )}

          {showCancelSection && refundQuote && (
            <CancelSection
              refundQuote={refundQuote}
              cancelling={cancelling}
              cancelError={cancelError}
              onCancel={() => cancel(() => setStatus('cancelled'))}
            />
          )}
        </section>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">문의: 스튜디오 놀 010-4255-7893</p>
        <Link href="/ko" className="mt-2 inline-block text-sm text-primary hover:underline">
          홈으로
        </Link>
      </main>
    </>
  );
}

function MixingManageView(props: MixingManageProps) {
  const { orderNo, token, productName, songCount, vocalTuning, itemAmount, vatAmount, totalAmount, workOrderStatus, canCancel, refundQuote } = props;
  const [status, setStatus] = useState<WorkOrderStatus>(workOrderStatus);
  const { cancelling, cancelError, refundResult, cancel } = useCancelFlow(orderNo, token, refundQuote);
  const showCancelSection = status === 'received' && canCancel;

  return (
    <>
      <Head>
        <title>주문 확인 · {orderNo} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <h1 className="typo-page-title">주문 확인</h1>
        <p className="mt-1 mb-8 text-sm text-gray-500 dark:text-gray-400">주문번호 {orderNo}</p>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="typo-card-subtitle text-gray-900 dark:text-white">{productName}</h2>
            <span className="shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
              {WORK_ORDER_STATUS_LABELS[status]}
            </span>
          </div>

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

          <PriceBox itemAmount={itemAmount} vatAmount={vatAmount} totalAmount={totalAmount} />

          {status !== 'received' &&
            (refundResult !== null ? (
              <div className="mt-6 rounded-md bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-800 dark:text-green-300">
                취소가 완료되었습니다. 환불 금액: {formatPriceAmount(refundResult)}원 (결제 수단으로 환불,
                카드사에 따라 3~5영업일 소요됩니다)
              </div>
            ) : (
              <div className="mt-6 rounded-md bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-600 dark:text-gray-300">
                {WORK_ORDER_STATUS_NOTICES[status]}
              </div>
            ))}

          {showCancelSection && refundQuote && (
            <CancelSection
              refundQuote={refundQuote}
              cancelling={cancelling}
              cancelError={cancelError}
              onCancel={() => cancel(() => setStatus('cancelled'))}
            />
          )}
        </section>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">문의: 스튜디오 놀 010-4255-7893</p>
        <Link href="/ko" className="mt-2 inline-block text-sm text-primary hover:underline">
          홈으로
        </Link>
      </main>
    </>
  );
}

export default function BookingManagePage(props: ManagePageProps) {
  return props.kind === 'mixing' ? <MixingManageView {...props} /> : <SessionManageView {...props} />;
}

export const getServerSideProps: GetServerSideProps<ManagePageProps> = async (context) => {
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
      },
    };
  }

  const booking = order.bookings[0];
  if (!booking) {
    return { notFound: true };
  }

  const product = getProduct(booking.productId);
  const canCancel = booking.status === 'confirmed' && booking.startAt.getTime() > now.getTime();
  const refundQuote = canCancel ? computeRefund(order.totalAmount, booking.startAt, now) : null;

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
    },
  };
};
