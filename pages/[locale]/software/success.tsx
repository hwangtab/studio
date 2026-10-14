/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 토스 paymentKey·orderId가 실린다)의 이탈 링크는 문서 이동이어야 한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트: tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';
import { useEffect } from 'react';

import { SOFTWARE_DRAFT_KEY } from '../../../components/software/SoftwareOrderForm';
import { Button } from '../../../components/ui/Button';
import { PageShell } from '../../../components/ui/PageHeader';
import { ResultCard } from '../../../components/ui/ResultCard';
import { formatPriceAmount } from '../../../data/pricing';
import { TOSS_KEY_CHANNEL_PARAM, tossKeyChannelFromQuery } from '../../../lib/booking/toss';
import { clearStoredDraft } from '../../../lib/formDraft';
import { withI18nServerProps } from '../../../lib/getStatic';
import { confirmSoftwareOrder } from '../../../lib/software/confirm';
import { findSoftwareOrder, SOFTWARE_ORDER_NO_PATTERN } from '../../../lib/software/order';

interface Props {
  outcome: 'confirmed' | 'error';
  message?: string;
  orderNo?: string;
  totalAmount?: number;
  receiptUrl?: string | null;
  manageUrl?: string;
  licenseKeys?: string[];
}

export default function SoftwareSuccessPage({ outcome, message, orderNo, totalAmount, receiptUrl, manageUrl, licenseKeys }: Props) {
  useEffect(() => {
    if (outcome === 'confirmed') clearStoredDraft(SOFTWARE_DRAFT_KEY);
  }, [outcome]);

  return (
    <>
      <Head>
        <title>{outcome === 'confirmed' ? '구매 완료' : '결제 확인 실패'} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="result">
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>
        {outcome === 'confirmed' ? (
          <ResultCard
            tone="success"
            as="h1"
            title="구매해 주셔서 고마워요"
            description="설치한 뒤 플러그인(또는 앱)에 아래 라이선스 키를 넣으면 정식판으로 바뀌어요. 같은 키를 메일로도 보내 드렸어요."
            actions={
              <>
                {manageUrl && (
                  <Button asChild>
                    <a href={manageUrl} rel="noreferrer">구매 내역·설치 파일</a>
                  </Button>
                )}
                {receiptUrl && (
                  <Button asChild variant="weak">
                    <a href={receiptUrl} target="_blank" rel="noreferrer">영수증 보기</a>
                  </Button>
                )}
              </>
            }
          >
            {licenseKeys && licenseKeys.length > 0 ? (
              <div className="space-y-1 text-center">
                {licenseKeys.map((k) => <p key={k} className="select-all font-mono text-lg tracking-wide text-gray-900 dark:text-white">{k}</p>)}
              </div>
            ) : (
              <p className="text-center typo-card-meta">라이선스 키를 만드는 중이에요. 몇 분 안에 메일로 보내 드려요.</p>
            )}
            <dl className="mt-4 space-y-1 text-center typo-card-meta">
              <div><dt className="inline">주문번호 </dt><dd className="inline">{orderNo}</dd></div>
              {typeof totalAmount === 'number' && (
                <div><dt className="inline">결제 금액 </dt><dd className="inline tabular-nums">{formatPriceAmount(totalAmount)}원 (부가세 포함)</dd></div>
              )}
            </dl>
          </ResultCard>
        ) : (
          <ResultCard
            tone="error"
            as="h1"
            title="결제를 확정하지 못했어요"
            description={message}
            actions={<Button asChild variant="ghost"><a href="/ko/software" rel="noreferrer">소프트웨어로</a></Button>}
          >
            <p className="text-center typo-card-meta">결제가 이뤄졌다면 자동으로 취소되거나 확정돼요. 문의: 010-4255-7893</p>
          </ResultCard>
        )}
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/software', permanent: false } };
  const { paymentKey, orderId, amount } = query;
  if (typeof paymentKey !== 'string' || typeof orderId !== 'string' || typeof amount !== 'string' || !SOFTWARE_ORDER_NO_PATTERN.test(orderId)) {
    return { props: { outcome: 'error', message: '잘못된 접근이에요.' } };
  }
  const result = await confirmSoftwareOrder({
    orderNo: orderId,
    paymentKey,
    amount: Number(amount),
    channel: tossKeyChannelFromQuery(query[TOSS_KEY_CHANNEL_PARAM]),
  });
  if (!result.ok) return { props: { outcome: 'error', message: result.message } };
  const placed = await findSoftwareOrder(result.orderNo).catch(() => null);
  return {
    props: {
      outcome: 'confirmed',
      orderNo: result.orderNo,
      totalAmount: result.totalAmount,
      receiptUrl: result.receiptUrl,
      manageUrl: `/ko/software/manage/${result.orderNo}?token=${encodeURIComponent(result.manageToken)}`,
      licenseKeys: (placed?.licenses ?? []).filter((l) => l.status === 'active').map((l) => l.licenseKey),
    },
  };
});

// 디자인 판 — lib/designEdition.ts
SoftwareSuccessPage.designEdition = 'v2';
