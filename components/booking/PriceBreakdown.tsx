import type { OrderAmounts } from '../../lib/booking/amounts';
import { PriceSummary } from '../ui/PriceSummary';

interface PriceBreakdownProps {
  amounts: OrderAmounts;
  /** 상품 줄의 이름. 기본 "상품가". 상품명을 넘기면 그 이름으로 보인다. */
  label?: string;
  className?: string;
}

/**
 * 금액은 항상 "상품가 + VAT = 합계"로 분해해 보여준다 — 합계만 단독 표기 금지.
 * 모양은 공용 PriceSummary(항목 dl + 부가세 + 합계)다. 숫자는 formatPriceAmount로만 포맷된다.
 */
export default function PriceBreakdown({ amounts, label = '상품가', className }: PriceBreakdownProps) {
  return (
    <PriceSummary
      className={className}
      items={[{ label, amount: amounts.itemAmount }]}
      vat={amounts.vatAmount}
      vatLabel="VAT"
      total={amounts.totalAmount}
    />
  );
}
