import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
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

const field = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800';

export default function PledgeWizard({ project, initialRewardId, remaining }: Props) {
  const router = useRouter();
  const [rewardId, setRewardId] = useState(initialRewardId ?? project.rewards[0].id);
  const reward = project.rewards.find((r) => r.id === rewardId) ?? project.rewards[0];
  const [quantity, setQuantity] = useState(1);
  const [additional, setAdditional] = useState(0);
  const [method, setMethod] = useState<'toss' | 'bank_transfer'>('toss');
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', supporterMessage: '', displayNamePublic: true, termsAgreed: false });
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
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? '후원 신청에 실패했습니다.'); return; }
      if (json.depositUrl) { await router.push(json.depositUrl); return; }
      setCreated(json);
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setSubmitting(false); }
  };

  if (created) {
    const expired = remainingMs !== null && remainingMs <= 0;
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">결제</h2>
        <PriceBreakdown amounts={{ itemAmount: created.itemAmount, vatAmount: created.vatAmount, totalAmount: created.totalAmount }} />
        {remainingMs !== null && !expired && <p className="text-sm text-gray-500">결제 대기 {Math.floor(remainingMs / 60000)}:{String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}</p>}
        {expired ? (
          <p role="alert" className="text-red-600">결제 대기 시간이 지났습니다. <button type="button" className="underline" onClick={() => setCreated(null)}>다시 신청</button></p>
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
    <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <fieldset>
        <legend className="text-xl font-bold">1. 리워드</legend>
        <div className="mt-3 space-y-2">
          {project.rewards.map((r) => {
            const left = remaining[r.id];
            const soldOut = left !== null && left !== undefined && left <= 0;
            return (
              <label key={r.id} className={`flex items-start gap-3 rounded-lg border p-3 ${soldOut ? 'opacity-50' : ''}`}>
                <input type="radio" name="reward" value={r.id} checked={rewardId === r.id} disabled={soldOut} onChange={() => setRewardId(r.id)} />
                <span><strong>{formatPriceAmount(r.amount)}원</strong> {r.title}{soldOut ? ' (품절)' : left != null ? ` · ${left}개 남음` : ''}</span>
              </label>
            );
          })}
        </div>
        <label className="mt-4 block text-sm">수량
          <input type="number" min={1} max={Math.min(MAX_QUANTITY, remaining[reward.id] ?? MAX_QUANTITY)} value={quantity} className={field}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label className="mt-4 block text-sm">추가 후원금 (선택, 1,000원 단위)
          <input type="number" min={0} max={MAX_ADDITIONAL_AMOUNT} step={ADDITIONAL_AMOUNT_STEP} value={additional} className={field}
            onChange={(e) => setAdditional(Math.max(0, Math.floor((Number(e.target.value) || 0) / ADDITIONAL_AMOUNT_STEP) * ADDITIONAL_AMOUNT_STEP))} />
        </label>
        <p className="mt-3 text-sm text-gray-600">예상 합계 {formatPriceAmount(preview.totalAmount)}원 (VAT 포함) — 실제 청구액은 다음 단계에서 서버가 확정합니다.</p>
      </fieldset>

      <fieldset>
        <legend className="text-xl font-bold">2. 후원자 정보</legend>
        <label className="mt-3 block text-sm">이름<input required className={field} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></label>
        <label className="mt-3 block text-sm">연락처<input required className={field} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} /></label>
        <label className="mt-3 block text-sm">이메일<input required type="email" className={field} value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} /></label>
        {reward.requiresShipping && (
          <div className="mt-4 space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold">배송지</p>
            <label className="block text-sm">받는 분<input required className={field} value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} /></label>
            <label className="block text-sm">받는 분 연락처<input required className={field} value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} /></label>
            <label className="block text-sm">우편번호<input required className={field} value={ship.postcode} onChange={(e) => setShip({ ...ship, postcode: e.target.value })} /></label>
            <label className="block text-sm">주소<input required className={field} value={ship.address1} onChange={(e) => setShip({ ...ship, address1: e.target.value })} /></label>
            <label className="block text-sm">상세주소<input className={field} value={ship.address2} onChange={(e) => setShip({ ...ship, address2: e.target.value })} /></label>
            <label className="block text-sm">배송 메모<input className={field} value={ship.memo} onChange={(e) => setShip({ ...ship, memo: e.target.value })} /></label>
          </div>
        )}
        <label className="mt-3 block text-sm">응원 메시지 (선택, 운영자에게만 보입니다)
          <textarea className={field} maxLength={500} value={form.supporterMessage} onChange={(e) => setForm({ ...form, supporterMessage: e.target.value })} />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.displayNamePublic} onChange={(e) => setForm({ ...form, displayNamePublic: e.target.checked })} />
          후원자 명단에 이름 공개
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.termsAgreed} onChange={(e) => setForm({ ...form, termsAgreed: e.target.checked })} />
          <span><Link href="/ko/funding/terms" target="_blank" className="underline">펀딩 약관·청약철회·환불 규정</Link>과 <Link href="/ko/privacy-policy" target="_blank" className="underline">개인정보 처리방침</Link>에 동의합니다</span>
        </label>
      </fieldset>

      <fieldset>
        <legend className="text-xl font-bold">3. 결제수단</legend>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="radio" name="method" checked={method === 'toss'} onChange={() => setMethod('toss')} /> 카드·계좌이체·간편결제 (토스페이먼츠)</label>
        {!limited && (
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="method" checked={method === 'bank_transfer'} onChange={() => setMethod('bank_transfer')} /> 무통장입금 (12시간 안에 입금)</label>
        )}
        {limited && <p className="mt-2 text-xs text-gray-500">한정 수량 리워드는 온라인 결제만 가능합니다.</p>}
      </fieldset>

      {error && <p role="alert" className="text-red-600">{error}</p>}
      <Button type="submit" size="lg" fullWidth disabled={submitting}>{method === 'toss' ? '결제로 이동' : '무통장 후원 신청'}</Button>
    </form>
  );
}
