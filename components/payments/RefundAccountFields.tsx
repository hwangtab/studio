import { Field, TextInput } from '../ui/Field';
import { REFUND_ACCOUNT_LIMITS } from '../../lib/payments/bankAccount';

export interface RefundAccountValue {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export const EMPTY_REFUND_ACCOUNT: RefundAccountValue = { bankName: '', accountNumber: '', accountHolder: '' };

export const isRefundAccountFilled = (v: RefundAccountValue): boolean =>
  Boolean(v.bankName.trim() && v.accountNumber.trim() && v.accountHolder.trim());

/**
 * **환불받을 계좌** 입력 — 계좌 입금 주문의 셀프 취소(결제 공용: 공연·예약·믹싱, 펀딩 확인 페이지와 같은 칸).
 * 토스 결제가 없어 결제 수단으로 돌려줄 수 없으니 운영자가 이 계좌로 송금한다. 상한은 서버 검증과 같은 값
 * (`REFUND_ACCOUNT_LIMITS` — 클라이언트 안전 모듈). 계좌번호는 서버가 암호화해 보관한다.
 */
export default function RefundAccountFields({ idPrefix, value, onChange, intro, locale = 'ko' }: {
  idPrefix: string;
  value: RefundAccountValue;
  onChange: (next: RefundAccountValue) => void;
  intro?: string;
  /** 영어 화면(공연 /en)이면 'en'. */
  locale?: 'ko' | 'en';
}) {
  const en = locale === 'en';
  return (
    <fieldset className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <legend className="px-1 text-base font-semibold text-gray-900 dark:text-white">{en ? 'Refund account' : '환불받을 계좌'}</legend>
      <p className="typo-card-meta mt-1">
        {intro ??
          (en
            ? 'You paid by bank transfer, so we send the refund to the account you enter (within 3 business days of the request). A Korean bank account is required. The account number is stored encrypted.'
            : '계좌로 입금하신 주문이라 적어 주신 계좌로 직접 보내 드려요(접수일부터 3영업일 이내). 계좌번호는 암호화해 보관해요.')}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field id={`${idPrefix}-bank`} label={en ? 'Bank' : '은행'} required>
          <TextInput required maxLength={REFUND_ACCOUNT_LIMITS.bankName} value={value.bankName}
            onChange={(e) => onChange({ ...value, bankName: e.target.value })} />
        </Field>
        <Field id={`${idPrefix}-holder`} label={en ? 'Account holder' : '예금주'} required>
          <TextInput required maxLength={REFUND_ACCOUNT_LIMITS.accountHolder} value={value.accountHolder}
            onChange={(e) => onChange({ ...value, accountHolder: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field id={`${idPrefix}-number`} label={en ? 'Account number' : '계좌번호'} required>
            <TextInput required inputMode="numeric" autoComplete="off" maxLength={REFUND_ACCOUNT_LIMITS.accountNumber} value={value.accountNumber}
              onChange={(e) => onChange({ ...value, accountNumber: e.target.value })} />
          </Field>
        </div>
      </div>
    </fieldset>
  );
}
