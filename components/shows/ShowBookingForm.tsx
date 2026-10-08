import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../ui/Button';
import { Field, TextInput, Select } from '../ui/Field';
import { ChoiceCard, ChoiceGroup } from '../ui/Choice';
import { Disclosure } from '../ui/Disclosure';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import PaymentMethodPicker, { PaymentMethodSkeleton } from '../payments/PaymentMethodPicker';
import { usePaymentCheckout } from '../payments/usePaymentCheckout';
import { reportPaymentWindowOpen } from '../../utils/reportPaymentFailure';
import { formatShowWon, showCopy, type ShowLocale } from '../../lib/shows/i18n';
import { SHOW_HOLD_SECONDS, SHOW_MAX_PER_ORDER_CAP } from '../../lib/shows/limits';
import type { PublicShow, PublicShowtime } from '../../lib/shows/queries';
import RefundPolicyList from './RefundPolicyList';
import PaymentMethodChoice from '../payments/PaymentMethodChoice';
import {
  BANK_DEPOSIT_BLOCK_MESSAGES,
  BANK_DEPOSIT_BLOCK_MESSAGES_EN,
  bankDepositBlockReason,
  type CheckoutPaymentMethod,
} from '../../lib/payments/bankDeposit';

interface Props {
  show: PublicShow;
  locale?: ShowLocale;
}

interface PendingOrder {
  key: string;
  orderNo: string;
  totalAmount: number;
  createdAt: number;
}

type AvailabilityPatch = Pick<PublicShowtime, 'id' | 'saleState' | 'remaining'>;

/**
 * 공연 예매 폼 — 회차·티켓·매수·구매자 정보를 받고, 토스 결제위젯을 폼 안에 띄워 제출 한 번에
 * 주문 생성 → 결제창으로 간다(펀딩과 같은 구조, 위젯 키 제약은 CLAUDE.md "토스 연동 키" 참고).
 * 홀드는 주문 생성 순간부터 10분이다. 같은 입력으로 결제창을 닫았다 다시 열면 만든 주문을
 * 재사용해 좌석이 이중으로 잡히지 않게 한다.
 */
export default function ShowBookingForm({ show, locale = 'ko' }: Props) {
  const copy = showCopy(locale);
  const t = copy.form;
  const en = locale === 'en';
  const won = (n: number) => formatShowWon(n, locale);
  const blockMessages = en ? BANK_DEPOSIT_BLOCK_MESSAGES_EN : BANK_DEPOSIT_BLOCK_MESSAGES;
  const [availability, setAvailability] = useState<Record<string, AvailabilityPatch>>({});

  // SSR 페이지는 CDN에 짧게 캐시된다 — 마운트 뒤 잔여석만 다시 읽는다(실패해도 SSR 값으로 동작).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/shows/availability?slug=${encodeURIComponent(show.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok: boolean; showtimes: AvailabilityPatch[] } | null) => {
        if (cancelled || !data?.ok) return;
        setAvailability(Object.fromEntries(data.showtimes.map((s) => [s.id, s])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [show.slug]);

  const showtimes = useMemo(
    () => show.showtimes.map((s) => ({ ...s, ...(availability[s.id] ?? {}) })),
    [show.showtimes, availability]
  );

  const firstOpen = showtimes.find((s) => s.saleState === 'open');
  const [showtimeId, setShowtimeId] = useState(firstOpen?.id ?? '');
  const showtime = showtimes.find((s) => s.id === showtimeId);
  const isOpen = showtime?.saleState === 'open';

  const remainingFor = useCallback(
    (ticketTypeId: string) => (showtime ? showtime.remaining[ticketTypeId] ?? 0 : 0),
    [showtime]
  );
  const [ticketTypeId, setTicketTypeId] = useState('');
  const selectedTypeId = useMemo(() => {
    if (ticketTypeId && remainingFor(ticketTypeId) > 0) return ticketTypeId;
    return show.ticketTypes.find((t) => remainingFor(t.id) > 0)?.id ?? '';
  }, [ticketTypeId, remainingFor, show.ticketTypes]);
  const ticketType = show.ticketTypes.find((t) => t.id === selectedTypeId);

  const maxQty = Math.max(1, Math.min(SHOW_MAX_PER_ORDER_CAP, ticketType ? remainingFor(ticketType.id) : 1));
  const [quantity, setQuantity] = useState(1);
  const qty = Math.min(quantity, maxQty);
  const total = ticketType ? ticketType.price * qty : 0;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef<PendingOrder | null>(null);

  const canBook = isOpen && !!ticketType && total > 0;

  /**
   * 결제 위젯은 폼이 화면 근처에 올 때까지 켜지 않는다. 공연 상세는 검색에 노출되는 공개 랜딩이라 방문자
   * 대부분이 폼까지 가지 않는데, 예전엔 페이지를 열 때마다 토스 SDK를 받고 위젯을 그렸다(예약 마법사는 3단계에서,
   * 펀딩은 모달을 열 때 켠다). 폼 위 한 화면 거리(rootMargin 100%)에서 미리 시작해 도달했을 땐 이미 준비돼 있고,
   * 한 번 켠 뒤에는 되돌리지 않는다. 폼 안에 포커스가 들어와도 켠다(키보드 이동·앵커 점프 대비).
   */
  const formRef = useRef<HTMLFormElement>(null);
  const [widgetArmed, setWidgetArmed] = useState(false);
  useEffect(() => {
    if (widgetArmed) return;
    const form = formRef.current;
    if (!form || typeof IntersectionObserver === 'undefined') {
      setWidgetArmed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setWidgetArmed(true);
      },
      { rootMargin: '100% 0px 100% 0px' },
    );
    io.observe(form);
    const arm = () => setWidgetArmed(true);
    form.addEventListener('focusin', arm, { once: true });
    return () => {
      io.disconnect();
      form.removeEventListener('focusin', arm);
    };
  }, [widgetArmed]);

  // 위젯(기본) 또는 우리가 그린 결제수단 목록(기능 플래그) — components/payments/usePaymentCheckout.ts.
  const widget = usePaymentCheckout(total, canBook && widgetArmed);

  /**
   * 결제수단 — 카드·간편결제(토스) / 계좌로 직접 입금. 계좌는 회차 시작 2시간 전부터 막는다(입금을 확인하고 티켓을
   * 보낼 시간이 없다). 서버(createShowOrder)가 **같은 함수·같은 인자**(회차 시작, 지금)로 다시 판정한다.
   */
  const [payMethod, setPayMethod] = useState<CheckoutPaymentMethod>('toss');
  const bankBlocked = showtime ? bankDepositBlockReason({ startsAt: new Date(showtime.startsAt * 1000), now: new Date() }) : null;
  const usingBank = payMethod === 'bank_transfer' && !bankBlocked;

  const submitBankDeposit = async () => {
    if (!ticketType || !showtime) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/shows/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showtimeId: showtime.id, ticketTypeId: ticketType.id, quantity: qty,
          buyerName: name, buyerContact: phone, buyerEmail: email,
          refundPolicyAgreed: true, paymentMethod: 'bank_transfer', locale,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; manageUrl?: string; message?: string } | null;
      if (res.status === 201 && data?.ok && typeof data.manageUrl === 'string') {
        // 문서 이동 — 도착지(내 티켓)는 관리 토큰이 실린 비밀 주소다(lib/analytics/privatePaths.ts).
        window.location.assign(data.manageUrl);
        return;
      }
      setError(data?.message || t.errBank);
    } catch {
      setError(t.errNetworkBank);
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBook || !ticketType || !showtime || submitting) return;
    setError(null);
    if (usingBank) return submitBankDeposit();
    if (widget.agreedRequiredTerms === false) return setError(t.errTerms);
    setSubmitting(true);
    try {
      const key = JSON.stringify([showtime.id, ticketType.id, qty, name.trim(), phone.trim(), email.trim()]);
      let pending = pendingRef.current;
      // 홀드 만료 1분 전까지만 재사용한다 — 결제창을 여는 동안 만료되는 주문을 넘기지 않는다.
      const fresh = pending && pending.key === key && Date.now() - pending.createdAt < (SHOW_HOLD_SECONDS - 60) * 1000;
      if (!fresh) {
        const res = await fetch('/api/shows/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            showtimeId: showtime.id,
            ticketTypeId: ticketType.id,
            quantity: qty,
            buyerName: name,
            buyerContact: phone,
            buyerEmail: email,
            // 동의는 결제하기를 누르는 행위로 받는다(아래 고지) — 체크박스를 두지 않는다. 서버 검증은 그대로다.
            refundPolicyAgreed: true,
            // 주문 언어 — 서버가 오류 문구·티켓 메일·내 티켓 주소를 이 언어로 만든다.
            locale,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; orderNo: string; totalAmount: number }
          | { ok: false; message?: string }
          | null;
        if (!res.ok || !data || !data.ok) {
          setError((data && !data.ok && data.message) || t.errCreate);
          return;
        }
        pending = { key, orderNo: data.orderNo, totalAmount: data.totalAmount, createdAt: Date.now() };
        pendingRef.current = pending;
      }
      if (!pending) return;

      const origin = window.location.origin;
      const orderName = t.orderName(show.title, showtime.label, ticketType.name, qty).slice(0, 100);
      reportPaymentWindowOpen(pending.orderNo);
      try {
        await widget.requestPayment({
          orderId: pending.orderNo,
          orderName,
          customerName: name.trim(),
          customerEmail: email.trim(),
          amount: pending.totalAmount,
          successUrl: `${origin}/${locale}/shows/success`,
          failUrl: `${origin}/${locale}/shows/fail?slug=${encodeURIComponent(show.slug)}`,
        });
      } catch (err) {
        // 같은 입력이면 만든 주문을 그대로 재사용하므로 어느 경우든 같은 버튼으로 다시 시도할 수 있다.
        // 카드사를 안 고른 경우(NEED_CARD_PAYMENT_DETAIL)는 창을 닫은 것이 아니라서 따로 안내한다.
        const code = (err as { code?: string } | null)?.code;
        setError(code === 'NEED_CARD_PAYMENT_DETAIL' ? t.errNeedCard : t.errClosed);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // role은 두지 않는다 — 취소 공연은 ShowDetailView가 이미 role="status"로 알리고 있어 둘이 되면 두 번 읽힌다.
  if (show.cancelled) {
    return <Notice tone="neutral" icon={false}>{t.cancelled}</Notice>;
  }
  if (showtimes.length === 0) {
    return <Notice tone="neutral" icon={false}>{t.comingSoon}</Notice>;
  }

  return (
    <form id="book" ref={formRef} onSubmit={submit} noValidate className="scroll-mt-24 space-y-6" aria-label={t.ariaLabel}>
      {showtimes.length > 1 || !isOpen ? (
        <div>
          <ChoiceGroup label={t.showtime}>
            {showtimes.map((s) => (
              <ChoiceCard
                key={s.id}
                name="showtime"
                value={s.id}
                checked={s.id === showtimeId}
                disabled={s.saleState !== 'open'}
                onChange={() => setShowtimeId(s.id)}
                title={s.label}
                trailing={<span className="font-normal text-gray-600 dark:text-gray-300">{copy.saleState[s.saleState]}</span>}
              />
            ))}
          </ChoiceGroup>
          {!firstOpen && (
            <p role="status" className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              {t.noOpenShowtime}
            </p>
          )}
        </div>
      ) : null}

      {isOpen && showtimes.length === 1 && show.ticketTypes.length === 1 && ticketType && showtime && (
        // 고를 것이 없으면 라디오 두 묶음 대신 한 줄로 알린다 — 입력 전에 읽을 것을 줄인다.
        <Panel className="text-sm text-gray-800 dark:text-gray-200">
          <span className="font-semibold text-gray-900 dark:text-white">{showtime.label}</span> · {ticketType.name} {won(ticketType.price)}
          <span className="text-gray-500 dark:text-gray-400">
            {' '}
            · {remainingFor(ticketType.id) <= 10 ? t.remaining(remainingFor(ticketType.id)) : t.available}
          </span>
        </Panel>
      )}

      {isOpen && (
        <>
          {show.ticketTypes.length > 1 ? (
            <ChoiceGroup label={t.ticket}>
              {show.ticketTypes.map((tt) => {
                const left = remainingFor(tt.id);
                const soldOut = left <= 0;
                const availability = soldOut ? t.soldOut : left <= 10 ? t.remaining(left) : t.available;
                return (
                  <ChoiceCard
                    key={tt.id}
                    name="ticketType"
                    value={tt.id}
                    checked={tt.id === selectedTypeId}
                    disabled={soldOut}
                    onChange={() => setTicketTypeId(tt.id)}
                    title={tt.name}
                    description={tt.zoneLabel ? `${tt.zoneLabel} · ${availability}` : availability}
                    trailing={won(tt.price)}
                  />
                );
              })}
            </ChoiceGroup>
          ) : null}

          <Field id="show-quantity" label={t.quantity} hint={t.quantityHint(SHOW_MAX_PER_ORDER_CAP)}>
            <Select value={qty} onChange={(e) => setQuantity(Number(e.target.value))}>
              {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t.quantityOption(n)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="show-name" label={t.name} required>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} />
            </Field>
            <Field id="show-phone" label={t.phone} required hint={t.phoneHint}>
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder={t.phonePlaceholder} />
            </Field>
          </div>
          <Field id="show-email" label={t.email} required hint={t.emailHint}>
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" />
          </Field>

          <div>
            <h3 className="mb-2 typo-card-meta font-medium text-gray-700 dark:text-gray-300">{t.payMethod}</h3>
            {widget.picker === null ? (
              <PaymentMethodSkeleton />
            ) : widget.picker ? (
              <>
                <PaymentMethodPicker
                  name="show-paymethod"
                  value={usingBank ? 'bank_transfer' : widget.choice}
                  onChange={(next) => {
                    if (next === 'bank_transfer') { setPayMethod('bank_transfer'); return; }
                    setPayMethod('toss');
                    widget.setChoice(next);
                  }}
                  applePaySupported={widget.applePaySupported}
                  bankBlockedMessage={bankBlocked ? blockMessages[bankBlocked] : null}
                  confirmLabel={t.confirmLabel}
                  locale={locale}
                />
                {widget.error && <Notice tone="error" className="mt-3">{en ? 'The payment module failed to load. Please refresh the page.' : widget.error}</Notice>}
              </>
            ) : (
              <>
                {/* 계좌를 고르면 위젯을 **숨기기만** 한다 — 언마운트하면 iframe이 다시 그려지며 위젯 약관 동의가 풀린다. */}
                <PaymentMethodChoice
                  name="show-paymethod"
                  value={usingBank ? 'bank_transfer' : 'toss'}
                  onChange={setPayMethod}
                  bankBlockedMessage={bankBlocked ? blockMessages[bankBlocked] : null}
                  confirmLabel={t.confirmLabel}
                  locale={locale}
                />
                <div hidden={usingBank} className="mt-3">
                  <div id={widget.methodsId} />
                  <div id={widget.agreementId} />
                  {widget.error && (
                    <Notice
                      tone="error"
                      actions={
                        <Button type="button" size="sm" variant="weak" onClick={widget.retry}>
                          {t.retry}
                        </Button>
                      }
                    >
                      {en ? 'The payment module failed to load. Please try again.' : widget.error}
                    </Notice>
                  )}
                </div>
              </>
            )}
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          {/*
            약관·규정 동의는 **결제하기를 누르는 행위**로 받는다 — 체크박스를 두지 않는다(펀딩 PledgeWizard와 같은
            규칙). 화면에는 결제위젯의 [필수] 결제 서비스 약관 체크가 이미 있어, 같은 말을 하는 체크를 더 두면
            중복으로 읽힌다. 청약철회·환불 조건은 법적으로 **고지** 의무라 한 줄로 알리고, 표는 접어 둔다.
            서버 검증(refundPolicyAgreed)과 기록은 그대로다.
          */}
          <div className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            <p>
              {t.agreeLead(usingBank)}
              {/* 처리방침은 한국어 원본이 정본이다(영어판 없음) — 영어 화면에서도 /ko 문서로 연결하고 라벨에 (Korean)을 붙인다. */}
              <Link href="/ko/privacy-policy" target="_blank" className="underline">{t.privacy}</Link>
              {t.agreeTail}
              {usingBank ? t.holdBank : t.holdToss(Math.floor(SHOW_HOLD_SECONDS / 60))}
            </p>
            <Disclosure variant="plain" summary={t.refundPolicy} className="mt-1" summaryClassName="text-xs font-medium text-gray-600 dark:text-gray-300" bodyClassName="text-xs">
              <RefundPolicyList locale={locale} />
            </Disclosure>
          </div>

          <Button type="submit" fullWidth disabled={!canBook || (!usingBank && !widget.ready) || submitting}>
            {submitting ? t.processing : t.submit(won(total), usingBank)}
          </Button>
        </>
      )}
    </form>
  );
}
