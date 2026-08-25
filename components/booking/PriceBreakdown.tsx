import { formatPriceAmount } from '../../data/pricing';
import type { OrderAmounts } from '../../lib/booking/amounts';

interface PriceBreakdownProps {
  amounts: OrderAmounts;
}

/**
 * 금액은 항상 "상품가 + VAT = 합계"로 분해해 보여준다 — 합계만 단독 표기 금지.
 * 숫자는 반드시 formatPriceAmount로만 포맷한다(리터럴 toLocaleString 금지).
 */
export default function PriceBreakdown({ amounts }: PriceBreakdownProps) {
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-700 dark:text-gray-300">
      <p>
        상품가 {formatPriceAmount(amounts.itemAmount)}원 + VAT {formatPriceAmount(amounts.vatAmount)}원 ={' '}
        <span className="font-semibold text-gray-900 dark:text-white">
          합계 {formatPriceAmount(amounts.totalAmount)}원
        </span>
      </p>
    </div>
  );
}
