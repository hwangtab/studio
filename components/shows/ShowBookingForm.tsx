import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../ui/Button';
import { Field, TextInput, Select } from '../ui/Field';
import { useTossPaymentWidgets } from '../booking/useTossPaymentWidgets';
import { reportPaymentWindowOpen } from '../../utils/reportPaymentFailure';
import { formatWon, SALE_STATE_LABELS } from '../../lib/shows/copy';
import { SHOW_HOLD_SECONDS, SHOW_MAX_PER_ORDER_CAP } from '../../lib/shows/limits';
import type { PublicShow, PublicShowtime } from '../../lib/shows/queries';
import RefundPolicyList from './RefundPolicyList';
import PaymentMethodChoice from '../payments/PaymentMethodChoice';
import { BANK_DEPOSIT_BLOCK_MESSAGES, bankDepositBlockReason, type CheckoutPaymentMethod } from '../../lib/payments/bankDeposit';

interface Props {
  show: PublicShow;
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
export default function ShowBookingForm({ show }: Props) {
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

  const widget = useTossPaymentWidgets(total, canBook && widgetArmed);

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
          refundPolicyAgreed: true, paymentMethod: 'bank_transfer',
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; manageUrl?: string; message?: string } | null;
      if (res.status === 201 && data?.ok && typeof data.manageUrl === 'string') {
        // 문서 이동 — 도착지(내 티켓)는 관리 토큰이 실린 비밀 주소다(lib/analytics/privatePaths.ts).
        window.location.assign(data.manageUrl);
        return;
      }
      setError(data?.message || '신청하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } catch {
      setError('네트워크 오류로 신청하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBook || !ticketType || !showtime || submitting) return;
    setError(null);
    if (usingBank) return submitBankDeposit();
    if (widget.agreedRequiredTerms === false) return setError('결제수단 아래 [필수] 결제 서비스 이용 약관에도 동의해 주세요.');
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
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; orderNo: string; totalAmount: number }
          | { ok: false; message?: string }
          | null;
        if (!res.ok || !data || !data.ok) {
          setError((data && !data.ok && data.message) || '주문을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
          return;
        }
        pending = { key, orderNo: data.orderNo, totalAmount: data.totalAmount, createdAt: Date.now() };
        pendingRef.current = pending;
      }
      if (!pending) return;

      const origin = window.location.origin;
      const orderName = `${show.title} ${showtime.label} ${ticketType.name} ${qty}매`.slice(0, 100);
      reportPaymentWindowOpen(pending.orderNo);
      try {
        await widget.requestPayment({
          orderId: pending.orderNo,
          orderName,
          customerName: name.trim(),
          customerEmail: email.trim(),
          amount: pending.totalAmount,
          successUrl: `${origin}/ko/shows/success`,
          failUrl: `${origin}/ko/shows/fail?slug=${encodeURIComponent(show.slug)}`,
        });
      } catch (err) {
        // 같은 입력이면 만든 주문을 그대로 재사용하므로 어느 경우든 같은 버튼으로 다시 시도할 수 있다.
        // 카드사를 안 고른 경우(NEED_CARD_PAYMENT_DETAIL)는 창을 닫은 것이 아니라서 따로 안내한다.
        const code = (err as { code?: string } | null)?.code;
        setError(
          code === 'NEED_CARD_PAYMENT_DETAIL'
            ? '카드 결제는 카드사를 먼저 골라 주세요. 결제 방법 아래에서 카드사를 선택한 뒤 다시 눌러 주세요.'
            : '결제창이 닫혔습니다. 좌석은 잠시 보류되어 있으니 같은 버튼으로 다시 시도할 수 있습니다.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (show.cancelled) {
    return <p className="rounded-xl bg-gray-100 p-4 text-sm dark:bg-gray-800">이 공연은 취소되었습니다. 문의는 아래 연락처로 부탁드립니다.</p>;
  }
  if (showtimes.length === 0) {
    return <p className="rounded-xl bg-gray-100 p-4 text-sm dark:bg-gray-800">예매 일정이 곧 공개됩니다.</p>;
  }

  return (
    <form id="book" ref={formRef} onSubmit={submit} noValidate className="scroll-mt-24 space-y-6" aria-label="티켓 예매">
      {showtimes.length > 1 || !isOpen ? (
      <fieldset>
        <legend className="mb-2 typo-card-title">회차</legend>
        <div className="grid gap-2">
          {showtimes.map((s) => {
            const selectable = s.saleState === 'open';
            const selected = s.id === showtimeId;
            return (
              <label
                key={s.id}
                className={[
                  'flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 focus-within:ring-2 focus-within:ring-primary/70 dark:focus-within:ring-primary-lighter/70',
                  selected ? 'border-primary bg-primary/5 dark:border-primary-lighter dark:bg-primary-lighter/10' : 'border-gray-300 dark:border-gray-600',
                  selectable ? '' : 'cursor-not-allowed opacity-60',
                ].join(' ')}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="showtime"
                    value={s.id}
                    checked={selected}
                    disabled={!selectable}
                    onChange={() => setShowtimeId(s.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="font-medium text-gray-900 dark:text-white">{s.label}</span>
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">{SALE_STATE_LABELS[s.saleState]}</span>
              </label>
            );
          })}
        </div>
        {!firstOpen && (
          <p role="status" className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            지금 예매할 수 있는 회차가 없습니다.
          </p>
        )}
      </fieldset>
      ) : null}

      {isOpen && showtimes.length === 1 && show.ticketTypes.length === 1 && ticketType && showtime && (
        // 고를 것이 없으면 라디오 두 묶음 대신 한 줄로 알린다 — 입력 전에 읽을 것을 줄인다.
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-800 dark:bg-gray-800/60 dark:text-gray-200">
          <span className="font-semibold text-gray-900 dark:text-white">{showtime.label}</span> · {ticketType.name} {formatWon(ticketType.price)}
          <span className="text-gray-500 dark:text-gray-400">
            {' '}
            · {remainingFor(ticketType.id) <= 10 ? `잔여 ${remainingFor(ticketType.id)}석` : '예매 가능'}
          </span>
        </p>
      )}

      {isOpen && (
        <>
          {show.ticketTypes.length > 1 ? (
          <fieldset>
            <legend className="mb-2 typo-card-title">티켓</legend>
            <div className="grid gap-2">
              {show.ticketTypes.map((t) => {
                const left = remainingFor(t.id);
                const soldOut = left <= 0;
                return (
                  <label
                    key={t.id}
                    className={[
                      'flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 focus-within:ring-2 focus-within:ring-primary/70 dark:focus-within:ring-primary-lighter/70',
                      t.id === selectedTypeId ? 'border-primary bg-primary/5 dark:border-primary-lighter dark:bg-primary-lighter/10' : 'border-gray-300 dark:border-gray-600',
                      soldOut ? 'cursor-not-allowed opacity-60' : '',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="ticketType"
                        value={t.id}
                        checked={t.id === selectedTypeId}
                        disabled={soldOut}
                        onChange={() => setTicketTypeId(t.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span>
                        <span className="font-medium text-gray-900 dark:text-white">{t.name}</span>
                        {t.zoneLabel && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{t.zoneLabel}</span>}
                      </span>
                    </span>
                    <span className="text-right text-sm text-gray-700 dark:text-gray-300">
                      {formatWon(t.price)}
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {soldOut ? '매진' : left <= 10 ? `잔여 ${left}석` : '예매 가능'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          ) : null}

          <Field id="show-quantity" label="매수" hint={`1회 최대 ${SHOW_MAX_PER_ORDER_CAP}매`}>
            <Select value={qty} onChange={(e) => setQuantity(Number(e.target.value))}>
              {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}매
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="show-name" label="이름" required>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} />
            </Field>
            <Field id="show-phone" label="휴대폰 번호" required>
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" />
            </Field>
          </div>
          <Field id="show-email" label="이메일" required hint="티켓(QR)을 이 주소로 보내 드립니다.">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" />
          </Field>

          <div>
            <h3 className="mb-2 typo-card-title">결제 수단</h3>
            {/* 계좌를 고르면 위젯을 **숨기기만** 한다 — 언마운트하면 iframe이 다시 그려지며 위젯 약관 동의가 풀린다. */}
            <PaymentMethodChoice
              name="show-paymethod"
              value={usingBank ? 'bank_transfer' : 'toss'}
              onChange={setPayMethod}
              bankBlockedMessage={bankBlocked ? BANK_DEPOSIT_BLOCK_MESSAGES[bankBlocked] : null}
              confirmLabel="티켓이 발권"
            />
            <div hidden={usingBank} className="mt-3">
              <div id={widget.methodsId} />
              <div id={widget.agreementId} />
              {widget.error && (
                <div>
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">{widget.error}</p>
                  <Button type="button" variant="outline" onClick={widget.retry} className="mt-3">
                    다시 시도
                  </Button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {/*
            약관·규정 동의는 **결제하기를 누르는 행위**로 받는다 — 체크박스를 두지 않는다(펀딩 PledgeWizard와 같은
            규칙). 화면에는 결제위젯의 [필수] 결제 서비스 약관 체크가 이미 있어, 같은 말을 하는 체크를 더 두면
            중복으로 읽힌다. 청약철회·환불 조건은 법적으로 **고지** 의무라 한 줄로 알리고, 표는 접어 둔다.
            서버 검증(refundPolicyAgreed)과 기록은 그대로다.
          */}
          <div className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            <p>
              {usingBank ? '계좌 안내 받기' : '결제하기'}를 누르면 취소·환불 규정과{' '}
              <Link href="/ko/privacy-policy" target="_blank" className="underline">개인정보 처리방침</Link>에 동의하는
              것으로 봅니다.{' '}
              {usingBank
                ? '좌석은 입금을 확인할 때까지 잡아 두고, 확인되면 티켓(QR)을 메일로 보내 드립니다.'
                : `좌석은 결제창을 여는 동안 ${Math.floor(SHOW_HOLD_SECONDS / 60)}분간 보류됩니다.`}
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer rounded underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70">
                취소·환불 규정 보기
              </summary>
              <RefundPolicyList className="mt-2" />
            </details>
          </div>

          <Button type="submit" fullWidth disabled={!canBook || (!usingBank && !widget.ready) || submitting}>
            {submitting ? '처리 중…' : `${formatWon(total)} · ${usingBank ? '계좌 안내 받기' : '결제하기'}`}
          </Button>
        </>
      )}
    </form>
  );
}
