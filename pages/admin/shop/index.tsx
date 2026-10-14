import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

import { AdminShell } from '../../../components/admin/AdminShell';
import { formatPriceAmount, SHOP_ARTIST_SHARE_PERCENT } from '../../../data/pricing';
import { SHOP_SALES_OPEN } from '../../../data/shop/policy';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { kstDateString } from '../../../lib/booking/kst';
import { kstMonthRange } from '../../../lib/shop/artistPayout';
import { countPendingShopProducts } from '../../../lib/shop/adminProducts';
import {
  listAdminShopOrders, listAdminSkuStock, listShopArtistSales,
  type AdminShopArtistSalesRow, type AdminShopOrderRow, type AdminSkuStockRow,
} from '../../../lib/shop/adminQueries';

interface Props {
  orders: AdminShopOrderRow[];
  skus: AdminSkuStockRow[];
  artistSales: AdminShopArtistSalesRow[];
  /** 정산 표의 달(KST 'YYYY-MM'). */
  month: string;
  prevMonth: string;
  nextMonth: string;
  salesOpen: boolean;
  /** 제출돼 심사를 기다리는 상품 수. 표가 없거나 조회가 실패하면 null. */
  pendingProducts: number | null;
  error?: string;
}

const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const now = new Date();
  const asked = typeof context.query.month === 'string' ? context.query.month : '';
  const month = kstMonthRange(asked) ? asked : kstDateString(now).slice(0, 7);
  const months = { month, prevMonth: shiftMonth(month, -1), nextMonth: shiftMonth(month, 1) };
  const pendingProducts = await countPendingShopProducts();
  try {
    const [orders, skus, artistSales] = await Promise.all([listAdminShopOrders(), listAdminSkuStock(now), listShopArtistSales(month)]);
    return { props: { orders, skus, artistSales, ...months, salesOpen: SHOP_SALES_OPEN, pendingProducts } };
  } catch (error: unknown) {
    console.error('[admin/shop] 조회 실패:', error);
    return { props: { orders: [], skus: [], artistSales: [], ...months, salesOpen: SHOP_SALES_OPEN, pendingProducts, error: '상점 정보를 불러오지 못했습니다. 운영 DB에 마이그레이션 0052가 적용됐는지 확인해 주세요.' } };
  }
};

const FULFILLMENT_LABEL: Record<string, string> = { preparing: '발송 준비', shipped: '발송함', delivered: '배송 완료', cancelled: '취소' };
const STATUS_LABEL: Record<string, string> = { paid: '결제 완료', partially_refunded: '부분 환불', refunded: '환불', auto_cancel_pending: '자동 취소 중' };
const kst = (sec: number) => new Date(sec * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function StockRow({ row }: { row: AdminSkuStockRow }) {
  const [value, setValue] = useState(row.stock === null ? '' : String(row.stock));
  const [state, setState] = useState<string | null>(null);
  const save = async () => {
    setState('저장 중…');
    const res = await fetch('/api/admin/shop/stock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skuId: row.skuId, stock: Number(value) }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (res.ok && data?.ok) window.location.reload();
    else setState(data?.message ?? '저장하지 못했습니다.');
  };
  return (
    <tr className="border-t border-gray-100">
      <td className="py-2 pr-3">{row.productTitle}{row.optionLabel ? ` · ${row.optionLabel}` : ''}<span className="block text-xs text-gray-500">{row.skuId}{row.retired ? ' · 판매 종료' : ''}{!row.published ? ' · 비공개' : ''}</span></td>
      <td className="py-2 pr-3 tabular-nums">{formatPriceAmount(row.price)}원</td>
      <td className="py-2 pr-3 tabular-nums">{row.remaining}</td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)}
            aria-label={`${row.skuId} 총 재고`}
            className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          />
          <button type="button" onClick={save} className="rounded-lg bg-gray-900 px-3 py-1 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">저장</button>
          {state && <span className="text-xs text-gray-600">{state}</span>}
        </div>
      </td>
    </tr>
  );
}

const won = (n: number) => `${formatPriceAmount(n)}원`;

function ArtistSalesSection({ rows, month, prevMonth, nextMonth }: Pick<Props, 'month' | 'prevMonth' | 'nextMonth'> & { rows: AdminShopArtistSalesRow[] }) {
  return (
    <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">아티스트 정산 예정 · {month}</h2>
        <div className="flex gap-3 text-xs">
          <Link href={`/admin/shop?month=${prevMonth}`} className="text-primary hover:underline">← {prevMonth}</Link>
          <Link href={`/admin/shop?month=${nextMonth}`} className="text-primary hover:underline">{nextMonth} →</Link>
        </div>
      </div>
      <p className="mb-3 text-gray-600">
        그 달에 발송한 결제 완료 주문의 위탁 상품만 셉니다. 배송 없는 디지털 주문은 결제 승인 월로 세고, 내려받기 전 주문은 철회할 수 있어 세지 않습니다. 아티스트 몫 {SHOP_ARTIST_SHARE_PERCENT}%(상품 판매가 기준). 아티스트가 직접 보낸 주문은 배송비 전액을 더합니다. 개인 아티스트는 부가세 상당액과 원천징수 3.3%를 뺍니다.
        이미 정산한 달의 반품 환불은 다음 정산에서 빼 주세요.
      </p>
      {rows.length === 0 ? (
        <p className="text-gray-600">이 달에 발송한 아티스트 상품이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs text-gray-500">
              <tr><th className="py-2 pr-3">아티스트</th><th className="py-2 pr-3">수량</th><th className="py-2 pr-3">판매액</th><th className="py-2 pr-3">공제</th><th className="py-2">이체액</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.artistSlug} className="border-t border-gray-100 align-top">
                  <td className="py-2 pr-3">
                    {r.artistName}
                    <span className="block text-xs text-gray-500">{r.taxType === 'invoice' ? '사업자 · 세금계산서' : r.taxType === 'withholding' ? '개인 · 원천징수' : r.artistSlug.startsWith('creator:') ? '세금 유형 미설정' : 'data/artists에 없음'}</span>
                    {r.businessNumberMissing && <span className="block text-xs font-semibold text-red-600">사업자등록번호 미등록</span>}
                    {r.withdrawableOrderCount > 0 && (
                      <span className="block text-xs text-amber-800">철회 가능 {r.withdrawableOrderCount}건 — 내려받기 전 디지털 주문이라 정산에 넣지 않았습니다</span>
                    )}
                    {r.needsReviewOrderNos.length > 0 && (
                      <span className="block text-xs text-amber-800">부분 환불 주문은 빼고 계산했습니다 — 직접 확인: {r.needsReviewOrderNos.join(', ')}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{r.quantity}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {won(r.salesAmount)}
                    {r.shippingAmount > 0 && <span className="block text-xs text-gray-600">+ 배송비 {won(r.shippingAmount)} ({r.shippingOrderCount}건, 전액 아티스트 몫)</span>}
                  </td>
                  <td className="py-2 pr-3 text-xs tabular-nums text-gray-600">
                    {r.payout ? (
                      <>상점 {won(r.payout.storeAmount)}{r.payout.vatDeductionAmount > 0 && <><br />부가세 상당 {won(r.payout.vatDeductionAmount)}</>}{r.payout.withholdingAmount > 0 && <><br />원천징수 {won(r.payout.withholdingAmount)}</>}</>
                    ) : '—'}
                  </td>
                  <td className="py-2 font-semibold tabular-nums">{r.payout ? won(r.payout.netAmount) : '세금 유형을 몰라 계산하지 않음'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminShopPage({ orders, skus, artistSales, month, prevMonth, nextMonth, salesOpen, pendingProducts, error }: Props) {
  return (
    <>
      <Head>
        <title>상점 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title="상점 관리" description="음반·굿즈 주문과 재고입니다. 새 상품은 상품 등록에서 만들고(스튜디오 상품도 같습니다), 아티스트가 올린 상품은 상품 심사에서 다룹니다. data/shop/catalog.ts의 기존 상품은 파일에서 고칩니다." width="wide" actions={(
        <span className="flex items-center gap-4">
          <Link href="/admin/shop/products/new" className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">상품 등록</Link>
          <Link href="/admin/shop/products" className="text-sm font-medium text-primary hover:underline">
            상품 심사{pendingProducts ? `(대기 ${pendingProducts})` : ''}
          </Link>
          <Link href="/admin/shop/artists" className="text-sm font-medium text-primary hover:underline">아티스트</Link>
        </span>
      )}>
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
        {!salesOpen && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            판매가 닫혀 있습니다(data/shop/policy.ts의 SHOP_SALES_OPEN). 여는 순서는 lib/shop/CLAUDE.md의 판매 개시 체크리스트를 보세요.
          </div>
        )}

        <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-900">재고</h2>
          <p className="mb-3 text-gray-600">총 재고 = 지금까지 내놓은 수량. 판매·결제 대기 수량은 주문에서 자동으로 빠지고, 취소·환불되면 돌아옵니다. 반품을 다시 팔 수 없으면 총 재고를 줄여 주세요.</p>
          {skus.length === 0 ? (
            <p className="text-gray-600">카탈로그에 상품이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-gray-500"><tr><th className="py-2 pr-3">SKU</th><th className="py-2 pr-3">가격</th><th className="py-2 pr-3">남음</th><th className="py-2">총 재고</th></tr></thead>
                <tbody>{skus.map((row) => <StockRow key={row.skuId} row={row} />)}</tbody>
              </table>
            </div>
          )}
        </section>

        <ArtistSalesSection rows={artistSales} month={month} prevMonth={prevMonth} nextMonth={nextMonth} />

        <section className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">주문</h2>
          {orders.length === 0 ? (
            <p className="text-gray-600">아직 주문이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-gray-500"><tr><th className="py-2 pr-3">주문</th><th className="py-2 pr-3">상품</th><th className="py-2 pr-3">금액</th><th className="py-2 pr-3">결제</th><th className="py-2">발송</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.orderNo} className="border-t border-gray-100 align-top">
                      <td className="py-2 pr-3">
                        <Link href={`/admin/shop/${o.orderNo}`} className="font-medium text-primary hover:underline">{o.orderNo}</Link>
                        <span className="block text-xs text-gray-500">{o.customerName} · {kst(o.createdAt)}</span>
                      </td>
                      <td className="py-2 pr-3">{o.itemSummary}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatPriceAmount(o.totalAmount)}원</td>
                      <td className="py-2 pr-3">{STATUS_LABEL[o.status] ?? o.status}</td>
                      <td className="py-2">
                        {FULFILLMENT_LABEL[o.fulfillmentStatus] ?? o.fulfillmentStatus}
                        {o.artistShipper && <span className="block text-xs text-amber-800">아티스트 발송: {o.artistShipper}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AdminShell>
    </>
  );
}
