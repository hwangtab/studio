import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import PriceBreakdown from './PriceBreakdown';
import TossPaymentWidget from './TossPaymentWidget';
import { Button } from '../ui/Button';
import { computeAmounts, type OrderAmounts } from '../../lib/booking/amounts';
import { kstDateString } from '../../lib/booking/kst';
import type { SessionProduct } from '../../lib/booking/products';
import { REFUND_POLICY_LINES } from '../../lib/booking/refund-policy';
import type { DaySlot } from '../../lib/booking/slots';
import { MAX_BOOK_DAYS, PENDING_HOLD_SECONDS } from '../../lib/booking/validation';

interface BookingWizardProps {
  service: string;
  products: SessionProduct[];
}

type Step = 1 | 2 | 3 | 4;

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent';

/** 예약 API 페이로드 — 서버에 금액을 절대 보내지 않는다(서버가 SSOT로 재계산). */
interface CreateBookingBody {
  productId: string;
  hours: number;
  date: string;
  startHour: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNote?: string;
  refundPolicyAgreed: true;
}

interface SlotsResponse {
  ok: boolean;
  slots?: DaySlot[];
  code?: string;
  message?: string;
}

interface CreateBookingResponse {
  ok: boolean;
  orderNo?: string;
  itemAmount?: number;
  vatAmount?: number;
  totalAmount?: number;
  code?: string;
  message?: string;
}

/** '보컬 녹음 1프로' + '2026-09-10' + 14 → '보컬 녹음 1프로 (9/10 14:00)' */
const formatOrderName = (nameKo: string, date: string, startHour: number): string => {
  const [, monthStr, dayStr] = date.split('-');
  const hh = String(startHour).padStart(2, '0');
  return `${nameKo} (${Number(monthStr)}/${Number(dayStr)} ${hh}:00)`;
};

/** 남은 선점 시간을 "12분 3초"로. 1분 미만이면 초만 보여 촉박함이 드러나게 한다. */
const formatHoldLeft = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m > 0 ? `${m}분 ${sec}초` : `${sec}초`;
};

export default function BookingWizard({ service, products }: BookingWizardProps) {
  const firstProduct = products[0];

  const [step, setStep] = useState<Step>(1);

  // Step 1: 상품 · 시간
  const [selectedProductId, setSelectedProductId] = useState(firstProduct.id);
  const [hours, setHours] = useState<number>(() =>
    firstProduct.kind === 'hourly' ? firstProduct.minHours ?? 1 : firstProduct.sessionHours ?? 1
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? firstProduct,
    [products, selectedProductId, firstProduct]
  );
  const effectiveHours = selectedProduct.kind === 'package' ? selectedProduct.sessionHours ?? 0 : hours;
  const amounts = useMemo(() => computeAmounts(selectedProduct, effectiveHours), [selectedProduct, effectiveHours]);

  const hourOptions = useMemo(() => {
    if (selectedProduct.kind !== 'hourly') return [];
    const min = selectedProduct.minHours ?? 1;
    const max = selectedProduct.maxHours ?? min;
    return Array.from({ length: Math.max(max - min + 1, 0) }, (_, i) => min + i);
  }, [selectedProduct]);

  // Step 2: 날짜 · 슬롯
  const { minDate, maxDate } = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const last = new Date(now.getTime() + MAX_BOOK_DAYS * 24 * 60 * 60 * 1000);
    return { minDate: kstDateString(tomorrow), maxDate: kstDateString(last) };
  }, []);

  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<DaySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  // 409(다른 예약 선점) 후 슬롯 단계로 되돌아왔을 때 보여주는 안내 — slotsError(조회 실패)와는 다른 채널.
  const [slotsNotice, setSlotsNotice] = useState<string | null>(null);
  const [selectedStartHour, setSelectedStartHour] = useState<number | null>(null);

  const resetSlotState = () => {
    setDate('');
    setSlots([]);
    setSlotsError(null);
    setSlotsNotice(null);
    setSelectedStartHour(null);
  };

  const handleProductChange = (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setSelectedProductId(id);
    setHours(product.kind === 'hourly' ? product.minHours ?? 1 : product.sessionHours ?? 1);
    resetSlotState();
  };

  const handleHoursChange = (value: number) => {
    setHours(value);
    resetSlotState();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
    setSelectedStartHour(null);
    setSlots([]);
    setSlotsError(null);
  };

  // AbortController로 응답 역전을 막는다 — 날짜를 빠르게 바꾸면 먼저 보낸 요청이
  // 나중에 도착해 최신 선택을 덮어쓸 수 있다(느린 응답이 빠른 응답을 역전). 새 요청을
  // 시작하기 전 이전 요청을 abort하고, AbortError는 상태를 건드리지 않고 무시한다.
  const fetchSlots = useCallback(async (signal: AbortSignal) => {
    if (!date) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const params = new URLSearchParams({
        productId: selectedProduct.id,
        hours: String(effectiveHours),
        date,
      });
      const res = await fetch(`/api/bookings/slots?${params.toString()}`, { signal });
      if (res.status === 503) {
        setSlots([]);
        setSlotsError('일시적으로 예약 현황을 불러올 수 없습니다.');
        return;
      }
      const data: SlotsResponse = await res.json();
      if (!res.ok || !data.ok) {
        setSlots([]);
        setSlotsError(data.message ?? '예약 현황을 불러오지 못했습니다.');
        return;
      }
      setSlots(data.slots ?? []);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return; // 최신 요청에 밀려난 이전 요청 — 무시
      setSlots([]);
      setSlotsError('일시적으로 예약 현황을 불러올 수 없습니다.');
    } finally {
      if (!signal.aborted) setSlotsLoading(false);
    }
  }, [date, selectedProduct.id, effectiveHours]);

  // step이 2로 (재)진입할 때마다 재조회한다 — 409로 되돌아온 경우도 이 경로로 재조회된다.
  useEffect(() => {
    if (step !== 2 || !date) return;
    const controller = new AbortController();
    void fetchSlots(controller.signal);
    return () => controller.abort();
  }, [step, date, fetchSlots]);

  const slotButtonClass = (slot: DaySlot) => {
    if (!slot.available)
      return 'h-11 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed';
    if (selectedStartHour === slot.startHour)
      return 'h-11 rounded-md border border-primary bg-primary text-white font-semibold';
    return 'h-11 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-primary hover:text-primary transition-colors';
  };

  // Step 3: 예약자 정보
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [refundPolicyAgreed, setRefundPolicyAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const agreeRef = React.useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 4: 결제 — 표시 금액은 서버가 POST 응답으로 돌려준 값(SSOT)만 쓴다.
  // step 1의 amounts(클라이언트 재계산)는 진행 중 미리보기용일 뿐, 실제 청구액과
  // 드리프트가 생길 수 있어(예: 서버 반올림 규칙 변경) 결제 단계엔 쓰지 않는다.
  const [confirmedOrder, setConfirmedOrder] = useState<{ orderNo: string; amounts: OrderAmounts } | null>(null);
  /**
   * 선점이 풀리는 시각(클라이언트 기준 epoch ms).
   *
   * 주문을 만들면 서버가 그 슬롯을 PENDING_HOLD_SECONDS 동안만 잡아 둔다. 고객이 결제창을
   * 오래 열어두면 토스 인증까지 마친 뒤 confirm에서 거부당하고, 카드에는 승인 대기만 남은
   * 채 이유를 알 수 없었다 — 화면에 타이머도 문구도 없었기 때문이다.
   *
   * 주문 생성 직후 클라이언트 시계로 기한을 잡고 같은 시계로 남은 시간을 센다. 두 값이
   * 한 시계에서 나오므로 기기 시계가 어긋나 있어도 카운트다운은 정확하다.
   */
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [holdRemainingMs, setHoldRemainingMs] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStartHour === null) {
      setStep(2);
      return;
    }
    if (!refundPolicyAgreed) {
      setAgreeError(true);
      agreeRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: CreateBookingBody = {
        productId: selectedProduct.id,
        hours: effectiveHours,
        date,
        startHour: selectedStartHour,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
        refundPolicyAgreed: true,
      };
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: CreateBookingResponse = await res.json();

      if (
        res.status === 201 &&
        data.ok &&
        data.orderNo &&
        typeof data.itemAmount === 'number' &&
        typeof data.vatAmount === 'number' &&
        typeof data.totalAmount === 'number'
      ) {
        setConfirmedOrder({
          orderNo: data.orderNo,
          amounts: { itemAmount: data.itemAmount, vatAmount: data.vatAmount, totalAmount: data.totalAmount },
        });
        setHoldExpiresAt(Date.now() + PENDING_HOLD_SECONDS * 1000);
        setStep(4);
        return;
      }

      if (res.status === 409) {
        setSlotsNotice(data.message ?? '방금 다른 예약이 먼저 잡혔습니다. 다른 시간대를 선택해 주세요.');
        setSelectedStartHour(null);
        setStep(2);
        return;
      }

      // 400(입력 오류) · 429(요청 과다) 등 — 현재 단계(정보 입력)에 메시지로 표시.
      setSubmitError(data.message ?? '예약 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } catch {
      setSubmitError('네트워크 오류로 예약 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // 선점 카운트다운. 4단계에 있을 때만 돌리고, 0에 닿으면 멈춘다.
  useEffect(() => {
    if (step !== 4 || holdExpiresAt === null) {
      setHoldRemainingMs(null);
      return;
    }
    const tick = () => setHoldRemainingMs(Math.max(0, holdExpiresAt - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [step, holdExpiresAt]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <Link href={`/ko/${service}`} className="text-sm text-primary hover:underline">
        ← 서비스 소개로 돌아가기
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
        {selectedProduct.nameKo} 온라인 예약
      </h1>
      <p className="mt-1 mb-8 text-sm text-gray-500 dark:text-gray-400">STEP {step} / 4</p>

      {step === 1 && (
        <section aria-labelledby="booking-step1-heading">
          <h2 id="booking-step1-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            1. 상품과 시간 선택
          </h2>

          {products.length > 1 && (
            <fieldset className="mb-4">
              <legend className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">상품 선택</legend>
              <div className="space-y-2">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer transition-colors ${
                      selectedProductId === p.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="product"
                      value={p.id}
                      checked={selectedProductId === p.id}
                      onChange={() => handleProductChange(p.id)}
                      className="h-4 w-4 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-100">{p.nameKo}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {selectedProduct.kind === 'hourly' && (
            <div className="mb-4">
              <label htmlFor="hours" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                이용 시간
              </label>
              <select
                id="hours"
                value={hours}
                onChange={(e) => handleHoursChange(Number(e.target.value))}
                className="w-full sm:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {hourOptions.map((h) => (
                  <option key={h} value={h}>
                    {h}시간
                  </option>
                ))}
              </select>
            </div>
          )}

          <PriceBreakdown amounts={amounts} />

          <div className="mt-6">
            <Button type="button" onClick={() => setStep(2)} fullWidth>
              다음: 날짜·시간 선택
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="booking-step2-heading">
          <h2 id="booking-step2-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            2. 날짜와 시간 선택
          </h2>

          {slotsNotice && (
            <p role="alert" className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
              {slotsNotice}
            </p>
          )}

          <div className="mb-4">
            <label htmlFor="booking-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
              날짜
            </label>
            <input
              id="booking-date"
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={handleDateChange}
              className="w-full sm:w-56 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {date && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">시간 선택</p>
              {slotsLoading && <p className="text-sm text-gray-500 dark:text-gray-400">예약 현황을 불러오는 중…</p>}
              {slotsError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {slotsError}
                </p>
              )}
              {!slotsLoading && !slotsError && slots.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.startHour}
                      type="button"
                      disabled={!slot.available}
                      aria-pressed={selectedStartHour === slot.startHour}
                      onClick={() => setSelectedStartHour(slot.startHour)}
                      className={slotButtonClass(slot)}
                    >
                      {String(slot.startHour).padStart(2, '0')}:00
                    </button>
                  ))}
                </div>
              )}
              {!slotsLoading && !slotsError && slots.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">이 날짜에는 예약 가능한 시간이 없습니다.</p>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              이전
            </Button>
            <Button
              type="button"
              onClick={() => setStep(3)}
              disabled={selectedStartHour === null}
              fullWidth
            >
              다음: 예약자 정보
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="booking-step3-heading">
          <h2 id="booking-step3-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            3. 예약자 정보
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="customerName" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                이름
              </label>
              <input
                id="customerName"
                type="text"
                autoComplete="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="customerPhone" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                휴대폰 번호
              </label>
              <input
                id="customerPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="010-1234-5678"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="customerEmail" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                이메일
              </label>
              <input
                id="customerEmail"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="customerNote" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                요청사항 (선택)
              </label>
              <textarea
                id="customerNote"
                rows={4}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">환불 규정</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                {REFUND_POLICY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2.5">
              <input
                ref={agreeRef}
                type="checkbox"
                id="refund-agree"
                checked={refundPolicyAgreed}
                onChange={(e) => {
                  setRefundPolicyAgreed(e.target.checked);
                  if (e.target.checked) setAgreeError(false);
                }}
                aria-required="true"
                aria-invalid={agreeError}
                aria-describedby={agreeError ? 'refund-agree-error' : undefined}
                className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-300 dark:border-gray-600 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <label htmlFor="refund-agree" className="text-sm text-gray-600 dark:text-gray-400 leading-snug">
                위 환불 규정에 동의합니다 (필수)
              </label>
            </div>
            {agreeError && (
              <p id="refund-agree-error" role="alert" className="text-xs text-red-600">
                환불 규정에 동의해 주세요.
              </p>
            )}

            {submitError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {submitError}
              </p>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                이전
              </Button>
              <Button type="submit" disabled={submitting} fullWidth>
                {submitting ? '처리 중…' : '예약 신청'}
              </Button>
            </div>
          </form>
        </section>
      )}

      {step === 4 && confirmedOrder && selectedStartHour !== null && (
        <section aria-labelledby="booking-step4-heading">
          <h2 id="booking-step4-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            4. 결제
          </h2>

          {holdRemainingMs !== null && (
            holdRemainingMs > 0 ? (
              <p
                className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
                role="status"
              >
                이 시간대를 <strong>{formatHoldLeft(holdRemainingMs)}</strong> 동안 잡아 두었습니다.
                시간이 지나면 다른 분이 예약할 수 있어 결제가 취소될 수 있습니다.
              </p>
            ) : (
              <div
                className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                <strong>선점 시간이 지났습니다.</strong> 지금 결제하면 이미 다른 예약이 잡혀
                취소될 수 있습니다. 시간대를 다시 선택해 주세요.
                <span className="mt-2 block">
                  <Button type="button" variant="outline" onClick={() => { setConfirmedOrder(null); setHoldExpiresAt(null); setStep(2); }}>
                    시간대 다시 선택
                  </Button>
                </span>
              </div>
            )
          )}

          <div className="mb-4">
            <PriceBreakdown amounts={confirmedOrder.amounts} />
          </div>

          <TossPaymentWidget
            orderNo={confirmedOrder.orderNo}
            amount={confirmedOrder.amounts.totalAmount}
            orderName={formatOrderName(selectedProduct.nameKo, date, selectedStartHour)}
            customerName={customerName}
            customerEmail={customerEmail}
            service={service}
          />

          <div className="mt-4">
            <Button type="button" variant="outline" onClick={() => setStep(3)}>
              ← 정보 수정
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
