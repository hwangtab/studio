import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ShippingAddressFields, { EMPTY_SHIPPING_ADDRESS, type ShippingAddressValue } from '../common/ShippingAddressFields';
import PaymentMethodPicker, { PaymentMethodSkeleton } from '../payments/PaymentMethodPicker';
import { usePaymentCheckout } from '../payments/usePaymentCheckout';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Disclosure } from '../ui/Disclosure';
import { Field, Select, TextInput } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { PriceSummary } from '../ui/PriceSummary';
import { formatPriceAmount } from '../../data/pricing';
import type { ShopProduct, ShopSku } from '../../data/shop/catalog';
import { SHOP_FREE_SHIPPING_FROM, SHOP_HOLD_SECONDS, SHOP_MAX_QTY_PER_LINE, SHOP_TEXT_LIMITS } from '../../data/shop/policy';
import { readStringDraft, writeStringDraft } from '../../lib/formDraft';
import { SHOP_DRAFT_KEY } from '../../lib/shop/draft';
import { computeShopTotals } from '../../lib/shop/amounts';
import { shopLineName } from '../../lib/shop/catalog';
import { SHOP_PREORDER_MIX_NOTE, SHOP_REFUND_RULES, shopPreorderSupplyNote, shopShippingNote } from '../../lib/shop/policyCopy';
import { latestPendingShipsOn } from '../../lib/shop/preorder';
import { reportPaymentFailure, reportPaymentWindowOpen } from '../../utils/reportPaymentFailure';

/** 남은 수량 — SKU id → 수량. null이면 아직 모른다(DB 조회 실패) — 고를 수는 있고 최종 판정은 주문 생성이 한다. */
export type RemainingStock = Record<string, number> | null;

interface PendingOrder {
  key: string;
  orderNo: string;
  totalAmount: number;
  orderName: string;
  createdAt: number;
}

const DRAFT_KEY = SHOP_DRAFT_KEY;
const DRAFT_FIELDS = ['name', 'phone', 'email', 'recipientName', 'recipientPhone', 'postcode', 'address1', 'address2', 'memo'] as const;

const sellable = (p: ShopProduct): ShopSku[] => p.skus.filter((s) => !s.retired);

/**
 * 상품 주문 폼 — 수량(옵션별) → 함께 담을 다른 상품(배송비는 주문당 한 번) → 주문자·받는 분·배송지 → 결제수단 → 결제하기.
 *
 * 결제수단은 전부 토스다(카드·간편결제·**토스 계좌이체**, `bankOption="toss_transfer"`) — 상점은 "계좌로 직접 입금"을
 * 받지 않는다(운영자 결정 2026-10-12: 직접 입금은 환불 때 수동 송금이 번거롭다). 공연 예매 폼(ShowBookingForm)과
 * 같은 장치를 쓴다: 위젯 지연 로드, 같은 입력으로 결제창을 다시 열면 만든 주문을 재사용(재고 홀드가 쌓이지 않게).
 * 펀딩 후원 폼에서 가져온 것: 카카오 주소 검색, 이름·연락처·주소 초안 저장(수량은 저장하지 않는다 — 재고가 바뀐다).
 */
export default function ShopOrderForm({ product, others, remaining, salesOpen }: {
  product: ShopProduct;
  /** 같은 주문에 함께 담을 수 있는 다른 공개 상품. */
  others: ShopProduct[];
  remaining: RemainingStock;
  salesOpen: boolean;
}) {
  const [stock, setStock] = useState<RemainingStock>(remaining);
  // SSR 페이지는 CDN에 짧게 캐시된다 — 마운트 뒤 이 상품의 남은 수량만 다시 읽는다(실패하면 SSR 값).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/shop/stock?slug=${encodeURIComponent(product.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok: boolean; remaining: Record<string, number> } | null) => {
        if (cancelled || !data?.ok) return;
        setStock((prev) => ({ ...(prev ?? {}), ...data.remaining }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product.slug]);

  const leftOf = useCallback((skuId: string): number => (stock ? stock[skuId] ?? 0 : SHOP_MAX_QTY_PER_LINE), [stock]);
  const capOf = useCallback((skuId: string): number => Math.max(0, Math.min(SHOP_MAX_QTY_PER_LINE, leftOf(skuId))), [leftOf]);

  const ownSkus = sellable(product);
  const singleSku = ownSkus.length === 1;
  const [qty, setQty] = useState<Record<string, number>>(() => (singleSku ? { [ownSkus[0].id]: 1 } : {}));
  const setLineQty = (skuId: string, n: number) => setQty((prev) => ({ ...prev, [skuId]: n }));

  // 담은 줄 — 재고가 줄어 상한을 넘으면 상한으로 낮춰 계산한다(입력값은 그대로 두고 화면·전송에 쓰는 값만).
  const allProducts = useMemo(() => [product, ...others], [product, others]);
  const lines = useMemo(
    () => allProducts.flatMap((p) => sellable(p).map((sku) => ({ product: p, sku, quantity: Math.min(qty[sku.id] ?? 0, capOf(sku.id)) })))
      .filter((l) => l.quantity > 0),
    [allProducts, qty, capOf],
  );
  // 예약 상품을 담았으면 가장 늦은 발송 예정일에 함께 보낸다.
  const latestShipsOn = latestPendingShipsOn(lines.map((l) => l.product.shipsOn), new Date());
  const totals = computeShopTotals(lines.map((l) => ({ unitPrice: l.sku.price, quantity: l.quantity })));

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [sameRecipient, setSameRecipient] = useState(true);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [address, setAddress] = useState<ShippingAddressValue>(EMPTY_SHIPPING_ADDRESS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef<PendingOrder | null>(null);

  // 초안 — 마운트 뒤 한 번 읽고(SSR에는 window가 없다), 복원이 끝난 뒤부터 쓴다(복원 전에 빈 값으로 덮지 않게).
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    const d = readStringDraft(DRAFT_KEY, DRAFT_FIELDS);
    if (d.name) setName(d.name);
    if (d.phone) setPhone(d.phone);
    if (d.email) setEmail(d.email);
    if (d.recipientName || d.recipientPhone) {
      setSameRecipient(false);
      setRecipientName(d.recipientName ?? '');
      setRecipientPhone(d.recipientPhone ?? '');
    }
    setAddress({ postcode: d.postcode ?? '', address1: d.address1 ?? '', address2: d.address2 ?? '', memo: d.memo ?? '' });
    setDraftRestored(true);
  }, []);
  useEffect(() => {
    if (!draftRestored) return;
    writeStringDraft(DRAFT_KEY, DRAFT_FIELDS, {
      name, phone, email,
      recipientName: sameRecipient ? '' : recipientName,
      recipientPhone: sameRecipient ? '' : recipientPhone,
      postcode: address.postcode, address1: address.address1, address2: address.address2, memo: address.memo,
    });
  }, [draftRestored, name, phone, email, sameRecipient, recipientName, recipientPhone, address]);

  // 위젯은 폼이 화면 근처에 오거나 폼 안에 포커스가 들어오면 켠다(공연 예매 폼과 같은 지연 로드).
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

  const canOrder = salesOpen && lines.length > 0;
  const widget = usePaymentCheckout(totals.total, canOrder && armed);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canOrder || submitting) return;
    setError(null);
    if (!address.postcode.trim() || !address.address1.trim()) {
      setError('배송지 주소를 찾아 주세요.');
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
        lines: lines.map((l) => ({ skuId: l.sku.id, quantity: l.quantity })),
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim(),
        shipping: {
          recipientName: (sameRecipient ? name : recipientName).trim(),
          recipientPhone: (sameRecipient ? phone : recipientPhone).trim(),
          postcode: address.postcode.trim(),
          address1: address.address1.trim(),
          address2: address.address2.trim(),
          shippingMemo: address.memo.trim(),
        },
      };
      const key = JSON.stringify(body);
      let pending = pendingRef.current;
      // 홀드 만료 1분 전까지만 재사용한다 — 결제창을 여는 동안 만료되는 주문을 넘기지 않는다.
      const fresh = pending && pending.key === key && Date.now() - pending.createdAt < (SHOP_HOLD_SECONDS - 60) * 1000;
      if (!fresh) {
        const res = await fetch('/api/shop/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; orderNo: string; totalAmount: number; orderName: string }
          | { ok: false; message?: string }
          | null;
        if (!res.ok || !data || !data.ok) {
          setError((data && !data.ok && data.message) || '주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        pending = { key, orderNo: data.orderNo, totalAmount: data.totalAmount, orderName: data.orderName, createdAt: Date.now() };
        pendingRef.current = pending;
      }
      if (!pending) return;
      createdOrderNo = pending.orderNo;
      const origin = window.location.origin;
      reportPaymentWindowOpen(pending.orderNo);
      await widget.requestPayment({
        orderId: pending.orderNo,
        orderName: pending.orderName,
        customerName: name.trim(),
        customerEmail: email.trim(),
        amount: pending.totalAmount,
        successUrl: `${origin}/ko/shop/success`,
        failUrl: `${origin}/ko/shop/fail?slug=${encodeURIComponent(product.slug)}`,
      });
    } catch (err) {
      reportPaymentFailure(createdOrderNo, err);
      const code = (err as { code?: string } | null)?.code;
      if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED') {
        setError('결제창이 닫혔어요. 상품은 잠시 잡아 두었으니 같은 버튼으로 다시 시도할 수 있어요.');
      } else if (code === 'NEED_CARD_PAYMENT_DETAIL') {
        setError('카드 결제는 카드사를 먼저 골라 주세요. 결제수단 아래에서 카드사를 고른 뒤 다시 눌러 주세요.');
      } else {
        setError('결제창을 열지 못했어요. 잠시 후 같은 버튼으로 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const qtySelect = (sku: ShopSku, idPrefix: string, allowZero: boolean) => {
    const cap = capOf(sku.id);
    const options = Array.from({ length: cap + (allowZero ? 1 : 0) }, (_, i) => i + (allowZero ? 0 : 1));
    return (
      <Select
        id={`${idPrefix}-${sku.id}`}
        aria-label={`${shopLineName(product.title, sku.optionLabel)} 수량`}
        value={Math.min(qty[sku.id] ?? 0, cap)}
        disabled={cap === 0}
        onChange={(e) => setLineQty(sku.id, Number(e.target.value))}
      >
        {options.map((n) => <option key={n} value={n}>{n}개</option>)}
      </Select>
    );
  };

  const stockHint = (skuId: string): string | null => {
    if (!stock) return null;
    const left = leftOf(skuId);
    if (left <= 0) return '품절';
    return left <= 10 ? `남은 수량 ${left}개` : null;
  };

  return (
    <form id="order" ref={formRef} onSubmit={submit} noValidate className="scroll-mt-24 space-y-6" aria-label="상품 주문">
      {singleSku ? (
        <Field id={`qty-${ownSkus[0].id}`} label="수량" hint={stockHint(ownSkus[0].id) ?? `한 번에 ${SHOP_MAX_QTY_PER_LINE}개까지`}>
          {capOf(ownSkus[0].id) === 0 ? <Panel className="text-sm text-gray-700 dark:text-gray-300">품절이에요.</Panel> : qtySelect(ownSkus[0], 'qty', false)}
        </Field>
      ) : (
        <fieldset className="min-w-0">
          <legend className="mb-2 typo-card-meta font-medium text-gray-700 dark:text-gray-300">옵션별 수량</legend>
          <div className="space-y-2">
            {ownSkus.map((sku) => (
              <div key={sku.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-sm text-gray-800 dark:text-gray-200">
                  {sku.optionLabel} · {formatPriceAmount(sku.price)}원
                  {stockHint(sku.id) && <span className="typo-caption block">{stockHint(sku.id)}</span>}
                </span>
                <div className="w-28 shrink-0">{qtySelect(sku, 'qty', true)}</div>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {others.length > 0 && (
        <Disclosure summary="다른 상품도 함께 담기 — 배송비는 한 번만 내요" variant="plain" summaryClassName="text-sm font-medium text-gray-700 dark:text-gray-200">
          <div className="mt-3 space-y-2">
            {others.flatMap((p) => sellable(p).map((sku) => (
              <div key={sku.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-sm text-gray-800 dark:text-gray-200">
                  <Link href={`/ko/shop/${p.slug}`} className="underline">{shopLineName(p.title, sku.optionLabel)}</Link> · {formatPriceAmount(sku.price)}원
                  {stockHint(sku.id) && <span className="typo-caption block">{stockHint(sku.id)}</span>}
                </span>
                <div className="w-28 shrink-0">
                  <Select
                    aria-label={`${shopLineName(p.title, sku.optionLabel)} 수량`}
                    value={Math.min(qty[sku.id] ?? 0, capOf(sku.id))}
                    disabled={capOf(sku.id) === 0}
                    onChange={(e) => setLineQty(sku.id, Number(e.target.value))}
                  >
                    {Array.from({ length: capOf(sku.id) + 1 }, (_, i) => i).map((n) => <option key={n} value={n}>{n}개</option>)}
                  </Select>
                </div>
              </div>
            )))}
          </div>
        </Disclosure>
      )}

      {latestShipsOn && (
        <Notice tone="info">
          {shopPreorderSupplyNote(latestShipsOn)} {SHOP_PREORDER_MIX_NOTE}
        </Notice>
      )}

      {lines.length > 0 && (
        <PriceSummary
          items={[
            ...lines.map((l) => ({ label: shopLineName(l.product.title, l.sku.optionLabel), amount: l.sku.price * l.quantity, quantity: l.quantity, unit: '개' })),
            {
              label: '배송비',
              amount: totals.shippingFee,
              note: totals.shippingFee > 0
                ? `상품 ${formatPriceAmount(SHOP_FREE_SHIPPING_FROM)}원 이상이면 무료 · ${formatPriceAmount(SHOP_FREE_SHIPPING_FROM - totals.subtotal)}원 남았어요`
                : '무료 배송',
            },
          ]}
          total={totals.total}
          totalLabel="결제 금액 (부가세 포함)"
        />
      )}

      {!salesOpen ? (
        <Notice tone="neutral" icon={false}>판매 준비 중이에요. 열리면 이 페이지에서 바로 주문할 수 있어요.</Notice>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="shop-name" label="주문하시는 분" required>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} />
            </Field>
            <Field id="shop-phone" label="휴대폰 번호" required>
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" />
            </Field>
          </div>
          <Field id="shop-email" label="이메일" required hint="주문 확인과 발송 안내(운송장 번호)를 이 주소로 보내 드려요.">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" />
          </Field>

          <div>
            <h3 className="mb-2 typo-card-meta font-medium text-gray-700 dark:text-gray-300">배송지</h3>
            <Checkbox label="주문하시는 분이 받아요" checked={sameRecipient} onChange={(e) => setSameRecipient(e.target.checked)} />
            {!sameRecipient && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field id="shop-rname" label="받는 분" required>
                  <TextInput value={recipientName} maxLength={SHOP_TEXT_LIMITS.recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                </Field>
                <Field id="shop-rphone" label="받는 분 휴대폰 번호" required>
                  <TextInput value={recipientPhone} type="tel" inputMode="tel" maxLength={SHOP_TEXT_LIMITS.recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
                </Field>
              </div>
            )}
            <div className="mt-4">
              <ShippingAddressFields
                idPrefix="shop-ship"
                value={address}
                onChange={setAddress}
                limits={{ postcode: SHOP_TEXT_LIMITS.postcode, address1: SHOP_TEXT_LIMITS.address1, address2: SHOP_TEXT_LIMITS.address2, memo: SHOP_TEXT_LIMITS.shippingMemo }}
              />
            </div>
            <p className="mt-2 typo-caption">{shopShippingNote()}</p>
          </div>

          <div>
            <h3 className="mb-2 typo-card-meta font-medium text-gray-700 dark:text-gray-300">결제수단</h3>
            {widget.picker === null ? (
              <PaymentMethodSkeleton />
            ) : widget.picker ? (
              <>
                <PaymentMethodPicker
                  name="shop-paymethod"
                  value={widget.choice}
                  onChange={(next) => {
                    // 직접 입금 줄은 이 화면에 없다(bankOption) — 남은 수단은 전부 토스 결제창이다.
                    if (next !== 'bank_transfer') widget.setChoice(next);
                  }}
                  applePaySupported={widget.applePaySupported}
                  bankOption="toss_transfer"
                  confirmLabel="주문이 접수"
                />
                {widget.error && <Notice tone="error" className="mt-3">{widget.error}</Notice>}
              </>
            ) : (
              <div>
                {/* 위젯(`?pay=widget`)은 토스 콘솔에 개통된 수단을 그대로 그린다. */}
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

          {error && <Notice tone="error">{error}</Notice>}

          {/* 동의는 결제하기를 누르는 행위로 받는다(공연·펀딩과 같은 규칙) — 체크박스 없이 고지 한 줄 + 접힌 규정. */}
          <div className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            <p>
              결제하기를 누르면 교환·환불 규정과{' '}
              <Link href="/ko/privacy-policy" target="_blank" className="underline">개인정보 처리방침</Link>
              에 동의하는 것으로 봐요. 상품은 결제창을 여는 동안 {Math.floor(SHOP_HOLD_SECONDS / 60)}분간 잡아 둬요.
            </p>
            <Disclosure variant="plain" summary="교환·환불 규정 보기" className="mt-1" summaryClassName="text-sm font-medium text-gray-600 dark:text-gray-300" bodyClassName="text-xs">
              <ul className="list-disc space-y-1 pl-5">
                {SHOP_REFUND_RULES.map((rule) => <li key={rule}>{rule}</li>)}
              </ul>
            </Disclosure>
          </div>

          <Button type="submit" fullWidth disabled={!canOrder || !widget.ready || submitting}>
            {submitting ? '처리 중…' : `${formatPriceAmount(totals.total)}원 · 결제하기`}
          </Button>
        </>
      )}
    </form>
  );
}
