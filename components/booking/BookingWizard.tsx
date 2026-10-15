import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { reportPaymentFailure } from '../../utils/reportPaymentFailure';

import PriceBreakdown from './PriceBreakdown';
import PaymentMethodPicker from '../payments/PaymentMethodPicker';
import { usePaymentCheckout } from '../payments/usePaymentCheckout';
import { useScrollTopOnStep } from '../payments/useScrollTopOnStep';
import { Button } from '../ui/Button';
import { computeAmounts } from '../../lib/booking/amounts';
import { BOOKING_CUSTOMER_DRAFT_KEY, CUSTOMER_DRAFT_FIELDS } from '../../lib/booking/customerDraft';
import { kstDateString, kstDateTime } from '../../lib/booking/kst';
import type { SessionProduct } from '../../lib/booking/products';
import { refundPolicyFor } from '../../lib/booking/refund-policy';
import type { DaySlot } from '../../lib/booking/slots';
import { MAX_BOOK_DAYS, PENDING_HOLD_SECONDS } from '../../lib/booking/validation';
import { clearStoredDraft, readStringDraft, writeStringDraft } from '../../lib/formDraft';
import { BANK_DEPOSIT_BLOCK_MESSAGES, bankDepositBlockReason, type CheckoutPaymentMethod } from '../../lib/payments/bankDeposit';
import { wantsBankFallback } from '../../lib/payments/bankFallback';
import { CANONICAL_FACTS } from '../../lib/factTokens';
import { getSiteConfig } from '../../data/siteConfig';
import { Field, Select, TextArea, TextInput } from '../ui/Field';
import { ChoiceCard, ChoiceGroup } from '../ui/Choice';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { PageHeader, PageShell } from '../ui/PageHeader';
import { Stepper } from '../ui/Stepper';
import { FOCUS_RING } from '../ui/focusRing';
import { cn } from '../../lib/utils';
import { formatPriceAmount } from '../../data/pricing';

// 슬롯 조회 장애 안내의 대안 경로 — 위저드는 ko 전용 화면이라 ko 오픈채팅으로 고정한다.
const KAKAO_URL = getSiteConfig('ko').contact.kakaoUrl;
const TEL_HREF = `tel:${CANONICAL_FACTS.phoneIntl.replace(/[^0-9+]/g, '')}`;
/** 직전 주문번호를 두는 탭 저장소 키 — 세션 예약은 상품과 무관하게 하나를 공유한다(service.ts). */
const HOLD_PROOF_KEY = 'booking:lastOrderNo:session';

interface BookingWizardProps {
  service: string;
  products: SessionProduct[];
  /** 처음 고를 상품. 없거나 목록에 없으면 첫 상품. */
  initialProductId?: string;
}

type Step = 1 | 2 | 3;

const BOOKING_STEPS = ['상품·시간', '날짜·시간', '예약자 정보'];

/** 안내 박스 안의 글자 링크 — 밑줄은 Notice가 긋고, 여기서는 포커스 링만 준다. */
const NOTICE_LINK_CLASS = cn('rounded font-semibold', FOCUS_RING);

/** 상품 카드 오른쪽 가격 — 공급가(VAT 별도) 기준. 시간제는 시간당가라 단위를 붙인다. */
const productPriceLabel = (p: SessionProduct): string =>
  p.kind === 'hourly' ? `시간당 ${formatPriceAmount(p.unitAmount)}원` : `${formatPriceAmount(p.unitAmount)}원`;

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
  /** 직전 제출로 만든 주문번호 — 서버가 이 주문만 풀어 준다(자기 홀드 해제의 소유 증명). */
  previousOrderNo?: string;
  /** 'bank_transfer'면 계좌 입금 대기로 만든다(lib/payments/bankDeposit.ts). 없으면 토스. */
  paymentMethod?: CheckoutPaymentMethod;
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
  /** 계좌 입금 신청이면 입금 안내가 있는 예약 확인 페이지 주소(관리 토큰 포함). */
  manageUrl?: string;
  paymentMethod?: CheckoutPaymentMethod;
}

/** '보컬 녹음 1프로' + '2026-09-10' + 14 → '보컬 녹음 1프로 (9/10 14:00)' */
const formatOrderName = (nameKo: string, date: string, startHour: number): string => {
  const [, monthStr, dayStr] = date.split('-');
  const hh = String(startHour).padStart(2, '0');
  return `${nameKo} (${Number(monthStr)}/${Number(dayStr)} ${hh}:00)`;
};

export default function BookingWizard({ service, products, initialProductId }: BookingWizardProps) {
  const firstProduct = products.find((p) => p.id === initialProductId) ?? products[0];

  const [step, setStep] = useState<Step>(1);
  useScrollTopOnStep(step);

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
        setSlotsError('일시적으로 예약 현황을 불러올 수 없어요.');
        return;
      }
      const data: SlotsResponse = await res.json();
      if (!res.ok || !data.ok) {
        setSlots([]);
        setSlotsError(data.message ?? '예약 현황을 불러오지 못했어요.');
        return;
      }
      setSlots(data.slots ?? []);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return; // 최신 요청에 밀려난 이전 요청 — 무시
      setSlots([]);
      setSlotsError('일시적으로 예약 현황을 불러올 수 없어요.');
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

  // 시간 슬롯은 설명 없는 짧은 라벨이라 선택 상태를 **채움**으로 표시한다(design-system.md §3 —
  // 틴트는 ChoiceCard, 채움은 세그먼트·칩·시간 슬롯). 반경은 카드·폼 안의 버튼과 같은 xl.
  const slotButtonClass = (slot: DaySlot) =>
    cn(
      'h-11 rounded-xl border text-sm tabular-nums',
      FOCUS_RING,
      !slot.available &&
        'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600',
      slot.available && selectedStartHour === slot.startHour && 'border-primary bg-primary font-semibold text-white',
      slot.available &&
        selectedStartHour !== slot.startHour &&
        'border-gray-300 bg-white text-gray-700 transition-colors hover:border-primary hover:text-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:text-primary-lighter',
    );

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
   * 직전 제출로 만든 주문번호. 다시 제출할 때 보내면 서버가 그 결제 대기 주문을 풀어, 같은
   * 슬롯을 다시 고른 고객이 자기 홀드에 막히지 않는다(lib/booking/service.ts). 서버는 이 증명
   * 없이는 아무것도 풀지 않는다 — 예전엔 이메일·전화만 맞으면 풀어서, 그 두 값을 아는 사람이
   * 남의 결제를 무산시킬 수 있었다.
   *
   * 탭 저장소에도 둔다. 결제에 실패하면 토스가 실패 화면으로 보내 이 컴포넌트가 사라지는데,
   * 돌아와서 같은 슬롯을 고르면 증명이 없어 15분 동안 자기 홀드에 막히기 때문이다.
   */
  const [previousOrderNo, setPreviousOrderNo] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(HOLD_PROOF_KEY);
      if (saved) setPreviousOrderNo(saved);
    } catch {
      /* 저장소 접근이 막힌 브라우저 — 증명 없이 진행한다(자기 홀드는 자연 만료된다). */
    }
  }, []);
  const rememberOrderNo = (orderNo: string) => {
    setPreviousOrderNo(orderNo);
    try {
      window.sessionStorage.setItem(HOLD_PROOF_KEY, orderNo);
    } catch {
      /* 위와 같다 — 기억하지 못해도 결제 자체는 진행된다. */
    }
  };

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
   * 결제수단 목록을 **예약자 정보 폼 안에** 보인다. 예전에는 주문을 만든 뒤 4단계 결제 화면을
   * 따로 그렸고, 거기서 선점 카운트다운을 보여 줬다.
   *
   * 카운트다운이 하던 말은 그대로 남긴다 — 다만 **시작하기 전에** 한다. 결제창을 열고 나면
   * 고객은 토스 화면에 있어서 우리 타이머를 볼 수 없다. "이 시간대를 15분간 잡아 둡니다"는
   * 누르기 전에 알아야 행동이 달라지는 정보다.
   *
   * 초기 금액은 화면의 추정치이고, **청구는 서버가 돌려준 금액으로** 연다(handleSubmit).
   */
  const {
    ready: paymentReady, error: paymentError, requestPayment,
    choice: pickerChoice, setChoice: setPickerChoice, applePaySupported,
    // 결제수단 목록은 3단계에만 있다 — 그 전에는 토스 스크립트를 미리 받지 않는다.
  } = usePaymentCheckout(amounts.totalAmount, step === 3);

  /**
   * 결제수단 — 카드·간편결제(토스) / 계좌로 직접 입금(우리 계좌번호 안내, 토스 계좌이체는 2026-10-14에 뺐다). 계좌는 이용 시작 2시간 전부터 막는다(입금을 확인할 시간이
   * 없다). 서버(pages/api/bookings)가 **같은 함수·같은 인자**(시작 시각, 지금)로 다시 판정한다.
   */
  const [payMethod, setPayMethod] = useState<CheckoutPaymentMethod>('toss');
  const bankBlocked = selectedStartHour === null
    ? null
    : bankDepositBlockReason({ startsAt: kstDateTime(date, selectedStartHour), now: new Date() });
  useEffect(() => {
    if (bankBlocked && payMethod === 'bank_transfer') setPayMethod('toss');
  }, [bankBlocked, payMethod]);
  const usingBank = payMethod === 'bank_transfer' && !bankBlocked;
  // 결제 실패 화면에서 "계좌로 직접 입금"으로 돌아온 경우 — 계좌 줄이 골라진 채 연다(lib/payments/bankFallback.ts).
  useEffect(() => {
    if (wantsBankFallback(window.location.search)) setPayMethod('bank_transfer');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStartHour === null) {
      setStep(2);
      return;
    }
    if (usingBank) {
      // 계좌 입금 — 결제창이 없다. 신청을 만들고 예약 확인 페이지(입금 안내)로 옮긴다.
      setSubmitting(true);
      setSubmitError(null);
      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: selectedProduct.id, hours: effectiveHours, date, startHour: selectedStartHour,
            customerName: customerName.trim(), customerPhone: customerPhone.trim(), customerEmail: customerEmail.trim(),
            ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
            refundPolicyAgreed: true,
            ...(previousOrderNo ? { previousOrderNo } : {}),
            paymentMethod: 'bank_transfer',
          } satisfies CreateBookingBody),
        });
        const data: CreateBookingResponse = await res.json();
        if (res.status === 201 && data.ok && typeof data.manageUrl === 'string') {
          clearStoredDraft(BOOKING_CUSTOMER_DRAFT_KEY);
          // 문서 이동 — 도착지는 관리 토큰이 실린 비밀 주소다(lib/analytics/privatePaths.ts). 금액·기한은 그 화면이 서버에서 다시 읽는다.
          window.location.assign(data.manageUrl);
          return;
        }
        if (res.status === 409 && data.code === 'slot_taken') {
          setSlotsNotice(data.message ?? '방금 다른 예약이 먼저 잡혔어요. 다른 시간대를 선택해 주세요.');
          setSelectedStartHour(null);
          setStep(2);
          return;
        }
        setSubmitError(data.message ?? '예약 신청에 실패했어요. 잠시 후 다시 시도해 주세요.');
      } catch {
        setSubmitError('네트워크 오류로 예약 신청에 실패했어요. 잠시 후 다시 시도해 주세요.');
      } finally {
        setSubmitting(false);
      }
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
        ...(previousOrderNo ? { previousOrderNo } : {}),
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
        rememberOrderNo(data.orderNo);
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
        setSlotsNotice(data.message ?? '방금 다른 예약이 먼저 잡혔어요. 다른 시간대를 선택해 주세요.');
        setSelectedStartHour(null);
        setStep(2);
        return;
      }

      // 400(입력 오류) · 429(요청 과다) 등 — 현재 단계(정보 입력)에 메시지로 표시.
      setSubmitError(data.message ?? '예약 신청에 실패했어요. 잠시 후 다시 시도해 주세요.');
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
       * 다시 제출하면 `previousOrderNo`가 그 홀드를 풀어 준다(lib/booking/service.ts의
       * 자가 선점 해제) — 자기 홀드에 자기가 막히지 않는다.
       */
      const code = (err as { code?: string } | null)?.code;
      if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED') return;
      setSubmitError('네트워크 오류로 예약 신청에 실패했어요. 잠시 후 다시 시도해 주세요. 결제가 계속 어려우시면 결제수단에서 "계좌로 직접 입금"을 고르실 수 있어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <PageHeader backHref={`/ko/${service}`} backLabel="서비스 소개로 돌아가기" title={`${selectedProduct.nameKo} 온라인 예약`}>
        <Stepper steps={BOOKING_STEPS} current={step} />
      </PageHeader>

      {step === 1 && (
        <section aria-labelledby="booking-step1-heading">
          <h2 id="booking-step1-heading" className="typo-card-subtitle text-gray-900 dark:text-white mb-3">
            1. 상품과 시간 선택
          </h2>

          {products.length > 1 && (
            <ChoiceGroup label="상품 선택" className="mb-4">
              {products.map((p) => (
                <ChoiceCard
                  key={p.id}
                  name="product"
                  value={p.id}
                  checked={selectedProductId === p.id}
                  onChange={() => handleProductChange(p.id)}
                  title={p.nameKo}
                  description={p.kind === 'package' && p.sessionHours ? `${p.sessionHours}시간 세션` : undefined}
                  trailing={productPriceLabel(p)}
                />
              ))}
            </ChoiceGroup>
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
            <Notice tone="error" className="mb-4">
              {slotsNotice}
            </Notice>
          )}

          <div className="mb-4">
            <Field id="booking-date" label="날짜">
              <TextInput
                type="date"
                value={date}
                min={minDate}
                max={maxDate}
                onChange={handleDateChange}
                // iOS Safari 폭 넘침·높이 접힘은 styles/globals.css의 date 입력 규칙이 막는다.
                // min-h는 빈 값일 때도 다른 입력과 높이를 맞추는 안전판.
                className="sm:w-56 min-h-[2.75rem]"
              />
            </Field>
          </div>

          {date && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">시간 선택</p>
              {slotsLoading && <p className="text-sm text-gray-500 dark:text-gray-400">예약 현황을 불러오는 중…</p>}
              {slotsError && (
                <Notice
                  tone="error"
                  actions={
                    <Button type="button" size="sm" variant="weak" onClick={() => setRetryTick((n) => n + 1)}>
                      다시 불러오기
                    </Button>
                  }
                >
                  <p>{slotsError}</p>
                  <p className="mt-1">
                    계속 안 되면{' '}
                    <a href={KAKAO_URL} target="_blank" rel="noopener noreferrer" className={NOTICE_LINK_CLASS}>카카오톡</a>
                    {' '}또는{' '}
                    <a href={TEL_HREF} className={NOTICE_LINK_CLASS}>{CANONICAL_FACTS.phone}</a>
                    로 예약해 주세요.
                  </p>
                </Notice>
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
                <p className="text-sm text-gray-500 dark:text-gray-400">이 날짜에는 예약 가능한 시간이 없어요.</p>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button type="button" variant="weak" onClick={() => setStep(1)}>
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

            <Panel title="환불 규정">
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {refundPolicyFor(selectedProduct).lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Panel>

            {/*
              동의는 **결제하기를 누르는 행위 자체**로 받는다. 체크박스를 두지 않는다 —
              토스 결제창이 자체 [필수] 결제 서비스 약관을 받으므로, 같은 말을 하는 체크를 우리 화면에도
              두면 중복으로 읽힌다(2026-09-16 실사용 확인).

              법적으로도 체크박스가 요구되는 항목이 아니다 — 청약철회·환불 조건은
              전자상거래법 제13조상 **고지** 의무이고, 규정 전문을 바로 위에 펼쳐 두었다.
              서버 검증(refundPolicyAgreed)은 그대로다.
            */}
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {`${usingBank ? '계좌 안내 받기' : '결제하기'}를 누르면 위 환불 규정에 동의하는 것으로 봅니다.`}
            </p>

            {/* 결제수단 — 카드·간편결제(토스) / 계좌로 직접 입금(우리 계좌번호 안내). 토스 계좌이체는 뱅크페이가 떠
                고령층이 쓰지 못해 뺐다(2026-10-14). */}
            <div className="pt-2">
              <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">결제수단</h3>
              <PaymentMethodPicker
                name="booking-paymethod"
                value={usingBank ? 'bank_transfer' : pickerChoice}
                onChange={(next) => {
                  if (next === 'bank_transfer') { setPayMethod('bank_transfer'); return; }
                  setPayMethod('toss');
                  setPickerChoice(next);
                }}
                applePaySupported={applePaySupported}
                withBank
                bankBlockedMessage={bankBlocked ? BANK_DEPOSIT_BLOCK_MESSAGES[bankBlocked] : null}
                confirmLabel="예약이 확정"
              />
              {paymentError && <Notice tone="error" className="mt-3">{paymentError}</Notice>}
            </div>

            {/* 예전에는 결제 화면에서 남은 시간을 세어 보여 줬다. 결제창을 열고 나면 고객은
                토스 화면에 있어서 그 타이머를 볼 수 없다 — 누르기 전에 말해야 행동이 달라진다. */}
            <Notice tone="warning" role="status">
              {usingBank ? (
                <>신청하시면 입금하실 계좌를 바로 알려 드리고, <strong>입금을 확인할 때까지</strong> 이 시간대를 잡아 둬요.
                입금이 확인되면 예약이 확정되고 메일로 알려 드려요.</>
              ) : (
                <>결제를 시작하면 이 시간대를 <strong>{Math.round(PENDING_HOLD_SECONDS / 60)}분간</strong> 잡아 둬요.
                그 안에 결제를 마치지 않으면 다시 열려 다른 분이 예약할 수 있어요.</>
              )}
            </Notice>

            {submitError && <Notice tone="error">{submitError}</Notice>}

            <div className="flex gap-3">
              <Button type="button" variant="weak" onClick={() => setStep(2)}>
                이전
              </Button>
              {/* 결제 설정이 없으면 누를 수 없다 — 누르면 슬롯만 잡히고 결제창은 안 열린다. 계좌 입금은 설정이 필요 없다. */}
              <Button type="submit" disabled={submitting || (!usingBank && !paymentReady)} fullWidth>
                {submitting ? '처리 중…' : usingBank ? '계좌 안내 받기' : '결제하기'}
              </Button>
            </div>
          </form>
        </section>
      )}

    </PageShell>
  );
}
