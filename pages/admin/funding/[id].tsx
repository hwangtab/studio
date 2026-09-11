import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { patchPledge, type FundingActionResult } from '../../../components/admin/fundingActions';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextArea, TextInput } from '../../../components/ui/Field';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { formatPriceAmount } from '../../../data/pricing';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatKstDateTime, formatKstDateTimeFull } from '../../../lib/booking/format';
import { serializePledgeForAdmin, type AdminPledgeItem } from '../../../lib/funding/admin-serialize';
import { remainingRefundable } from '../../../lib/funding/refundable';
import { findFundingOrderById } from '../../../lib/funding/service';

interface AdminFundingDetailPageProps {
  pledge: AdminPledgeItem;
  /** 아직 환불하지 않은 금액 = totalAmount − 기록된 done 환불 합. 부분환불 건에서 totalAmount와 다르다. */
  refundableAmount: number;
}

export const getServerSideProps: GetServerSideProps<AdminFundingDetailPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { id } = context.query;
  if (typeof id !== 'string') return { notFound: true };

  const order = await findFundingOrderById(id).catch((error: unknown) => {
    console.error('[admin/funding/[id]] Failed to load pledge:', error);
    return undefined;
  });
  if (!order || !order.fundingPledge) return { notFound: true };

  // 취소 로직과 같은 헬퍼를 쓴다 — 화면이 보여주는 잔액과 실제 환불액이 갈리면 관리자가
  // 확인창에서 본 금액과 다른 금액이 나간다.
  const refundableAmount = remainingRefundable(order);

  return { props: { pledge: serializePledgeForAdmin(order, new Set()), refundableAmount } };
};

const STATUS_LABELS: Record<string, string> = {
  pending: '결제대기',
  paid: '확정',
  partially_refunded: '부분환불',
  refunded: '환불완료',
  failed: '결제실패',
  expired: '만료',
};

const PAYMENT_LABELS: Record<string, string> = { toss: '카드', bank_transfer: '무통장' };
const FULFILLMENT_OPTIONS = ['none', 'preparing', 'shipped', 'delivered'] as const;
const FULFILLMENT_LABELS: Record<string, string> = { none: '미발송', preparing: '준비중', shipped: '발송완료', delivered: '수령완료' };

const DescriptionRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="font-medium text-right">{value}</dd>
  </div>
);

export default function AdminFundingDetailPage({ pledge, refundableAmount }: AdminFundingDetailPageProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [fulfillmentStatus, setFulfillmentStatus] = useState(pledge.fulfillmentStatus);
  const [trackingCompany, setTrackingCompany] = useState(pledge.trackingCompany ?? '');
  const [trackingNumber, setTrackingNumber] = useState(pledge.trackingNumber ?? '');
  const [memo, setMemo] = useState(pledge.adminMemo ?? '');

  const run = async (task: () => Promise<FundingActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setNotice(null);
    const result = await task();
    setBusy(false);
    if (!result.ok) setNotice(result.message ?? '요청을 처리하지 못했습니다.');
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const canConfirmDeposit = (pledge.status === 'pending' || pledge.status === 'expired') && pledge.paymentMethod === 'bank_transfer';
  // 부분환불 건도 잔액이 남아 있으면 관리자가 마저 환불할 수 있어야 한다.
  const canRefund = ['paid', 'partially_refunded'].includes(pledge.status);

  const handleConfirmDeposit = () => run(() => patchPledge(pledge.id, { action: 'confirm_deposit' }), '입금을 확인 처리할까요? 후원이 확정됩니다.');
  const handleRefund = () => run(() => patchPledge(pledge.id, { action: 'refund', reason: '관리자 환불' }), `이 후원의 남은 금액 ${formatPriceAmount(refundableAmount)}원을 환불할까요? 되돌릴 수 없습니다.`);
  const handleSaveFulfillment = () =>
    run(() => patchPledge(pledge.id, { action: 'set_fulfillment', fulfillmentStatus, trackingCompany, trackingNumber }));
  const handleSaveMemo = () => run(() => patchPledge(pledge.id, { action: 'set_memo', adminMemo: memo || undefined }));
  const handleResendEmail = () => run(() => patchPledge(pledge.id, { action: 'resend_email' }));

  return (
    <>
      <Head>
        <title>{pledge.customerName}님 후원 상세 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">후원 상세</h1>
            <Link href="/admin/funding" passHref>
              <Button variant="outline">목록으로</Button>
            </Link>
          </div>

          {notice && <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>}

          {pledge.mismatch && (
            <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">
              <strong className="block mb-1">결제 기록과 주문 상태 불일치 — 토스 콘솔 확인 필요</strong>
              주문 상태는 “{STATUS_LABELS[pledge.status] ?? pledge.status}”인데 결제 기록이 있습니다.
            </div>
          )}

          {pledge.notificationError && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
              <strong className="block mb-1">알림 발송에 실패했습니다</strong>
              {pledge.notificationError}
              <span className="block mt-2 text-amber-700">아래 “메일 재발송”을 눌러 다시 보내 주세요.</span>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3">기본 정보</h2>
              <dl className="space-y-2 text-sm">
                <DescriptionRow label="주문번호" value={pledge.orderNo} />
                <DescriptionRow label="프로젝트" value={pledge.projectSlug} />
                <DescriptionRow label="상태" value={STATUS_LABELS[pledge.status] ?? pledge.status} />
                <DescriptionRow label="결제수단" value={PAYMENT_LABELS[pledge.paymentMethod] ?? pledge.paymentMethod} />
                <DescriptionRow label="등록 경로" value={pledge.entrySource === 'manual' ? '수기 등록' : '온라인'} />
                <DescriptionRow label="고객" value={`${pledge.customerName} / ${pledge.customerPhone} / ${pledge.customerEmail}`} />
                <DescriptionRow label="리워드" value={`${pledge.rewardTitle} × ${pledge.quantity}`} />
                <DescriptionRow label="추가 후원금" value={`${formatPriceAmount(pledge.additionalAmount)}원`} />
                <DescriptionRow label="합계" value={`${formatPriceAmount(pledge.totalAmount)}원`} />
                <DescriptionRow label="발송 상태" value={FULFILLMENT_LABELS[pledge.fulfillmentStatus] ?? pledge.fulfillmentStatus} />
                <DescriptionRow label="배송지" value={pledge.shipping ?? '없음'} />
                <DescriptionRow label="응원 메시지" value={pledge.supporterMessage ?? '없음'} />
                <DescriptionRow label="환불 요청 시각" value={pledge.refundRequestedAt ? formatKstDateTimeFull(pledge.refundRequestedAt) : '없음'} />
                <DescriptionRow label="확정 시각" value={pledge.paidAt ? formatKstDateTimeFull(pledge.paidAt) : '없음'} />
                <DescriptionRow label="입금 기한" value={formatKstDateTimeFull(pledge.holdExpiresAt)} />
                <DescriptionRow label="접수 시각" value={formatKstDateTime(pledge.createdAt)} />
              </dl>
            </div>

            <div className="flex flex-wrap gap-2">
              {canConfirmDeposit && (
                <Button disabled={busy} onClick={handleConfirmDeposit}>입금 확인</Button>
              )}
              {canRefund && (
                <Button variant="secondary" disabled={busy} onClick={handleRefund}>환불</Button>
              )}
              <Button variant="outline" disabled={busy} onClick={handleResendEmail}>메일 재발송</Button>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3">발송 상태</h2>
              <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-xl">
                <Field id="fulfillment-status" label="상태" className={lightOnlyField}>
                  <Select
                    value={fulfillmentStatus}
                    onChange={(e) => setFulfillmentStatus(e.target.value as typeof fulfillmentStatus)}
                    light className="w-auto text-sm"
                    disabled={pledge.status !== 'paid'}
                  >
                    {FULFILLMENT_OPTIONS.map((s) => (
                      <option key={s} value={s}>{FULFILLMENT_LABELS[s]}</option>
                    ))}
                  </Select>
                </Field>
                <Field id="tracking-company" label="택배사" className={lightOnlyField}>
                  <TextInput
                    type="text"
                    value={trackingCompany}
                    onChange={(e) => setTrackingCompany(e.target.value)}
                    light className="w-auto text-sm"
                    disabled={pledge.status !== 'paid'}
                  />
                </Field>
                <Field id="tracking-number" label="운송장번호" className={lightOnlyField}>
                  <TextInput
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    light className="w-auto text-sm"
                    disabled={pledge.status !== 'paid'}
                  />
                </Field>
                <Button disabled={busy || pledge.status !== 'paid'} onClick={handleSaveFulfillment}>저장</Button>
              </div>
              {pledge.status !== 'paid' && (
                <p className="mt-2 text-xs text-gray-500">확정된 후원만 발송 상태를 바꿀 수 있습니다.</p>
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3">관리자 메모</h2>
              <div className="flex flex-col gap-3">
                <TextArea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={3}
                  aria-label="관리자 메모"
                  light className="min-h-0 text-sm"
                />
                <Button disabled={busy} onClick={handleSaveMemo} className="self-start">메모 저장</Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
