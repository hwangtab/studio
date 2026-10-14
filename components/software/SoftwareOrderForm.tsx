import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import PaymentMethodPicker, { PaymentMethodSkeleton } from '../payments/PaymentMethodPicker';
import { usePaymentCheckout } from '../payments/usePaymentCheckout';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Field, TextInput } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { PriceSummary } from '../ui/PriceSummary';
import { formatPriceAmount } from '../../data/pricing';
import type { SoftwarePrice, SoftwareProduct } from '../../data/software/catalog';
import { SOFTWARE_SELF_CANCEL_DAYS } from '../../data/software/policy';
import { readStringDraft, writeStringDraft } from '../../lib/formDraft';
import { reportPaymentFailure, reportPaymentWindowOpen } from '../../utils/reportPaymentFailure';

export const SOFTWARE_DRAFT_KEY = 'software-order';
const DRAFT_FIELDS = ['name', 'phone', 'email'] as const;

interface PendingOrder {
  key: string;
  orderNo: string;
  totalAmount: number;
  orderName: string;
}

/**
 * 소프트웨어 라이선스 구매 폼 — 구매자 정보 → 결제수단 → **환불 규정 동의(체크)** → 결제하기.
 *
 * 결제수단은 전부 토스(카드·간편결제·토스 계좌이체, `bankOption="toss_transfer"`)다. "계좌로 직접 입금"은 넣지 않는다 —
 * 입금 확인까지 라이선스를 줄 수 없어 즉시 발급과 맞지 않는다. 다른 흐름과 달리 동의를 **체크박스로** 받는다: 디지털콘텐츠
 * 청약철회 제한은 결제 전에 알리고 동의를 받아야 성립하고(입증 책임은 사업자), 서버가 그 시각을 주문에 남긴다.
 */
export default function SoftwareOrderForm({ product, price }: { product: SoftwareProduct; price: SoftwarePrice }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef<PendingOrder | null>(null);

  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    const d = readStringDraft(SOFTWARE_DRAFT_KEY, DRAFT_FIELDS);
    if (d.name) setName(d.name);
    if (d.phone) setPhone(d.phone);
    if (d.email) setEmail(d.email);
    setDraftRestored(true);
  }, []);
  useEffect(() => {
    if (draftRestored) writeStringDraft(SOFTWARE_DRAFT_KEY, DRAFT_FIELDS, { name, phone, email });
  }, [draftRestored, name, phone, email]);

  // 위젯은 폼이 화면 근처에 오거나 폼 안에 포커스가 들어오면 켠다(상점·공연 폼과 같은 지연 로드).
  const formRef = useRef<HTMLFormElement>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (armed) return;
    const form = formRef.current;
    if (!form || typeof IntersectionObserver === 'undefined') { setArmed(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setArmed(true); }, { rootMargin: '100% 0px 100% 0px' });
    io.observe(form);
    const arm = () => setArmed(true);
    form.addEventListener('focusin', arm, { once: true });
    return () => { io.disconnect(); form.removeEventListener('focusin', arm); };
  }, [armed]);

  const widget = usePaymentCheckout(price.krw, armed);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!ack) {
      setError('환불 규정을 확인하고 동의해 주세요.');
      return;
    }
    if (widget.agreedRequiredTerms === false) {
      setError('결제수단 아래 [필수] 결제 서비스 이용 약관에도 동의해 주세요.');
      return;
    }
    setSubmitting(true);
    let createdOrderNo: string | null = null;
    try {
      const body = {
        productSlug: product.slug,
        priceId: price.id,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim(),
        withdrawalAck: true,
      };
      const key = JSON.stringify(body);
      let pending = pendingRef.current;
      // 같은 입력으로 결제창을 다시 열면 만든 주문을 재사용한다(결제 대기 주문이 쌓이지 않게).
      if (!pending || pending.key !== key) {
        const res = await fetch('/api/software/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; orderNo: string; totalAmount: number; orderName: string }
          | { ok: false; message?: string }
          | null;
        if (!res.ok || !data || !data.ok) {
          setError((data && !data.ok && data.message) || '주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        pending = { key, orderNo: data.orderNo, totalAmount: data.totalAmount, orderName: data.orderName };
        pendingRef.current = pending;
      }
      createdOrderNo = pending.orderNo;
      const origin = window.location.origin;
      reportPaymentWindowOpen(pending.orderNo);
      await widget.requestPayment({
        orderId: pending.orderNo,
        orderName: pending.orderName,
        customerName: name.trim(),
        customerEmail: email.trim(),
        amount: pending.totalAmount,
        successUrl: `${origin}/ko/software/success`,
        failUrl: `${origin}/ko/software/fail?slug=${encodeURIComponent(product.slug)}`,
      });
    } catch (err) {
      reportPaymentFailure(createdOrderNo, err);
      const code = (err as { code?: string } | null)?.code;
      if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED') setError('결제창이 닫혔어요. 같은 버튼으로 다시 시도할 수 있어요.');
      else if (code === 'NEED_CARD_PAYMENT_DETAIL') setError('카드 결제는 카드사를 먼저 골라 주세요. 결제수단 아래에서 카드사를 고른 뒤 다시 눌러 주세요.');
      else setError('결제창을 열지 못했어요. 잠시 후 같은 버튼으로 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id="buy" ref={formRef} onSubmit={submit} noValidate className="scroll-mt-24 space-y-6" aria-label="라이선스 구매">
      <PriceSummary items={[{ label: `${product.title} 라이선스`, amount: price.krw }]} total={price.krw} totalLabel="결제 금액 (부가세 포함)" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sw-name" label="구매하시는 분" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} />
        </Field>
        <Field id="sw-phone" label="휴대폰 번호" required>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" />
        </Field>
      </div>
      <Field id="sw-email" label="이메일" required hint="라이선스 키와 구매 내역 링크를 이 주소로 보내 드려요.">
        <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" />
      </Field>

      <div>
        <h3 className="mb-2 typo-card-meta font-medium text-gray-700 dark:text-gray-300">결제수단</h3>
        {widget.picker === null ? (
          <PaymentMethodSkeleton />
        ) : widget.picker ? (
          <>
            <PaymentMethodPicker
              name="software-paymethod"
              value={widget.choice}
              onChange={(next) => {
                // 직접 입금 줄은 이 화면에 없다(bankOption) — 남은 수단은 전부 토스 결제창이다.
                if (next !== 'bank_transfer') widget.setChoice(next);
              }}
              applePaySupported={widget.applePaySupported}
              bankOption="toss_transfer"
              confirmLabel="라이선스가 발급"
            />
            {widget.error && <Notice tone="error" className="mt-3">{widget.error}</Notice>}
          </>
        ) : (
          <div>
            <div id={widget.methodsId} />
            <div id={widget.agreementId} />
            {widget.error && (
              <Notice tone="error" actions={<Button type="button" size="sm" variant="weak" onClick={widget.retry}>다시 시도</Button>}>
                {widget.error}
              </Notice>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Checkbox
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          label={`라이선스를 활성화하면 단순 변심으로 환불할 수 없다는 것을 확인했어요. 활성화 전에는 결제 후 ${SOFTWARE_SELF_CANCEL_DAYS}일 안에 바로 환불할 수 있어요.`}
        />
        <p className="pl-7 text-sm text-gray-500 dark:text-gray-400">
          체험판으로 먼저 써 보세요. 설치·동작에 문제가 있으면 활성화 뒤에도 환불해 드려요. 결제하면{' '}
          <Link href="/ko/terms" target="_blank" className="underline">이용약관</Link>과{' '}
          <Link href="/ko/privacy-policy" target="_blank" className="underline">개인정보 처리방침</Link>에 동의하는 것으로 봐요.
        </p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <Button type="submit" fullWidth disabled={!widget.ready || submitting}>
        {submitting ? '처리 중…' : `${formatPriceAmount(price.krw)}원 · 결제하기`}
      </Button>
    </form>
  );
}
