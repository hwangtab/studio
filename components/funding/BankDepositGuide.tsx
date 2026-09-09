import { formatPriceAmount } from '../../data/pricing';
import { formatKstDateTimeFull } from '../../lib/booking/format';
import { BANK_ACCOUNT } from '../../lib/funding/policy';

interface Props { orderNo: string; customerName: string; totalAmount: number; holdExpiresAt: string; status: string }

export default function BankDepositGuide({ orderNo, customerName, totalAmount, holdExpiresAt, status }: Props) {
  if (status === 'paid') return <p className="text-lg font-semibold">입금이 확인되어 후원이 확정되었습니다.</p>;
  if (status === 'expired') return <p className="text-lg font-semibold">입금 기한이 지나 후원이 취소되었습니다. 다시 후원해 주세요.</p>;
  if (status === 'refunded') return <p className="text-lg font-semibold">환불 처리된 후원입니다.</p>;
  if (status !== 'pending') return <p className="text-lg font-semibold">처리할 수 없는 상태입니다. 문의해 주세요.</p>;
  return (
    <dl className="space-y-3 text-base">
      <div><dt className="text-sm text-gray-500">입금 계좌</dt><dd className="text-xl font-bold">{BANK_ACCOUNT.bank} {BANK_ACCOUNT.number}</dd><dd className="text-sm">{BANK_ACCOUNT.holder}</dd></div>
      <div><dt className="text-sm text-gray-500">입금 금액</dt><dd className="text-xl font-bold">{formatPriceAmount(totalAmount)}원</dd></div>
      <div><dt className="text-sm text-gray-500">입금자명</dt><dd className="font-semibold">{customerName}</dd><dd className="text-sm text-gray-500">후원 신청 이름과 같게 해 주세요.</dd></div>
      <div><dt className="text-sm text-gray-500">입금 기한</dt><dd className="font-semibold">{formatKstDateTimeFull(holdExpiresAt)}</dd><dd className="text-sm text-gray-500">기한이 지나면 자동 취소됩니다.</dd></div>
      <div><dt className="text-sm text-gray-500">주문번호</dt><dd>{orderNo}</dd></div>
    </dl>
  );
}
