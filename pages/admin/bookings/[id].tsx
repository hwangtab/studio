import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import {
  refundBooking,
  resendBookingNotification,
  setBookingStatus,
  setWorkOrderStage,
  type BookingActionResult,
} from '../../../components/admin/bookingActions';
import { Button } from '../../../components/ui/Button';
import { Field, TextArea, TextInput } from '../../../components/ui/Field';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { getDb } from '../../../db/client';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatPriceAmount } from '../../../data/pricing';
import {
  serializeBookingDetailForAdmin,
  type AdminBookingDetail,
} from '../../../lib/booking/admin-serialize';
import { formatKstDateTime, formatKstDateTimeFull } from '../../../lib/booking/format';

interface AdminBookingDetailPageProps {
  booking: AdminBookingDetail;
}

export const getServerSideProps: GetServerSideProps<AdminBookingDetailPageProps> = async (
  context,
) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { id } = context.query;
  if (typeof id !== 'string') {
    return { notFound: true };
  }

  const order = await getDb().query.orders
    .findFirst({
      where: (ordersTable, { eq }) => eq(ordersTable.id, id),
      with: { bookings: true, payments: { with: { refunds: true } }, workOrders: true },
    })
    .catch((error: unknown) => {
      console.error('[admin/bookings/[id]] Failed to load order:', error);
      return null;
    });

  if (!order) {
    return { notFound: true };
  }

  return {
    props: {
      booking: serializeBookingDetailForAdmin(order),
    },
  };
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '결제대기',
  paid: '결제완료',
  partially_refunded: '부분환불',
  refunded: '환불완료',
  failed: '결제실패',
  expired: '만료',
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  confirmed: '확정',
  completed: '완료',
  no_show: '노쇼',
  cancelled: '취소',
};

const BOOKING_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  no_show: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-600',
};

/** work_orders 상태 라벨 — index.tsx와 같은 어휘(계획서 §4: 접수됨/작업 중/납품 완료/취소됨). */
const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '결제대기',
  received: '접수됨',
  in_progress: '작업 중',
  delivered: '납품 완료',
  cancelled: '취소됨',
};

const WORK_ORDER_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  received: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  delivered: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-gray-200 text-gray-600',
};

const REFUND_REQUESTER_LABELS: Record<string, string> = {
  customer: '고객',
  admin: '관리자',
  webhook: '웹훅',
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  done: '완료',
  failed: '실패',
};

const DescriptionRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="font-medium text-right">{value}</dd>
  </div>
);

export default function AdminBookingDetailPage({ booking }: AdminBookingDetailPageProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [refundAmount, setRefundAmount] = useState<number>(booking.totalAmount);
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);

  const run = async (task: () => Promise<BookingActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;

    setBusy(true);
    setNotice(null);
    const result = await task();
    setBusy(false);

    if (!result.ok) {
      setNotice(result.message ?? '요청을 처리하지 못했습니다.');
    }
    // 실패해도 새로고침한다 — 거절 사유는 대개 화면이 낡았다는 뜻이다(contracts 관례와 동일).
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const handleComplete = () =>
    run(
      () => setBookingStatus(booking.id, 'completed'),
      '이 예약을 완료 처리할까요?',
    );

  const handleNoShow = () =>
    run(
      () => setBookingStatus(booking.id, 'no_show'),
      '이 예약을 노쇼로 처리할까요? 환불이 필요하면 별도로 임의 환불을 진행해 주세요.',
    );

  const handleResend = () => run(() => resendBookingNotification(booking.id));

  const handleStartWork = () =>
    run(
      () => setWorkOrderStage(booking.id, 'start_work'),
      '이 주문을 작업 중으로 변경할까요?',
    );

  const handleDeliver = () =>
    run(
      () => setWorkOrderStage(booking.id, 'deliver'),
      '이 주문을 납품 완료로 변경할까요?',
    );

  // components/admin/bookingActions.ts에 넣지 않고 여기 인라인으로 둔다 — 이번 작업의
  // 수정 허용 파일 목록에 그 파일이 없고(다른 에이전트가 동시에 만지는 파일들과 분리해
  // 두기 위한 경계), resendBookingNotification과 같은 fetch 패턴이라 그대로 옮겨 왔다.
  const handleRetryGcal = () =>
    run(async (): Promise<BookingActionResult> => {
      try {
        const response = await fetch(`/api/admin/bookings/${booking.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ action: 'retry-gcal' }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.ok) {
          return { ok: false, message: result?.message || '캘린더 재시도에 실패했습니다.' };
        }
        return { ok: true };
      } catch {
        return { ok: false, message: '네트워크 오류가 발생했습니다.' };
      }
    });

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setRefundError(null);

    if (!Number.isInteger(refundAmount) || refundAmount < 0 || refundAmount > booking.totalAmount) {
      setRefundError(`환불 금액은 0 ~ ${formatPriceAmount(booking.totalAmount)}원 사이의 정수여야 합니다.`);
      return;
    }
    if (refundReason.trim() === '') {
      setRefundError('환불 사유를 입력해 주세요.');
      return;
    }
    if (
      !window.confirm(
        `${formatPriceAmount(refundAmount)}원을 환불 처리할까요? 예약은 즉시 취소되며 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }

    await run(() => refundBooking(booking.id, refundAmount, refundReason.trim()));
  };

  const isMixing = booking.orderType === 'mixing';
  const workOrder = booking.workOrder;

  // 완료·노쇼·캘린더·재발송은 슬롯이 있는 세션 예약만의 개념(API도 믹싱엔 409를 준다).
  const canChangeStatus = !isMixing && booking.bookingStatus === 'confirmed';
  const canResend = !isMixing && booking.bookingStatus !== null && booking.bookingStatus !== 'pending';
  // 취소된 예약은 캘린더에 다시 등록할 이유가 없다 — API도 같은 가드를 둔다
  // (pages/api/admin/bookings/[id].ts retry-gcal).
  const canRetryGcal = !isMixing && booking.bookingStatus !== null && booking.bookingStatus !== 'cancelled';

  const canStartWork = isMixing && workOrder?.status === 'received';
  const canDeliver = isMixing && workOrder?.status === 'in_progress';
  // 임의 환불은 착수 전후 어디서든 가능(계획서 §4) — cancel.ts의 관리자 취소 조건과 같다.
  const canRefund = isMixing
    ? workOrder !== null && ['received', 'in_progress', 'delivered'].includes(workOrder.status)
    : canChangeStatus;

  return (
    <>
      <Head>
        <title>{booking.customerName}님 예약 상세 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">예약 상세</h1>
            <Link href="/admin/bookings" passHref>
              <Button light variant="outline">목록으로</Button>
            </Link>
          </div>

          {notice && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>
          )}

          {/* 결제 기록과 주문 상태의 불일치는 돈이 걸린 문제라 맨 위에 둔다(스펙 §10). */}
          {booking.mismatch && (
            <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">
              <strong className="block mb-1">결제 기록과 주문 상태 불일치 — 토스 콘솔 확인 필요</strong>
              주문 상태는 “{ORDER_STATUS_LABELS[booking.orderStatus] ?? booking.orderStatus}”인데 결제
              기록은 {booking.paymentCount}건입니다
              {booking.latestPaymentKeyPrefix && ` (최신 결제 ${booking.latestPaymentKeyPrefix}…)`}.
              <span className="block mt-2 text-red-700">
                토스 콘솔에서 실제 승인·취소 상태를 확인한 뒤, 필요하면 환불 또는 수동 정정을 진행해
                주세요.
              </span>
            </div>
          )}

          {/* gcalError·notificationError는 결제·환불은 정상 처리됐지만 후속 처리(캘린더 등록,
              메일 발송)만 실패한 경우다 — 미정합을 발견하려고 넣은 필드라 여기서 그대로 보여준다. */}
          {booking.notificationError && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
              <strong className="block mb-1">알림 발송에 실패했습니다</strong>
              {booking.notificationError}
              <span className="block mt-2 text-amber-700">
                고객이 예약 확정 또는 취소 메일을 받지 못했을 수 있습니다. 아래 “알림 재발송”을
                눌러 다시 보내 주세요.
              </span>
            </div>
          )}

          {booking.gcalError && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
              <strong className="block mb-1">구글 캘린더 동기화에 실패했습니다</strong>
              {booking.gcalError}
              <span className="block mt-2 text-amber-700">
                운영자는 구글 캘린더에 직접 일정을 넣지 않으므로, 이 예약 시간이 캘린더에
                비어 있으면 다른 일정이 겹칠 수 있습니다. 아래 “캘린더 재시도”를 눌러 다시
                등록해 주세요.
              </span>
              {canRetryGcal && (
                <Button light
                  variant="secondary"
                  disabled={busy}
                  onClick={handleRetryGcal}
                  className="mt-3"
                >
                  캘린더 재시도
                </Button>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="p-6 md:p-8 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    isMixing ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  {isMixing ? '믹싱·마스터링' : '세션 예약'}
                </span>
                {isMixing
                  ? workOrder && (
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${WORK_ORDER_STATUS_CLASS[workOrder.status]}`}
                      >
                        {WORK_ORDER_STATUS_LABELS[workOrder.status]}
                      </span>
                    )
                  : booking.bookingStatus && (
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${BOOKING_STATUS_CLASS[booking.bookingStatus]}`}
                      >
                        {BOOKING_STATUS_LABELS[booking.bookingStatus]}
                      </span>
                    )}
                <span className="text-gray-500 text-sm">
                  {ORDER_STATUS_LABELS[booking.orderStatus] ?? booking.orderStatus}
                </span>
                <span className="text-gray-400 text-xs font-mono">{booking.orderNo}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">고객 정보</h2>
                  <dl className="space-y-2 text-sm">
                    <DescriptionRow label="이름" value={booking.customerName} />
                    <DescriptionRow label="전화번호" value={booking.customerPhone} />
                    <DescriptionRow label="이메일" value={booking.customerEmail} />
                  </dl>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">
                    {isMixing ? '주문 정보' : '예약 정보'}
                  </h2>
                  <dl className="space-y-2 text-sm">
                    <DescriptionRow label="상품" value={booking.productName} />
                    {isMixing ? (
                      <>
                        <DescriptionRow label="곡 수" value={workOrder ? `${workOrder.songCount}곡` : '-'} />
                        <DescriptionRow
                          label="보컬 튜닝"
                          value={workOrder?.vocalTuning ? '포함' : '미포함'}
                        />
                        {workOrder?.startedAt && (
                          <DescriptionRow
                            label="착수일시"
                            value={formatKstDateTimeFull(workOrder.startedAt)}
                          />
                        )}
                        {workOrder?.deliveredAt && (
                          <DescriptionRow
                            label="납품일시"
                            value={formatKstDateTimeFull(workOrder.deliveredAt)}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <DescriptionRow label="일시" value={formatKstDateTime(booking.startAt)} />
                        <DescriptionRow
                          label="이용 시간"
                          value={booking.durationHours ? `${booking.durationHours}시간` : '-'}
                        />
                      </>
                    )}
                    {booking.cancelledAt && (
                      <DescriptionRow
                        label="취소일시"
                        value={formatKstDateTimeFull(booking.cancelledAt)}
                      />
                    )}
                  </dl>
                </div>
              </div>

              {booking.customerNote && (
                <div className="mt-6 pt-6 border-t border-gray-100 text-sm">
                  <h2 className="text-lg font-bold text-gray-900 mb-2">요청사항</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">{booking.customerNote}</p>
                </div>
              )}
            </div>

            <div className="p-6 md:p-8 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">결제 금액</h2>
              <dl className="space-y-2 text-sm">
                <DescriptionRow label="상품가" value={`${formatPriceAmount(booking.itemAmount)}원`} />
                <DescriptionRow label="VAT" value={`${formatPriceAmount(booking.vatAmount)}원`} />
                <DescriptionRow
                  label="합계"
                  value={<span className="text-base">{formatPriceAmount(booking.totalAmount)}원</span>}
                />
              </dl>

              {booking.payment && (
                <dl className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm">
                  <DescriptionRow label="결제 수단" value={booking.payment.method ?? '-'} />
                  <DescriptionRow
                    label="승인일시"
                    value={formatKstDateTimeFull(booking.payment.approvedAt)}
                  />
                  {booking.payment.receiptUrl && (
                    <DescriptionRow
                      label="영수증"
                      value={
                        <a
                          href={booking.payment.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          보기
                        </a>
                      }
                    />
                  )}
                </dl>
              )}
            </div>

            {booking.refunds.length > 0 && (
              <div className="p-6 md:p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4">환불 내역</h2>
                <div className="space-y-2">
                  {booking.refunds.map((refund) => (
                    <div
                      key={refund.id}
                      className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg text-sm"
                    >
                      <span>
                        {formatKstDateTimeFull(refund.createdAt)} ·{' '}
                        {REFUND_REQUESTER_LABELS[refund.requestedBy] ?? refund.requestedBy} ·{' '}
                        {refund.reason}
                      </span>
                      <span
                        className={`shrink-0 font-medium ${refund.status === 'done' ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {formatPriceAmount(refund.amount)}원 (
                        {REFUND_STATUS_LABELS[refund.status] ?? refund.status})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-8">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">작업</h2>
              <div className="flex flex-wrap gap-3">
                {canChangeStatus && (
                  <>
                    <Button light disabled={busy} onClick={handleComplete}>
                      완료 처리
                    </Button>
                    <Button light variant="outline" disabled={busy} onClick={handleNoShow}>
                      노쇼 처리
                    </Button>
                  </>
                )}

                {canStartWork && (
                  <Button light disabled={busy} onClick={handleStartWork}>
                    작업 시작
                  </Button>
                )}
                {canDeliver && (
                  <Button light disabled={busy} onClick={handleDeliver}>
                    납품 완료
                  </Button>
                )}

                {canResend && (
                  <Button light variant="secondary" disabled={busy} onClick={handleResend}>
                    알림 재발송
                  </Button>
                )}

                {!canChangeStatus && !canResend && !canStartWork && !canDeliver && (
                  <p className="text-sm text-gray-500">
                    {isMixing ? '지금 상태에서는 가능한 작업이 없습니다.' : '결제 대기 중인 예약에는 가능한 작업이 없습니다.'}
                  </p>
                )}
              </div>
            </div>

            {canRefund && (
              <div className="pt-6 border-t border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-1">임의 환불</h2>
                <p className="text-sm text-gray-500 mb-4">
                  {isMixing ? '주문을 취소하고' : '예약을 취소하고'} 지정한 금액을 환불합니다. 처리하면{' '}
                  {isMixing ? '주문은' : '예약은'} 즉시 취소 상태가 되며 되돌릴 수 없습니다.
                </p>

                <form onSubmit={handleRefund} className="space-y-3 max-w-md">
                  <Field
                    id="refund-amount"
                    label={`환불 금액 (원, 최대 ${formatPriceAmount(booking.totalAmount)})`}
                    error={refundError ?? undefined}
                    className={lightOnlyField}
                  >
                    <TextInput
                      type="number"
                      min={0}
                      max={booking.totalAmount}
                      step={1}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(Number(e.target.value))}
                      light className="text-sm"
                    />
                  </Field>
                  <Field id="refund-reason" label="환불 사유" className={lightOnlyField}>
                    <TextArea
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      rows={2}
                      placeholder="예: 고객 요청 — 개인 사정으로 취소"
                      light className="min-h-0 text-sm"
                    />
                  </Field>
                  <Button light type="submit" variant="outline" disabled={busy}>
                    환불 처리
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
