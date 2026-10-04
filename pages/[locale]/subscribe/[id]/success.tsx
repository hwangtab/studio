/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 관리 토큰·paymentKey·orderId가 실린다)의 이탈 링크는 next/link가
 * 아니라 문서 이동이어야 한다. 클라 전환으로 공개 페이지에 나갔다 뒤로가기 하면, 그 사이
 * mount된 gtag가 살아 있는 채로 비밀값이 붙은 URL에 돌아와 page_view를 보낸다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트:
 * tests/pages/privateLinkNavigation.test.ts
 */
import { withI18nServerProps } from '../../../../lib/getStatic';
import Head from 'next/head';

import { formatPriceAmount } from '../../../../data/pricing';
import { Button } from '../../../../components/ui/Button';
import { PageShell } from '../../../../components/ui/PageHeader';
import { ResultCard, type ResultTone } from '../../../../components/ui/ResultCard';
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

/** 결과별 제목·설명·보조 줄·카드 색. 첫 결제 실패는 카드는 등록된 상태지만 다음 행동이 "다시 등록"이라 error로 둔다. */
const RESULT_COPY: Record<
  Outcome,
  { tone: ResultTone; title: string; description: (p: SuccessProps) => string | undefined; note: (p: SuccessProps) => string | null }
> = {
  activated: {
    tone: 'success',
    title: '정기결제가 시작됐습니다',
    description: ({ amount }) => `첫 달 결제 완료 ${typeof amount === 'number' ? `${formatPriceAmount(amount)}원` : ''}`,
    note: ({ billingDay }) => (typeof billingDay === 'number' ? `다음 결제일: 매월 ${billingDay}일` : null),
  },
  card_changed: {
    tone: 'success',
    title: '카드 등록이 완료됐습니다',
    description: () => '이번 결제는 없으며, 다음 결제일부터 새 카드로 청구됩니다.',
    note: () => null,
  },
  first_charge_failed: {
    tone: 'error',
    title: '카드는 등록됐으나 결제가 승인되지 않았습니다',
    description: ({ message }) => message,
    note: () => '다른 카드로 다시 등록해야 합니다 — 담당자에게 새 등록 링크를 요청해 주세요. 010-4255-7893',
  },
  error: {
    tone: 'error',
    title: '카드 등록을 완료하지 못했습니다',
    description: ({ message }) => message,
    note: () => '문의: 010-4255-7893',
  },
};

export default function SubscribeSuccessPage(props: SuccessProps) {
  const { outcome, manageUrl } = props;
  const copy = RESULT_COPY[outcome];
  const note = copy.note(props);
  return (
    <>
      <Head>
        <title>정기결제 등록 결과 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <PageShell width="result">
        {/* Layout이 헤더·푸터를 벗기는 화면이라(lib/analytics/privatePaths.ts) 여기가 브랜드를
            밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 피싱과 구별할 수 있어야 한다. */}
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>
        <ResultCard
          tone={copy.tone}
          as="h1"
          title={copy.title}
          description={copy.description(props)}
          actions={
            <>
              {/* 메일 실패에 대비해 화면에도 관리 링크를 띄운다 — booking/success.tsx와 같은 판단.
                  목적지도 토큰이 붙는 private 화면이라 rel은 불필요하지만, 문서 이동인 것은
                  필수다(아래 규칙). */}
              {manageUrl && (
                <Button asChild>
                  <a href={manageUrl}>구독 조회·해지 페이지 열기</a>
                </Button>
              )}
              {/* 이 URL에는 관리·등록 토큰이 실린다 — 이탈 링크는 문서 이동(`<a href>`)이어야 한다.
                  next/link 클라 전환으로 공개 페이지에 나갔다 뒤로가기를 누르면, 그 사이 mount된
                  gtag가 토큰이 붙은 이 URL로 page_view를 보낸다. 공개 목적지에는 rel="noreferrer"도
                  함께 — 사이트 Referrer-Policy가 동일 출처 이동에 전체 URL을 보낸다
                  (규칙 정본: lib/analytics/privatePaths.ts). */}
              <Button asChild variant="ghost">
                <a href="/ko" rel="noreferrer">홈으로</a>
              </Button>
            </>
          }
        >
          {note && <p className="text-center typo-card-meta">{note}</p>}
        </ResultCard>
        {manageUrl && <p className="mt-4 break-all text-center typo-caption">이 주소를 저장해 두세요: {manageUrl}</p>}
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<SuccessProps>(async ({ query, res, params }) => {
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
});

// 디자인 판 — lib/designEdition.ts
SubscribeSuccessPage.designEdition = 'v2';
