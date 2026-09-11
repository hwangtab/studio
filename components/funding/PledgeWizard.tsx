import { type KeyboardEvent, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';

import TossPaymentWidget from '../booking/TossPaymentWidget';
import PriceBreakdown from '../booking/PriceBreakdown';
import { Button } from '../ui/Button';
import { formatPriceAmount } from '../../data/pricing';
import { computeFundingAmounts } from '../../lib/funding/amounts';
import { ADDITIONAL_AMOUNT_STEP, MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY } from '../../lib/funding/policy';
import type { FundingProject } from '../../lib/funding/projects';
import { Field, TextArea, TextInput } from '../ui/Field';

interface Props { project: FundingProject; initialRewardId: string | null; remaining: Record<string, number | null> }
interface Created {
  orderNo: string; totalAmount: number; itemAmount: number; vatAmount: number;
  holdExpiresAt: string;
  /** 서버가 홀드를 만든 시각. 있으면 기기 시계와 무관하게 남은 시간을 잴 수 있다. */
  serverNow?: string;
  /** 응답을 받은 순간의 **기기** 시계. 이후 경과 시간은 전부 이 값과의 차이로만 잰다. */
  receivedAt: number;
}

/**
 * 결제 대기 시간의 총량(ms). `null`이면 "알 수 없음"이고, 그때는 만료로 단정하지 않는다.
 *
 * 예전엔 서버가 준 절대 시각(`holdExpiresAt`)을 기기의 `Date.now()`와 직접 비교했다. 기기
 * 시계가 15분 이상 빨리 가면 방금 만든 홀드가 **생성 직후 만료**로 판정돼 결제 위젯이 영영
 * 뜨지 않았고, "다시 신청"을 눌러도 같은 결과였다(새 주문의 holdExpiresAt도 같은 이유로
 * 과거가 된다). 지금은 서버 시각(`serverNow`)과의 차이로 총량을 구하고, 남은 시간은
 * **응답 수신 이후 경과분**만 빼서 잰다 — 두 시계를 섞지 않는다.
 */
const holdDurationMs = (c: Created): number | null => {
  const end = new Date(c.holdExpiresAt).getTime();
  if (!Number.isFinite(end)) return null;
  if (c.serverNow) {
    const server = new Date(c.serverNow).getTime();
    if (Number.isFinite(server)) return end - server;
  }
  // serverNow가 없는 응답(구버전)에는 기기 시계로 폴백하되, 음수는 "시계가 어긋났다"는
  // 신호로 읽고 만료로 단정하지 않는다 — 방금 만든 홀드가 이미 지났을 리는 없다.
  const local = end - c.receivedAt;
  return local > 0 ? local : null;
};

const helpClass = 'typo-card-meta mt-1.5';
const ALL_SOLD_OUT_MESSAGE = '모든 리워드가 품절되었습니다. 문의: 010-4255-7893';
const cardClass = 'glass-card rounded-2xl p-5 sm:p-6';
// 선택 가능한 행(리워드·결제수단)은 탭 타깃이 카드 전체가 되도록.
const choiceRow =
  'flex items-start gap-3 rounded-xl border p-4 transition-colors cursor-pointer border-gray-200 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary-light/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 dark:has-[:checked]:border-primary-light dark:has-[:checked]:bg-primary-light/10';
const radioClass = 'mt-0.5 h-4 w-4 shrink-0 accent-primary';

/**
 * 수량·추가 후원금은 **문자열 상태로 자유 입력**받고, 정규화는 blur와 제출 직전에만 한다.
 *
 * 예전엔 onChange가 매 키 입력마다 정규화한 값을 상태로 되돌려 넣었다. 그래서 추가
 * 후원금은 1,000원 단위 내림이 글자마다 걸려 `5`→0, `50`→0, `500`→0 … 즉 **어떤 값도
 * 타이핑으로 넣을 수 없었고**(스피너가 없는 모바일에서는 기능 자체가 없었다), 수량은
 * 기본값 `1`에 한 글자만 더 쳐도(`12`) 곧바로 상한으로 튀었다.
 *
 * native `min`/`max`/`step`은 그대로 둔다 — 데스크톱 스피너와 ↑↓ 키가 추가 후원금에서
 * **유일하게 동작하던 입력 수단**이라, 없애면 `step` 기본값 1로 ↑ 한 번이 `1`이 되고 blur의
 * 1,000원 단위 내림에 0으로 지워진다. 대신 두 칸에서 Enter를 가로채(`onKeyDown`) 정규화 뒤
 * 직접 제출한다 — 브라우저 제약 검증(stepMismatch·rangeOverflow) 경로를 아예 타지 않으므로
 * 정규화 전 중간값이 남은 채 Enter를 눌러도 말풍선으로 막히지 않는다. `noValidate`는 쓰지
 * 않는다(이름·연락처·이메일의 native `required`·type=email 검증까지 죽는다).
 *
 * 규칙은 아래 두 함수 한 곳에만 있고, 서버 `lib/funding/validation.ts`(수량 1~MAX_QUANTITY
 * 정수, 추가금 0~MAX_ADDITIONAL_AMOUNT의 ADDITIONAL_AMOUNT_STEP 배수)와 같은 규칙이다.
 * 최종 판정은 언제나 서버다.
 */
const clampQuantity = (raw: string, cap: number): number => {
  const n = Math.floor(Number(raw));
  // 빈 문자열·`-`·`.` 같은 타이핑 중간 상태는 폴백값으로 읽는다(입력 자체는 막지 않는다).
  return Number.isFinite(n) ? Math.min(cap, Math.max(1, n)) : 1;
};

const clampAdditional = (raw: string): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  const stepped = Math.floor(Math.max(0, n) / ADDITIONAL_AMOUNT_STEP) * ADDITIONAL_AMOUNT_STEP;
  return Math.min(MAX_ADDITIONAL_AMOUNT, stepped);
};

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

/** 품절 판정 — remaining이 없거나(null=무제한, undefined=미집계) 1개 이상 남았으면 고를 수 있다. */
const isSoldOut = (remaining: Record<string, number | null>, rewardId: string): boolean =>
  (remaining[rewardId] ?? 1) <= 0;

export default function PledgeWizard({ project, initialRewardId, remaining }: Props) {
  const uid = useId();
  // 첫 리워드가 품절이면 disabled 라디오가 선택된 채로 시작해, 후원자가 폼을 다 채우고
  // 제출한 뒤에야 409를 봤다. 고를 수 있는 첫 리워드를 기본값으로 둔다(전부 품절이면
  // 첫 리워드를 그대로 두되 아래에서 제출 자체를 막는다).
  const [rewardId, setRewardId] = useState(
    initialRewardId ?? (project.rewards.find((r) => !isSoldOut(remaining, r.id)) ?? project.rewards[0]).id,
  );
  const reward = project.rewards.find((r) => r.id === rewardId) ?? project.rewards[0];
  const [quantityText, setQuantityText] = useState('1');
  const [additionalText, setAdditionalText] = useState('0');
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', supporterMessage: '', displayNamePublic: false, termsAgreed: false });
  const [ship, setShip] = useState({ name: '', phone: '', postcode: '', address1: '', address2: '', memo: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  // 전 리워드 품절 — 제출을 막고 이유를 밝힌다. 막지 않으면 무엇을 눌러도 409만 돌아온다.
  const allSoldOut = project.rewards.every((r) => isSoldOut(remaining, r.id));
  // 화면 요약·서버 전송에 쓰는 값은 언제나 정규화본이다 — 입력 칸의 문자열은 건드리지 않는다.
  const quantityCap = Math.max(1, Math.min(MAX_QUANTITY, remaining[reward.id] ?? MAX_QUANTITY));
  const quantity = clampQuantity(quantityText, quantityCap);
  const additional = clampAdditional(additionalText);
  const preview = useMemo(() => computeFundingAmounts(reward.amount, quantity, additional), [reward.amount, quantity, additional]);

  useEffect(() => {
    if (!created) return;
    const total = holdDurationMs(created);
    // 총량을 못 구하면 카운트다운도, 만료 판정도 하지 않는다 — 결제 위젯은 그대로 뜬다.
    // 실제 만료는 서버가 판정한다(confirm이 hold_expired로 거절).
    if (total === null) { setRemainingMs(null); return; }
    const tick = () => setRemainingMs(Math.max(0, total - (Date.now() - created.receivedAt)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [created]);

  const submit = async () => {
    setError(null);
    if (allSoldOut) { setError(ALL_SOLD_OUT_MESSAGE); return; }
    if (!form.termsAgreed) { setError('약관에 동의해 주세요.'); return; }
    // 제출 직전 확정 — blur 없이 Enter로 보낸 경우에도 입력 칸이 실제 청구 값과 일치한다.
    setQuantityText(String(quantity));
    setAdditionalText(String(additional));
    setSubmitting(true);
    try {
      const res = await fetch('/api/funding/pledges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: project.slug, rewardId: reward.id, quantity, additionalAmount: additional, paymentMethod: 'toss',
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
      // 남은 시간은 이 시각 기준으로만 잰다 — 서버가 준 절대 시각을 기기 시계와 직접
      // 비교하지 않는다(holdDurationMs 주석).
      const receivedAt = Date.now();
      // router.push가 아니라 전체 페이지 이동 — 클라이언트 전환이면 이미 로드된 gtag가
      // ?token=이 붙은 URL로 page_view를 보낸다(_app의 측정 스크립트 제외는 mount 시점 판정).
      setCreated({ ...json, receivedAt });
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setSubmitting(false); }
  };

  /**
   * 숫자 칸에서 Enter를 가로챈다. 그냥 두면 브라우저의 암묵적 제출이 제약 검증
   * (stepMismatch·rangeOverflow)을 먼저 돌려, 아직 정규화 전인 중간값(`5500`·`12`)에
   * 말풍선을 띄우고 제출을 막는다 — 우리가 곧바로 정규화해 줄 값인데도.
   *
   * 이 경로는 native 검증을 건너뛰므로 이름·연락처·이메일 누락은 서버가 판정해 메시지를
   * 돌려준다(`validateCreatePledgePayload`). 버튼 클릭·다른 칸에서의 Enter는 종전대로
   * form의 native 검증을 탄다.
   */
  const handleNumericEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void submit();
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
            const soldOut = isSoldOut(remaining, r.id);
            return (
              <label key={r.id} className={`${choiceRow} ${soldOut ? 'cursor-not-allowed opacity-50' : ''}`}>
                <input type="radio" name="reward" value={r.id} className={radioClass} checked={rewardId === r.id} disabled={soldOut} onChange={() => { setRewardId(r.id); setQuantityText('1'); }} />
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
            <Field id={`${uid}-qty`} label="수량" hint={`1~${quantityCap}개까지 후원할 수 있습니다.`}>
              <TextInput type="number" inputMode="numeric" min={1} max={quantityCap} step={1} value={quantityText}
                onChange={(e) => setQuantityText(e.target.value)}
                onKeyDown={handleNumericEnter}
                onBlur={() => setQuantityText(String(clampQuantity(quantityText, quantityCap)))} />
            </Field>
          </div>
          <div>
            <Field id={`${uid}-add`} label="추가 후원금" hint={`선택 항목입니다. 1,000원 단위로 최대 ${formatPriceAmount(MAX_ADDITIONAL_AMOUNT)}원까지 올릴 수 있습니다.`}>
              <TextInput type="number" inputMode="numeric" min={0} max={MAX_ADDITIONAL_AMOUNT} step={ADDITIONAL_AMOUNT_STEP} value={additionalText}
                onChange={(e) => setAdditionalText(e.target.value)}
                onKeyDown={handleNumericEnter}
                onBlur={() => setAdditionalText(String(clampAdditional(additionalText)))} />
            </Field>
          </div>
        </div>
      </fieldset>

      <fieldset className={cardClass}>
        <StepHeader n={2} title="후원자 정보" hint="후원 확인 메일과 리워드 발송에 씁니다." />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Field id={`${uid}-name`} label="이름" required>
              <TextInput required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </Field>
          </div>
          <div>
            <Field id={`${uid}-phone`} label="연락처" required>
              <TextInput required inputMode="tel" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id={`${uid}-email`} label="이메일" required>
              <TextInput required type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
            </Field>
          </div>
        </div>

        {reward.requiresShipping && (
          <div className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">배송지</p>
            <p className={helpClass}>이 리워드는 배송이 있습니다.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Field id={`${uid}-sname`} label="받는 분" required>
                  <TextInput required value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field id={`${uid}-sphone`} label="받는 분 연락처" required>
                  <TextInput required inputMode="tel" value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field id={`${uid}-post`} label="우편번호" required>
                  <TextInput required inputMode="numeric" value={ship.postcode} onChange={(e) => setShip({ ...ship, postcode: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field id={`${uid}-addr1`} label="주소" required>
                  <TextInput required value={ship.address1} onChange={(e) => setShip({ ...ship, address1: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field id={`${uid}-addr2`} label="상세주소">
                  <TextInput value={ship.address2} onChange={(e) => setShip({ ...ship, address2: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field id={`${uid}-memo`} label="배송 메모">
                  <TextInput value={ship.memo} onChange={(e) => setShip({ ...ship, memo: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5">
          <Field id={`${uid}-msg`} label="응원 메시지" hint="선택 항목이며 운영자에게만 보입니다.">
            <TextArea rows={3} className="min-h-0" maxLength={500} value={form.supporterMessage} onChange={(e) => setForm({ ...form, supporterMessage: e.target.value })} />
          </Field>
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
        {allSoldOut && (
          <p role="status" className="mt-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200">{ALL_SOLD_OUT_MESSAGE}</p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</p>
        )}
        <Button type="submit" size="lg" fullWidth className="mt-4" disabled={submitting || allSoldOut}>
          {submitting ? '처리 중…' : '결제로 이동'}
        </Button>
      </div>
    </form>
  );
}
