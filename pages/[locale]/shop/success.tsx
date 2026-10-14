/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 토스 paymentKey·orderId가 실린다)의 이탈 링크는 문서 이동이어야 한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트: tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';
import { useEffect } from 'react';

import { Button } from '../../../components/ui/Button';
import { PageShell } from '../../../components/ui/PageHeader';
import { ResultCard } from '../../../components/ui/ResultCard';
import { formatPriceAmount } from '../../../data/pricing';
import { TOSS_KEY_CHANNEL_PARAM, tossKeyChannelFromQuery } from '../../../lib/booking/toss';
import { clearStoredDraft } from '../../../lib/formDraft';
import { withI18nServerProps } from '../../../lib/getStatic';
import { confirmShopOrder } from '../../../lib/shop/confirm';
import { findShopOrderByOrderNo } from '../../../lib/shop/service';
import { SHOP_DRAFT_KEY } from '../../../lib/shop/draft';
import { SHOP_ORDER_NO_PATTERN, shopOrderShips } from '../../../lib/shop/shape';

interface Props {
  outcome: 'confirmed' | 'error';
  message?: string;
  orderNo?: string;
  totalAmount?: number;
  receiptUrl?: string | null;
  manageUrl?: string;
  /** 디지털 상품만 담은 주문(배송 없음). */
  digitalOnly?: boolean;
}

export default function ShopSuccessPage({ outcome, message, orderNo, totalAmount, receiptUrl, manageUrl, digitalOnly }: Props) {
  // 결제가 확정됐으면 주문 폼의 입력 초안(이름·주소)을 지운다 — 공용 PC에 남지 않게.
  useEffect(() => {
    if (outcome === 'confirmed') clearStoredDraft(SHOP_DRAFT_KEY);
  }, [outcome]);

  return (
    <>
      <Head>
        <title>{outcome === 'confirmed' ? '주문 완료' : '결제 확인 실패'} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="result">
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>
        {outcome === 'confirmed' ? (
          <ResultCard
            tone="success"
            as="h1"
            title="주문이 접수됐어요"
            description={digitalOnly ? '주문 확인 페이지에서 파일을 내려받을 수 있어요.' : '준비되는 대로 보내 드리고, 운송장 번호를 메일로 알려 드릴게요.'}
            actions={
              <>
                {manageUrl && (
                  <Button asChild>
                    <a href={manageUrl} rel="noreferrer">{digitalOnly ? '주문 확인·내려받기' : '주문 확인'}</a>
                  </Button>
                )}
                {receiptUrl && (
                  <Button asChild variant="weak">
                    <a href={receiptUrl} target="_blank" rel="noreferrer">영수증 보기</a>
                  </Button>
                )}
                <Button asChild variant="ghost">
                  <a href="/ko/shop" rel="noreferrer">상점으로</a>
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
            <p className="mt-4 text-center typo-card-meta">{digitalOnly ? '내려받기 전에는 주문 확인 페이지에서 바로 취소할 수 있어요.' : '보내기 전에는 주문 확인 페이지에서 바로 취소할 수 있어요.'}</p>
          </ResultCard>
        ) : (
          <ResultCard
            tone="error"
            as="h1"
            title="결제를 확정하지 못했어요"
            description={message}
            actions={
              <Button asChild variant="ghost">
                <a href="/ko/shop" rel="noreferrer">상점으로</a>
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

export const getServerSideProps = withI18nServerProps<Props>(async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/shop', permanent: false } };
  const { paymentKey, orderId, amount } = query;
  if (typeof paymentKey !== 'string' || typeof orderId !== 'string' || typeof amount !== 'string' || !SHOP_ORDER_NO_PATTERN.test(orderId)) {
    return { props: { outcome: 'error', message: '잘못된 접근이에요.' } };
  }
  const result = await confirmShopOrder({
    orderNo: orderId,
    paymentKey,
    amount: Number(amount),
    channel: tossKeyChannelFromQuery(query[TOSS_KEY_CHANNEL_PARAM]),
  });
  if (!result.ok) return { props: { outcome: 'error', message: result.message } };
  // 배송이 없는 주문인지 — 안내 문구만 바뀐다. 조회가 흔들리면 배송 있는 주문의 문구로 둔다.
  const placed = await findShopOrderByOrderNo(result.orderNo).catch(() => null);
  const digitalOnly = Boolean(placed?.shopOrder && !shopOrderShips(placed.shopOrder));
  return {
    props: {
      outcome: 'confirmed',
      orderNo: result.orderNo,
      totalAmount: result.totalAmount,
      receiptUrl: result.receiptUrl,
      manageUrl: `/ko/shop/manage/${result.orderNo}?token=${encodeURIComponent(result.manageToken)}`,
      digitalOnly,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
ShopSuccessPage.designEdition = 'v2';
