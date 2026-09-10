import { formatPriceAmount } from '../../data/pricing';
import { formatKstDateTimeFull } from '../../lib/booking/format';
import { BANK_ACCOUNT } from '../../lib/funding/policy';

interface Props { orderNo: string; customerName: string; totalAmount: number; holdExpiresAt: string; status: string }

const noticeClass = 'typo-card-title text-gray-900 dark:text-white';
const rowClass = 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-200/70 pb-3 last:border-0 last:pb-0 dark:border-gray-700/70';
const dtClass = 'typo-card-meta';

export default function BankDepositGuide({ orderNo, customerName, totalAmount, holdExpiresAt, status }: Props) {
  if (status === 'paid') return <p className={noticeClass}>입금이 확인되어 후원이 확정되었습니다.</p>;
  if (status === 'expired') return <p className={noticeClass}>입금 기한이 지나 후원이 취소되었습니다. 다시 후원해 주세요.</p>;
  if (status === 'partially_refunded') return <p className={noticeClass}>일부 환불된 후원입니다.</p>;
  if (status === 'refunded') return <p className={noticeClass}>환불 처리된 후원입니다.</p>;
  if (status !== 'pending') return <p className={noticeClass}>처리할 수 없는 상태입니다. 문의해 주세요.</p>;
  return (
    <dl className="space-y-3">
      <div className={rowClass}>
        <dt className={dtClass}>입금 계좌</dt>
        <dd className="text-right text-xl font-bold tabular-nums text-gray-900 dark:text-white">{BANK_ACCOUNT.bank} {BANK_ACCOUNT.number}</dd>
        <dd className="typo-card-meta w-full text-right">{BANK_ACCOUNT.holder}</dd>
      </div>
      <div className={rowClass}>
        <dt className={dtClass}>입금 금액</dt>
        <dd className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{formatPriceAmount(totalAmount)}원</dd>
      </div>
      <div className={rowClass}>
        <dt className={dtClass}>입금자명</dt>
        <dd className="font-semibold text-gray-900 dark:text-white">{customerName}</dd>
        <dd className="typo-card-meta w-full text-right">후원 신청 이름과 같게 해 주세요.</dd>
      </div>
      <div className={rowClass}>
        <dt className={dtClass}>입금 기한</dt>
        <dd className="font-semibold text-gray-900 dark:text-white">{formatKstDateTimeFull(holdExpiresAt)}</dd>
        <dd className="typo-card-meta w-full text-right">기한이 지나면 자동 취소됩니다.</dd>
      </div>
      <div className={rowClass}>
        <dt className={dtClass}>주문번호</dt>
        <dd className="text-sm tabular-nums text-gray-700 dark:text-gray-200">{orderNo}</dd>
      </div>
    </dl>
  );
}
