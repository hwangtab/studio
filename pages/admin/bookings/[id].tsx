import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import {
  recordLinkRefund,
  refundBooking,
  resendBookingNotification,
  setBookingStatus,
  setWorkOrderStage,
  type BookingActionResult,
} from '../../../components/admin/bookingActions';
import { bookingLineOf } from '../../../lib/booking/line';
import { AdminShell } from '../../../components/admin/AdminShell';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextArea, TextInput } from '../../../components/ui/Field';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { getDb } from '../../../db/client';
import { loadPaymentLinkOrderInfo } from '../../../lib/payments/paymentLinkOrders';
import { logAdminView } from '../../../lib/privacy/adminView';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatPriceAmount } from '../../../data/pricing';
import {
  canAdminRefund,
  LIVE_ORDER_STATUSES_FOR_REFUND,
  serializeBookingDetailForAdmin,
  type AdminBookingDetail,
} from '../../../lib/booking/admin-serialize';
import { formatKstDateTime, formatKstDateTimeFull } from '../../../lib/booking/format';
import { formatKstDeadline } from '../../../lib/payments/bankAccount';
import { findSameNameDepositOrders, type SameNameDepositOrder } from '../../../lib/payments/bankDepositOrders';
import { loadRefundAccountSummary } from '../../../lib/payments/refundAccount';
import { describeNotificationError } from '../../../lib/ops/notificationSentinel';

/** 환불 계좌 요약 — 은행명·예금주만. 계좌번호는 props에 싣지 않는다("계좌 보기"가 API로 가져온다). */
type RefundAccountSummaryProps =
  | { status: 'present'; bankName: string; accountHolder: string; updatedAt: string; refundedAt: string | null }
  | { status: 'none' }
  | { status: 'unavailable' };

interface AdminBookingDetailPageProps {
  booking: AdminBookingDetail;
  /** 같은 이름의 다른 계좌 입금 신청(입금 대기·입금 전 취소). 계좌 입금 대기·취소 건에서만 채운다. */
  sameNameDeposits?: SameNameDepositOrder[];
  refundAccount?: RefundAccountSummaryProps | null;
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

  // 열람 기록 — 고객 이름·연락처·이메일이 props로 실리는 화면이다(처리방침 19항). 없는 주문을 열려 한 것도 남기고, 값은 적지 않는다.
  await logAdminView(context, auth.actor, 'booking_view', id, order ? 'success' : 'not_found');

  if (!order) {
    return { notFound: true };
  }

  const linkInfo = order.type === 'deposit' ? (await loadPaymentLinkOrderInfo([order.orderNo])).get(order.orderNo) : undefined;
  const booking = serializeBookingDetailForAdmin(order, linkInfo);

  // 계좌 입금 건만 — 이름이 같은 다른 신청(이중 확인 방지)과 환불 계좌 요약(복호화 없음).
  const sameNameDeposits =
    booking.bankDeposit === 'awaiting' || booking.bankDeposit === 'cancelled'
      ? await findSameNameDepositOrders({ id: order.id, customerName: order.customerName })
      : [];
  let refundAccount: RefundAccountSummaryProps | null = null;
  // 예약금 결제 링크 주문은 환불 계좌 접수 화면이 없다(고객 관리 페이지가 없다) — 조회할 행이 없다.
  if (booking.bankDeposit === 'paid' && order.type !== 'deposit') {
    const summary = await loadRefundAccountSummary({
      kind: order.type === 'mixing' ? 'mixing' : 'session',
      orderNo: order.orderNo,
    });
    refundAccount =
      summary.status === 'present'
        ? {
            status: 'present',
            bankName: summary.bankName,
            accountHolder: summary.accountHolder,
            updatedAt: summary.updatedAt.toISOString(),
            refundedAt: summary.refundedAt ? summary.refundedAt.toISOString() : null,
          }
        : summary;
  }

  return { props: { booking, sameNameDeposits, refundAccount } };
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '결제대기',
  paid: '결제완료',
  partially_refunded: '부분환불',
  refunded: '환불완료',
  failed: '결제실패',
  expired: '만료',
  awaiting_deposit: '계좌 입금 대기',
  deposit_cancelled: '입금 전 취소',
  auto_cancel_pending: '자동 취소 처리 중',
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

/** 공백을 무시하고 같은 이름인가 — 예금주와 고객 이름 대조용(서버 holderMatchesCustomer와 같은 취지). */
const sameNameIgnoringSpace = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

interface RefundAccountView {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export default function AdminBookingDetailPage({
  booking,
  sameNameDeposits = [],
  refundAccount = null,
}: AdminBookingDetailPageProps) {
  const router = useRouter();
  const isBankPaid = booking.bankDeposit === 'paid';
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 문자열로 들고 제출 때 숫자로 바꾼다 — 숫자 상태에서는 칸을 비우면 Number('')이 0이 되어, 일반 취소(0원 허용)에서
  // 빈 칸이 "환불 없이 예약 취소"로 통과했다. 초기값은 총액이 아니라 잔액이다(부분환불 뒤 잔액 환불을 이어 갈 때 총액이 남아 있던 문제).
  const [refundInput, setRefundInput] = useState<string>(String(booking.refundableAmount));
  useEffect(() => {
    setRefundInput(String(booking.refundableAmount));
  }, [booking.refundableAmount]);
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

  const handleRevertStatus = () =>
    run(
      () => setBookingStatus(booking.id, 'confirmed'),
      '완료·노쇼 처리를 취소하고 확정 상태로 되돌릴까요? 되돌린 뒤에는 환불·취소를 진행할 수 있습니다.',
    );

  const handleNoShow = () =>
    run(
      () => setBookingStatus(booking.id, 'no_show'),
      '이 예약을 노쇼로 처리할까요? 처리하면 환불 화면이 닫힙니다. 환불이 필요하면 먼저 취소하거나, 처리 뒤 "확정으로 되돌리기"로 되돌린 다음 환불해 주세요.',
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

  /** 계좌 입금 작업 — 같은 POST 엔드포인트의 action만 다르다. 응답의 warnings는 화면에 드러낸다. */
  const postDepositAction = async (action: string, fallback: string): Promise<BookingActionResult> => {
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) return { ok: false, message: result?.message || fallback };
      const warnings: string[] = Array.isArray(result.warnings) ? result.warnings : [];
      // 성공해도 눈에 보이는 변화가 없으면 눌렀는지조차 알 수 없다(2026-10-20 "프리징 됐다") — 결과를 한 줄로 알린다.
      if (action === 'confirm_deposit') {
        const mail = result.emailSent === true ? '확정 메일을 보냈어요.' : result.emailSent === false ? '확정 메일 발송에 실패했어요 — 고객에게 직접 알려 주세요.' : '';
        return { ok: true, message: ['입금을 확인했어요.', mail, ...warnings].filter(Boolean).join(' ') };
      }
      if (action === 'cancel_unpaid_deposit') return { ok: true, message: '미입금 신청을 닫았어요.' };
      if (warnings.length > 0) return { ok: true, message: warnings.join(' / ') };
      if (action === 'resend_deposit_guide' && result.notificationError) {
        return { ok: true, message: '입금 안내 메일 발송에 실패했습니다. 고객에게 직접 연락해 주세요.' };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: '네트워크 오류가 발생했습니다.' };
    }
  };

  /** 성공이어도 message가 있으면(경고) 새로고침 뒤에도 보이도록 run과 따로 notice를 둔다. */
  const runDeposit = async (action: string, fallback: string, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setNotice(null);
    const result = await postDepositAction(action, fallback);
    setBusy(false);
    if (result.message) setNotice(result.message);
    await router.replace(router.asPath, undefined, { scroll: false });
    // 결과 안내가 화면 위쪽에 뜨므로 아래에서 누른 경우에도 보이게 올린다.
    if (result.message) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmDeposit = () =>
    runDeposit(
      'confirm_deposit',
      '입금 확인에 실패했습니다.',
      `통장에 실제로 입금됐는지 먼저 확인하세요.\n\n${booking.customerName} · ${formatPriceAmount(booking.totalAmount)}원\n입금 확인을 누르면 결제완료로 바뀌고 고객에게 확정 메일이 나갑니다.`,
    );
  const handleCancelUnpaid = () =>
    runDeposit(
      'cancel_unpaid_deposit',
      '미입금 취소에 실패했습니다.',
      '받은 돈이 없는 신청을 닫습니다 — 시간대가 풀리고 고객에게 메일은 가지 않습니다.\n\n계속할까요?',
    );
  const handleResendDepositGuide = () =>
    runDeposit(
      'resend_deposit_guide',
      '입금 안내 재발송에 실패했습니다.',
      `${booking.customerEmail}로 계좌 입금 안내 메일을 다시 보낼까요?`,
    );
  /** 결제 링크 이용 일정의 구글 캘린더 — 다시 등록(없으면 새로, 있으면 지우고 새로) / 지우기. */
  const runLinkCalendar = async (action: 'sync_link_calendar' | 'remove_link_calendar', confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setNotice(null);
    const result = await postDepositAction(action, '캘린더 처리에 실패했습니다.');
    setBusy(false);
    if (result.message) setNotice(result.message);
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const handleMarkRefundSent = () =>
    runDeposit('mark_refund_sent', '송금 완료 기록에 실패했습니다.', '환불 계좌로 송금을 마쳤나요?');

  /** 환불 계좌 — 누를 때만 가져와 이 화면 state에만 둔다(props·HTML에 싣지 않는다). */
  const [refundAccountView, setRefundAccountView] = useState<RefundAccountView | null>(null);
  const handleShowRefundAccount = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/orders/${booking.id}/refund-account`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.ok && result.account) {
        setRefundAccountView(result.account as RefundAccountView);
      } else {
        setNotice(result?.message || '환불 계좌를 불러오지 못했습니다.');
      }
    } catch {
      setNotice('네트워크 오류가 발생했습니다.');
    }
    setBusy(false);
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setRefundError(null);

    // 상한은 총액이 아니라 **잔액**이다 — cancel.ts validateOverrideAmount와 같은 기준.
    // 총액을 상한으로 두면 부분환불 이력이 있는 건에서 서버가 되돌리는 죽은 입력이 된다.
    //
    // 하한은 경로마다 다르다. 일반 취소의 0원은 유효한 액션이지만(0% 티어 당일 취소와 동형)
    // 이미 취소된 건의 잔액 환불에서 0원은 아무 일도 하지 않는다 — 서버도 거절한다.
    const minAmount = isRemainderRefund || isDeposit ? 1 : 0;
    if (refundInput.trim() === '') {
      setRefundError(isDeposit ? '환불 금액을 입력해 주세요.' : '환불 금액을 입력해 주세요. 환불 없이 취소하려면 0을 적어 주세요.');
      return;
    }
    const refundAmount = Number(refundInput);
    if (!Number.isInteger(refundAmount) || refundAmount < minAmount || refundAmount > booking.refundableAmount) {
      setRefundError(`환불 금액은 ${minAmount} ~ ${formatPriceAmount(booking.refundableAmount)}원 사이의 정수여야 합니다.`);
      return;
    }
    if (refundReason.trim() === '') {
      setRefundError('환불 사유를 입력해 주세요.');
      return;
    }
    if (
      !window.confirm(
        isDeposit && isBankPaid
          ? `계좌로 직접 입금받은 링크 주문입니다 — 이 화면은 송금을 하지 않고 기록만 남깁니다.\n\n${formatPriceAmount(refundAmount)}원 송금을 이미 마쳤다면 환불로 기록할까요? 되돌릴 수 없습니다.`
          : isDeposit
          ? `예약금 ${formatPriceAmount(refundAmount)}원을 환불할까요? 결제수단으로 취소되며 되돌릴 수 없습니다.`
          : isBankPaid
          ? `계좌 입금 건입니다 — 토스로 돌려주지 않습니다. 고객 계좌로 송금을 마친 뒤 기록하세요.\n\n${formatPriceAmount(refundAmount)}원 송금을 마쳤다면 환불로 기록할까요? 되돌릴 수 없습니다.`
          : isRemainderRefund
          ? `${formatPriceAmount(refundAmount)}원을 추가로 환불할까요? 되돌릴 수 없습니다.`
          : refundAmount === 0
          ? '환불 없이(0원) 예약을 취소할까요? 예약은 즉시 취소되며 고객에게 돌려주는 금액이 없습니다. 되돌릴 수 없습니다.'
          : `${formatPriceAmount(refundAmount)}원을 환불 처리할까요? 예약은 즉시 취소되며 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }

    await run(() =>
      booking.orderType === 'deposit' && isBankPaid
        ? recordLinkRefund(booking.id, refundAmount, refundReason.trim())
        : refundBooking(booking.id, refundAmount, refundReason.trim()),
    );
  };

  const bookingLine = bookingLineOf(booking);
  const isMixing = booking.orderType === 'mixing';
  const isDeposit = booking.orderType === 'deposit';
  const workOrder = booking.workOrder;

  // 완료·노쇼·캘린더·재발송은 슬롯이 있는 세션 예약만의 개념(API도 믹싱엔 409를 준다).
  const canChangeStatus = !isMixing && booking.bookingStatus === 'confirmed';
  // 완료·노쇼는 환불 경로를 닫는다 — 잘못 눌렀거나 환불이 필요해지면 확정으로 되돌릴 수 있어야 한다.
  const canRevertStatus = !isMixing && (booking.bookingStatus === 'completed' || booking.bookingStatus === 'no_show');
  // 입금 전에 취소된 계좌 입금 신청은 보낼 알림이 없다(API도 409).
  const canResend = !isMixing && booking.bookingStatus !== null && booking.bookingStatus !== 'pending' && booking.bankDeposit !== 'cancelled';
  // 취소된 예약은 캘린더에 다시 등록할 이유가 없다 — API도 같은 가드를 둔다
  // (pages/api/admin/bookings/[id].ts retry-gcal).
  //
  // 뒤쪽 괄호가 "고칠 것이 실제로 있는가"다. 예전엔 이 버튼이 gcalError 배너 **안**에만
  // 있어서 그 조건을 따로 적을 필요가 없었는데, 등록 시도 자체가 없었던 예약
  // (gcalEventId·gcalError 둘 다 NULL)에는 배너가 안 떠서 버튼도 같이 사라졌다.
  // gcalMissing은 confirmed에서만 참이므로(admin-serialize) 대기·취소 예약에 등록 버튼이
  // 새로 뜨는 일은 없고, gcalError가 있는 완료·노쇼 예약의 기존 재시도 경로도 그대로다.
  const canEditDetails = !isMixing && !isDeposit && booking.orderStatus === 'awaiting_deposit';
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(booking.customerName);
  const [editPhone, setEditPhone] = useState(booking.customerPhone === '-' ? '' : booking.customerPhone);
  const [editEmail, setEditEmail] = useState(booking.customerEmail === 'manual@studionol.co.kr' ? '' : booking.customerEmail);
  const [editAmount, setEditAmount] = useState(String(booking.totalAmount));
  const handleEditDetails = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'update_details', customerName: editName, customerPhone: editPhone, customerEmail: editEmail, totalAmount: Number(editAmount.replace(/[,\s원]/g, '')) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) {
        setNotice(result?.message || '수정에 실패했습니다.');
      } else {
        setEditOpen(false);
        setNotice(Array.isArray(result.warnings) && result.warnings.length > 0 ? result.warnings.join(' / ') : '고객 정보와 금액을 고쳤어요.');
      }
    } catch {
      setNotice('네트워크 오류가 발생했습니다.');
    }
    setBusy(false);
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const canReschedule =
    !isMixing && !isDeposit && (booking.bookingStatus === 'confirmed' || (booking.bookingStatus === 'pending' && booking.orderStatus === 'awaiting_deposit'));
  // 입금 확인이 끝난 계좌 입금 주문(예약·믹싱·예약금 링크)의 금액 정정 — 환불 기록이 없을 때만(refundableAmount === totalAmount). 토스(카드)는 승인 금액과 어긋나 못 고친다.
  const canAdjustPaidAmount = booking.orderStatus === 'paid' && isBankPaid && booking.refundableAmount === booking.totalAmount;
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState(String(booking.totalAmount));
  const [adjustReason, setAdjustReason] = useState('');
  const handleAdjustPaidAmount = async () => {
    const next = Number(adjustAmount.replace(/[,\s원]/g, ''));
    if (!window.confirm(`금액을 ${formatPriceAmount(booking.totalAmount)}원 → ${Number.isFinite(next) ? formatPriceAmount(next) : adjustAmount}원으로 정정할까요?\n\n매출 현황과 환불 가능 금액이 함께 바뀌고, 사유와 함께 기록이 남습니다. 고객에게 메일은 가지 않습니다.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'update_paid_amount', totalAmount: next, reason: adjustReason }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) {
        setNotice(result?.message || '금액 정정에 실패했습니다.');
      } else {
        setAdjustOpen(false);
        setAdjustReason('');
        setNotice(`금액을 ${formatPriceAmount(result.from)}원에서 ${formatPriceAmount(result.to)}원으로 정정했어요.`);
      }
    } catch {
      setNotice('네트워크 오류가 발생했습니다.');
    }
    setBusy(false);
    await router.replace(router.asPath, undefined, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const kstStart = booking.startAt ? new Date(new Date(booking.startAt).getTime() + 9 * 3_600_000) : null;
  const [newDate, setNewDate] = useState(kstStart ? kstStart.toISOString().slice(0, 10) : '');
  const [newHour, setNewHour] = useState(kstStart ? kstStart.getUTCHours() : 10);
  const handleReschedule = async () => {
    const isPastTarget = new Date(`${newDate}T${String(newHour).padStart(2, '0')}:00:00+09:00`).getTime() <= Date.now();
    const waiting = booking.orderStatus === 'awaiting_deposit';
    if (
      !window.confirm(
        `${newDate} ${String(newHour).padStart(2, '0')}:00 으로 옮길까요?\n구글 캘린더 일정도 함께 옮겨요. 고객에게는 메일이 자동으로 가지 않아요.` +
          (isPastTarget ? '\n\n⚠ 이미 지난 시각이에요. 지난 세션을 바로잡는 게 아니라면 날짜를 확인해 주세요.' : '') +
          (waiting ? '\n\n입금 대기 중이에요 — 이용일이 가까워지면 입금 기한도 짧아져요. 옮긴 뒤 “입금 안내 재발송”으로 새 기한을 알려 주세요.' : ''),
      )
    ) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'reschedule', date: newDate, startHour: newHour }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) {
        setNotice(result?.message || '일정 변경에 실패했습니다.');
      } else {
        setRescheduleOpen(false);
        setNotice(
          Array.isArray(result.warnings) && result.warnings.length > 0
            ? result.warnings.join(' / ')
            : booking.orderStatus === 'awaiting_deposit'
              ? '일정을 옮겼어요. 입금 대기 중이라 “알림 재발송”은 없습니다 — 새 일정을 알리려면 “입금 안내 재발송”을 눌러 주세요.'
              : '일정을 옮겼어요. 고객에게 알리려면 아래 “알림 재발송”을 눌러 주세요.',
        );
      }
    } catch {
      setNotice('네트워크 오류가 발생했습니다.');
    }
    setBusy(false);
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  // 취소 때 지우지 못한 [예약] 일정 — 등록이 아니라 "다시 지우기"가 필요하다(캘린더에 남은 일정이 그 시간을 계속 막는다).
  const staleCalendarDelete = !isMixing && booking.bookingStatus === 'cancelled' && booking.gcalError?.startsWith('delete: ') === true;
  const canRetryGcal =
    !isMixing &&
    booking.bookingStatus !== null &&
    ((booking.bookingStatus !== 'cancelled' && (booking.gcalError !== null || booking.gcalMissing)) || staleCalendarDelete);

  // 센티널(`send_pending`·`send_inflight`)과 실제 실패 사유를 갈라 읽는다 — 원문 노출 금지.
  const notificationCopy = describeNotificationError(booking.notificationError);

  const canStartWork = isMixing && workOrder?.status === 'received';
  const canDeliver = isMixing && workOrder?.status === 'in_progress';
  /**
   * 임의 환불 폼을 띄울지 — **cancel.ts와 같은 함수를 쓴다**(canAdminRefund).
   *
   * 예전엔 이 화면이 세션은 `confirmed`, 믹싱은 received/in_progress/delivered만 봤다. 그래서
   * 한 번 취소된 건(셀프 취소 50% 티어 → cancelled + partially_refunded, 또는 당일 취소
   * 0원 → cancelled + paid)에는 폼이 아예 렌더되지 않았고, lib이 그 용도로 만들어 둔
   * 잔액 환불 경로(isCancelledRemainderRefund)가 제품 안에서 도달 불가였다 — 호의 환불·
   * 분쟁 환불을 하려면 토스 콘솔에서 손으로 취소하는 수밖에 없었다.
   *
   * 판정이 갈리면 폼은 있는데 API가 거절하거나(죽은 버튼) 그 반대가 된다. 한 함수로 묶는다.
   */
  const canRefund = canAdminRefund({
    orderType: booking.orderType,
    orderStatus: booking.orderStatus,
    entityStatus: isMixing ? (workOrder?.status ?? null) : booking.bookingStatus,
    refundableAmount: booking.refundableAmount,
  });
  const isRemainderRefund =
    (isMixing ? workOrder?.status : booking.bookingStatus) === 'cancelled';
  /**
   * 예약금 결제 링크 주문은 예약·작업 행이 없어 canAdminRefund가 항상 false라 따로 판정한다. 두 갈래 모두 같은 폼을 쓴다:
   * - 계좌로 직접 입금받은 건 → 송금을 마친 뒤 장부만 남긴다(lib/payments/linkRefund.ts).
   * - 카드(토스) 결제 건 → 토스 취소를 부른다(lib/booking/cancel.ts refundDepositOrder).
   * 서버가 갈래별로 반대편을 거절하므로 화면도 `isBankPaid`로 같은 기준을 따른다.
   */
  const canRefundDeposit =
    isDeposit && LIVE_ORDER_STATUSES_FOR_REFUND.some((status) => status === booking.orderStatus) && booking.refundableAmount > 0;
  const showRefundForm = canRefund || canRefundDeposit;

  return (
    <>
      <Head>
        <title>{booking.customerName}님 예약 상세 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="예약 상세"
        description={`${booking.customerName}님 · ${booking.productName}`}
        backHref={bookingLine ? `/admin/bookings?line=${bookingLine}` : '/admin/bookings'}
        backLabel="예약 목록"
        navLine={bookingLine}
      >
        {notice && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>
        )}

        {booking.bankDeposit === 'awaiting' && (
          <div className="mb-4 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950">
            <p className="font-semibold">계좌 입금 대기</p>
            <p className="mt-1">
              보내는 분 <strong>{booking.customerName}</strong> · <strong>{formatPriceAmount(booking.totalAmount)}원</strong>
              {booking.depositDeadline && (
                <> · 안내한 기한 {formatKstDeadline(new Date(booking.depositDeadline))}(한국시간, 자동 취소 없음)</>
              )}
            </p>
            <p className="mt-1 text-xs text-sky-900">
              통장에 실제로 입금됐는지 먼저 확인한 뒤 “입금 확인”을 누르세요. {isDeposit ? '이 신청은 자동으로 취소되지 않습니다.' : `이 신청은 ${isMixing ? '주문' : '시간대'}을 잡아 둔 채 자동으로 취소되지 않습니다.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button light disabled={busy} onClick={handleConfirmDeposit}>{busy ? '처리 중…' : '입금 확인'}</Button>
              <Button light variant="weak" disabled={busy} onClick={handleCancelUnpaid}>미입금 취소</Button>
              <Button light variant="weak" disabled={busy} onClick={handleResendDepositGuide}>입금 안내 재발송</Button>
            </div>
          </div>
        )}

        {booking.bankDeposit === 'cancelled' && (
          <div className="mb-4 rounded-lg border border-gray-300 bg-gray-50 p-4 text-sm text-gray-800">
            입금 전에 취소된 계좌 입금 신청입니다 — 늦게 입금이 들어왔다면 고객에게 돌려주거나 다시 신청받아 주세요.
            {/* 미입금 취소 때 [입금 대기] 캘린더 일정 삭제가 실패했다 — 그 일정이 웹 예약을 막는다. */}
            {booking.gcalError?.startsWith('waiting_delete: ') && (
              <div className="mt-3">
                <p className="font-semibold text-red-700">[입금 대기] 캘린더 일정이 남아 이 시간대의 웹 예약을 막고 있습니다.</p>
                <Button type="button" variant="weak" className="mt-2" disabled={busy}
                  onClick={() => runDeposit('delete_waiting_event', '캘린더 일정을 지우지 못했습니다.', '남은 [입금 대기] 캘린더 일정을 지울까요?')}>
                  대기 일정 지우기
                </Button>
              </div>
            )}
            {!booking.gcalError?.startsWith('waiting_delete: ') && (
              <div className="mt-3">
                <p className="text-xs text-gray-500">돈이 오간 적 없는 기록이에요. 테스트로 만들었거나 잘못 올렸다면 목록에서 지울 수 있어요(되돌릴 수 없어요).</p>
                <Button type="button" variant="weak" className="mt-2" disabled={busy}
                  onClick={async () => {
                    if (!window.confirm(`${booking.orderNo} 기록을 완전히 삭제할까요? 되돌릴 수 없어요.`)) return;
                    setBusy(true);
                    setNotice(null);
                    const result = await postDepositAction('delete_unpaid_record', '삭제에 실패했습니다.');
                    setBusy(false);
                    if (result.ok) {
                      await router.replace('/admin/bookings');
                    } else {
                      setNotice(result.message ?? '삭제에 실패했습니다.');
                    }
                  }}>
                  기록 삭제
                </Button>
              </div>
            )}
          </div>
        )}

        {sameNameDeposits.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">
              같은 이름의 다른 계좌 입금 신청이 있습니다 — 통장 입금 한 건을 두 신청에 확인하지 않게 금액·시각을 대조하세요
            </p>
            <ul className="mt-2 space-y-1">
              {sameNameDeposits.map((c) => (
                <li key={c.id}>
                  <a href={`/admin/bookings/${c.id}`} className="font-medium underline">{c.orderNo}</a>
                  {' '}· {ORDER_STATUS_LABELS[c.status] ?? c.status} · {formatPriceAmount(c.totalAmount)}원 · {formatKstDateTime(c.createdAt)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isBankPaid && refundAccount && (
          <div className="mb-4 rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
            <p className="font-semibold">환불 계좌</p>
            {refundAccount.status === 'present' && (
              <>
                <p className="mt-1">
                  {refundAccount.bankName} · 예금주 {refundAccount.accountHolder} (접수 {formatKstDateTimeFull(refundAccount.updatedAt)})
                </p>
                {!sameNameIgnoringSpace(refundAccount.accountHolder, booking.customerName) && (
                  <p className="mt-2 font-semibold text-red-700">
                    예금주가 고객 이름({booking.customerName})과 다릅니다. 가족 계좌일 수 있으니 필요하면 고객에게 확인해 주세요.
                  </p>
                )}
                {refundAccountView ? (
                  <div className="mt-2 rounded border border-orange-200 bg-white p-3">
                    <p>{refundAccountView.bankName}</p>
                    <p className="text-lg font-bold tracking-wide">{refundAccountView.accountNumber}</p>
                    <p>예금주 {refundAccountView.accountHolder}</p>
                  </div>
                ) : (
                  <Button light variant="weak" size="sm" className="mt-2" disabled={busy} onClick={handleShowRefundAccount}>
                    계좌 보기
                  </Button>
                )}
                <p className="mt-2 text-xs">“계좌 보기”를 누른 사실은 접속기록에 남습니다.</p>
                {refundAccount.refundedAt ? (
                  <p className="mt-2 font-semibold">송금 완료: {formatKstDateTimeFull(refundAccount.refundedAt)}</p>
                ) : (
                  <Button light size="sm" className="mt-2" disabled={busy} onClick={handleMarkRefundSent}>
                    송금 완료
                  </Button>
                )}
              </>
            )}
            {refundAccount.status === 'none' && <p className="mt-1">접수된 환불 계좌가 없습니다.</p>}
            {refundAccount.status === 'unavailable' && (
              <p className="mt-1">환불 계좌를 불러오지 못했습니다(마이그레이션 0048 확인).</p>
            )}
          </div>
        )}

        {booking.virtualAccountPayment && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">
            <strong className="block mb-1">가상계좌 결제 — 화면에서 환불할 수 없습니다</strong>
            토스는 가상계좌 취소에 환불받을 계좌(은행·계좌번호·예금주)를 필수로 요구하는데, 우리는 그 값을
            받는 화면이 없습니다. 아래 환불 폼을 써도 실패합니다.
            <span className="block mt-2">
              고객에게 환불 계좌를 받아 <strong>토스 콘솔에서 직접 취소</strong>해 주세요. 취소하면 웹훅 대사가
              이 화면의 상태를 맞춥니다.
            </span>
          </div>
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
            메일 발송)만 남은 경우다 — 미정합을 발견하려고 넣은 필드라 여기서 보여준다.

            notificationError는 자유 문자열이 아니다. 확정 후처리 소유권을 CAS로 정하면서
            `send_pending`·`send_inflight` 두 예약어가 같은 칸에 들어온다. 원문을 그대로
            찍으면 "알림 발송에 실패했습니다 send_inflight"가 되어, 정상 진행 중인 주문을
            사고로 읽게 만든다 — describeNotificationError가 그 해석을 맡는다. */}
        {notificationCopy && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
            <strong className="block mb-1">{notificationCopy.title}</strong>
            {notificationCopy.detail}
            <span className="block mt-2 text-amber-700">
              {notificationCopy.kind === 'failure'
                ? isDeposit
                  ? '고객이 입금 확인 또는 환불 안내 메일을 받지 못했을 수 있습니다. '
                  : '고객이 예약 확정 또는 취소 메일을 받지 못했을 수 있습니다. '
                : ''}
              {/* 믹싱·마스터링 주문에는 재발송 버튼이 없다(bookings 행이 없어 API도 409를
                  준다). 없는 버튼을 가리키면 운영자가 화면을 뒤지게 되므로 안내를 가른다. */}
              {canResend
                ? '아래 “알림 재발송”을 눌러 다시 보내 주세요.'
                : '이 주문에는 재발송 버튼이 없습니다 — 고객에게 직접 연락해 주세요.'}
            </span>
          </div>
        )}

        {/* 캘린더 구멍은 두 모습으로 온다 — 배너를 하나로 두고 제목·본문만 가른다.
            (1) 등록을 시도했다가 실패: gcalError에 사유가 남는다.
            (2) 등록 시도 자체가 없음: gcalEventId·gcalError가 둘 다 NULL(gcalMissing).
            확정 직후 후처리가 죽은 경우라 오류 기록조차 없다. 예전엔 (1)만 배너를 띄워서
            (2)는 화면 어디에도 안 보였고, 운영자가 알림 배너를 보고 “알림 재발송”을 누르면
            남은 신호까지 지워져 빈 캘린더로 confirmed 예약만 남았다. */}
        {(booking.gcalError || booking.gcalMissing) && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
            {booking.gcalError ? (
              <>
                <strong className="block mb-1">
                  {staleCalendarDelete ? '취소된 예약의 캘린더 일정을 지우지 못했습니다' : '구글 캘린더 동기화에 실패했습니다'}
                </strong>
                {booking.gcalError}
              </>
            ) : (
              <strong className="block mb-1">
                구글 캘린더에 등록되지 않았습니다 — 등록 시도 기록이 없습니다
              </strong>
            )}
            <span className="block mt-2 text-amber-700">
              {staleCalendarDelete ? (
                '캘린더에 남은 [예약] 일정이 이 시간을 계속 막아 새 예약이 들어오지 못합니다. 아래 버튼으로 다시 지워 주세요.'
              ) : (
                <>
                  운영자는 구글 캘린더에 직접 일정을 넣지 않으므로, 이 예약 시간이 캘린더에
                  비어 있으면 다른 일정이 겹칠 수 있습니다.{' '}
                  {canRetryGcal
                    ? '아래 “캘린더 재시도”를 눌러 다시 등록해 주세요.'
                    : '캘린더에 직접 넣어 주세요.'}
                </>
              )}
            </span>
            {canRetryGcal && (
              <Button light
                variant="secondary"
                disabled={busy}
                onClick={handleRetryGcal}
                className="mt-3"
              >
                {staleCalendarDelete ? '캘린더 일정 지우기' : '캘린더 재시도'}
              </Button>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 md:p-8 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  isMixing ? 'bg-purple-100 text-purple-700' : isDeposit ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {isMixing ? '믹싱·마스터링' : isDeposit ? '예약금' : '세션 예약'}
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
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">고객 정보</h2>
                <dl className="space-y-2 text-sm">
                  <DescriptionRow label="이름" value={booking.customerName} />
                  <DescriptionRow label="전화번호" value={booking.customerPhone} />
                  <DescriptionRow label="이메일" value={booking.customerEmail} />
                </dl>
                {canEditDetails && (
                  <div className="pt-3">
                    {editOpen ? (
                      <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 p-3">
                        <Field id="ed-name" label="이름" className={lightOnlyField}><TextInput value={editName} onChange={(e) => setEditName(e.target.value)} light /></Field>
                        <Field id="ed-amount" label="금액 (부가세 포함, 원)" className={lightOnlyField}><TextInput inputMode="numeric" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} light /></Field>
                        <Field id="ed-phone" label="연락처 (비우면 기록만)" className={lightOnlyField}><TextInput value={editPhone} onChange={(e) => setEditPhone(e.target.value)} light /></Field>
                        <Field id="ed-email" label="이메일 (저장만 해요 — 안내 메일은 “입금 안내 재발송”으로)" className={lightOnlyField}><TextInput value={editEmail} onChange={(e) => setEditEmail(e.target.value)} light /></Field>
                        <p className="col-span-2 text-xs text-gray-500">입금 확인 전의 예약만 여기서 고쳐요. 입금 확인 뒤에는 결제 금액 칸의 “금액 정정”을 쓰세요.</p>
                        <div className="col-span-2 flex flex-wrap gap-2">
                          <Button light size="sm" disabled={busy || editName.trim() === ''} onClick={handleEditDetails}>저장</Button>
                          <Button light variant="weak" size="sm" disabled={busy} onClick={() => setEditOpen(false)}>닫기</Button>
                        </div>
                      </div>
                    ) : (
                      <Button light variant="weak" size="sm" disabled={busy} onClick={() => setEditOpen(true)}>고객 정보·금액 수정</Button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">
                  {isMixing || isDeposit ? '주문 정보' : '예약 정보'}
                </h2>
                <dl className="space-y-2 text-sm">
                  <DescriptionRow label="상품" value={booking.productName} />
                  {isDeposit && booking.linkMemo && <DescriptionRow label="링크 메모" value={booking.linkMemo} />}
                  {isDeposit && booking.linkSessionAt && <DescriptionRow label="이용 일시" value={formatKstDateTimeFull(booking.linkSessionAt)} />}
                  {isDeposit && booking.linkCalendar && (
                    <DescriptionRow
                      label="구글 캘린더"
                      value={(
                        <span className="inline-flex flex-wrap items-center justify-end gap-2">
                          <span>{booking.linkCalendar.state === 'registered' ? '등록됨' : booking.linkCalendar.state === 'failed' ? `등록 실패 — ${booking.linkCalendar.error ?? ''}` : '아직 안 올림'}</span>
                          {(booking.orderStatus === 'paid' || booking.orderStatus === 'partially_refunded') && (
                            <Button light variant="weak" size="sm" disabled={busy} onClick={() => runLinkCalendar('sync_link_calendar', '구글 캘린더에 이 이용 일정을 (다시) 올릴까요? 이미 올린 일정이 있으면 지우고 새로 올려요.')}>
                              {booking.linkCalendar.state === 'registered' ? '다시 등록' : '캘린더에 올리기'}
                            </Button>
                          )}
                          {booking.linkCalendar.state === 'registered' && (
                            <Button light variant="weak" size="sm" disabled={busy} onClick={() => runLinkCalendar('remove_link_calendar', '구글 캘린더에서 이 일정을 지울까요? (환불 등으로 이용하지 않을 때)')}>
                              캘린더에서 지우기
                            </Button>
                          )}
                        </span>
                      )}
                    />
                  )}
                  {isDeposit ? null : isMixing ? (
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
                      {canReschedule && (
                        <div className="pt-2">
                          {rescheduleOpen ? (
                            <div className="grid grid-cols-2 gap-3 items-end rounded-lg border border-gray-200 p-3">
                              <Field id="rs-date" label="새 날짜" className={lightOnlyField}>
                                <TextInput type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} light />
                              </Field>
                              <Field id="rs-hour" label="새 시작 시각" className={lightOnlyField}>
                                <Select value={newHour} onChange={(e) => setNewHour(Number(e.target.value))} light>
                                  {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                                  ))}
                                </Select>
                              </Field>
                              <p className="col-span-2 text-xs text-gray-500">이용 시간({booking.durationHours}시간)·금액은 그대로, 시작만 옮겨요. 겹침과 캘린더를 검사한 뒤 캘린더 일정도 함께 옮깁니다.</p>
                              <div className="col-span-2 flex flex-wrap gap-2">
                                <Button light size="sm" disabled={busy || newDate === ''} onClick={handleReschedule}>옮기기</Button>
                                <Button light variant="weak" size="sm" disabled={busy} onClick={() => setRescheduleOpen(false)}>닫기</Button>
                              </div>
                            </div>
                          ) : (
                            <Button light variant="weak" size="sm" disabled={busy} onClick={() => setRescheduleOpen(true)}>일정 변경</Button>
                          )}
                        </div>
                      )}
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
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-2">요청사항</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{booking.customerNote}</p>
              </div>
            )}
          </div>

          <div className="p-4 md:p-8 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">결제 금액</h2>
            <dl className="space-y-2 text-sm">
              <DescriptionRow label="공급가액" value={`${formatPriceAmount(booking.itemAmount)}원`} />
              <DescriptionRow label="VAT" value={`${formatPriceAmount(booking.vatAmount)}원`} />
              <DescriptionRow
                label="합계"
                value={<span className="text-base">{formatPriceAmount(booking.totalAmount)}원</span>}
              />
            </dl>

            {canAdjustPaidAmount && (
              <div className="mt-3">
                {adjustOpen ? (
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2">
                    <Field id="adj-amount" label="바꿀 금액 (부가세 포함, 원)" className={lightOnlyField}><TextInput inputMode="numeric" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} light /></Field>
                    <Field id="adj-reason" label="정정 사유 (기록에 남아요)" className={lightOnlyField}><TextInput value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="예: 협의 금액을 잘못 넣음" light /></Field>
                    <p className="text-xs text-gray-500 sm:col-span-2">계좌로 받은 돈과 기록이 다를 때만 쓰세요. 매출·환불 가능 금액이 바뀌고, 고객에게 메일은 가지 않아요. 환불이 한 번이라도 있으면 정정할 수 없어요.</p>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <Button light size="sm" disabled={busy || adjustReason.trim().length < 2} onClick={handleAdjustPaidAmount}>정정</Button>
                      <Button light variant="weak" size="sm" disabled={busy} onClick={() => setAdjustOpen(false)}>닫기</Button>
                    </div>
                  </div>
                ) : (
                  <Button light variant="weak" size="sm" disabled={busy} onClick={() => setAdjustOpen(true)}>금액 정정</Button>
                )}
              </div>
            )}

            {booking.payment && (
              <dl className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm">
                <DescriptionRow label="결제 수단" value={isBankPaid ? '계좌 입금' : (booking.payment.method ?? '-')} />
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
            <div className="p-4 md:p-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">환불 내역</h2>
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

        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8 space-y-8">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">작업</h2>
            <div className="flex flex-wrap gap-3">
              {canChangeStatus && (
                <>
                  <Button light disabled={busy} onClick={handleComplete}>
                    완료 처리
                  </Button>
                  <Button light variant="weak" disabled={busy} onClick={handleNoShow}>
                    노쇼 처리
                  </Button>
                </>
              )}

              {canRevertStatus && (
                <Button light variant="weak" disabled={busy} onClick={handleRevertStatus}>
                  확정으로 되돌리기
                </Button>
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

              {!canChangeStatus && !canRevertStatus && !canResend && !canStartWork && !canDeliver && !showRefundForm && (
                <p className="text-sm text-gray-500">
                  {isMixing || isDeposit
                    ? '지금 상태에서는 가능한 작업이 없습니다.'
                    : '결제 대기 중인 예약에는 가능한 작업이 없습니다.'}
                </p>
              )}
            </div>
          </div>

          {showRefundForm && (
            <div className="pt-6 border-t border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-1">{isDeposit ? (isBankPaid ? '환불 기록' : '예약금 환불') : isRemainderRefund ? '잔액 환불' : '임의 환불'}</h2>
              {isBankPaid && (
                <p className="mb-2 text-sm font-semibold text-red-700">
                  계좌 입금 건입니다 — 토스로 돌려주지 않습니다. 고객 계좌로 송금을 마친 뒤 기록하세요.
                </p>
              )}
              <p className="text-sm text-gray-500 mb-4">
                {isDeposit && isBankPaid ? (
                  <>고객 계좌로 송금을 마친 금액을 장부에 기록합니다. 이 화면은 돈을 보내지 않으며, 기록하면 매출 현황에 환불로 잡힙니다. 처리하면 고객에게 환불 안내 메일이 갑니다. 이용 일정을 취소하는 것이 아니므로 구글 캘린더 일정은 위의 “캘린더에서 지우기”로 따로 지워 주세요.</>
                ) : isDeposit ? (
                  <>
                    예약금 결제 링크 주문의 금액을 돌려줍니다. 결제수단(토스)으로 취소되고, 부분 환불을 여러 번 나눠 할 수 있습니다(같은 금액을 연속으로 환불할 수는 없으니 금액을 달리 나눠 주세요). 처리하면 고객에게 환불 안내 메일이 갑니다. 이용 일정을 취소하는 것이 아니므로 구글 캘린더 일정은 위의 “캘린더에서 지우기”로 따로 지워 주세요.
                  </>
                ) : isRemainderRefund ? (
                  <>
                    이미 취소된 {isMixing ? '주문' : '예약'}의 남은 금액을 더 돌려줍니다. 취소 안내는 이미 나갔으므로
                    메일·캘린더 후처리 없이 환불만 처리합니다.
                  </>
                ) : (
                  <>
                    {isMixing ? '주문을 취소하고' : '예약을 취소하고'} 지정한 금액을 환불합니다. 처리하면{' '}
                    {isMixing ? '주문은' : '예약은'} 즉시 취소 상태가 되며 되돌릴 수 없습니다.
                  </>
                )}
              </p>

              <form onSubmit={handleRefund} className="space-y-3 max-w-md">
                <Field
                  id="refund-amount"
                  label={`환불 금액 (원, 잔액 ${formatPriceAmount(booking.refundableAmount)})`}
                  error={refundError ?? undefined}
                  className={lightOnlyField}
                >
                  <TextInput
                    type="number"
                    min={isRemainderRefund || isDeposit ? 1 : 0}
                    max={booking.refundableAmount}
                    step={1}
                    value={refundInput}
                    onChange={(e) => setRefundInput(e.target.value)}
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
                <Button light type="submit" variant="weak" disabled={busy}>
                  {isBankPaid ? '송금 완료(환불 기록)' : '환불 처리'}
                </Button>
              </form>
            </div>
          )}
        </div>
      </AdminShell>
    </>
  );
}
