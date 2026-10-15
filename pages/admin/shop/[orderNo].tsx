import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

import { AdminShell } from '../../../components/admin/AdminShell';
import { formatPriceAmount } from '../../../data/pricing';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { remainingRefundable } from '../../../lib/booking/cancel';
import { isBankDepositPayment } from '../../../lib/payments/bankDeposit';
import { holderMatchesCustomer, loadRefundAccountSummary } from '../../../lib/payments/refundAccount';
import { shopLineName } from '../../../lib/shop/catalog';
import { resolveOrderShipper } from '../../../lib/shop/artistShipping';
import { getFirstDownloadedAt } from '../../../lib/shop/downloads';
import { loadOrderExtras } from '../../../lib/shop/orderExtras';
import { formatShipsOn } from '../../../lib/shop/preorder';
import { findShopOrderByOrderNo } from '../../../lib/shop/service';
import { normalizeShopOrderNo, shopOrderShips } from '../../../lib/shop/shape';
import { SHOP_STUDIO_COURIER } from '../../../lib/shop/shipper';

/** 환불 계좌 요약 — 은행명·예금주만. 계좌번호는 props에 싣지 않는다("계좌 보기"가 API로 가져온다). */
type RefundAccountSummaryProps =
  | { status: 'present'; bankName: string; accountHolder: string; updatedAt: number; refundedAt: number | null }
  | { status: 'none' }
  | { status: 'unavailable' };

interface Props {
  /** `orders.id` — "계좌 보기" API(`/api/admin/orders/<id>/refund-account`)가 쓴다. */
  orderId: string;
  refundAccount: RefundAccountSummaryProps | null;
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
  /** 계좌 입금으로 확정된 주문 — 환불은 토스가 아니라 운영자 송금 뒤 기록이다. */
  bankPaid: boolean;
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
  // 계좌 입금으로 확정된 주문의 환불 계좌(고객 셀프 취소로 접수된 것) — 접수된 행이 있을 때만 보인다.
  let refundAccount: RefundAccountSummaryProps | null = null;
  if (order.payments.some(isBankDepositPayment)) {
    const summary = await loadRefundAccountSummary({ kind: 'merch', orderNo: order.orderNo });
    refundAccount = summary.status === 'present'
      ? { status: 'present', bankName: summary.bankName, accountHolder: summary.accountHolder, updatedAt: Math.floor(summary.updatedAt.getTime() / 1000), refundedAt: summary.refundedAt ? Math.floor(summary.refundedAt.getTime() / 1000) : null }
      : summary;
  }
  return {
    props: {
      orderId: order.id,
      refundAccount,
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
      bankPaid: order.payments.some(isBankDepositPayment),
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
const PAYMENT_LABEL: Record<string, string> = { pending: '결제 대기', paid: '결제 완료', partially_refunded: '부분 환불', refunded: '환불', auto_cancel_pending: '자동 취소 중', expired: '만료', failed: '결제 실패', awaiting_deposit: '입금 대기', deposit_cancelled: '미입금 취소' };
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
  const [accountView, setAccountView] = useState<{ bankName: string; accountNumber: string; accountHolder: string } | null>(null);
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

  /** 환불 계좌 — 누를 때만 가져와 이 화면 state에만 둔다(props·HTML에 싣지 않는다). */
  const showAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${p.orderId}/refund-account`, { credentials: 'same-origin', cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; account?: { bankName: string; accountNumber: string; accountHolder: string }; message?: string } | null;
      if (res.ok && data?.ok && data.account) setAccountView(data.account);
      else setError(data?.message ?? '환불 계좌를 불러오지 못했습니다.');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
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

        {p.status === 'awaiting_deposit' && (
          <section className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm md:p-6">
            <h2 className="mb-2 text-lg font-bold">계좌 입금 대기</h2>
            <p className="mb-3">통장에 <strong>{p.customer.name}</strong> 이름으로 <strong>{formatPriceAmount(p.totalAmount)}원</strong>이 들어왔는지 확인하고 <strong>입금 확인</strong>을 눌러 주세요. 확인하면 주문이 확정되고 고객에게 메일이 가요. 자동 취소는 없어요 — 입금하지 않을 것 같으면 <strong>미입금 취소</strong>로 닫아 재고를 풀어 주세요.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => act({ action: 'confirm_deposit' }, `${formatPriceAmount(p.totalAmount)}원 입금을 확인했나요? 주문이 확정됩니다.`)} className={buttonClass}>입금 확인</button>
              <button type="button" disabled={busy} onClick={() => act({ action: 'cancel_deposit' }, '미입금으로 취소할까요? 잡아 둔 재고가 풀립니다.')} className={buttonClass}>미입금 취소</button>
              <button type="button" disabled={busy} onClick={() => act({ action: 'resend_deposit_guide' })} className={buttonClass}>입금 안내 재발송</button>
            </div>
          </section>
        )}

        {p.refundAccount?.status === 'present' && (
          <section className="mb-6 rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 text-sm text-orange-950 shadow-sm md:p-6">
            <h2 className="mb-2 text-lg font-bold">환불 계좌</h2>
            <p>{p.refundAccount.bankName} · 예금주 {p.refundAccount.accountHolder} (접수 {kst(p.refundAccount.updatedAt)})</p>
            {!holderMatchesCustomer(p.refundAccount.accountHolder, p.customer.name) && (
              <p className="mt-2 font-semibold text-red-700">예금주가 주문자 이름({p.customer.name})과 다릅니다. 가족 계좌일 수 있으니 필요하면 고객에게 확인해 주세요.</p>
            )}
            {accountView ? (
              <div className="mt-2 rounded border border-orange-200 bg-white p-3">
                <p>{accountView.bankName}</p>
                <p className="text-lg font-bold tracking-wide">{accountView.accountNumber}</p>
                <p>예금주 {accountView.accountHolder}</p>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={showAccount} className={`mt-2 ${buttonClass}`}>계좌 보기</button>
            )}
            <p className="mt-2 text-xs">"계좌 보기"를 누른 사실은 접속기록에 남습니다.</p>
            {p.refundAccount.refundedAt ? (
              <p className="mt-2 font-semibold">송금 완료: {kst(p.refundAccount.refundedAt)}</p>
            ) : (
              <button type="button" disabled={busy} onClick={() => act({ action: 'mark_refund_sent' }, '환불 계좌로 송금을 마쳤나요?')} className={`mt-2 ${buttonClass}`}>송금 완료</button>
            )}
          </section>
        )}
        {p.refundAccount?.status === 'unavailable' && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">환불 계좌를 불러오지 못했습니다(마이그레이션 0048·0061 확인).</div>
        )}

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
            {p.bankPaid ? (
              <p className="mb-3 rounded-lg bg-amber-50 p-3 text-amber-900">계좌로 입금하신 주문이에요. 고객에게 환불 계좌를 받아 <strong>먼저 {formatPriceAmount(p.refundable)}원을 송금한 뒤</strong> 눌러 기록하세요(토스는 부르지 않습니다). 고객이 직접 취소하며 계좌를 적었다면 위 "환불 계좌"에서 "송금 완료"를 누르세요. 발송한 뒤라면 반품을 받은 다음에 누르세요.</p>
            ) : (
              <p className="mb-3 text-gray-600">토스로 {formatPriceAmount(p.refundable)}원을 돌려주고 주문을 취소합니다. 발송한 뒤라면 반품을 받은 다음에 누르세요. 일부만 돌려줄 때는 토스 콘솔에서 하면 웹훅이 기록을 맞춥니다.</p>
            )}
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
