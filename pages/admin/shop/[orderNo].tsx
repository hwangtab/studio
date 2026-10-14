import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

import { AdminShell } from '../../../components/admin/AdminShell';
import { formatPriceAmount } from '../../../data/pricing';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { remainingRefundable } from '../../../lib/booking/cancel';
import { shopLineName } from '../../../lib/shop/catalog';
import { resolveOrderShipper } from '../../../lib/shop/artistShipping';
import { getFirstDownloadedAt } from '../../../lib/shop/downloads';
import { loadOrderExtras } from '../../../lib/shop/orderExtras';
import { formatShipsOn } from '../../../lib/shop/preorder';
import { findShopOrderByOrderNo } from '../../../lib/shop/service';
import { normalizeShopOrderNo, shopOrderShips } from '../../../lib/shop/shape';
import { SHOP_STUDIO_COURIER } from '../../../lib/shop/shipper';

interface Props {
  orderNo: string;
  status: string;
  fulfillmentStatus: string;
  customer: { name: string; phone: string; email: string };
  recipient: { name: string; phone: string; address: string; memo: string | null };
  lines: Array<{ label: string; quantity: number; amount: number; shipsOn: string | null; serials: string | null }>;
  latestShipsOn: string | null;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  refundable: number;
  paymentMethod: string | null;
  receiptUrl: string | null;
  courier: string | null;
  trackingNumber: string | null;
  notificationError: string | null;
  /** 배송이 있는 주문인가. 디지털 상품만이면 false(발송 처리·배송지 없음). */
  ships: boolean;
  /** 고객이 처음 내려받은 시각(초). 없으면 null. */
  downloadedAt: number | null;
  /** 발송 주체. 'artist'면 그 아티스트가 콘솔에서 보낸다(관리자도 대신 처리할 수 있다). */
  shipper: { kind: 'studio' } | { kind: 'artist'; name: string };
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const orderNo = normalizeShopOrderNo(context.params?.orderNo);
  if (!orderNo) return { notFound: true };
  const order = await findShopOrderByOrderNo(orderNo);
  if (!order || !order.shopOrder) return { notFound: true };
  const so = order.shopOrder;
  const payment = order.payments[0];
  const extras = await loadOrderExtras(order.orderNo, so.items, new Date()).catch(() => null);
  const downloadedAt = so.items.some((i) => i.skuId.startsWith('db-')) ? await getFirstDownloadedAt(order.orderNo).catch(() => null) : null;
  const found = await resolveOrderShipper(order.orderNo);
  const shipper: Props['shipper'] = found.kind === 'artist' ? { kind: 'artist', name: found.creatorName } : { kind: 'studio' };
  return {
    props: {
      shipper,
      orderNo: order.orderNo,
      status: order.status,
      fulfillmentStatus: so.fulfillmentStatus,
      customer: { name: order.customerName, phone: order.customerPhone, email: order.customerEmail },
      recipient: { name: so.recipientName, phone: so.recipientPhone, address: `(${so.postcode}) ${so.address1}${so.address2 ? ` ${so.address2}` : ''}`, memo: so.shippingMemo },
      lines: so.items.map((i) => ({
        label: shopLineName(i.productTitle, i.optionLabel), quantity: i.quantity, amount: i.unitPrice * i.quantity,
        shipsOn: extras?.shipsOnByItem.get(i.id) ?? null, serials: extras?.serialsByItem.get(i.id) ?? null,
      })),
      latestShipsOn: extras?.latestShipsOn ?? null,
      subtotal: so.subtotalAmount,
      shippingFee: so.shippingFee,
      totalAmount: order.totalAmount,
      refundable: remainingRefundable(order, order.payments),
      paymentMethod: payment?.method ?? null,
      receiptUrl: payment?.receiptUrl ?? null,
      courier: so.courier,
      trackingNumber: so.trackingNumber,
      notificationError: order.notificationError,
      ships: shopOrderShips(so),
      downloadedAt,
    },
  };
};

const kst = (sec: number) => new Date(sec * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const PAYMENT_LABEL: Record<string, string> = { pending: '결제 대기', paid: '결제 완료', partially_refunded: '부분 환불', refunded: '환불', auto_cancel_pending: '자동 취소 중', expired: '만료', failed: '결제 실패' };
const FULFILLMENT_LABEL: Record<string, string> = { preparing: '발송 준비', shipped: '발송함', delivered: '배송 완료', cancelled: '취소' };
const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';
const buttonClass = 'rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';

export default function AdminShopOrderPage(p: Props) {
  // 스튜디오가 보내는 주문은 택배사가 로젠택배다 — 처음 보낼 때 채워 둔다. 아티스트가 보내는 주문은 아티스트가 고른 택배사를 따른다.
  const [courier, setCourier] = useState(p.courier ?? (p.shipper.kind === 'studio' ? SHOP_STUDIO_COURIER : ''));
  const [tracking, setTracking] = useState(p.trackingNumber ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = p.status === 'paid' || p.status === 'partially_refunded';

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/shop/orders/${p.orderNo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && data?.ok) window.location.reload();
      else setError(data?.message ?? '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>{p.orderNo} | 상점 관리</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title={`상점 주문 ${p.orderNo}`} description={`${PAYMENT_LABEL[p.status] ?? p.status} · ${FULFILLMENT_LABEL[p.fulfillmentStatus] ?? p.fulfillmentStatus}`}>
        <p className="mb-4 text-sm"><Link href="/admin/shop" className="text-primary hover:underline">← 상점 관리</Link></p>
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
        {p.notificationError && <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">마지막 메일 발송 실패: {p.notificationError}</div>}

        <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-900">주문</h2>
          <ul className="mb-3 space-y-1">
            {p.lines.map((l) => (
              <li key={l.label}>
                {l.label} × {l.quantity} — {formatPriceAmount(l.amount)}원
                {l.shipsOn && <span className="ml-2 text-amber-700">예약 · {formatShipsOn(l.shipsOn)} 발송 예정</span>}
                {l.serials && <span className="ml-2 font-semibold">포장할 번호 {l.serials}</span>}
              </li>
            ))}
          </ul>
          {p.latestShipsOn && <p className="mb-2 text-amber-800">예약 상품이 있어요. {formatShipsOn(p.latestShipsOn)} 이후에 함께 보내세요.</p>}
          <p>상품 {formatPriceAmount(p.subtotal)}원{p.ships && <> + 배송비 {formatPriceAmount(p.shippingFee)}원</>} = <strong>{formatPriceAmount(p.totalAmount)}원</strong></p>
          <p className="mt-1 text-gray-600">결제수단 {p.paymentMethod ?? '-'}{p.receiptUrl && <> · <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">영수증</a></>} · 환불 가능 잔액 {formatPriceAmount(p.refundable)}원</p>
        </section>

        <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-900">{p.ships ? '주문자·받는 분' : '주문자'}</h2>
          {p.ships && <p className="mb-1">발송 {p.shipper.kind === 'artist' ? `아티스트 발송: ${p.shipper.name}` : '스튜디오 발송'}</p>}
          <p>주문자 {p.customer.name} · {p.customer.phone} · {p.customer.email}</p>
          {p.ships ? (
            <>
              <p className="mt-1">받는 분 {p.recipient.name} · {p.recipient.phone}</p>
              <p className="mt-1">배송지 {p.recipient.address}</p>
              {p.recipient.memo && <p className="mt-1">배송 메모 {p.recipient.memo}</p>}
            </>
          ) : (
            <p className="mt-1 text-gray-600">배송 없음(디지털 상품). 첫 내려받기에서 배송 완료로 바뀝니다.</p>
          )}
          <p className="mt-1">내려받기 {p.downloadedAt ? kst(p.downloadedAt) : '아직 없음'}</p>
        </section>

        {p.ships && paid && p.fulfillmentStatus !== 'cancelled' && (
          <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
            <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-900">발송</h2>
            {p.shipper.kind === 'artist' && (
              <p className="mb-3 rounded-lg bg-amber-50 p-3 text-amber-900">아티스트가 직접 보내는 주문입니다({p.shipper.name}). 아티스트가 콘솔에서 발송 처리하며, 필요하면 여기서 대신 처리할 수 있습니다.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
              <label className="block">택배사<input value={courier} onChange={(e) => setCourier(e.target.value)} className={`mt-1 ${inputClass}`} /></label>
              <label className="block">운송장 번호<input value={tracking} onChange={(e) => setTracking(e.target.value)} className={`mt-1 ${inputClass}`} /></label>
              <button type="button" disabled={busy} onClick={() => act({ action: 'ship', courier, trackingNumber: tracking })} className={buttonClass}>
                {p.fulfillmentStatus === 'preparing' ? '발송 처리(고객 메일)' : '운송장 고치기'}
              </button>
            </div>
            {p.fulfillmentStatus === 'shipped' && (
              <button type="button" disabled={busy} onClick={() => act({ action: 'deliver' })} className={`mt-3 ${buttonClass}`}>배송 완료로 표시</button>
            )}
          </section>
        )}

        {paid && p.refundable > 0 && (
          <section className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
            <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-900">전액 환불</h2>
            {p.downloadedAt && (
              <div role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                고객이 {kst(p.downloadedAt)}에 파일을 내려받았습니다. 환불하면 파일을 받은 채 돈을 돌려주게 됩니다. 파일 문제 등 환불할 사유인지 확인하세요.
              </div>
            )}
            <p className="mb-3 text-gray-600">토스로 {formatPriceAmount(p.refundable)}원을 돌려주고 주문을 취소합니다. 발송한 뒤라면 반품을 받은 다음에 누르세요. 일부만 돌려줄 때는 토스 콘솔에서 하면 웹훅이 기록을 맞춥니다.</p>
            <label className="block">사유<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 반품 접수(불량)" className={`mt-1 ${inputClass}`} /></label>
            <button type="button" disabled={busy} onClick={() => act({ action: 'refund', reason }, `${p.downloadedAt ? `고객이 ${kst(p.downloadedAt)}에 파일을 내려받았습니다. ` : ''}${formatPriceAmount(p.refundable)}원을 환불할까요? 되돌릴 수 없습니다.`)} className={`mt-3 ${buttonClass}`}>
              전액 환불
            </button>
          </section>
        )}
      </AdminShell>
    </>
  );
}
