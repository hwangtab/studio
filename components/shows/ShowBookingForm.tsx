import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../ui/Button';
import { Field, TextInput, Select } from '../ui/Field';
import { useTossPaymentWidgets } from '../booking/useTossPaymentWidgets';
import { reportPaymentWindowOpen } from '../../utils/reportPaymentFailure';
import { formatWon, SALE_STATE_LABELS } from '../../lib/shows/copy';
import { SHOW_HOLD_SECONDS, SHOW_MAX_PER_ORDER_CAP } from '../../lib/shows/limits';
import type { PublicShow, PublicShowtime } from '../../lib/shows/queries';
import RefundPolicyList from './RefundPolicyList';

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
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef<PendingOrder | null>(null);

  const canBook = isOpen && !!ticketType && total > 0;
  const widget = useTossPaymentWidgets(total, canBook);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBook || !ticketType || !showtime || submitting) return;
    setError(null);
    if (!agreed) return setError('환불 규정에 동의해 주세요.');
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
            refundPolicyAgreed: agreed,
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
      } catch {
        // 사용자가 결제창을 닫은 경우 — 같은 입력이면 만든 주문을 그대로 재사용한다.
        setError('결제창이 닫혔습니다. 좌석은 잠시 보류되어 있으니 같은 버튼으로 다시 시도할 수 있습니다.');
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
    <form id="book" onSubmit={submit} noValidate className="space-y-6" aria-label="티켓 예매">
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

      {isOpen && (
        <>
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
          <Field id="show-email" label="이메일" required hint="티켓(QR)을 이 주소로 보내 드립니다. 결제 후 화면에서도 티켓 링크를 받을 수 있습니다.">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" />
          </Field>

          <section aria-label="환불 규정" className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="mb-2 typo-card-subtitle">취소·환불 규정</h3>
            <RefundPolicyList />
            <label className="mt-4 flex min-h-[44px] items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-5 w-5 accent-primary"
              />
              <span>위 취소·환불 규정을 확인했고 동의합니다. (필수)</span>
            </label>
          </section>

          <div>
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

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth disabled={!canBook || !widget.ready || submitting}>
            {submitting ? '처리 중…' : `${formatWon(total)} · 결제하기`}
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            결제 버튼을 누르면 좌석이 {Math.floor(SHOW_HOLD_SECONDS / 60)}분간 보류됩니다. 시간 안에 결제를 마치지 않으면 자동으로 풀립니다.
          </p>
        </>
      )}
    </form>
  );
}
