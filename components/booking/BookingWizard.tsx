import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import PriceBreakdown from './PriceBreakdown';
import TossPaymentWidget from './TossPaymentWidget';
import { Button } from '../ui/Button';
import { computeAmounts } from '../../lib/booking/amounts';
import { kstDateString } from '../../lib/booking/kst';
import type { SessionProduct } from '../../lib/booking/products';
import { REFUND_POLICY_LINES } from '../../lib/booking/refund-policy';
import type { DaySlot } from '../../lib/booking/slots';
import { MAX_BOOK_DAYS } from '../../lib/booking/validation';

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

  const fetchSlots = useCallback(async () => {
    if (!date) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const params = new URLSearchParams({
        productId: selectedProduct.id,
        hours: String(effectiveHours),
        date,
      });
      const res = await fetch(`/api/bookings/slots?${params.toString()}`);
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
    } catch {
      setSlots([]);
      setSlotsError('일시적으로 예약 현황을 불러올 수 없습니다.');
    } finally {
      setSlotsLoading(false);
    }
  }, [date, selectedProduct.id, effectiveHours]);

  // step이 2로 (재)진입할 때마다 재조회한다 — 409로 되돌아온 경우도 이 경로로 재조회된다.
  useEffect(() => {
    if (step !== 2 || !date) return;
    void fetchSlots();
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

  // Step 4: 결제
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);

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

      if (res.status === 201 && data.ok && data.orderNo && typeof data.totalAmount === 'number') {
        setOrderNo(data.orderNo);
        setTotalAmount(data.totalAmount);
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

      {step === 4 && orderNo && totalAmount !== null && selectedStartHour !== null && (
        <section aria-labelledby="booking-step4-heading">
          <h2 id="booking-step4-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            4. 결제
          </h2>

          <div className="mb-4">
            <PriceBreakdown amounts={amounts} />
          </div>

          <TossPaymentWidget
            orderNo={orderNo}
            amount={totalAmount}
            orderName={formatOrderName(selectedProduct.nameKo, date, selectedStartHour)}
            customerName={customerName}
            customerEmail={customerEmail}
          />
        </section>
      )}
    </main>
  );
}
