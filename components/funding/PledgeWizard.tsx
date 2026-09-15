import { type KeyboardEvent, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';

import TossPaymentWidget from '../booking/TossPaymentWidget';
import PriceBreakdown from '../booking/PriceBreakdown';
import { Button } from '../ui/Button';
import { formatPriceAmount } from '../../data/pricing';
import { computeFundingAmounts } from '../../lib/funding/amounts';
import { ADDITIONAL_AMOUNT_STEP, MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY } from '../../lib/funding/policy';
import type { FundingProject } from '../../lib/funding/projects';
import { draftStorageKey, readStringDraft, writeStringDraft } from '../../lib/formDraft';
import { Field, TextArea, TextInput } from '../ui/Field';

/**
 * 임시 저장에 담는 문자열 10칸. 배송 리워드는 이름·전화·이메일 + 배송 6칸 + 응원 메시지로
 * 채워야 할 칸이 많아, 모달 백드롭을 잘못 눌러 언마운트되면 전부 다시 쳐야 했다.
 *
 * 여기 없는 것이 계약이다(lib/formDraft.ts "지켜야 할 선"):
 * - `termsAgreed` — 복원된 체크는 의사표시가 아니다. `funding_pledges.terms_version`이
 *   "그때 이 내용에 동의했다"의 증거인데, 되살린 체크가 그 증거를 받치지 못한다.
 * - `displayNamePublic` — 체크 한 번뿐이라 잃어도 타이핑 손해가 없고, 문자열만 담는
 *   모듈 계약을 깨면서까지 살릴 값이 아니다.
 * - `rewardId`·`quantityText`·`additionalText` — 재고는 그 사이 바뀐다. 되살린 선택이
 *   지금도 유효한 재고인지 이 모듈은 알 수 없다.
 */
const DRAFT_FIELDS = [
  'customerName', 'customerPhone', 'customerEmail', 'supporterMessage',
  'shipName', 'shipPhone', 'shipPostcode', 'shipAddress1', 'shipAddress2', 'shipMemo',
] as const;

interface Props {
  project: FundingProject;
  initialRewardId: string | null;
  remaining: Record<string, number | null>;
  /**
   * 결제 위젯(토스 iframe)이 화면에 있는 동안 true. 모달이 이 값을 받아 **포커스 트랩을
   * 끈다** — 트랩의 포커스 대상 목록에 iframe이 없어서, 켜 둔 채로는 키보드 사용자가
   * 카드번호 칸에 Tab으로 못 들어가고 첫 요소로 되감긴다.
   */
  onPaymentActiveChange?: (active: boolean) => void;
  /**
   * 리워드를 이미 고르고 들어온 화면에서 선택 단계를 감춘다. 리워드 카드를 눌러 연 모달이
   * 그런 경우다 — 방금 고른 것을 네 개 중에서 또 고르게 하면 무엇을 고른 건지 의심하게 된다.
   * 고른 티어는 읽기 전용으로 보여 주고, 바꾸려면 모달을 닫고 다른 카드를 누른다.
   */
  lockedReward?: boolean;
  /**
   * 요약·결제 줄을 화면 아래에 붙일지. 페이지에서는 붙이는 게 맞지만 모달은 **본문 자체가
   * 스크롤 컨테이너**라, sticky가 컨테이너 바닥에 붙으면서 폼 위로 떠 내용과 겹친다.
   */
  stickySummary?: boolean;
}
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

/**
 * `<legend>`를 쓰지 않는다. legend는 브라우저가 **fieldset의 테두리 위에** 얹어 그리는
 * 요소라 패딩 박스 밖으로 빠져나간다. 카드에 rounded-2xl과 패딩을 준 이 화면에서는 제목이
 * 카드 위 경계에 걸쳐 떠 보였다 — "텍스트가 카드를 벗어난다"의 정체다.
 *
 * 대신 평범한 div로 그리고, fieldset에는 `aria-labelledby`로 같은 이름을 준다. 접근성
 * 이름은 그대로 유지되고 배치만 정상으로 돌아온다.
 */
function StepHeader({ id, n, title, hint }: { id: string; n: number; title: string; hint?: string }) {
  return (
    <div id={id} className="mb-4 flex w-full items-center gap-3">
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
    </div>
  );
}

/** 품절 판정 — remaining이 없거나(null=무제한, undefined=미집계) 1개 이상 남았으면 고를 수 있다. */
const isSoldOut = (remaining: Record<string, number | null>, rewardId: string): boolean =>
  (remaining[rewardId] ?? 1) <= 0;

export default function PledgeWizard({ project, initialRewardId, remaining, onPaymentActiveChange, lockedReward = false, stickySummary = true }: Props) {
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
  /**
   * 직전에 만든 **자기** 주문번호. 재제출 시 서버에 함께 보내 그 주문 하나만 만료시킨다
   * (자기 홀드 해제의 소유 증명 — lib/funding/service.ts createFundingPledge 주석).
   *
   * **sessionStorage에 둔다.** React state만 쓰면 가장 흔한 동선에서 증명이 항상 사라진다:
   * 결제 위젯이 토스로 **전체 이동**했다가 실패·뒤로가기로 돌아오면 페이지가 새로 뜨고
   * state는 초기화된다. 그러면 본인 홀드가 15분간 한정 재고를 붙들고 본인이 "품절"을 본다
   * (한정 1개짜리에서는 확실히 체감된다). 탭 단위로만 살아 있고 탭을 닫으면 사라지므로
   * 증명의 수명이 홀드의 수명을 넘지 않는다.
   *
   * 키를 slug별로 나누는 이유: 자기 홀드 해제 UPDATE가 프로젝트별로 걸리므로, 다른
   * 프로젝트의 주문번호를 보내면 아무것도 만료시키지 못한 채 요청만 커진다.
   *
   * localStorage가 아니라 sessionStorage인 것, 그리고 read/write를 전부 try/catch로 감싸는
   * 것은 사생활 보호 모드·저장 차단 브라우저에서 접근 자체가 throw하기 때문이다.
   */
  const holdProofKey = `funding:lastOrderNo:${project.slug}`;
  const [previousOrderNo, setPreviousOrderNo] = useState<string | null>(null);

  // 마운트 시 한 번 읽어 온다(SSR에서는 window가 없다).
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(holdProofKey);
      if (saved) setPreviousOrderNo(saved);
    } catch {
      /* 저장소 접근이 막힌 브라우저 — 증명 없이 진행한다(자기 홀드는 자연 만료된다). */
    }
  }, [holdProofKey]);

  const rememberOrderNo = (orderNo: string) => {
    setPreviousOrderNo(orderNo);
    try {
      window.sessionStorage.setItem(holdProofKey, orderNo);
    } catch {
      /* 위와 같다 — 기억하지 못해도 결제 자체는 진행된다. */
    }
  };
  /**
   * 임시 저장 키. 프로젝트별로 가른다 — 갈지 않으면 다른 펀딩의 이름·연락처·주소가
   * 새어 들어온다(`holdProofKey`와 같은 이유).
   */
  const draftKey = draftStorageKey('funding', project.slug);
  /**
   * 복원이 끝났는지. **저장 effect가 이 값을 게이트로 삼는다** — 없으면 마운트 시
   * 저장 effect가 복원 effect보다 먼저 "빈 폼"으로 한 번 실행돼 방금 읽은 초안을
   * 지워 버린다. `useRef`로는 못 막는다: ref는 같은 커밋 안에서 곧바로 true가 될 뿐
   * 리렌더를 일으키지 않아, 저장 effect가 여전히 복원 이전(빈 폼) 렌더의 클로저 값을
   * 들고 실행된다. `useState`로 둬야 복원 effect의 `setForm`·`setShip`과 함께 커밋되는
   * 다음 렌더에서만 저장 effect가 (이미 복원된) 값으로 재실행된다.
   */
  const [draftRestored, setDraftRestored] = useState(false);

  // 마운트 시 한 번 읽어 온다(SSR에는 window가 없어 초기값으로 쓰면 하이드레이션이 어긋난다
  // — 서명 화면 `pages/[locale]/contracts/[id]/sign.tsx`와 같은 판단). 복원된 필드만 덮고
  // 빈 칸은 그대로 둔다.
  useEffect(() => {
    const draft = readStringDraft(draftKey, DRAFT_FIELDS);
    setForm((prev) => ({
      ...prev,
      customerName: draft.customerName ?? prev.customerName,
      customerPhone: draft.customerPhone ?? prev.customerPhone,
      customerEmail: draft.customerEmail ?? prev.customerEmail,
      supporterMessage: draft.supporterMessage ?? prev.supporterMessage,
    }));
    setShip((prev) => ({
      ...prev,
      name: draft.shipName ?? prev.name,
      phone: draft.shipPhone ?? prev.phone,
      postcode: draft.shipPostcode ?? prev.postcode,
      address1: draft.shipAddress1 ?? prev.address1,
      address2: draft.shipAddress2 ?? prev.address2,
      memo: draft.shipMemo ?? prev.memo,
    }));
    setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // 값이 바뀔 때마다 담는다. `draftRestored`가 false인 동안은(복원 전) 아무것도 쓰지
  // 않는다 — 위 주석의 함정.
  useEffect(() => {
    if (!draftRestored) return;
    writeStringDraft(draftKey, DRAFT_FIELDS, {
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail,
      supporterMessage: form.supporterMessage,
      shipName: ship.name,
      shipPhone: ship.phone,
      shipPostcode: ship.postcode,
      shipAddress1: ship.address1,
      shipAddress2: ship.address2,
      shipMemo: ship.memo,
    });
  }, [
    draftRestored, draftKey,
    form.customerName, form.customerPhone, form.customerEmail, form.supporterMessage,
    ship.name, ship.phone, ship.postcode, ship.address1, ship.address2, ship.memo,
  ]);

  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  // 위젯이 실제로 렌더되는 조건(아래 `if (created)` 분기와 같은 식)을 한 곳에서 판정해
  // 부모에게 알린다. 만료 화면에는 iframe이 없으므로 트랩을 유지한다.
  const paymentActive = created !== null && !(remainingMs !== null && remainingMs <= 0);
  useEffect(() => {
    onPaymentActiveChange?.(paymentActive);
  }, [onPaymentActiveChange, paymentActive]);
  // 언마운트(모달 닫기)될 때 켜진 상태가 남지 않도록 되돌린다.
  useEffect(() => () => onPaymentActiveChange?.(false), [onPaymentActiveChange]);

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
          ...(previousOrderNo ? { previousOrderNo } : {}),
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
      if (typeof json.orderNo === 'string') rememberOrderNo(json.orderNo);
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
    const expired = !paymentActive;
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
      <fieldset className={cardClass} aria-labelledby={lockedReward ? undefined : `${uid}-step-reward`}>
        {lockedReward ? (
          <div className="mb-5 rounded-xl border border-primary bg-primary/5 p-4 dark:border-primary-light dark:bg-primary-light/10">
            <p className="typo-card-meta">고르신 리워드</p>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatPriceAmount(reward.amount)}원</p>
            <p className="typo-card-meta">{reward.title}</p>
          </div>
        ) : (
          <StepHeader id={`${uid}-step-reward`} n={1} title="리워드" hint="후원 금액에 따라 돌려드릴 구성입니다." />
        )}
        {!lockedReward && (
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
        )}
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

      <fieldset className={cardClass} aria-labelledby={`${uid}-step-backer`}>
        <StepHeader id={`${uid}-step-backer`} n={lockedReward ? 1 : 2} title="후원자 정보" hint="후원 확인 메일과 리워드 발송에 씁니다." />
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
      <div className={`${stickySummary ? 'sticky bottom-0 z-10 -mx-4 px-4 backdrop-blur sm:mx-0 sm:px-6' : 'px-4 sm:px-6'} border-t border-gray-200 bg-white/95 pb-4 pt-4 sm:rounded-2xl sm:border dark:border-gray-700 dark:bg-gray-900/95`}>
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
