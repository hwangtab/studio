import type { GetServerSideProps } from 'next';
import Head from 'next/head';

import { formatPriceAmount } from '../../../../data/pricing';
import {
  sendSubscriptionActivatedEmail,
  sendSubscriptionOperatorAlert,
  subscriptionManageUrl,
} from '../../../../lib/billing/email';
import { completeCardSetup, getSubscriptionWithDetails } from '../../../../lib/billing/service';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';

type Outcome = 'activated' | 'card_changed' | 'first_charge_failed' | 'error';

interface SuccessProps {
  outcome: Outcome;
  message?: string;
  amount?: number;
  billingDay?: number;
  manageUrl?: string;
}

export default function SubscribeSuccessPage({ outcome, message, amount, billingDay, manageUrl }: SuccessProps) {
  return (
    <>
      <Head>
        <title>정기결제 등록 결과 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <main className="mx-auto max-w-lg min-w-0 max-w-full px-4 py-24 text-center">
        {outcome === 'activated' && (
          <>
            <h1 className="typo-page-title">정기결제가 시작됐습니다</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              첫 달 결제 완료 {typeof amount === 'number' ? `${formatPriceAmount(amount)}원` : ''}
            </p>
            {typeof billingDay === 'number' && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">다음 결제일: 매월 {billingDay}일</p>
            )}
          </>
        )}
        {outcome === 'card_changed' && (
          <>
            <h1 className="typo-page-title">카드 등록이 완료됐습니다</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">이번 결제는 없으며, 다음 결제일부터 새 카드로 청구됩니다.</p>
          </>
        )}
        {outcome === 'first_charge_failed' && (
          <>
            <h1 className="typo-page-title">카드는 등록됐으나 결제가 승인되지 않았습니다</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">{message}</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              다른 카드로 다시 등록해야 합니다 — 담당자에게 새 등록 링크를 요청해 주세요. 010-4255-7893
            </p>
          </>
        )}
        {outcome === 'error' && (
          <>
            <h1 className="typo-page-title">카드 등록을 완료하지 못했습니다</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">{message}</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">문의: 010-4255-7893</p>
          </>
        )}

        {/* 메일 실패에 대비해 화면에도 관리 링크를 띄운다 — booking/success.tsx와 같은 판단. */}
        {manageUrl && (
          <>
            <p className="mt-6">
              {/* 목적지도 토큰이 붙는 private 화면이라 rel은 불필요하지만, 문서 이동인 것은
                  필수다(위 규칙). */}
              <a
                href={manageUrl}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-primary-dark"
              >
                구독 조회·해지 페이지 열기
              </a>
            </p>
            <p className="mt-3 break-all text-xs text-gray-500 dark:text-gray-400">이 주소를 저장해 두세요: {manageUrl}</p>
          </>
        )}

        {/* 이 URL에는 관리·등록 토큰이 실린다 — 이탈 링크는 문서 이동(`<a href>`)이어야 한다.
            next/link 클라 전환으로 공개 페이지에 나갔다 뒤로가기를 누르면, 그 사이 mount된
            gtag가 토큰이 붙은 이 URL로 page_view를 보낸다. 공개 목적지에는 rel="noreferrer"도
            함께 — 사이트 Referrer-Policy가 동일 출처 이동에 전체 URL을 보낸다
            (규칙 정본: lib/analytics/privatePaths.ts). */}
        <a href="/ko" rel="noreferrer" className="mt-8 inline-block underline">홈으로</a>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SuccessProps> = async ({ query, res, params }) => {
  denyContractPageCaching(res);
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { id } = params as { id: string };
  const { token, customerKey, authKey } = query;
  if (
    typeof id !== 'string' ||
    typeof token !== 'string' ||
    typeof customerKey !== 'string' ||
    typeof authKey !== 'string'
  ) {
    return { props: { outcome: 'error', message: '잘못된 접근입니다.' } };
  }

  const now = new Date();
  const result = await completeCardSetup({ id, token, authKey, customerKey }, now);

  if (!result.ok) {
    if (result.code === 'first_charge_failed') {
      // 카드는 등록됐지만 첫 결제가 거부된 상태 — 구독은 pending_card로 남아 조용히
      // 방치될 수 있으므로 운영자에게 바로 알린다(스펙 §6).
      const details = await getSubscriptionWithDetails(id);
      if (details) {
        const alertError = await sendSubscriptionOperatorAlert(details.subscription, 'first_charge_failed', result.message);
        if (alertError) console.error('[subscribe] 첫 결제 실패 운영자 알림 발송 실패', { subscriptionId: id, alertError });
      }
      return { props: { outcome: 'first_charge_failed', message: result.message } };
    }
    return { props: { outcome: 'error', message: result.message } };
  }

  const details = await getSubscriptionWithDetails(id);
  if (!details) return { props: { outcome: 'error', message: '구독 정보를 찾을 수 없습니다.' } };
  const { subscription } = details;
  const manageUrl = subscriptionManageUrl(subscription);

  if (!result.charged) {
    // 카드 교체(setupMode='change')는 결제 없이 키만 갈아 끼운다 — 확정 메일이 아니라
    // 화면 안내만으로 충분하다(스펙 §6, service.ts completeCardSetup 주석과 같은 판단).
    return { props: { outcome: 'card_changed', manageUrl } };
  }

  const emailError = await sendSubscriptionActivatedEmail(subscription, {
    manageUrl,
    amount: subscription.totalAmount,
  });
  if (emailError) {
    console.error('[subscribe] 카드 등록 확정 메일 발송 실패', { subscriptionId: id, emailError });
  }

  return {
    props: {
      outcome: 'activated',
      amount: subscription.totalAmount,
      billingDay: subscription.billingDay,
      manageUrl,
    },
  };
};
