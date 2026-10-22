import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

import { Button, buttonVariants } from '../../../components/ui/Button';
import { TextInput } from '../../../components/ui/Field';
import { AdminShell } from '../../../components/admin/AdminShell';
import { ShopPayoutSection } from '../../../components/admin/ShopPayoutSection';
import { formatPriceAmount, SHOP_ARTIST_SHARE_PERCENT } from '../../../data/pricing';
import { SHOP_SALES_OPEN } from '../../../data/shop/policy';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { kstDateString } from '../../../lib/booking/kst';
import { kstMonthRange } from '../../../lib/shop/artistPayout';
import { isMissingTableError } from '../../../lib/dbErrors';
import { listAllUnappliedAdjustments } from '../../../lib/partnerPayouts/adjustments';
import { buildShopPayoutPreviews } from '../../../lib/partnerPayouts/shop';
import {
  serializeAdjustment, serializeShopPayoutPreview, type AdjustmentView, type ShopPayoutRowView,
} from '../../../lib/partnerPayouts/shopView';
import { countPendingShopProducts } from '../../../lib/shop/adminProducts';
import { Notice } from '../../../components/ui/Notice';
import { formatAdminDateTimeFromSeconds } from '../../../lib/admin/displayDate';
import {
  listAdminShopOrders, listAdminSkuStock, listShopArtistSales,
  type AdminShopArtistSalesRow, type AdminShopOrderRow, type AdminSkuStockRow,
} from '../../../lib/shop/adminQueries';

const ORDER_LIST_LIMIT = 200;

interface Props {
  orders: AdminShopOrderRow[];
  /** 주문이 화면 상한(200건)에서 잘렸는가 — 오래된 주문은 검색으로 찾는다. */
  ordersTruncated?: boolean;
  /** 주문 검색어. */
  q?: string;
  skus: AdminSkuStockRow[];
  /** 정산 기록 표(0067)를 못 읽었을 때만 채운다 — 예전 "정산 예정" 표로 되돌아간다. */
  artistSales: AdminShopArtistSalesRow[];
  /** 아티스트 정산 표(기록·조정 포함). 표가 없거나 읽지 못하면 null. */
  payoutRows: ShopPayoutRowView[] | null;
  /** 정산 기록 표를 읽지 못한 이유 — 'migration_needed'(0067 미적용)이면 안내 문구를 띄운다. */
  payoutsError: 'migration_needed' | 'error' | null;
  /** 이 달 표에 행이 없는 수취인의 미적용 조정. */
  otherAdjustments: Array<AdjustmentView & { payeeName: string | null }>;
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
    const qParam = context.query.q;
    const q = typeof qParam === 'string' ? qParam.trim().slice(0, 60) : '';
    const [fetched, skus] = await Promise.all([listAdminShopOrders(ORDER_LIST_LIMIT + 1, q), listAdminSkuStock(now)]);
    const orders = fetched.slice(0, ORDER_LIST_LIMIT);
    // 정산 표는 별도 try — 정산 기록 표(0067)가 없는 DB에서도 재고·주문 화면은 그대로 열려야 한다. 못 읽으면 예전 "정산 예정" 표로 되돌아간다.
    let payoutRows: ShopPayoutRowView[] | null = null;
    let payoutsError: Props['payoutsError'] = null;
    let otherAdjustments: Props['otherAdjustments'] = [];
    let artistSales: AdminShopArtistSalesRow[] = [];
    try {
      const previews = await buildShopPayoutPreviews(month);
      payoutRows = previews.map(serializeShopPayoutPreview);
      const names = new Map(previews.map((p) => [p.subjectKey, p.payeeName]));
      otherAdjustments = (await listAllUnappliedAdjustments('shop'))
        .filter((a) => !previews.some((p) => p.subjectKey === a.payeeKey))
        .map((a) => ({ ...serializeAdjustment(a), payeeName: names.get(a.payeeKey) ?? null }));
    } catch (payoutError: unknown) {
      payoutRows = null;
      payoutsError = isMissingTableError(payoutError) ? 'migration_needed' : 'error';
      if (payoutsError === 'error') console.error('[admin/shop] 정산 표 조회 실패 — 예전 정산 예정 표로 대신합니다:', payoutError);
      artistSales = await listShopArtistSales(month);
    }
    return { props: { orders, ordersTruncated: fetched.length > ORDER_LIST_LIMIT, q, skus, artistSales, payoutRows, payoutsError, otherAdjustments, ...months, salesOpen: SHOP_SALES_OPEN, pendingProducts } };
  } catch (error: unknown) {
    console.error('[admin/shop] 조회 실패:', error);
    return { props: { orders: [], skus: [], artistSales: [], payoutRows: null, payoutsError: null, otherAdjustments: [], ...months, salesOpen: SHOP_SALES_OPEN, pendingProducts, error: '상점 정보를 불러오지 못했습니다. 운영 DB에 마이그레이션 0052가 적용됐는지 확인해 주세요.' } };
  }
};

const FULFILLMENT_LABEL: Record<string, string> = { preparing: '발송 준비', shipped: '발송함', delivered: '배송 완료', cancelled: '취소' };
const STATUS_LABEL: Record<string, string> = { paid: '결제 완료', partially_refunded: '부분 환불', refunded: '환불', auto_cancel_pending: '자동 취소 중', awaiting_deposit: '입금 대기', deposit_cancelled: '미입금 취소' };
const kst = (sec: number) => formatAdminDateTimeFromSeconds(sec);

function StockRow({ row }: { row: AdminSkuStockRow }) {
  const [value, setValue] = useState(row.stock === null ? '' : String(row.stock));
  const [state, setState] = useState<string | null>(null);
  const save = async () => {
    // 재고가 아직 없는 SKU는 칸이 비어 있다 — 비운 채 저장하면 Number('')이 0이라 "품절"로 덮어쓴다.
    if (value.trim() === '' || !Number.isInteger(Number(value)) || Number(value) < 0) {
      setState('재고 수(0 이상의 정수)를 입력해 주세요.');
      return;
    }
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
      <td data-label="가격" className="py-2 pr-3 tabular-nums">{formatPriceAmount(row.price)}원</td>
      <td data-label="남음" className="py-2 pr-3 tabular-nums">{row.remaining}</td>
      <td data-label="총 재고" className="py-2">
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)}
            aria-label={`${row.skuId} 총 재고`}
            className="h-11 w-24 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          />
          <button type="button" onClick={save} className={buttonVariants({ variant: 'solid', size: 'sm', light: true })}>저장</button>
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
          <table className="admin-table w-full text-left">
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
                  <td data-label="수량" className="py-2 pr-3 tabular-nums">{r.quantity}</td>
                  <td data-label="판매액" className="py-2 pr-3 tabular-nums">
                    {won(r.salesAmount)}
                    {r.shippingAmount > 0 && <span className="block text-xs text-gray-600">+ 배송비 {won(r.shippingAmount)} ({r.shippingOrderCount}건, 전액 아티스트 몫)</span>}
                  </td>
                  <td data-label="공제" className="py-2 pr-3 text-xs tabular-nums text-gray-600">
                    {r.payout ? (
                      <>상점 {won(r.payout.storeAmount)}{r.payout.vatDeductionAmount > 0 && <><br />부가세 상당 {won(r.payout.vatDeductionAmount)}</>}{r.payout.withholdingAmount > 0 && <><br />원천징수 {won(r.payout.withholdingAmount)}</>}</>
                    ) : '—'}
                  </td>
                  <td data-label="이체액" className="py-2 font-semibold tabular-nums">{r.payout ? won(r.payout.netAmount) : '세금 유형을 몰라 계산하지 않음'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminShopPage({ orders, ordersTruncated = false, q = '', skus, artistSales, payoutRows, payoutsError, otherAdjustments, month, prevMonth, nextMonth, salesOpen, pendingProducts, error }: Props) {
  return (
    <>
      <Head>
        <title>상점 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title="상점 관리" description="음반·굿즈 주문과 재고입니다. 새 상품은 상품 등록에서 만들고(스튜디오 상품도 같습니다), 아티스트가 올린 상품은 상품 심사에서 다룹니다. data/shop/catalog.ts의 기존 상품은 파일에서 고칩니다." width="wide" actions={(
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/admin/shop/products/new" className={buttonVariants({ variant: 'solid', size: 'sm', light: true })}>상품 등록</Link>
          <Link href="/admin/shop/products" className="text-sm font-medium text-primary hover:underline">
            상품 심사{pendingProducts ? `(대기 ${pendingProducts})` : ''}
          </Link>
          <Link href="/admin/shop/artists" className="text-sm font-medium text-primary hover:underline">아티스트</Link>
        </span>
      )}>
        {error && <Notice tone="error" light className="mb-4">{error}</Notice>}
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
              <table className="admin-table w-full text-left">
                <thead className="text-xs text-gray-500"><tr><th className="py-2 pr-3">SKU</th><th className="py-2 pr-3">가격</th><th className="py-2 pr-3">남음</th><th className="py-2">총 재고</th></tr></thead>
                <tbody>{skus.map((row) => <StockRow key={row.skuId} row={row} />)}</tbody>
              </table>
            </div>
          )}
        </section>

        {payoutsError === 'migration_needed' && (
          <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            정산 기록 표가 아직 없습니다 — 운영 DB에 마이그레이션 0067(partner_payouts)을 적용하면 정산 기록·지급 완료·이월 조정을 쓸 수 있습니다. 그동안은 아래 예전 「정산 예정」 표로 계산만 보입니다.
          </div>
        )}
        {payoutsError === 'error' && (
          <Notice tone="error" light className="mb-4">정산 기록을 불러오지 못해 예전 「정산 예정」 표로 대신합니다. 잠시 뒤 새로고침해 주세요.</Notice>
        )}
        {payoutRows ? (
          <ShopPayoutSection rows={payoutRows} month={month} prevMonth={prevMonth} nextMonth={nextMonth} otherAdjustments={otherAdjustments} />
        ) : (
          <ArtistSalesSection rows={artistSales} month={month} prevMonth={prevMonth} nextMonth={nextMonth} />
        )}

        <section className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">주문</h2>
          <form method="GET" action="/admin/shop" className="mb-3 flex flex-wrap items-center gap-2" role="search">
            <input type="hidden" name="month" value={month} />
            <TextInput type="search" name="q" defaultValue={q} placeholder="주문번호, 이름, 연락처 검색" aria-label="주문 검색" light className="w-auto flex-1 min-w-[220px] px-4" />
            <Button light type="submit" variant="weak">검색</Button>
            {q && <Link href={`/admin/shop?month=${month}`} className="text-sm text-primary hover:underline">검색 해제</Link>}
          </form>
          {ordersTruncated && (
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              최근 {ORDER_LIST_LIMIT}건만 표시합니다. 오래된 주문은 위 검색으로 찾을 수 있습니다.
            </p>
          )}
          {orders.length === 0 ? (
            <p className="text-gray-600">{q ? '검색 결과가 없습니다.' : '아직 주문이 없습니다.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table w-full text-left">
                <thead className="text-xs text-gray-500"><tr><th className="py-2 pr-3">주문</th><th className="py-2 pr-3">상품</th><th className="py-2 pr-3">금액</th><th className="py-2 pr-3">결제</th><th className="py-2">발송</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.orderNo} className="border-t border-gray-100 align-top">
                      <td className="py-2 pr-3">
                        <Link href={`/admin/shop/${o.orderNo}`} className="font-medium text-primary hover:underline">{o.orderNo}</Link>
                        <span className="block text-xs text-gray-500">{o.customerName} · {kst(o.createdAt)}</span>
                      </td>
                      <td data-label="상품" className="py-2 pr-3">{o.itemSummary}</td>
                      <td data-label="금액" className="py-2 pr-3 tabular-nums">{formatPriceAmount(o.totalAmount)}원</td>
                      <td data-label="결제" className="py-2 pr-3">{STATUS_LABEL[o.status] ?? o.status}</td>
                      <td data-label="발송" className="py-2">
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
