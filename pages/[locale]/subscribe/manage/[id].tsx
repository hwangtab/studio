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
import { useRouter } from 'next/router';

import { Button } from '../../../../components/ui/Button';
import { Badge, type BadgeTone } from '../../../../components/ui/Badge';
import { Notice } from '../../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../../components/ui/PageHeader';
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

/** 상태 배지 색 — 이용 중은 success, 돈·카드를 기다리는 상태는 warning, 끝나거나 멈춘 것은 neutral. */
const STATUS_TONES: Record<SubscriptionStatus, BadgeTone> = {
  pending_card: 'warning',
  active: 'success',
  past_due: 'warning',
  paused: 'neutral',
  cancelled: 'neutral',
  ended: 'neutral',
};

const PAYMENT_STATUS_LABELS: Record<PaymentHistoryItem['status'], string> = {
  pending: '진행 중',
  paid: '결제 완료',
  failed: '결제 실패',
};

const PAYMENT_STATUS_TONES: Record<PaymentHistoryItem['status'], BadgeTone> = {
  pending: 'neutral',
  paid: 'success',
  failed: 'error',
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
    if (!window.confirm('정기결제를 해지할까요? 다음 결제일부터 청구가 멈추고, 이미 결제된 기간까지는 계속 이용하실 수 있어요.')) return;
    setCancelling(true);
    setActionError(null);
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || '해지 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setCurrentStatus('cancelled');
      if (typeof result.endsAt === 'string') setCurrentEndsAt(result.endsAt);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : '해지 처리 중 오류가 발생했어요.');
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
      if (!response.ok || !result.ok) throw new Error(result.message || '카드 변경 링크 발급에 실패했어요.');
      await router.push(`/ko/subscribe/${id}?token=${encodeURIComponent(result.setupToken)}`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : '카드 변경 처리 중 오류가 발생했어요.');
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
      <PageShell>
        {/* Layout이 헤더·푸터를 벗기는 화면이라(lib/analytics/privatePaths.ts) 여기가 브랜드를
            밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 피싱과 구별할 수 있어야 한다. */}
        <p className="typo-card-meta">스튜디오 놀</p>
        <PageHeader title="정기결제 관리" />

        <section className="glass-card rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="typo-card-subtitle text-gray-900 dark:text-white">{productName}</h2>
            <Badge size="md" tone={STATUS_TONES[currentStatus]} className="shrink-0">
              {STATUS_LABELS[currentStatus]}
            </Badge>
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
            <Notice tone="neutral" className="mt-6">
              해지가 접수됐어요. {currentEndsAt ? `${formatKstDate(currentEndsAt)}까지는 계속 이용하실 수 있어요.` : ''}
            </Notice>
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
                    <Badge tone={PAYMENT_STATUS_TONES[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionError && <Notice tone="error" className="mt-4">{actionError}</Notice>}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" variant="weak" disabled={changingCard} onClick={handleCardChange}>
              {changingCard ? '이동 중...' : '카드 변경'}
            </Button>
            {showCancelButton && (
              <Button
                type="button"
                variant="weak"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                disabled={cancelling}
                onClick={handleCancel}
              >
                {cancelling ? '해지 처리 중...' : '해지'}
              </Button>
            )}
          </div>
        </section>

        <p className="mt-6 typo-card-meta">문의: 스튜디오 놀 010-4255-7893</p>
        {/* 이 URL에는 관리·등록 토큰이 실린다 — 이탈 링크는 문서 이동(`<a href>`)이어야 한다.
            next/link 클라 전환으로 공개 페이지에 나갔다 뒤로가기를 누르면, 그 사이 mount된
            gtag가 토큰이 붙은 이 URL로 page_view를 보낸다. 공개 목적지에는 rel="noreferrer"도
            함께 — 사이트 Referrer-Policy가 동일 출처 이동에 전체 URL을 보낸다
            (규칙 정본: lib/analytics/privatePaths.ts). */}
        <Button asChild variant="ghost" size="sm" className="mt-2 -ml-3">
          <a href="/ko" rel="noreferrer">홈으로</a>
        </Button>
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<ManageProps>(async ({ query, res, params }) => {
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
      productName: subscriptionOrderName(subscription),
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
});

// 디자인 판 — lib/designEdition.ts
SubscribeManagePage.designEdition = 'v2';
