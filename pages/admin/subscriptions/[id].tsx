import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import {
  copyToClipboard,
  mutateSubscription,
  type SubscriptionActionResult,
} from '../../../components/admin/subscriptionActions';
import { Button } from '../../../components/ui/Button';
import { Field, TextArea } from '../../../components/ui/Field';
import { lightOnlyControl, lightOnlyField } from '../../../components/ui/adminFieldClass';
import { getSubscriptionWithDetails } from '../../../lib/billing/service';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatPriceAmount } from '../../../data/pricing';
import { subscriptionOrderName } from '../../../lib/billing/amounts';
import {
  serializeBillingKey,
  serializeSubscription,
  serializeSubscriptionPayment,
  type SerializedBillingKey,
  type SerializedSubscription,
  type SerializedSubscriptionContract,
  type SerializedSubscriptionPayment,
} from '../../../lib/billing/admin-serialize';
import { formatKstDateTimeFull } from '../../../lib/booking/format';

interface AdminSubscriptionDetailPageProps {
  subscription: SerializedSubscription;
  billingKey: SerializedBillingKey | null;
  payments: SerializedSubscriptionPayment[];
  contract: SerializedSubscriptionContract | null;
}

export const getServerSideProps: GetServerSideProps<AdminSubscriptionDetailPageProps> = async (
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

  const details = await getSubscriptionWithDetails(id).catch((error: unknown) => {
    console.error('[admin/subscriptions/[id]] Failed to load subscription:', error);
    return null;
  });

  if (!details) {
    return { notFound: true };
  }

  return {
    props: {
      subscription: serializeSubscription(details.subscription),
      billingKey: details.billingKey ? serializeBillingKey(details.billingKey) : null,
      payments: details.payments.map(serializeSubscriptionPayment),
      contract: details.contract,
    },
  };
};

const KIND_LABELS: Record<string, string> = {
  'practice-room': '연습실',
  lesson: '레슨',
};

const STATUS_LABELS: Record<string, string> = {
  pending_card: '카드 등록 대기',
  active: '정상',
  past_due: '결제 재시도 중',
  paused: '정지',
  cancelled: '해지 예약',
  ended: '종료',
};

const STATUS_CLASS: Record<string, string> = {
  pending_card: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-amber-100 text-amber-800',
  paused: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-600',
  ended: 'bg-gray-200 text-gray-500',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '처리 중',
  paid: '결제완료',
  failed: '실패',
};

const PAYMENT_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const DescriptionRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="font-medium text-right">{value}</dd>
  </div>
);

export default function AdminSubscriptionDetailPage({
  subscription,
  billingKey,
  payments,
  contract,
}: AdminSubscriptionDetailPageProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);

  const run = async (
    task: () => Promise<SubscriptionActionResult & { url?: string }>,
    confirmText?: string,
  ) => {
    if (confirmText && !window.confirm(confirmText)) return;

    setBusy(true);
    setNotice(null);
    const result = await task();
    setBusy(false);

    if (!result.ok) {
      setNotice(result.message ?? '요청을 처리하지 못했습니다.');
    } else if (result.url) {
      setLinkNotice(result.url);
    }
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const handleCharge = () =>
    run(
      () => mutateSubscription(subscription.id, 'charge'),
      '지금 이 구독의 이번 회차를 수동으로 결제할까요?',
    );

  const handlePause = () =>
    run(() => mutateSubscription(subscription.id, 'pause'), '이 구독의 청구를 일시정지할까요?');

  const handleResume = () =>
    run(() => mutateSubscription(subscription.id, 'resume'), '이 구독을 재개할까요? 다음 결제가 즉시 예약됩니다.');

  const handleCardChangeLink = () =>
    run(() => mutateSubscription(subscription.id, 'card_change_link'), '카드 변경 링크를 새로 발급하고 고객에게 메일을 보낼까요?');

  const handleResendSetup = () =>
    run(() => mutateSubscription(subscription.id, 'resend_setup'), '카드 등록 안내 메일을 다시 보낼까요?');

  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelError(null);
    const reason = cancelReason.trim();
    if (reason === '') {
      setCancelError('해지 사유를 입력해 주세요.');
      return;
    }
    if (!window.confirm('이 구독을 해지할까요? 다음 결제일부터 청구가 멈춥니다.')) return;
    await run(() => mutateSubscription(subscription.id, 'cancel', { reason }));
  };

  const canCharge = subscription.status === 'active' || subscription.status === 'past_due' || subscription.status === 'paused';
  const canPause = subscription.status === 'active' || subscription.status === 'past_due';
  const canResume = subscription.status === 'paused';
  const canCancel = subscription.status === 'active' || subscription.status === 'past_due' || subscription.status === 'paused';
  const canCardChangeLink =
    subscription.status === 'pending_card' ||
    subscription.status === 'active' ||
    subscription.status === 'past_due' ||
    subscription.status === 'paused';
  const canResendSetup = subscription.status === 'pending_card';

  return (
    <>
      <Head>
        <title>{subscription.customerName}님 구독 상세 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">구독 상세</h1>
            <Link href="/admin/subscriptions" passHref>
              <Button variant="outline">목록으로</Button>
            </Link>
          </div>

          {notice && <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>}

          {linkNotice && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-900 rounded-lg text-sm">
              <strong className="block mb-2">고객에게 보낼 링크</strong>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate bg-white border border-green-200 rounded px-2 py-1 text-xs">
                  {linkNotice}
                </code>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const ok = await copyToClipboard(linkNotice);
                    setNotice(ok ? '링크를 복사했습니다.' : '복사에 실패했습니다.');
                  }}
                >
                  복사
                </Button>
              </div>
              <p className="mt-2 text-green-700">카톡으로 보내는 것이 주 채널입니다.</p>
            </div>
          )}

          {subscription.notificationError && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
              <strong className="block mb-1">메일 발송에 실패했습니다</strong>
              {subscription.notificationError}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="p-6 md:p-8 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  {KIND_LABELS[subscription.kind] ?? subscription.kind}
                </span>
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASS[subscription.status]}`}
                >
                  {STATUS_LABELS[subscription.status] ?? subscription.status}
                </span>
                <span className="text-gray-400 text-xs font-mono">{subscription.id}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">고객 정보</h2>
                  <dl className="space-y-2 text-sm">
                    <DescriptionRow label="이름" value={subscription.customerName} />
                    <DescriptionRow label="전화번호" value={subscription.customerPhone} />
                    <DescriptionRow label="이메일" value={subscription.customerEmail} />
                  </dl>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">구독 정보</h2>
                  <dl className="space-y-2 text-sm">
                    <DescriptionRow label="상품" value={subscriptionOrderName(subscription.kind as 'practice-room' | 'lesson')} />
                    <DescriptionRow label="월 청구액" value={`${formatPriceAmount(subscription.totalAmount)}원 (VAT 포함)`} />
                    <DescriptionRow label="결제일" value={`매월 ${subscription.billingDay}일`} />
                    <DescriptionRow
                      label="다음 결제일"
                      value={subscription.nextBillingAt ? formatKstDateTimeFull(subscription.nextBillingAt) : '-'}
                    />
                    {contract && (
                      <DescriptionRow
                        label="연결 계약"
                        value={
                          <Link href={`/admin/contracts/${contract.id}`} className="text-primary hover:underline">
                            {contract.roomNumber}호 계약
                          </Link>
                        }
                      />
                    )}
                    {subscription.cancelledAt && (
                      <DescriptionRow label="해지 접수일" value={formatKstDateTimeFull(subscription.cancelledAt)} />
                    )}
                    {subscription.endsAt && <DescriptionRow label="이용 종료일" value={formatKstDateTimeFull(subscription.endsAt)} />}
                    {subscription.cancelReason && <DescriptionRow label="해지 사유" value={subscription.cancelReason} />}
                  </dl>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">카드</h2>
              {billingKey ? (
                <dl className="space-y-2 text-sm">
                  <DescriptionRow label="카드사" value={billingKey.cardCompany ?? '-'} />
                  <DescriptionRow label="카드번호" value={billingKey.cardNumberMasked ?? '-'} />
                  <DescriptionRow label="등록일" value={formatKstDateTimeFull(billingKey.issuedAt)} />
                </dl>
              ) : (
                <p className="text-sm text-gray-500">등록된 카드가 없습니다.</p>
              )}
            </div>

            <div className="p-6 md:p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">회차 이력</h2>
              {payments.length === 0 ? (
                <p className="text-sm text-gray-500">아직 결제 시도가 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-2 py-2 text-left">회차</th>
                        <th className="px-2 py-2 text-left">시도</th>
                        <th className="px-2 py-2 text-left">상태</th>
                        <th className="px-2 py-2 text-right">금액</th>
                        <th className="px-2 py-2 text-left">토스 코드</th>
                        <th className="px-2 py-2 text-left">시도 일시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-2 py-2">{p.cycleYm}</td>
                          <td className="px-2 py-2">{p.attempt}</td>
                          <td className="px-2 py-2">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_CLASS[p.status]}`}
                            >
                              {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right">{formatPriceAmount(p.amount)}원</td>
                          <td className="px-2 py-2 text-gray-500">
                            {p.tossCode ? `${p.tossCode}${p.tossMessage ? ` — ${p.tossMessage}` : ''}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-gray-500">{formatKstDateTimeFull(p.attemptedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs text-gray-400">
                회차 환불은 토스 콘솔에서 직접 취소해 주세요. 웹훅이 취소 상태를 자동으로 동기화합니다.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">작업</h2>
              <div className="flex flex-wrap gap-3">
                {canCharge && (
                  <Button disabled={busy} onClick={handleCharge}>
                    수동 결제
                  </Button>
                )}
                {canPause && (
                  <Button variant="secondary" disabled={busy} onClick={handlePause}>
                    일시정지
                  </Button>
                )}
                {canResume && (
                  <Button disabled={busy} onClick={handleResume}>
                    재개
                  </Button>
                )}
                {canCardChangeLink && (
                  <Button variant="outline" disabled={busy} onClick={handleCardChangeLink}>
                    카드 변경 링크 발급
                  </Button>
                )}
                {canResendSetup && (
                  <Button variant="outline" disabled={busy} onClick={handleResendSetup}>
                    등록 링크 재발송
                  </Button>
                )}
                {!canCharge && !canPause && !canResume && !canCardChangeLink && !canResendSetup && (
                  <p className="text-sm text-gray-500">지금 상태에서는 가능한 작업이 없습니다.</p>
                )}
              </div>
            </div>

            {canCancel && (
              <div className="pt-6 border-t border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-1">해지</h2>
                <p className="text-sm text-gray-500 mb-4">
                  해지하면 다음 결제일부터 청구가 멈춥니다. 이미 결제한 기간은 끝까지 이용할 수 있습니다.
                </p>
                <form onSubmit={handleCancel} className="space-y-3 max-w-md">
                  <Field id="cancel-reason" label="해지 사유" className={lightOnlyField}>
                    <TextArea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={2}
                      placeholder="예: 고객 요청 — 개인 사정으로 해지"
                      className={`min-h-0 text-sm ${lightOnlyControl}`}
                    />
                  </Field>
                  {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
                  <Button type="submit" variant="outline" disabled={busy}>
                    해지 처리
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
