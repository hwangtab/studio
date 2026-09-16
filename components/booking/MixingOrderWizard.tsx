import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import PriceBreakdown from './PriceBreakdown';
import { useTossPaymentWidgets } from './useTossPaymentWidgets';
import { Button } from '../ui/Button';
import { formatPriceAmount, VOCAL_TUNING_ADDON_PRICE } from '../../data/pricing';
import { CUSTOMER_DRAFT_FIELDS, MIXING_CUSTOMER_DRAFT_KEY } from '../../lib/booking/customerDraft';
import { MIXING_PRODUCTS, computeMixingAmounts, getMixingProduct, type MixingProduct } from '../../lib/booking/mixing-products';
import { MIXING_REFUND_POLICY_LINES } from '../../lib/booking/refund-policy';
import { readStringDraft, writeStringDraft } from '../../lib/formDraft';
import { Field, Select, TextArea, TextInput } from '../ui/Field';

interface MixingOrderWizardProps {
  /** ?product= 쿼리를 서버에서 검증해 넘긴 값 — 없거나 유효하지 않으면 undefined(1번 상품이 기본). */
  initialProductId?: string;
}

type Step = 1 | 2;


interface CreateMixingOrderBody {
  productId: string;
  songCount: number;
  vocalTuning: boolean;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNote?: string;
  refundPolicyAgreed: true;
}

interface CreateMixingOrderResponse {
  ok: boolean;
  orderNo?: string;
  itemAmount?: number;
  vatAmount?: number;
  totalAmount?: number;
  code?: string;
  message?: string;
}

/** '믹싱 · 10트랙 이하' + 3곡 → '믹싱 · 10트랙 이하 × 3곡' */
const formatOrderName = (nameKo: string, songCount: number): string => `${nameKo} × ${songCount}곡`;

export default function MixingOrderWizard({ initialProductId }: MixingOrderWizardProps) {
  const firstProduct = getMixingProduct(initialProductId ?? '') ?? MIXING_PRODUCTS[0];

  const [step, setStep] = useState<Step>(1);

  // Step 1: 상품 · 곡 수 · 튜닝
  const [selectedProductId, setSelectedProductId] = useState(firstProduct.id);
  const selectedProduct: MixingProduct = useMemo(
    () => getMixingProduct(selectedProductId) ?? firstProduct,
    [selectedProductId, firstProduct]
  );
  const [songCount, setSongCount] = useState<number>(selectedProduct.minSongs);
  const [vocalTuning, setVocalTuning] = useState(false);

  const handleProductChange = (id: string) => {
    const product = getMixingProduct(id);
    if (!product) return;
    setSelectedProductId(id);
    setSongCount(product.minSongs);
    if (!product.tuningEligible) setVocalTuning(false);
  };

  const songCountOptions = useMemo(
    () =>
      Array.from(
        { length: selectedProduct.maxSongs - selectedProduct.minSongs + 1 },
        (_, i) => selectedProduct.minSongs + i
      ),
    [selectedProduct]
  );

  const amounts = useMemo(
    () => computeMixingAmounts(selectedProduct, songCount, vocalTuning),
    [selectedProduct, songCount, vocalTuning]
  );

  // Step 2: 주문자 정보
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  // 환불 규정 동의는 임시 저장 대상이 아니다 — 복원된 체크는 사람이 그 자리에서 한
  // 의사표시가 아니라서 매번 새로 눌러야 한다(CLAUDE.md 약관 판본 절과 같은 판단).
  const [refundPolicyAgreed, setRefundPolicyAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const agreeRef = React.useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * 이름·연락처·이메일·요청사항만 새로고침·뒤로가기에도 살린다.
   *
   * 상품·곡 수·보컬 튜닝은 일부러 담지 않는다 — 고르는 값이라 되살리지 않아도 탭 한
   * 번이고, BookingWizard와 같은 판단이다(lib/booking/customerDraft.ts).
   *
   * `draftRestored`는 마운트 후 복원이 끝났는지를 가리키는 게이트다 — 아래 저장 effect가
   * 복원 effect보다 먼저 "아직 빈 폼"으로 한 번 실행되면 방금 불러온 초안을 그 빈 값으로
   * 덮어써 지워 버린다. 이 게이트가 없으면 새로고침 직후 초안이 사라진다.
   */
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    const draft = readStringDraft(MIXING_CUSTOMER_DRAFT_KEY, CUSTOMER_DRAFT_FIELDS);
    if (draft.customerName) setCustomerName(draft.customerName);
    if (draft.customerPhone) setCustomerPhone(draft.customerPhone);
    if (draft.customerEmail) setCustomerEmail(draft.customerEmail);
    if (draft.customerNote) setCustomerNote(draft.customerNote);
    setDraftRestored(true);
  }, []);

  useEffect(() => {
    if (!draftRestored) return;
    writeStringDraft(MIXING_CUSTOMER_DRAFT_KEY, CUSTOMER_DRAFT_FIELDS, {
      customerName,
      customerPhone,
      customerEmail,
      customerNote,
    });
  }, [draftRestored, customerName, customerPhone, customerEmail, customerNote]);

  /**
   * 결제위젯을 **주문자 정보 폼 안에** 띄운다. 예전에는 주문을 만든 뒤 3단계 결제 화면을
   * 따로 그렸는데, 거기서 하는 일이 금액 확인과 위젯 렌더뿐이라 화면 하나와 클릭 하나가
   * 더 있는 셈이었다. 잡아 둘 슬롯도 없어(주문은 24시간 유지) 그 화면이 알려 줄 시한도 없다.
   *
   * 초기 금액은 화면의 추정치이고, **청구는 서버가 돌려준 금액으로** 연다(handleSubmit).
   */
  const {
    methodsId, agreementId, ready: paymentReady, error: paymentError, retry: retryPayment, requestPayment,
  } = useTossPaymentWidgets(amounts.totalAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundPolicyAgreed) {
      setAgreeError(true);
      agreeRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: CreateMixingOrderBody = {
        productId: selectedProduct.id,
        songCount,
        vocalTuning,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
        refundPolicyAgreed: true,
      };
      const res = await fetch('/api/orders/mixing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: CreateMixingOrderResponse = await res.json();

      if (
        res.status === 201 &&
        data.ok &&
        data.orderNo &&
        typeof data.itemAmount === 'number' &&
        typeof data.vatAmount === 'number' &&
        typeof data.totalAmount === 'number'
      ) {
        // 주문이 만들어졌으면 곧바로 결제창을 연다. 금액은 **서버가 돌려준 값**으로 맞춘다.
        const origin = window.location.origin;
        await requestPayment({
          orderId: data.orderNo,
          orderName: formatOrderName(selectedProduct.nameKo, songCount),
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          amount: data.totalAmount,
          successUrl: `${origin}/ko/booking/success`,
          failUrl: `${origin}/ko/booking/fail?service=${encodeURIComponent('mixing-mastering')}`,
        });
        return;
      }

      // 400(입력 오류) · 429(요청 과다) 등 — 현재 단계(정보 입력)에 메시지로 표시.
      setSubmitError(data.message ?? '주문 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } catch (err) {
      /**
       * 결제창을 닫은 것은 오류가 아니다 — 주문은 pending으로 24시간 남고, 다시 누르면
       * 새로 만들어진다. 빨간 경고를 띄우면 "주문이 실패했다"로 읽혀 멀쩡한 주문을 두고
       * 이탈한다. 그 밖의 실패만 메시지로 알린다.
       */
      const code = (err as { code?: string } | null)?.code;
      if (code === 'NEED_AGREEMENT' || code === 'NEED_CARD_PAYMENT_DETAIL') {
        setSubmitError('결제 수단과 약관 동의를 확인해 주세요.');
      } else if (code !== 'USER_CANCEL' && code !== 'PAY_PROCESS_CANCELED') {
        setSubmitError('네트워크 오류로 주문 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <Link href="/ko/mixing-mastering" className="text-sm text-primary dark:text-primary-lighter hover:underline">
        ← 서비스 소개로 돌아가기
      </Link>
      <h1 className="mt-3 typo-page-title">믹싱·마스터링 온라인 주문</h1>
      <p className="mt-1 mb-8 text-sm text-gray-500 dark:text-gray-400">STEP {step} / 2</p>

      {step === 1 && (
        <section aria-labelledby="mixing-step1-heading">
          <h2 id="mixing-step1-heading" className="typo-card-subtitle text-gray-900 dark:text-white mb-3">
            1. 상품과 곡 수 선택
          </h2>

          <fieldset className="mb-4">
            <legend className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">상품 선택</legend>
            <div className="space-y-2">
              {MIXING_PRODUCTS.map((p) => (
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
                  <span className="text-sm text-gray-800 dark:text-gray-100">
                    {p.nameKo} — 곡당 {formatPriceAmount(p.unitAmount)}원
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mb-4">
            <Field id="songCount" label="곡 수">
              <Select
                value={songCount}
                onChange={(e) => setSongCount(Number(e.target.value))}
                className="sm:w-48 min-w-0 max-w-full"
              >
                {songCountOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}곡
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {selectedProduct.tuningEligible && (
            <div className="mb-4">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vocalTuning}
                  onChange={(e) => setVocalTuning(e.target.checked)}
                  className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-300 dark:border-gray-600 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  정교한 보컬 튜닝·박자 보정 (+{formatPriceAmount(VOCAL_TUNING_ADDON_PRICE)}원/곡)
                </span>
              </label>
            </div>
          )}

          <PriceBreakdown amounts={amounts} />

          <div className="mt-6">
            <Button type="button" onClick={() => setStep(2)} fullWidth>
              다음: 주문자 정보
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="mixing-step2-heading">
          <h2 id="mixing-step2-heading" className="typo-card-subtitle text-gray-900 dark:text-white mb-3">
            2. 주문자 정보
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
                  placeholder="파일 링크(구글 드라이브·WeTransfer)가 이미 있으면 여기 적어주셔도 됩니다."
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                />
              </Field>
            </div>

            <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">환불 규정</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                {MIXING_REFUND_POLICY_LINES.map((line) => (
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
                className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-300 dark:border-gray-600 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70"
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

            <p className="text-sm text-gray-600 dark:text-gray-300">
              결제 후 확인 메일에 파일 보내는 방법을 안내해 드립니다.
            </p>

            {submitError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {submitError}
              </p>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                이전
              </Button>
              {/* 위젯이 아직 안 떴으면 누를 수 없다 — 누르면 주문만 만들어지고 결제창은 안 열린다. */}
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
