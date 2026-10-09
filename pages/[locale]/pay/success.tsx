/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 토스 paymentKey·orderId가 실린다)의 이탈 링크는 문서 이동이어야 한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트: tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';

import { getSiteConfig } from '../../../data/siteConfig';
import { formatPriceAmount } from '../../../data/pricing';
import { confirmDepositPayment } from '../../../lib/booking/confirmDeposit';
import { TOSS_KEY_CHANNEL_PARAM, tossKeyChannelFromQuery } from '../../../lib/booking/toss';
import { withI18nServerProps } from '../../../lib/getStatic';
import { Button } from '../../../components/ui/Button';
import { PageShell } from '../../../components/ui/PageHeader';
import { ResultCard } from '../../../components/ui/ResultCard';

interface PaySuccessProps {
  outcome: 'confirmed' | 'error';
  message?: string;
  orderNo?: string;
  totalAmount?: number;
  receiptUrl?: string | null;
}

export default function PaymentLinkSuccessPage({ outcome, message, orderNo, totalAmount, receiptUrl }: PaySuccessProps) {
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  return (
    <>
      <Head>
        <title>{outcome === 'confirmed' ? '결제 완료' : '결제 확인 실패'} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="result">
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>
        {outcome === 'confirmed' ? (
          <ResultCard
            tone="success"
            as="h1"
            title="결제가 완료됐어요"
            actions={
              <>
                {receiptUrl && (
                  <Button asChild>
                    <a href={receiptUrl} target="_blank" rel="noreferrer">
                      영수증 보기
                    </a>
                  </Button>
                )}
                <Button asChild variant="ghost">
                  <a href="/ko" rel="noreferrer">
                    홈으로
                  </a>
                </Button>
              </>
            }
          >
            <dl className="space-y-1 text-center typo-card-meta">
              <div>
                <dt className="inline">주문번호 </dt>
                <dd className="inline">{orderNo}</dd>
              </div>
              {typeof totalAmount === 'number' && (
                <div>
                  <dt className="inline">결제 금액 </dt>
                  <dd className="inline tabular-nums">{formatPriceAmount(totalAmount)}원 (부가세 포함)</dd>
                </div>
              )}
            </dl>
            <p className="mt-4 text-center typo-card-meta">
              문의:{' '}
              <a href={kakaoUrl} target="_blank" rel="noopener noreferrer" className="underline">
                카카오톡
              </a>{' '}
              · 010-4255-7893
            </p>
          </ResultCard>
        ) : (
          <ResultCard
            tone="error"
            as="h1"
            title="결제를 확정하지 못했어요"
            description={message}
            actions={
              <Button asChild variant="ghost">
                <a href="/ko" rel="noreferrer">
                  홈으로
                </a>
              </Button>
            }
          >
            <p className="text-center typo-card-meta">결제가 이뤄졌다면 자동으로 취소되거나 확정돼요. 문의: 010-4255-7893</p>
          </ResultCard>
        )}
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<PaySuccessProps>(async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };
  const { paymentKey, orderId, amount } = query;
  if (typeof paymentKey !== 'string' || typeof orderId !== 'string' || typeof amount !== 'string')
    return { props: { outcome: 'error', message: '잘못된 접근이에요.' } };

  const result = await confirmDepositPayment({
    orderNo: orderId,
    paymentKey,
    amount: Number(amount),
    channel: tossKeyChannelFromQuery(query[TOSS_KEY_CHANNEL_PARAM]),
  });
  if (!result.ok) return { props: { outcome: 'error', message: result.message } };
  return {
    props: {
      outcome: 'confirmed',
      orderNo: result.orderNo,
      totalAmount: result.totalAmount,
      receiptUrl: result.receiptUrl,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
PaymentLinkSuccessPage.designEdition = 'v2';
