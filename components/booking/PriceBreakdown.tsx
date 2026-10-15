import type { OrderAmounts } from '../../lib/booking/amounts';
import { PriceSummary } from '../ui/PriceSummary';

interface PriceBreakdownProps {
  amounts: OrderAmounts;
  /** 상품 줄의 이름. 없으면 "공급가액", 상품명을 넘기면 "상품명 (공급가액)"으로 보인다. */
  label?: string;
  className?: string;
}

/**
 * 금액은 항상 "공급가액 + VAT = 합계"로 분해해 보여준다 — 합계만 단독 표기 금지.
 * 2026-10-15부터 화면 가격(합계)이 부가세 포함가라 합계가 먼저 정해지고 공급가액·VAT는 그 안을 가른 값이다
 * (월 이용료·레슨 월정액만 공급가액에 10%를 더한다). 그래서 "상품가"라고 부르지 않는다.
 * 모양은 공용 PriceSummary(항목 dl + 부가세 + 합계)다. 숫자는 formatPriceAmount로만 포맷된다.
 */
export default function PriceBreakdown({ amounts, label, className }: PriceBreakdownProps) {
  return (
    <PriceSummary
      className={className}
      items={[{ label: label ? `${label} (공급가액)` : '공급가액', amount: amounts.itemAmount }]}
      vat={amounts.vatAmount}
      vatLabel="VAT"
      total={amounts.totalAmount}
      totalLabel="합계 (VAT 포함)"
    />
  );
}
