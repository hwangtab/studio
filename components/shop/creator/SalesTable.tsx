import { useState } from 'react';

import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { TextInput } from '../../ui/Field';
import type { CreatorSkuSales } from '../../../lib/shop/creatorStats';

/** 직접 보내는 상품의 총 재고 입력 — 저장하면 새로 읽는다. */
function StockInput({ skuId, label, value }: { skuId: string; label: string; value: number }) {
  const [text, setText] = useState(String(value));
  const [state, setState] = useState<string | null>(null);
  const save = async () => {
    setState('저장 중…');
    try {
      const res = await fetch('/api/funding/creator/shop/stock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skuId, stock: Number(text) }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && data?.ok) window.location.reload();
      else setState(data?.message ?? '저장하지 못했어요.');
    } catch {
      setState('연결에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <TextInput
        type="number" min={0} inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)}
        aria-label={`${label} 총 재고`} className="w-24 text-right"
      />
      <Button type="button" variant="secondary" size="sm" onClick={save} disabled={text === ''}>저장</Button>
      {state && <span role="alert" className="typo-caption">{state}</span>}
    </div>
  );
}

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
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.canSetStock ? <StockInput skuId={r.skuId} label={`${r.productTitle}${r.optionLabel ? ` · ${r.optionLabel}` : ''}`} value={r.deposited} /> : r.deposited}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.paid}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.shipped}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.some((r) => r.canSetStock) && (
        <p className="typo-caption mt-2">직접 보내는 상품은 내놓을 총수량을 직접 정해요. 판매·결제 대기 수량은 주문에서 자동으로 빠지고, 취소되면 돌아와요.</p>
      )}
    </section>
  );
}
