import { contactSummaryCopy } from '../../lib/contact/copy';
import { CONTACT_EMAIL_MAX, CONTACT_NAME_MAX, type ContactField, type ContactValues } from '../../lib/contact/rules';
import { Field, TextInput } from '../ui/Field';
import type { ContactValidation } from './useContactValidation';

type PerField<T> = Partial<Record<ContactField, T>>;

const DEFAULT_LABELS = {
  ko: { customerName: '이름', customerPhone: '휴대폰 번호', customerEmail: '이메일' },
  en: { customerName: 'Name', customerPhone: 'Phone', customerEmail: 'Email' },
} as const;

interface Props {
  contact: ContactValidation;
  values: ContactValues;
  onChange: (field: ContactField, value: string) => void;
  /** 칸 id. 기본은 필드 이름 그대로(customerName…). 한 페이지에 폼이 둘이면 겹치지 않게 준다. */
  ids?: PerField<string>;
  labels?: PerField<string>;
  hints?: PerField<string>;
  phonePlaceholder?: string;
  /** 'pair' = 이름·휴대폰을 sm부터 두 칸으로(상점·공연·소프트웨어), 'stack' = 한 줄씩(예약·믹싱·결제 링크). */
  layout?: 'stack' | 'pair';
}

/**
 * 결제 화면의 주문자 칸 세 개 + 오류 요약. 예약·믹싱 주문·결제 링크·상점·공연·소프트웨어가 같은 컴포넌트를 쓴다
 * (예전엔 폼마다 손으로 그렸고 일부는 검사 없이 서버 오류 한 줄에 기댔다, 2026-10-22).
 * 오류는 요약 한 줄만 role="alert"로 알리고(다시 제출할 때마다 다시 알린다), 칸 오류는 aria-describedby로 읽힌다.
 */
export default function CustomerContactFields({ contact, values, onChange, ids, labels, hints, phonePlaceholder = '010-1234-5678', layout = 'stack' }: Props) {
  const label = { ...DEFAULT_LABELS[contact.locale], ...labels };
  const id = (f: ContactField) => ids?.[f] ?? f;
  const change = (f: ContactField) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(f, e.target.value);
    contact.recheck(f, e.target.value);
  };

  const name = (
    <Field id={id('customerName')} label={label.customerName} required hint={hints?.customerName} error={contact.errors.customerName} announceError={false}>
      <TextInput type="text" autoComplete="name" maxLength={CONTACT_NAME_MAX} value={values.customerName} onChange={change('customerName')} required />
    </Field>
  );
  const phone = (
    <Field id={id('customerPhone')} label={label.customerPhone} required hint={hints?.customerPhone} error={contact.errors.customerPhone} announceError={false}>
      <TextInput type="tel" inputMode="tel" autoComplete="tel" placeholder={phonePlaceholder} value={values.customerPhone} onChange={change('customerPhone')} required />
    </Field>
  );
  const email = (
    <Field id={id('customerEmail')} label={label.customerEmail} required hint={hints?.customerEmail} error={contact.errors.customerEmail} announceError={false}>
      <TextInput type="email" inputMode="email" autoComplete="email" maxLength={CONTACT_EMAIL_MAX} value={values.customerEmail} onChange={change('customerEmail')} required />
    </Field>
  );

  return (
    <div ref={contact.containerRef} className="space-y-4">
      {contact.errorCount > 0 && (
        // key로 다시 그려 같은 문구여도 다시 제출할 때마다 알린다.
        <p key={contact.attempt} role="alert" className="typo-card-meta font-medium text-red-600 dark:text-red-400">
          {contactSummaryCopy(contact.errorCount, contact.locale)}
        </p>
      )}
      {layout === 'pair' ? <div className="grid gap-4 sm:grid-cols-2">{name}{phone}</div> : <>{name}{phone}</>}
      {email}
    </div>
  );
}
