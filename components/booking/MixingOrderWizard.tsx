import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import PriceBreakdown from './PriceBreakdown';
import TossPaymentWidget from './TossPaymentWidget';
import { Button } from '../ui/Button';
import { formatPriceAmount, VOCAL_TUNING_ADDON_PRICE } from '../../data/pricing';
import type { OrderAmounts } from '../../lib/booking/amounts';
import { MIXING_PRODUCTS, computeMixingAmounts, getMixingProduct, type MixingProduct } from '../../lib/booking/mixing-products';
import { MIXING_REFUND_POLICY_LINES } from '../../lib/booking/refund-policy';
import { PENDING_HOLD_SECONDS } from '../../lib/booking/validation';

interface MixingOrderWizardProps {
  /** ?product= 쿼리를 서버에서 검증해 넘긴 값 — 없거나 유효하지 않으면 undefined(1번 상품이 기본). */
  initialProductId?: string;
}

type Step = 1 | 2 | 3;

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent';

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

/** 남은 선점 시간을 "12분 3초"로. 1분 미만이면 초만 보여 촉박함이 드러나게 한다. */
const formatHoldLeft = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m > 0 ? `${m}분 ${sec}초` : `${sec}초`;
};

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
  const [refundPolicyAgreed, setRefundPolicyAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const agreeRef = React.useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 3: 결제 — 표시 금액은 서버가 POST 응답으로 돌려준 값(SSOT)만 쓴다(BookingWizard와 동일 원칙).
  const [confirmedOrder, setConfirmedOrder] = useState<{ orderNo: string; amounts: OrderAmounts } | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [holdRemainingMs, setHoldRemainingMs] = useState<number | null>(null);

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
        setConfirmedOrder({
          orderNo: data.orderNo,
          amounts: { itemAmount: data.itemAmount, vatAmount: data.vatAmount, totalAmount: data.totalAmount },
        });
        setHoldExpiresAt(Date.now() + PENDING_HOLD_SECONDS * 1000);
        setStep(3);
        return;
      }

      // 400(입력 오류) · 429(요청 과다) 등 — 현재 단계(정보 입력)에 메시지로 표시.
      setSubmitError(data.message ?? '주문 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } catch {
      setSubmitError('네트워크 오류로 주문 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // 선점 카운트다운. 3단계에 있을 때만 돌리고, 0에 닿으면 멈춘다.
  useEffect(() => {
    if (step !== 3 || holdExpiresAt === null) {
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
      <Link href="/ko/mixing-mastering" className="text-sm text-primary hover:underline">
        ← 서비스 소개로 돌아가기
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">믹싱·마스터링 온라인 주문</h1>
      <p className="mt-1 mb-8 text-sm text-gray-500 dark:text-gray-400">STEP {step} / 3</p>

      {step === 1 && (
        <section aria-labelledby="mixing-step1-heading">
          <h2 id="mixing-step1-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
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
                    className="h-4 w-4 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-100">
                    {p.nameKo} — 곡당 {formatPriceAmount(p.unitAmount)}원
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mb-4">
            <label htmlFor="songCount" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
              곡 수
            </label>
            <select
              id="songCount"
              value={songCount}
              onChange={(e) => setSongCount(Number(e.target.value))}
              className="w-full sm:w-48 min-w-0 max-w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {songCountOptions.map((n) => (
                <option key={n} value={n}>
                  {n}곡
                </option>
              ))}
            </select>
          </div>

          {selectedProduct.tuningEligible && (
            <div className="mb-4">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vocalTuning}
                  onChange={(e) => setVocalTuning(e.target.checked)}
                  className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-300 dark:border-gray-600 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
          <h2 id="mixing-step2-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            2. 주문자 정보
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
                placeholder="파일 링크(구글 드라이브·WeTransfer)가 이미 있으면 여기 적어주셔도 됩니다."
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className={inputClass}
              />
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
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                이전
              </Button>
              <Button type="submit" disabled={submitting} fullWidth>
                {submitting ? '처리 중…' : '주문 신청'}
              </Button>
            </div>
          </form>
        </section>
      )}

      {step === 3 && confirmedOrder && (
        <section aria-labelledby="mixing-step3-heading">
          <h2 id="mixing-step3-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            3. 결제
          </h2>

          {holdRemainingMs !== null && (
            holdRemainingMs > 0 ? (
              <p
                className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
                role="status"
              >
                결제까지 <strong>{formatHoldLeft(holdRemainingMs)}</strong> 남았습니다.
              </p>
            ) : (
              <div
                className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                <strong>주문 대기 시간이 지났습니다.</strong> 다시 신청해 주세요.
                <span className="mt-2 block">
                  <Button type="button" variant="outline" onClick={() => { setConfirmedOrder(null); setHoldExpiresAt(null); setStep(1); }}>
                    처음부터 다시
                  </Button>
                </span>
              </div>
            )
          )}

          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            결제 후 확인 메일에 파일 보내는 방법을 안내해 드립니다.
          </p>

          <div className="mb-4">
            <PriceBreakdown amounts={confirmedOrder.amounts} />
          </div>

          <TossPaymentWidget
            orderNo={confirmedOrder.orderNo}
            amount={confirmedOrder.amounts.totalAmount}
            orderName={formatOrderName(selectedProduct.nameKo, songCount)}
            customerName={customerName}
            customerEmail={customerEmail}
            service="mixing-mastering"
          />

          <div className="mt-4">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              ← 정보 수정
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
