import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';

import TossPaymentWidget from '../booking/TossPaymentWidget';
import PriceBreakdown from '../booking/PriceBreakdown';
import { Button } from '../ui/Button';
import { formatPriceAmount } from '../../data/pricing';
import { computeFundingAmounts } from '../../lib/funding/amounts';
import { ADDITIONAL_AMOUNT_STEP, MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY } from '../../lib/funding/policy';
import type { FundingProject } from '../../lib/funding/projects';

interface Props { project: FundingProject; initialRewardId: string | null; remaining: Record<string, number | null> }
interface Created { orderNo: string; totalAmount: number; itemAmount: number; vatAmount: number; holdExpiresAt: string }

// 예약 위저드(components/booking/BookingWizard.tsx)와 같은 입력 재질 — 사이트 안에서
// 폼이 한 벌로 읽히도록 클래스를 복제하지 않고 같은 정의를 그대로 쓴다.
const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-200';
const helpClass = 'typo-card-meta mt-1.5';
const cardClass = 'glass-card rounded-2xl p-5 sm:p-6';
// 선택 가능한 행(리워드·결제수단)은 탭 타깃이 카드 전체가 되도록.
const choiceRow =
  'flex items-start gap-3 rounded-xl border p-4 transition-colors cursor-pointer border-gray-200 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary-light/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 dark:has-[:checked]:border-primary-light dark:has-[:checked]:bg-primary-light/10';
const radioClass = 'mt-0.5 h-4 w-4 shrink-0 accent-primary';

function StepHeader({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <legend className="mb-4 flex w-full items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
      >
        {n}
      </span>
      <span>
        <span className="typo-card-subtitle block text-gray-900 dark:text-white">{title}</span>
        {hint && <span className="typo-card-meta block">{hint}</span>}
      </span>
    </legend>
  );
}

export default function PledgeWizard({ project, initialRewardId, remaining }: Props) {
  const uid = useId();
  const [rewardId, setRewardId] = useState(initialRewardId ?? project.rewards[0].id);
  const reward = project.rewards.find((r) => r.id === rewardId) ?? project.rewards[0];
  const [quantity, setQuantity] = useState(1);
  const [additional, setAdditional] = useState(0);
  const [method, setMethod] = useState<'toss' | 'bank_transfer'>('toss');
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', supporterMessage: '', displayNamePublic: false, termsAgreed: false });
  const [ship, setShip] = useState({ name: '', phone: '', postcode: '', address1: '', address2: '', memo: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const limited = reward.totalQuantity !== null;
  useEffect(() => { if (limited && method === 'bank_transfer') setMethod('toss'); }, [limited, method]);
  const preview = useMemo(() => computeFundingAmounts(reward.amount, quantity, additional), [reward.amount, quantity, additional]);

  useEffect(() => {
    if (!created) return;
    const end = new Date(created.holdExpiresAt).getTime();
    const tick = () => setRemainingMs(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [created]);

  const submit = async () => {
    setError(null);
    if (!form.termsAgreed) { setError('약관에 동의해 주세요.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/funding/pledges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: project.slug, rewardId: reward.id, quantity, additionalAmount: additional, paymentMethod: method,
          ...form, supporterMessage: form.supporterMessage || undefined,
          shipping: reward.requiresShipping ? ship : undefined,
        }),
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        setError('서버 오류가 발생했습니다.');
        return;
      }
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? '후원 신청에 실패했습니다.'); return; }
      // router.push가 아니라 전체 페이지 이동 — 클라이언트 전환이면 이미 로드된 gtag가
      // ?token=이 붙은 URL로 page_view를 보낸다(_app의 측정 스크립트 제외는 mount 시점 판정).
      if (json.depositUrl) { window.location.assign(json.depositUrl); return; }
      setCreated(json);
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setSubmitting(false); }
  };

  if (created) {
    const expired = remainingMs !== null && remainingMs <= 0;
    return (
      <div className={`${cardClass} space-y-5`}>
        <div>
          <h2 className="typo-card-title text-gray-900 dark:text-white">결제</h2>
          <p className="typo-card-meta mt-1">{reward.title} × {quantity}</p>
        </div>
        <PriceBreakdown amounts={{ itemAmount: created.itemAmount, vatAmount: created.vatAmount, totalAmount: created.totalAmount }} />
        {remainingMs !== null && !expired && (
          <p className="typo-card-meta">결제 대기 {Math.floor(remainingMs / 60000)}:{String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}</p>
        )}
        {expired ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            결제 대기 시간이 지났습니다. <button type="button" className="font-semibold underline" onClick={() => { setCreated(null); setRemainingMs(null); }}>다시 신청</button>
          </p>
        ) : (
          <TossPaymentWidget orderNo={created.orderNo} amount={created.totalAmount}
            orderName={`[펀딩] ${project.title} · ${reward.title}`.slice(0, 100)}
            customerName={form.customerName} customerEmail={form.customerEmail} service="funding"
            successUrl="/ko/funding/success" failUrl={`/ko/funding/fail?slug=${encodeURIComponent(project.slug)}`} />
        )}
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <fieldset className={cardClass}>
        <StepHeader n={1} title="리워드" hint="후원 금액에 따라 돌려드릴 구성입니다." />
        <div className="space-y-2">
          {project.rewards.map((r) => {
            const left = remaining[r.id];
            const soldOut = left !== null && left !== undefined && left <= 0;
            return (
              <label key={r.id} className={`${choiceRow} ${soldOut ? 'cursor-not-allowed opacity-50' : ''}`}>
                <input type="radio" name="reward" value={r.id} className={radioClass} checked={rewardId === r.id} disabled={soldOut} onChange={() => { setRewardId(r.id); setQuantity(1); }} />
                <span className="min-w-0">
                  <span className="block font-bold text-gray-900 dark:text-white">{formatPriceAmount(r.amount)}원</span>
                  <span className="typo-card-meta block">{r.title}{soldOut ? ' (품절)' : left != null ? ` · ${left}개 남음` : ''}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-qty`} className={labelClass}>수량</label>
            <input id={`${uid}-qty`} type="number" min={1} max={Math.max(1, Math.min(MAX_QUANTITY, remaining[reward.id] ?? MAX_QUANTITY))} value={quantity} className={`${inputClass} mt-1`}
              onChange={(e) => {
                const cap = Math.max(1, Math.min(MAX_QUANTITY, remaining[reward.id] ?? MAX_QUANTITY));
                setQuantity(Math.min(cap, Math.max(1, Number(e.target.value) || 1)));
              }} />
          </div>
          <div>
            <label htmlFor={`${uid}-add`} className={labelClass}>추가 후원금</label>
            <input id={`${uid}-add`} type="number" min={0} max={MAX_ADDITIONAL_AMOUNT} step={ADDITIONAL_AMOUNT_STEP} value={additional} className={`${inputClass} mt-1`}
              onChange={(e) => setAdditional(Math.min(MAX_ADDITIONAL_AMOUNT, Math.max(0, Math.floor((Number(e.target.value) || 0) / ADDITIONAL_AMOUNT_STEP) * ADDITIONAL_AMOUNT_STEP)))} />
            <p className={helpClass}>선택 항목입니다. 1,000원 단위로 올릴 수 있습니다.</p>
          </div>
        </div>
      </fieldset>

      <fieldset className={cardClass}>
        <StepHeader n={2} title="후원자 정보" hint="후원 확인 메일과 리워드 발송에 씁니다." />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-name`} className={labelClass}>이름</label>
            <input id={`${uid}-name`} required className={`${inputClass} mt-1`} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${uid}-phone`} className={labelClass}>연락처</label>
            <input id={`${uid}-phone`} required inputMode="tel" className={`${inputClass} mt-1`} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-email`} className={labelClass}>이메일</label>
            <input id={`${uid}-email`} required type="email" className={`${inputClass} mt-1`} value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
          </div>
        </div>

        {reward.requiresShipping && (
          <div className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">배송지</p>
            <p className={helpClass}>이 리워드는 배송이 있습니다.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${uid}-sname`} className={labelClass}>받는 분</label>
                <input id={`${uid}-sname`} required className={`${inputClass} mt-1`} value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${uid}-sphone`} className={labelClass}>받는 분 연락처</label>
                <input id={`${uid}-sphone`} required inputMode="tel" className={`${inputClass} mt-1`} value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${uid}-post`} className={labelClass}>우편번호</label>
                <input id={`${uid}-post`} required inputMode="numeric" className={`${inputClass} mt-1`} value={ship.postcode} onChange={(e) => setShip({ ...ship, postcode: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${uid}-addr1`} className={labelClass}>주소</label>
                <input id={`${uid}-addr1`} required className={`${inputClass} mt-1`} value={ship.address1} onChange={(e) => setShip({ ...ship, address1: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${uid}-addr2`} className={labelClass}>상세주소</label>
                <input id={`${uid}-addr2`} className={`${inputClass} mt-1`} value={ship.address2} onChange={(e) => setShip({ ...ship, address2: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${uid}-memo`} className={labelClass}>배송 메모</label>
                <input id={`${uid}-memo`} className={`${inputClass} mt-1`} value={ship.memo} onChange={(e) => setShip({ ...ship, memo: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        <div className="mt-5">
          <label htmlFor={`${uid}-msg`} className={labelClass}>응원 메시지</label>
          <textarea id={`${uid}-msg`} rows={3} className={`${inputClass} mt-1`} maxLength={500} value={form.supporterMessage} onChange={(e) => setForm({ ...form, supporterMessage: e.target.value })} />
          <p className={helpClass}>선택 항목이며 운영자에게만 보입니다.</p>
        </div>

        <div className="mt-5 space-y-2">
          <label className={choiceRow}>
            <input type="checkbox" className={radioClass} checked={form.displayNamePublic} onChange={(e) => setForm({ ...form, displayNamePublic: e.target.checked })} />
            <span className="text-sm text-gray-700 dark:text-gray-200">후원자 명단에 이름 공개</span>
          </label>
          <label className={choiceRow}>
            <input type="checkbox" className={radioClass} checked={form.termsAgreed} onChange={(e) => setForm({ ...form, termsAgreed: e.target.checked })} />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              <Link href="/ko/funding/terms" target="_blank" className="underline">펀딩 약관·청약철회·환불 규정</Link>과 <Link href="/ko/privacy-policy" target="_blank" className="underline">개인정보 처리방침</Link>에 동의합니다
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className={cardClass}>
        <StepHeader n={3} title="결제수단" />
        <div className="space-y-2">
          <label className={choiceRow}>
            <input type="radio" name="method" className={radioClass} checked={method === 'toss'} onChange={() => setMethod('toss')} />
            <span className="text-sm text-gray-700 dark:text-gray-200">카드·계좌이체·간편결제 (토스페이먼츠)</span>
          </label>
          {!limited && (
            <label className={choiceRow}>
              <input type="radio" name="method" className={radioClass} checked={method === 'bank_transfer'} onChange={() => setMethod('bank_transfer')} />
              <span className="text-sm text-gray-700 dark:text-gray-200">무통장입금 (12시간 안에 입금)</span>
            </label>
          )}
        </div>
        {limited && <p className={`${helpClass} mt-3`}>한정 수량 리워드는 온라인 결제만 가능합니다.</p>}
      </fieldset>

      {/* 선택 내용과 합계를 제출 버튼 바로 위에 붙여 둔다 — 모바일에서 폼을 다시
          위로 스크롤하지 않고도 무엇을 얼마에 사는지 확인할 수 있어야 한다. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 pb-4 pt-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-6 dark:border-gray-700 dark:bg-gray-900/95">
        <dl className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="typo-card-meta">선택 리워드</dt>
            <dd className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">{reward.title}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="typo-card-meta">수량</dt>
            <dd className="text-sm font-medium text-gray-900 dark:text-white">{quantity}개{additional > 0 ? ` · 추가 후원 ${formatPriceAmount(additional)}원` : ''}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-gray-200 pt-2 dark:border-gray-700">
            <dt className="text-sm font-semibold text-gray-900 dark:text-white">예상 합계</dt>
            <dd className="text-lg font-bold text-gray-900 dark:text-white">{formatPriceAmount(preview.totalAmount)}원</dd>
          </div>
        </dl>
        <p className={helpClass}>VAT 포함. 실제 청구액은 다음 단계에서 서버가 확정합니다.</p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</p>
        )}
        <Button type="submit" size="lg" fullWidth className="mt-4" disabled={submitting}>
          {submitting ? '처리 중…' : method === 'toss' ? '결제로 이동' : '무통장 후원 신청'}
        </Button>
      </div>
    </form>
  );
}
