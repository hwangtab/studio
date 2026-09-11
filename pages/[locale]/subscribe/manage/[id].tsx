import { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { Button } from '../../../../components/ui/Button';
import { formatPriceAmount } from '../../../../data/pricing';
import type { SubscriptionStatus } from '../../../../lib/billing/service';
import { subscriptionOrderName } from '../../../../lib/billing/amounts';
import { findSubscriptionForManage, getSubscriptionWithDetails } from '../../../../lib/billing/service';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';

interface PaymentHistoryItem {
  cycleYm: string;
  attempt: number;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  attemptedAt: string;
}

interface ManageProps {
  id: string;
  token: string;
  productName: string;
  status: SubscriptionStatus;
  /** active·past_due·paused에서만 표시(해지·종료 구독은 다음 결제일이 없다). */
  nextBillingAt: string | null;
  /** 해지 예정(endsAt)일 때만 채워진다. */
  endsAt: string | null;
  cardCompany: string | null;
  cardNumberMasked: string | null;
  totalAmount: number;
  payments: PaymentHistoryItem[];
}

/** 해지 버튼을 보여줄 상태 — active·past_due·paused에서만(스펙 §6). */
const CANCELLABLE_STATUSES: SubscriptionStatus[] = ['active', 'past_due', 'paused'];

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending_card: '카드 등록 대기',
  active: '이용 중',
  past_due: '결제 실패 · 재시도 예정',
  paused: '정지',
  cancelled: '해지 예정',
  ended: '종료',
};

/** '2026-09-10T00:00:00.000Z' → '2026.09.10' (KST 고정 오프셋, booking/manage와 동일 방식). */
const formatKstDate = (isoString: string): string => {
  const kst = new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
};

const PAYMENT_STATUS_LABELS: Record<PaymentHistoryItem['status'], string> = {
  pending: '진행 중',
  paid: '결제 완료',
  failed: '결제 실패',
};

export default function SubscribeManagePage(props: ManageProps) {
  const router = useRouter();
  const { id, token, productName, status, nextBillingAt, endsAt, cardCompany, cardNumberMasked, totalAmount, payments } = props;
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentEndsAt, setCurrentEndsAt] = useState(endsAt);
  const [cancelling, setCancelling] = useState(false);
  const [changingCard, setChangingCard] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!window.confirm('정기결제를 해지하시겠습니까? 다음 결제일부터 청구가 멈추고, 이미 결제된 기간까지는 계속 이용하실 수 있습니다.')) return;
    setCancelling(true);
    setActionError(null);
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || '해지 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setCurrentStatus('cancelled');
      if (typeof result.endsAt === 'string') setCurrentEndsAt(result.endsAt);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : '해지 처리 중 오류가 발생했습니다.');
    } finally {
      setCancelling(false);
    }
  };

  const handleCardChange = async () => {
    setChangingCard(true);
    setActionError(null);
    try {
      const response = await fetch('/api/subscriptions/card-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || '카드 변경 링크 발급에 실패했습니다.');
      await router.push(`/ko/subscribe/${id}?token=${encodeURIComponent(result.setupToken)}`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : '카드 변경 처리 중 오류가 발생했습니다.');
      setChangingCard(false);
    }
  };

  const showNextBillingAt = nextBillingAt && !['cancelled', 'paused', 'ended'].includes(currentStatus);
  const showCancelButton = CANCELLABLE_STATUSES.includes(currentStatus);

  return (
    <>
      <Head>
        <title>정기결제 관리 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <main className="mx-auto max-w-2xl min-w-0 max-w-full px-4 py-12 sm:py-16">
        <h1 className="typo-page-title">정기결제 관리</h1>

        <section className="mt-8 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="typo-card-subtitle text-gray-900 dark:text-white">{productName}</h2>
            <span className="shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
              {STATUS_LABELS[currentStatus]}
            </span>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">월 청구액</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{formatPriceAmount(totalAmount)}원 (VAT 포함)</dd>
            </div>
            {showNextBillingAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">다음 결제일</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{formatKstDate(nextBillingAt!)}</dd>
              </div>
            )}
            {currentStatus === 'cancelled' && currentEndsAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">이용 종료일</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{formatKstDate(currentEndsAt)}까지 이용 가능</dd>
              </div>
            )}
            {cardNumberMasked && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">등록 카드</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {cardCompany ? `${cardCompany} ` : ''}
                  {cardNumberMasked}
                </dd>
              </div>
            )}
          </dl>

          {currentStatus === 'cancelled' && (
            <div className="mt-6 rounded-md bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-600 dark:text-gray-300">
              해지가 접수되었습니다. {currentEndsAt ? `${formatKstDate(currentEndsAt)}까지는 계속 이용하실 수 있습니다.` : ''}
            </div>
          )}

          {payments.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">결제 이력</h3>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                {payments.map((p) => (
                  <li key={`${p.cycleYm}-${p.attempt}`} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-gray-600 dark:text-gray-300">
                      {p.cycleYm} {p.attempt > 1 ? `(${p.attempt}차 시도)` : ''}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">{formatKstDate(p.attemptedAt)}</span>
                    <span
                      className={
                        p.status === 'paid'
                          ? 'font-medium text-green-700 dark:text-green-400'
                          : p.status === 'failed'
                            ? 'font-medium text-red-600 dark:text-red-400'
                            : 'font-medium text-gray-500 dark:text-gray-400'
                      }
                    >
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionError && (
            <p role="alert" className="mt-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
              {actionError}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" variant="outline" disabled={changingCard} onClick={handleCardChange}>
              {changingCard ? '이동 중...' : '카드 변경'}
            </Button>
            {showCancelButton && (
              <Button
                type="button"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                disabled={cancelling}
                onClick={handleCancel}
              >
                {cancelling ? '해지 처리 중...' : '해지'}
              </Button>
            )}
          </div>
        </section>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">문의: 스튜디오 놀 010-4255-7893</p>
        <Link href="/ko" className="mt-2 inline-block text-sm text-primary dark:text-primary-lighter hover:underline">
          홈으로
        </Link>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ManageProps> = async ({ query, res, params }) => {
  denyContractPageCaching(res);
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { id } = params as { id: string };
  const { token } = query;
  // 토큰 없음·불일치·구독 부재를 전부 notFound로 답한다 — booking/manage와 같은 원칙
  // (구분해 알려주면 id 존재 여부를 토큰 없이 확인하는 창구가 된다).
  if (typeof id !== 'string' || typeof token !== 'string' || token.trim() === '') {
    return { notFound: true };
  }

  const found = await findSubscriptionForManage(id, token);
  if (!found.ok) return { notFound: true };

  const details = await getSubscriptionWithDetails(id);
  if (!details) return { notFound: true };
  const { subscription, billingKey, payments } = details;

  return {
    props: {
      id: subscription.id,
      token,
      productName: subscriptionOrderName(subscription.kind),
      status: subscription.status,
      nextBillingAt: subscription.nextBillingAt ? subscription.nextBillingAt.toISOString() : null,
      endsAt: subscription.endsAt ? subscription.endsAt.toISOString() : null,
      cardCompany: billingKey?.cardCompany ?? null,
      cardNumberMasked: billingKey?.cardNumberMasked ?? null,
      totalAmount: subscription.totalAmount,
      payments: payments.slice(0, 12).map((p) => ({
        cycleYm: p.cycleYm,
        attempt: p.attempt,
        amount: p.amount,
        status: p.status,
        attemptedAt: p.attemptedAt.toISOString(),
      })),
    },
  };
};
