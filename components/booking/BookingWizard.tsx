import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { reportPaymentFailure } from '../../utils/reportPaymentFailure';

import PriceBreakdown from './PriceBreakdown';
import { TOSS_TERMS_REQUIRED_MESSAGE, useTossPaymentWidgets } from './useTossPaymentWidgets';
import { Button } from '../ui/Button';
import { computeAmounts } from '../../lib/booking/amounts';
import { BOOKING_CUSTOMER_DRAFT_KEY, CUSTOMER_DRAFT_FIELDS } from '../../lib/booking/customerDraft';
import { kstDateString } from '../../lib/booking/kst';
import type { SessionProduct } from '../../lib/booking/products';
import { refundPolicyFor } from '../../lib/booking/refund-policy';
import type { DaySlot } from '../../lib/booking/slots';
import { MAX_BOOK_DAYS, PENDING_HOLD_SECONDS } from '../../lib/booking/validation';
import { readStringDraft, writeStringDraft } from '../../lib/formDraft';
import { CANONICAL_FACTS } from '../../lib/factTokens';
import { getSiteConfig } from '../../data/siteConfig';
import { Field, Select, TextArea, TextInput } from '../ui/Field';

// 슬롯 조회 장애 안내의 대안 경로 — 위저드는 ko 전용 화면이라 ko 오픈채팅으로 고정한다.
const KAKAO_URL = getSiteConfig('ko').contact.kakaoUrl;
const TEL_HREF = `tel:${CANONICAL_FACTS.phoneIntl.replace(/[^0-9+]/g, '')}`;

interface BookingWizardProps {
  service: string;
  products: SessionProduct[];
}

type Step = 1 | 2 | 3;


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
    // 오늘부터 고를 수 있다. 지난 시각은 슬롯 API가 leadOk로 거른다(MIN_LEAD_HOURS = 0).
    // 2026-09-25까지 '내일부터'로 묶여 있었다 — 당일 예약이 통째로 막혀 있었다.
    const last = new Date(now.getTime() + MAX_BOOK_DAYS * 24 * 60 * 60 * 1000);
    return { minDate: kstDateString(now), maxDate: kstDateString(last) };
  }, []);

  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<DaySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  // 409(다른 예약 선점) 후 슬롯 단계로 되돌아왔을 때 보여주는 안내 — slotsError(조회 실패)와는 다른 채널.
  const [slotsNotice, setSlotsNotice] = useState<string | null>(null);
  // 슬롯 조회 실패(503 등) 뒤 "다시 불러오기" — 값이 바뀌면 같은 날짜로 재조회한다.
  const [retryTick, setRetryTick] = useState(0);

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
  }, [step, date, fetchSlots, retryTick]);

  const slotButtonClass = (slot: DaySlot) => {
    if (!slot.available)
      return 'h-11 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed';
    if (selectedStartHour === slot.startHour)
      return 'h-11 rounded-md border border-primary bg-primary text-white font-semibold';
    return 'h-11 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-primary hover:text-primary dark:hover:text-primary-lighter transition-colors';
  };

  // Step 3: 예약자 정보
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  // 환불 규정 동의는 임시 저장 대상이 아니다 — 복원된 체크는 사람이 그 자리에서 한
  // 의사표시가 아니라서 매번 새로 눌러야 한다(CLAUDE.md 약관 판본 절과 같은 판단).
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * 이름·연락처·이메일·요청사항만 새로고침·뒤로가기에도 살린다.
   *
   * 날짜·시간대·상품·시간은 일부러 담지 않는다 — 예약 가능 시간은 그 사이 바뀌고,
   * 되살린 시간대가 지금도 비어 있다는 보장이 없다. 되살렸다가 결제 직전에 409를 보여
   * 주는 쪽이, 탭 한 번으로 다시 고르게 하는 쪽보다 나쁘다(고르는 값은 타이핑이 아니다).
   *
   * `draftRestored`는 마운트 후 복원이 끝났는지를 가리키는 게이트다 — 아래 저장 effect가
   * 복원 effect보다 먼저 "아직 빈 폼"으로 한 번 실행되면 방금 불러온 초안을 그 빈 값으로
   * 덮어써 지워 버린다. 이 게이트가 없으면 새로고침 직후 초안이 사라진다.
   */
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    const draft = readStringDraft(BOOKING_CUSTOMER_DRAFT_KEY, CUSTOMER_DRAFT_FIELDS);
    if (draft.customerName) setCustomerName(draft.customerName);
    if (draft.customerPhone) setCustomerPhone(draft.customerPhone);
    if (draft.customerEmail) setCustomerEmail(draft.customerEmail);
    if (draft.customerNote) setCustomerNote(draft.customerNote);
    setDraftRestored(true);
  }, []);

  useEffect(() => {
    if (!draftRestored) return;
    writeStringDraft(BOOKING_CUSTOMER_DRAFT_KEY, CUSTOMER_DRAFT_FIELDS, {
      customerName,
      customerPhone,
      customerEmail,
      customerNote,
    });
  }, [draftRestored, customerName, customerPhone, customerEmail, customerNote]);

  // Step 4: 결제 — 표시 금액은 서버가 POST 응답으로 돌려준 값(SSOT)만 쓴다.
  // step 1의 amounts(클라이언트 재계산)는 진행 중 미리보기용일 뿐, 실제 청구액과
  // 드리프트가 생길 수 있어(예: 서버 반올림 규칙 변경) 결제 단계엔 쓰지 않는다.
  /**
   * 결제위젯을 **예약자 정보 폼 안에** 띄운다. 예전에는 주문을 만든 뒤 4단계 결제 화면을
   * 따로 그렸고, 거기서 선점 카운트다운을 보여 줬다.
   *
   * 카운트다운이 하던 말은 그대로 남긴다 — 다만 **시작하기 전에** 한다. 결제창을 열고 나면
   * 고객은 토스 화면에 있어서 우리 타이머를 볼 수 없다. "이 시간대를 15분간 잡아 둡니다"는
   * 누르기 전에 알아야 행동이 달라지는 정보다.
   *
   * 초기 금액은 화면의 추정치이고, **청구는 서버가 돌려준 금액으로** 연다(handleSubmit).
   */
  const {
    methodsId, agreementId, ready: paymentReady, error: paymentError, retry: retryPayment, requestPayment,
    agreedRequiredTerms,
    // 마운트 지점이 3단계에만 있다 — 그 전에 붙이려 하면 선택자가 비어 실패한다.
  } = useTossPaymentWidgets(amounts.totalAmount, step === 3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStartHour === null) {
      setStep(2);
      return;
    }
    /**
     * 위젯이 그리는 결제 약관도 제출 **전에** 본다.
     *
     * 예전에는 그냥 보내고 `requestPayment`가 실패하게 뒀다. 그 시점엔 주문이 이미
     * 만들어져 있고, 문구도 "잠시 후 다시 시도해 주세요"라 무엇을 고쳐야 하는지 알 수
     * 없었다(가리려던 `NEED_AGREEMENT` 코드는 SDK에 없다). 동의 상태를 못 받았을 때
     * (null)는 막지 않는다 — 동의했는데 결제가 안 되는 쪽이 더 나쁘다.
     */
    if (agreedRequiredTerms !== true) {
      setSubmitError(TOSS_TERMS_REQUIRED_MESSAGE);
      document.getElementById(agreementId)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    // 결제창 실패를 서버에 알릴 때 쓴다 — catch에서 주문번호가 보여야 한다.
    let createdOrderNo: string | null = null;
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
        // 슬롯을 잡아 둔 채로 곧바로 결제창을 연다. 금액은 **서버가 돌려준 값**으로 맞춘다.
        const origin = window.location.origin;
        createdOrderNo = data.orderNo;
        await requestPayment({
          orderId: data.orderNo,
          orderName: formatOrderName(selectedProduct.nameKo, date, selectedStartHour),
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          amount: data.totalAmount,
          successUrl: `${origin}/ko/booking/success`,
          failUrl: `${origin}/ko/booking/fail?service=${encodeURIComponent(service)}`,
        });
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
    } catch (err) {
      /**
       * 결제창이 열리기 전에 SDK가 던진 경우 실패 사유는 여기서만 알 수 있다 —
       * 토스의 failUrl 리다이렉트를 안 타므로 실패 화면(서버)도 모른다. 2026-09-19에
       * 한 후원자가 세 번 실패하고 떠났는데 이유가 어디에도 없었던 것이 이 구멍이다.
       * 취소(USER_CANCEL 등)도 코드가 오지만 아래 분기에서 조용히 빠지므로, 기록은
       * 분기보다 먼저 한다 — "창을 닫았다"도 알아야 할 사실이다.
       */
      reportPaymentFailure(createdOrderNo, err);
      /**
       * 결제창을 닫은 것은 오류가 아니다. 주문은 pending으로 남고 슬롯도 잡혀 있는데,
       * 다시 제출하면 서버가 **같은 고객의 세션 pending을 먼저 만료시키고** 새로 만든다
       * (lib/booking/service.ts의 자가 선점 해제) — 자기 홀드에 자기가 막히지 않는다.
       */
      const code = (err as { code?: string } | null)?.code;
      // **취소를 가장 먼저 걸러낸다.** 결제창을 닫은 것은 오류가 아니라서 아무 문구도
      // 띄우지 않는다 — 여기서 아래 약관 분기가 먼저 걸리면 창을 닫은 사람에게 "약관에
      // 동의해 주세요"를 띄우는 오진이 된다.
      if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED') return;
      // `NEED_AGREEMENT`는 SDK에 없는 코드였다 — 그 분기는 한 번도 타지 않았고, 약관만
      // 빼먹은 사람이 "잠시 후 다시 시도해 주세요"를 봤다. 이제는 제출 전에 막지만(위),
      // 동의 상태를 못 받은 경우(null)까지 대비해 여기서도 동의 쪽을 먼저 의심한다.
      if (agreedRequiredTerms !== true) {
        setSubmitError(TOSS_TERMS_REQUIRED_MESSAGE);
      } else if (code === 'NEED_CARD_PAYMENT_DETAIL') {
        setSubmitError('결제 수단과 약관 동의를 확인해 주세요.');
      } else {
        setSubmitError('네트워크 오류로 예약 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <Link href={`/ko/${service}`} className="text-sm text-primary dark:text-primary-lighter hover:underline">
        ← 서비스 소개로 돌아가기
      </Link>
      <h1 className="mt-3 typo-page-title">
        {selectedProduct.nameKo} 온라인 예약
      </h1>
      <p className="mt-1 mb-8 text-sm text-gray-500 dark:text-gray-400">STEP {step} / 3</p>

      {step === 1 && (
        <section aria-labelledby="booking-step1-heading">
          <h2 id="booking-step1-heading" className="typo-card-subtitle text-gray-900 dark:text-white mb-3">
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
                      className="h-4 w-4 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-100">{p.nameKo}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {selectedProduct.kind === 'hourly' && (
            <div className="mb-4">
              <Field id="hours" label="이용 시간">
                <Select
                  value={hours}
                  onChange={(e) => handleHoursChange(Number(e.target.value))}
                  className="sm:w-48 min-w-0 max-w-full"
                >
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>
                      {h}시간
                    </option>
                  ))}
                </Select>
              </Field>
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
          <h2 id="booking-step2-heading" className="typo-card-subtitle text-gray-900 dark:text-white mb-3">
            2. 날짜와 시간 선택
          </h2>

          {slotsNotice && (
            <p role="alert" className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
              {slotsNotice}
            </p>
          )}

          <div className="mb-4">
            <Field id="booking-date" label="날짜">
              <TextInput
                type="date"
                value={date}
                min={minDate}
                max={maxDate}
                onChange={handleDateChange}
                className="sm:w-56 min-w-0 max-w-full appearance-none box-border"
              />
            </Field>
          </div>

          {date && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">시간 선택</p>
              {slotsLoading && <p className="text-sm text-gray-500 dark:text-gray-400">예약 현황을 불러오는 중…</p>}
              {slotsError && (
                <div role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                  <p>{slotsError}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      onClick={() => setRetryTick((n) => n + 1)}
                      className="font-semibold underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      다시 불러오기
                    </button>
                    <span className="text-red-600/80 dark:text-red-300/80">
                      계속 안 되면{' '}
                      <a href={KAKAO_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">카카오톡</a>
                      {' '}또는{' '}
                      <a href={TEL_HREF} className="font-semibold underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">{CANONICAL_FACTS.phone}</a>
                      로 예약해 주세요.
                    </span>
                  </div>
                </div>
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
          <h2 id="booking-step3-heading" className="typo-card-subtitle text-gray-900 dark:text-white mb-3">
            3. 예약자 정보
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Field id="customerName" label="이름" required>
                <TextInput
                  type="text"
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div>
              <Field id="customerPhone" label="휴대폰 번호" required>
                <TextInput
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="010-1234-5678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div>
              <Field id="customerEmail" label="이메일" required>
                <TextInput
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div>
              <Field id="customerNote" label="요청사항 (선택)">
                <TextArea
                  className="min-h-0"
                  rows={4}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                />
              </Field>
            </div>

            <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">환불 규정</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                {refundPolicyFor(selectedProduct).lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            {/*
              동의는 **결제하기를 누르는 행위 자체**로 받는다. 체크박스를 두지 않는다 —
              같은 화면에 결제위젯이 그리는 [필수] 결제 서비스 약관 체크가 이미 있고,
              위젯은 자기 영역 안에 들여쓰여 그리므로 정렬도 배경도 맞출 수 없다. 거의 같은
              말을 하는 체크가 어긋난 자리에 둘이면 중복으로 읽힌다(2026-09-16 실사용 확인).

              법적으로도 체크박스가 요구되는 항목이 아니다 — 청약철회·환불 조건은
              전자상거래법 제13조상 **고지** 의무이고, 규정 전문을 바로 위에 펼쳐 두었다.
              서버 검증(refundPolicyAgreed)은 그대로다.
            */}
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              결제하기를 누르면 위 환불 규정에 동의하는 것으로 봅니다.
            </p>

            {/* 결제수단과 결제 약관 동의는 **위젯이 그린다.** 우리 목록을 따로 두지 않는다 —
                계약된 수단이 늘면 그대로 따라오고, 갈라지면 화면과 실제가 어긋난다. */}
            <div className="pt-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">결제수단</h3>
              {paymentError ? (
                <div className="mt-2">
                  <p role="alert" className="text-sm text-red-600">{paymentError}</p>
                  <Button type="button" variant="outline" onClick={retryPayment} className="mt-3">다시 시도</Button>
                </div>
              ) : (
                <>
                  <div id={methodsId} />
                  <div id={agreementId} />
                </>
              )}
            </div>

            {/* 예전에는 결제 화면에서 남은 시간을 세어 보여 줬다. 결제창을 열고 나면 고객은
                토스 화면에 있어서 그 타이머를 볼 수 없다 — 누르기 전에 말해야 행동이 달라진다. */}
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
            >
              결제를 시작하면 이 시간대를 <strong>{Math.round(PENDING_HOLD_SECONDS / 60)}분간</strong> 잡아 둡니다.
              그 안에 결제를 마치지 않으면 다시 열려 다른 분이 예약할 수 있습니다.
            </p>

            {submitError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {submitError}
              </p>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                이전
              </Button>
              {/* 위젯이 아직 안 떴으면 누를 수 없다 — 누르면 슬롯만 잡히고 결제창은 안 열린다. */}
              <Button type="submit" disabled={submitting || !paymentReady} fullWidth>
                {submitting ? '처리 중…' : '결제하기'}
              </Button>
            </div>
          </form>
        </section>
      )}

    </main>
  );
}
