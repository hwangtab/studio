import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { reportPaymentFailure } from '../../utils/reportPaymentFailure';

import { TOSS_TERMS_REQUIRED_MESSAGE, useTossPaymentWidgets } from '../booking/useTossPaymentWidgets';
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
const helpClass = 'typo-card-meta mt-1.5';
const ALL_SOLD_OUT_MESSAGE = '모든 리워드가 품절되었습니다. 문의: 010-4255-7893';

const cardClass = 'glass-card rounded-2xl p-5 sm:p-6';
// 선택 가능한 행(리워드·결제수단)은 탭 타깃이 카드 전체가 되도록.
const choiceRow =
  'flex items-start gap-3 rounded-xl border p-4 transition-colors cursor-pointer border-gray-200 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary-light/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 dark:has-[:checked]:border-primary-light dark:has-[:checked]:bg-primary-light/10';
const radioClass = 'mt-0.5 h-5 w-5 shrink-0 accent-primary';

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

export default function PledgeWizard({ project, initialRewardId, remaining, lockedReward = false, stickySummary = true }: Props) {
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
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', supporterMessage: '', displayNamePublic: false });
  const [ship, setShip] = useState({ name: '', phone: '', postcode: '', address1: '', address2: '', memo: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
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

  // 전 리워드 품절 — 제출을 막고 이유를 밝힌다. 막지 않으면 무엇을 눌러도 409만 돌아온다.
  const allSoldOut = project.rewards.every((r) => isSoldOut(remaining, r.id));
  // 화면 요약·서버 전송에 쓰는 값은 언제나 정규화본이다 — 입력 칸의 문자열은 건드리지 않는다.
  const quantityCap = Math.max(1, Math.min(MAX_QUANTITY, remaining[reward.id] ?? MAX_QUANTITY));
  const quantity = clampQuantity(quantityText, quantityCap);
  const additional = clampAdditional(additionalText);
  const preview = useMemo(() => computeFundingAmounts(reward.amount, quantity, additional), [reward.amount, quantity, additional]);

  /**
   * 결제위젯을 **폼 안에** 띄운다. 수단 목록은 위젯이 계약·노출 설정대로 그리므로 우리가
   * 목록을 들고 있지 않는다 — 토스 쪽에서 수단이 늘거나 줄면 그대로 따라간다.
   *
   * 금액은 후원자가 수량·추가 후원금을 고칠 때마다 위젯에 알린다. 다시 그리지는 않는다.
   */
  const {
    methodsId, agreementId, ready: paymentReady, error: paymentError, retry: retryPayment, requestPayment,
    agreedRequiredTerms,
  } = useTossPaymentWidgets(preview.totalAmount);

  const submit = async () => {
    // 재진입 가드는 **ref**여야 한다. `submitting` 상태는 비동기로 갱신돼서, 같은 tick에
    // 두 번 불리면(수량 칸에서 Enter 연타·키 리피트) 둘 다 통과해 pending 주문이 두 건
    // 생긴다. 한정 리워드면 본인이 남은 재고를 잠근 채 한 건만 결제하게 된다.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    if (allSoldOut) { submittingRef.current = false; setError(ALL_SOLD_OUT_MESSAGE); return; }
    /**
     * 위젯 약관도 제출 **전에** 본다.
     *
     * 예전에는 그냥 보내고 `requestPayment`가 실패하게 뒀다. 그 시점엔 주문이 이미
     * 만들어져 있어서 한정 재고 홀드가 잡힌 채 실패했고, 문구도 "잠시 후 다시 시도해
     * 주세요"라 무엇을 고쳐야 하는지 알 수 없었다. 동의 상태를 못 받았을 때(null)는
     * 막지 않는다 — 동의했는데 결제가 안 되는 쪽이 더 나쁘다.
     */
    if (agreedRequiredTerms !== true) {
      submittingRef.current = false;
      setError(TOSS_TERMS_REQUIRED_MESSAGE);
      document.getElementById(agreementId)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      return;
    }
    // 제출 직전 확정 — blur 없이 Enter로 보낸 경우에도 입력 칸이 실제 청구 값과 일치한다.
    setQuantityText(String(quantity));
    setAdditionalText(String(additional));
    setSubmitting(true);
    // 결제창 실패를 서버에 알릴 때 쓴다 — catch에서 주문번호가 보여야 한다.
    let createdOrderNo: string | null = null;
    try {
      const res = await fetch('/api/funding/pledges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: project.slug, rewardId: reward.id, quantity, additionalAmount: additional, paymentMethod: 'toss',
          ...(previousOrderNo ? { previousOrderNo } : {}),
          ...form, supporterMessage: form.supporterMessage || undefined,
          // 동의는 **결제하기를 누르는 행위**로 받는다(버튼 위 고지). 서버 검증과
          // terms_version 기록은 그대로라, 누른 시점의 판본이 증거로 남는다.
          termsAgreed: true,
          shipping: reward.requiresShipping ? ship : undefined,
        }),
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        setError('서버 오류가 발생했습니다.');
        return;
      }
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? '펀딩 신청에 실패했습니다.'); return; }
      if (typeof json.orderNo === 'string') rememberOrderNo(json.orderNo);

      /**
       * 주문을 만들자마자 **결제창을 연다.**
       *
       * 예전에는 여기서 화면을 하나 더 그렸다 — 결제위젯이 수단 목록을 보여 주고, 후원자가
       * 고른 뒤 「결제하기」를 또 눌러야 했다. 위젯은 이미 위 폼 안에 떠 있으므로 그 화면은
       * 같은 것을 두 번 보여 주는 자리였다.
       *
       * 금액은 **서버가 확정한 값**으로 맞춰 연다. 화면의 추정치는 후원자가 방금 고친
       * 수량을 반영하지만, 청구되는 것은 서버가 계산한 값이다.
       */
      const origin = window.location.origin;
      createdOrderNo = json.orderNo;
      await requestPayment({
        orderId: json.orderNo,
        orderName: `[펀딩] ${project.title} · ${reward.title}`.slice(0, 100),
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        amount: json.totalAmount,
        successUrl: `${origin}/ko/funding/success`,
        failUrl: `${origin}/ko/funding/fail?slug=${encodeURIComponent(project.slug)}`,
      });
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
       * 결제창을 닫으면 여기로 온다 — 오류가 아니다. 주문은 pending으로 남고, 다시
       * 제출하면 `previousOrderNo`가 그 홀드를 풀어 준다(본인이 한정 재고를 붙들고
       * 품절을 보는 일이 없게).
       *
       * 약관 동의를 안 한 채 누르면 위젯이 그 사실을 코드로 알려 준다. 그건 후원자가
       * 고쳐야 하는 것이라 문구를 띄운다.
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
        setError(TOSS_TERMS_REQUIRED_MESSAGE);
      } else if (code === 'NEED_CARD_PAYMENT_DETAIL') {
        setError('결제 수단과 약관 동의를 확인해 주세요.');
      } else {
        setError('결제를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
    finally { submittingRef.current = false; setSubmitting(false); }
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
          <StepHeader id={`${uid}-step-reward`} n={1} title="리워드" hint="펀딩 금액에 따라 돌려드릴 구성입니다." />
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
            <Field id={`${uid}-qty`} label="수량" hint={`1~${quantityCap}개까지 펀딩할 수 있습니다.`}>
              <TextInput type="number" inputMode="numeric" min={1} max={quantityCap} step={1} value={quantityText}
                onChange={(e) => setQuantityText(e.target.value)}
                onKeyDown={handleNumericEnter}
                onBlur={() => setQuantityText(String(clampQuantity(quantityText, quantityCap)))} />
            </Field>
          </div>
          <div>
            <Field id={`${uid}-add`} label="추가 펀딩 금액" hint={`선택 항목입니다. 1,000원 단위로 최대 ${formatPriceAmount(MAX_ADDITIONAL_AMOUNT)}원까지 올릴 수 있습니다.`}>
              <TextInput type="number" inputMode="numeric" min={0} max={MAX_ADDITIONAL_AMOUNT} step={ADDITIONAL_AMOUNT_STEP} value={additionalText}
                onChange={(e) => setAdditionalText(e.target.value)}
                onKeyDown={handleNumericEnter}
                onBlur={() => setAdditionalText(String(clampAdditional(additionalText)))} />
            </Field>
          </div>
        </div>
      </fieldset>

      <fieldset className={cardClass} aria-labelledby={`${uid}-step-backer`}>
        <StepHeader id={`${uid}-step-backer`} n={lockedReward ? 1 : 2} title="서포터 정보" hint="펀딩 확인 메일과 리워드 발송에 씁니다." />
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
          <Field id={`${uid}-msg`} label="응원 메시지" hint="선택 항목입니다. 아래 공개에 동의하시면 프로젝트 페이지에 이름과 함께 표시됩니다.">
            <TextArea rows={3} className="min-h-0" maxLength={500} value={form.supporterMessage} onChange={(e) => setForm({ ...form, supporterMessage: e.target.value })} />
          </Field>
        </div>

        {/* 이름 공개는 **선택**이라 테두리 박스를 두르지 않는다. 필수 약관 동의와 같은
            모양으로 나란히 두면 동의 체크가 두 개인 것처럼 읽혀, 화면 아래 토스 위젯의
            결제 약관 동의까지 셋이 비슷해 보인다. 약관 동의는 제출 버튼 옆으로 옮겼다. */}
        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input type="checkbox" className={radioClass} checked={form.displayNamePublic} onChange={(e) => setForm({ ...form, displayNamePublic: e.target.checked })} />
          <span className="text-sm text-gray-700 dark:text-gray-200">서포터 명단에 이름과 응원 메시지 공개</span>
        </label>
      </fieldset>

      {/* 결제수단과 결제 약관 동의는 **위젯이 그린다.** 우리 목록을 따로 두지 않는다 —
          계약된 수단이 늘면 그대로 따라오고, 갈라지면 화면과 실제가 어긋난다. */}
      <fieldset className={cardClass} aria-labelledby={`${uid}-step-pay`}>
        <StepHeader id={`${uid}-step-pay`} n={lockedReward ? 2 : 3} title="결제수단" hint="고르신 수단으로 바로 결제창이 열립니다." />
        {paymentError ? (
          <div>
            <p role="alert" className="text-sm text-red-600">{paymentError}</p>
            <Button type="button" variant="outline" onClick={retryPayment} className="mt-3">다시 시도</Button>
          </div>
        ) : (
          <>
            <div id={methodsId} />
            <div id={agreementId} />
          </>
        )}
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
            <dd className="text-sm font-medium text-gray-900 dark:text-white">{quantity}개{additional > 0 ? ` · 추가 펀딩 ${formatPriceAmount(additional)}원` : ''}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-gray-200 pt-2 dark:border-gray-700">
            <dt className="text-sm font-semibold text-gray-900 dark:text-white">예상 합계</dt>
            <dd className="text-lg font-bold text-gray-900 dark:text-white">{formatPriceAmount(preview.totalAmount)}원</dd>
          </div>
        </dl>
        <p className={helpClass}>VAT 포함. 실제 청구액은 서버가 확정합니다.</p>

        {allSoldOut && (
          <p role="status" className="mt-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200">{ALL_SOLD_OUT_MESSAGE}</p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</p>
        )}
        {/*
          약관 동의는 **결제하기를 누르는 행위 자체**로 받는다. 체크박스를 두지 않는다.

          화면에는 결제위젯이 그리는 [필수] 결제 서비스 약관 체크가 이미 있고, 그 바로
          아래에 거의 같은 말을 하는 체크를 하나 더 두면 — 위젯은 자기 회색 영역 안에
          들여쓰여 그리므로 정렬도 배경도 맞출 수 없다 — 중복으로 읽히고 어느 쪽을 눌러야
          하는지 헷갈린다(2026-09-16 실사용 확인).

          법적으로도 체크박스가 요구되는 항목이 아니다. 청약철회 등에 관한 사항은
          전자상거래법 제13조상 **고지** 의무이고, 개인정보 처리방침은 개인정보보호법
          제30조상 **공개** 대상이다. 이름·연락처·배송지는 리워드 이행에 필요한 정보라
          제15조 제1항 제4호(계약 이행)로 동의 없이 수집할 수 있다. 계약 이행에 필요하지
          않은 **선택** 항목(이름·응원 메시지 공개)만 위에서 따로 동의를 받는다.

          서버 검증(termsAgreed)과 판본 기록(funding_pledges.terms_version)은 그대로다 —
          누른 시점의 판본이 증거로 남는다.
        */}
        <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          결제하기를 누르면{' '}
          <Link href="/ko/funding/terms" target="_blank" className="underline">펀딩 약관(청약철회·환불)</Link>과{' '}
          <Link href="/ko/privacy-policy" target="_blank" className="underline">개인정보 처리방침</Link>에 동의하는 것으로 봅니다.
        </p>

        {/* 위젯이 아직 안 떴으면 누를 수 없다 — 누르면 주문만 만들어지고 결제창은 안 열린다. */}
        <Button type="submit" size="lg" fullWidth className="mt-4" disabled={submitting || allSoldOut || !paymentReady}>
          {submitting ? '처리 중…' : '결제하기'}
        </Button>
      </div>
    </form>
  );
}
