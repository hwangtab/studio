import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

import { AdminShell } from '../../../components/admin/AdminShell';
import { formatPriceAmount } from '../../../data/pricing';
import { SHOP_SALES_OPEN } from '../../../data/shop/policy';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { listAdminShopOrders, listAdminSkuStock, type AdminShopOrderRow, type AdminSkuStockRow } from '../../../lib/shop/adminQueries';

interface Props {
  orders: AdminShopOrderRow[];
  skus: AdminSkuStockRow[];
  salesOpen: boolean;
  error?: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  try {
    const [orders, skus] = await Promise.all([listAdminShopOrders(), listAdminSkuStock(new Date())]);
    return { props: { orders, skus, salesOpen: SHOP_SALES_OPEN } };
  } catch (error: unknown) {
    console.error('[admin/shop] 조회 실패:', error);
    return { props: { orders: [], skus: [], salesOpen: SHOP_SALES_OPEN, error: '상점 정보를 불러오지 못했습니다. 운영 DB에 마이그레이션 0052가 적용됐는지 확인해 주세요.' } };
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

export default function AdminShopPage({ orders, skus, salesOpen, error }: Props) {
  return (
    <>
      <Head>
        <title>상점 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title="상점 관리" description="음반·굿즈 주문과 재고입니다. 상품 정의(이름·옵션·가격)는 data/shop/catalog.ts에서 바꿉니다." width="wide">
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
        {!salesOpen && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            판매가 닫혀 있습니다(data/shop/policy.ts의 SHOP_SALES_OPEN). 여는 순서는 lib/shop/CLAUDE.md의 판매 개시 체크리스트를 보세요.
          </div>
        )}

        <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-1 font-semibold">재고</h2>
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

        <section className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-3 font-semibold">주문</h2>
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
                      <td className="py-2">{FULFILLMENT_LABEL[o.fulfillmentStatus] ?? o.fulfillmentStatus}</td>
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
