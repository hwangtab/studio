/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 관리 토큰이 실린다)의 이탈 링크는 문서 이동이어야 한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트: tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';
import { useState } from 'react';

import { Button } from '../../../../components/ui/Button';
import { Notice } from '../../../../components/ui/Notice';
import { PageShell } from '../../../../components/ui/PageHeader';
import { Panel } from '../../../../components/ui/Panel';
import { PriceSummary } from '../../../../components/ui/PriceSummary';
import StatusBadge from '../../../../components/ui/StatusBadge';
import { getSiteConfig } from '../../../../data/siteConfig';
import { isTokenMatch } from '../../../../lib/booking/token';
import { withI18nServerProps } from '../../../../lib/getStatic';
import { shopLineName } from '../../../../lib/shop/catalog';
import { loadOrderExtras } from '../../../../lib/shop/orderExtras';
import { formatShipsOn } from '../../../../lib/shop/preorder';
import { findShopOrderByOrderNo } from '../../../../lib/shop/service';
import { normalizeShopOrderNo } from '../../../../lib/shop/shape';

interface Props {
  orderNo: string;
  token: string;
  state: 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'unpaid';
  lines: Array<{ label: string; quantity: number; amount: number; serials: string | null }>;
  /** 아직 오지 않은 가장 늦은 발송 예정일(YYYY-MM-DD). 발송 전 예약 주문만. */
  shipsOn: string | null;
  shippingFee: number;
  totalAmount: number;
  recipient: string;
  address: string;
  courier: string | null;
  trackingNumber: string | null;
}

const STATE_LABEL: Record<Props['state'], string> = {
  preparing: '보낼 준비 중',
  shipped: '보냈어요',
  delivered: '배송 완료',
  cancelled: '취소됨',
  unpaid: '결제 전',
};

export default function ShopManagePage(props: Props) {
  const { orderNo, token, state, lines, shipsOn, shippingFee, totalAmount, recipient, address, courier, trackingNumber } = props;
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const cancel = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/shop/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNo, token }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && data?.ok) {
        window.location.reload();
        return;
      }
      setMessage({ tone: 'error', text: data?.message || '취소하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    } catch {
      setMessage({ tone: 'error', text: '네트워크 오류로 취소하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Head>
        <title>주문 확인 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="form">
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>
        <header className="mb-6 text-center">
          <h1 className="typo-page-title text-gray-900 dark:text-white">주문 확인</h1>
          <p className="mt-2 typo-card-meta">주문번호 {orderNo}</p>
          <StatusBadge tone={state === 'cancelled' || state === 'unpaid' ? 'neutral' : 'active'} className="mt-3">{STATE_LABEL[state]}</StatusBadge>
        </header>

        <PriceSummary
          className="mb-6"
          items={[...lines.map((l) => ({ label: l.label, amount: l.amount, quantity: l.quantity, unit: '개' })), { label: '배송비', amount: shippingFee }]}
          total={totalAmount}
          totalLabel="결제 금액 (부가세 포함)"
        />

        <Panel className="mb-6 space-y-1 text-sm text-gray-800 dark:text-gray-200">
          <p><span className="text-gray-500 dark:text-gray-400">받는 분</span> {recipient}</p>
          <p><span className="text-gray-500 dark:text-gray-400">배송지</span> {address}</p>
          {state === 'preparing' && shipsOn && (
            <p><span className="text-gray-500 dark:text-gray-400">발송 예정</span> {formatShipsOn(shipsOn)}</p>
          )}
          {lines.filter((l) => l.serials).map((l) => (
            <p key={l.label}><span className="text-gray-500 dark:text-gray-400">한정판</span> {l.label} {l.serials}</p>
          ))}
          {courier && trackingNumber && (
            <p><span className="text-gray-500 dark:text-gray-400">운송장</span> {courier} {trackingNumber}</p>
          )}
        </Panel>

        {message && <Notice tone={message.tone} className="mb-4">{message.text}</Notice>}

        {state === 'preparing' && (
          <div className="space-y-3">
            {!confirming ? (
              <Button type="button" variant="weak" fullWidth onClick={() => setConfirming(true)}>주문 취소하기</Button>
            ) : (
              <Panel className="space-y-3">
                <p className="text-sm text-gray-800 dark:text-gray-200">주문을 취소하고 결제하신 수단으로 전액을 돌려받을까요?</p>
                <div className="flex gap-2">
                  <Button type="button" onClick={cancel} disabled={busy}>{busy ? '처리 중…' : '네, 취소할게요'}</Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>아니요</Button>
                </div>
              </Panel>
            )}
          </div>
        )}
        {(state === 'shipped' || state === 'delivered') && (
          <p className="typo-card-meta">교환·반품은 받으신 날부터 7일 안에 카카오톡이나 010-4255-7893으로 요청해 주세요.</p>
        )}

        <p className="mt-8 text-center typo-card-meta">
          <a href={kakaoUrl} target="_blank" rel="noopener noreferrer" className="underline">카카오톡 문의</a>
          {' · '}
          <a href="tel:01042557893" rel="noreferrer" className="underline">010-4255-7893</a>
          {' · '}
          <a href="/ko/shop" rel="noreferrer" className="underline">상점으로</a>
        </p>
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, query, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (params?.locale !== 'ko') return { notFound: true };
  // 미들웨어가 경로를 소문자로 308한다 — 주문번호는 대문자로 맞춰 비교한다(공연 manage와 같다).
  const orderNo = normalizeShopOrderNo(params?.orderNo);
  const token = typeof query.token === 'string' ? query.token : '';
  if (!orderNo || !token) return { notFound: true };
  const order = await findShopOrderByOrderNo(orderNo).catch(() => undefined);
  if (!order || !order.shopOrder || !isTokenMatch(order.manageToken, token)) return { notFound: true };
  const so = order.shopOrder;
  const extras = await loadOrderExtras(order.orderNo, so.items, new Date()).catch(() => null);
  const paid = order.status === 'paid' || order.status === 'partially_refunded' || order.status === 'refunded';
  return {
    props: {
      orderNo: order.orderNo,
      token,
      state: !paid ? 'unpaid' : so.fulfillmentStatus,
      lines: so.items.map((i) => ({ label: shopLineName(i.productTitle, i.optionLabel), quantity: i.quantity, amount: i.unitPrice * i.quantity, serials: extras?.serialsByItem.get(i.id) ?? null })),
      shipsOn: extras?.latestShipsOn ?? null,
      shippingFee: so.shippingFee,
      totalAmount: order.totalAmount,
      recipient: `${so.recipientName} · ${so.recipientPhone}`,
      address: `(${so.postcode}) ${so.address1}${so.address2 ? ` ${so.address2}` : ''}`,
      courier: so.courier,
      trackingNumber: so.trackingNumber,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
ShopManagePage.designEdition = 'v2';
