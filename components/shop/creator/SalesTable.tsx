import { EmptyState } from '../../ui/EmptyState';
import type { CreatorSkuSales } from '../../../lib/shop/creatorStats';

/** 판매 현황 — 옵션별 맡긴 수량·결제·발송·남은 수량. 구매자 정보는 없다. */
export function SalesTable({ rows }: { rows: CreatorSkuSales[] }) {
  return (
    <section aria-labelledby="shop-sales-heading" className="mt-10">
      <h2 id="shop-sales-heading" className="typo-card-title mb-4">판매 현황</h2>
      {rows.length === 0 ? (
        <EmptyState title="판매가 시작된 옵션이 아직 없어요." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-300">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">상품</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">맡긴 수량</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">결제 완료</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">발송 완료</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">남은 수량</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.skuId} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {r.productTitle}{r.optionLabel ? ` · ${r.optionLabel}` : ''}
                    {r.retired && <span className="ml-2 typo-caption">판매 종료</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.deposited}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.paid}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.shipped}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
