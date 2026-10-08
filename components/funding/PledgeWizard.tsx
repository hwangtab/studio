import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { reportPaymentFailure, reportPaymentWindowOpen } from '../../utils/reportPaymentFailure';

import { TOSS_TERMS_REQUIRED_MESSAGE } from '../booking/useTossPaymentWidgets';
import PaymentMethodPicker, { PaymentMethodSkeleton } from '../payments/PaymentMethodPicker';
import { usePaymentCheckout } from '../payments/usePaymentCheckout';
import { Button } from '../ui/Button';
import { formatPriceAmount } from '../../data/pricing';
import { computeFundingAmounts } from '../../lib/funding/amounts';
import { ADDITIONAL_AMOUNT_STEP, ANONYMOUS_LABEL, MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY, PLEDGE_TEXT_LIMITS } from '../../lib/funding/policy';
import { BANK_TRANSFER_BLOCK_MESSAGES, bankTransferBlockReason } from '../../lib/funding/bankAccount';
import type { FundingProject } from '../../lib/funding/projects';
import type { PublicNameStyle } from '../../lib/funding/publicName';
import { clearStoredDraft, draftStorageKey, readStringDraft, writeStringDraft } from '../../lib/formDraft';
import { Field, TextArea, TextInput } from '../ui/Field';
import { ChoiceCard } from '../ui/Choice';
import { Checkbox } from '../ui/Checkbox';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { PriceSummary } from '../ui/PriceSummary';
import PublicNameChoice from './PublicNameChoice';
import { formatKakaoAddress, loadKakaoPostcode } from './kakaoPostcode';

/**
 * 임시 저장에 담는 문자열 10칸. 배송 리워드는 이름·전화·이메일 + 배송 6칸 + 응원 메시지로
 * 채워야 할 칸이 많아, 모달 백드롭을 잘못 눌러 언마운트되면 전부 다시 쳐야 했다.
 *
 * 여기 없는 것이 계약이다(lib/formDraft.ts "지켜야 할 선"):
 * - `displayNamePublic` — 체크 한 번뿐이라 잃어도 타이핑 손해가 없고, 문자열만 담는
 *   모듈 계약을 깨면서까지 살릴 값이 아니다. 명단 표시 방식·닉네임도 같다 — 공개 동의가
 *   복원되지 않으니 그 아래 선택만 살려 둘 이유가 없다.
 * - `rewardId`·`quantityText`·`additionalText` — 재고는 그 사이 바뀐다. 되살린 선택이
 *   지금도 유효한 재고인지 이 모듈은 알 수 없다. (결제를 **시도한** 선택은 따로
 *   `lastRewardKey`로 되살린다 — 거기서는 지금 재고로 다시 자른다.)
 */
const DRAFT_FIELDS = [
  'customerName', 'customerPhone', 'customerEmail', 'supporterMessage',
  'shipName', 'shipPhone', 'shipPostcode', 'shipAddress1', 'shipAddress2', 'shipMemo',
] as const;

interface Props {
  project: FundingProject;
  /** 처음부터 고른 채로 시작할 리워드. 리워드 카드를 눌러 연 모달·`?reward=` 링크가 넘긴다. */
  initialRewardId: string | null;
  /**
   * 리워드를 이미 고르고 들어온 화면에서 선택 단계를 **접어 둔다**(2026-10-04, 되돌림).
   * 리워드 카드를 눌러 연 모달이 그런 경우다 — 방금 고른 것을 전체 목록에서 또 고르게 하면
   * 무엇을 고른 건지 의심하게 된다(2026-09-15 #118). 고른 리워드는 요약으로 먼저 보여 주고,
   * "다른 리워드 보기"로 펼치면 라디오 목록이 나와 **바꿀 수 있다** — #118은 완전히 숨기고
   * 모달을 닫고 다른 카드를 누르게 했는데, 그건 불편하다는 지적을 받아 접어 두는 쪽으로
   * 고쳤다(목록은 있지만 기본은 닫힘).
   *
   * 한 주문에 여러 리워드를 **담는** "장바구니" 방식을 2026-09-28~10-04 사이 썼었다("두
   * 리워드를 원하는 사람이 결제를 두 번 한다"는 추정 때문). 그런데 그 방식을 켜 둔 동안
   * 실제 결제 완료 12건이 전부 리워드 1개였다 — 추정한 수요가 실재하지 않았다. 되돌린 것은
   * "여러 개를 더하는" 메커니즘(담기·빼기·수량별 관리·추가 상품 제안)이다 — 다른 선택지를
   * **보는 것** 자체는 남겨 둔다. 세트 리워드를 두지 않는 것은 여전히 같은 이유(운영자 결정)다.
   */
  lockedReward?: boolean;
  remaining: Record<string, number | null>;
  /**
   * 어디에 놓였나. 결제 버튼 바는 **어디서든 바닥에 고정**하고(모바일에서 주 버튼은 늘 하단 고정
   * 바 — 2026-09-29 통일 규칙), 차이는 바가 가장자리에 붙는 방식뿐이다.
   * - `page`: /pledge 페이지. 화면 가장자리까지(좌우 패딩 −4).
   * - `modal`: 리워드 모달 본문(스크롤 컨테이너, 패딩 p-5 sm:p-6) 바닥. 모달 상세 단계의 고정
   *   버튼 바(RewardModal)와 같은 모양이 되도록 본문 패딩만큼 끌어내린다.
   */
  layout?: 'page' | 'modal';
}
const helpClass = 'typo-card-meta mt-1.5';
const ALL_SOLD_OUT_MESSAGE = '모든 리워드가 품절되었습니다. 문의: 010-4255-7893';
const EMPTY_ADDRESS_MESSAGE = '주소 검색으로 받으실 주소를 넣어 주세요.';
/** 결제를 시도한 선택을 되살리는 기한. */
const LAST_SELECTION_TTL_MS = 30 * 60 * 1000;

const cardClass = 'glass-card rounded-2xl p-5 sm:p-6';
// 선택 가능한 행(리워드·결제수단)은 ChoiceCard — 탭 타깃이 카드 전체이고 선택 틴트·포커스 링은
// 거기 한 벌로 있다(docs/design-system.md §4). 단독 체크박스는 Checkbox.

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

export default function PledgeWizard({ project, initialRewardId, lockedReward = false, remaining, layout = 'page' }: Props) {
  const uid = useId();
  // 첫 리워드가 품절이면 disabled 라디오가 선택된 채로 시작해, 후원자가 폼을 다 채우고
  // 제출한 뒤에야 409를 봤다. 고를 수 있는 첫 리워드를 기본값으로 둔다(전부 품절이면
  // 첫 리워드를 그대로 두되 아래에서 제출 자체를 막는다). 넘겨받은 리워드(카드·`?reward=`)가
  // 그 사이 품절됐어도 같은 규칙을 적용한다 — 공유된 링크로 들어온 사람이 비활성 라디오가
  // 선택된 폼을 다 채운 뒤에야 품절을 보게 하지 않는다.
  const [rewardId, setRewardId] = useState(
    initialRewardId && !isSoldOut(remaining, initialRewardId)
      ? initialRewardId
      : (project.rewards.find((r) => !isSoldOut(remaining, r.id)) ?? project.rewards[0]).id,
  );
  const reward = project.rewards.find((r) => r.id === rewardId) ?? project.rewards[0];
  /** 리워드가 잠겨 있을 때(모달에서 카드로 들어옴) 다른 리워드 목록을 펼쳤는가. */
  const [showAllRewards, setShowAllRewards] = useState(false);
  const [quantityText, setQuantityText] = useState('1');
  const [additionalText, setAdditionalText] = useState('0');
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '', supporterMessage: '', displayNamePublic: false,
    publicNameStyle: 'real' as PublicNameStyle, publicNickname: '',
  });
  const [ship, setShip] = useState({ name: '', phone: '', postcode: '', address1: '', address2: '', memo: '' });
  /**
   * 받는 분이 후원자와 다른가. 기본은 **같다** — 대부분 자기 앞으로 받는데 이름·연락처를 두 번
   * 받던 것이 불만이었다(2026-09-29 운영자). 같으면 받는 분 칸을 숨기고 제출 때 후원자 이름·
   * 연락처를 배송지에 채워 보낸다. 임시 저장 칸(DRAFT_FIELDS)을 늘리지 않으려고 이 값은
   * 저장하지 않고, 복원한 초안에 받는 분이 적혀 있으면 true로 되짚는다.
   */
  const [shipToOther, setShipToOther] = useState(false);
  /**
   * 주소는 **검색으로** 넣는다 — 자기 우편번호를 외우는 사람은 없다. 우편번호·주소 칸은 검색
   * 결과로만 채워지고(읽기 전용), 우편번호 서비스를 못 불러오면(차단·오프라인) 그때만 직접
   * 입력으로 연다. 읽기 전용 칸은 브라우저의 required 검사에서 빠지므로 제출 때 따로 본다.
   */
  const [addressSearchOpen, setAddressSearchOpen] = useState(false);
  const [addressManual, setAddressManual] = useState(false);
  const addressEmbedRef = useRef<HTMLDivElement>(null);
  const address2Ref = useRef<HTMLInputElement>(null);
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
  /**
   * 마지막으로 **결제를 시도한 선택**. 결제창은 토스로 전체 이동했다가 돌아오므로, 실패·
   * 취소 뒤 다시 들어오면 고른 것이 사라지고 기본값으로 되돌아갔다. 탭 단위(sessionStorage)로
   * 두고 결제가 확정되면 지운다(success).
   *
   * 되살릴 때 **지금의 재고로 다시 자른다** — 그 사이 품절된 것은 기본값으로 돌아가고
   * 수량은 상한을 넘으면 줄인다. 이름·주소 초안(formDraft)에서 선택을 뺀 이유가 "재고가
   * 바뀐다"였는데, 여기서는 그 검사를 직접 하므로 되살려도 된다. 시간 제한(30분)은 홀드
   * 수명의 두 배쯤 — 한참 뒤에 다시 온 사람에게 예전 선택을 들이밀지 않는다.
   *
   * 리워드가 **잠겨 있으면**(모달에서 카드를 눌러 들어온 경우) 되살리지 않는다 — 그 카드가
   * 곧 선택이라, 지난 시도와 다른 카드를 눌렀다면 그게 새 선택이다.
   */
  const lastSelectionKey = `funding:lastSelection:${project.slug}`;
  /**
   * 폼을 열어 둔 사이 한정 리워드가 팔려 나가면(상태 폴링이 `remaining`을 새로 준다) 고른
   * 수량을 **지금 남은 만큼으로 자른다**. 예전엔 화면에 그대로 남아 있다가 제출하면 서버가
   * "남은 수량보다 많이 신청했다"로 거절했다 — 초과 판매는 없지만 폼을 다 채운 뒤에야 안다.
   * 줄인 사실은 바로 위에서 알린다(말없이 바꾸면 합계가 왜 줄었는지 모른다).
   */
  const [stockNotice, setStockNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!isSoldOut(remaining, rewardId)) {
      const cap = Math.max(1, Math.min(MAX_QUANTITY, remaining[rewardId] ?? MAX_QUANTITY));
      const current = Math.floor(Number(quantityText));
      if (!Number.isFinite(current) || current <= cap) return;
      setQuantityText(String(cap));
      setStockNotice(`남은 수량이 바뀌어 ${cap}개로 조정했습니다.`);
      return;
    }
    // 고른 리워드가 폼을 열어 둔 사이 품절됐다 — 고를 수 있는 다른 리워드로 옮긴다. 예전엔
    // 수량 상한만 보아서(아래 1-이상 가드), 선택한 것만 품절돼도 조용히 1개로 남아 있다가
    // 제출에서야 409를 봤다.
    // 옮길 데가 없으면(전 리워드 품절) 아래 ALL_SOLD_OUT_MESSAGE가 이미 알리므로 더 보태지 않는다.
    const next = project.rewards.find((r) => !isSoldOut(remaining, r.id));
    if (next) {
      const soldOutTitle = project.rewards.find((r) => r.id === rewardId)?.title ?? rewardId;
      setRewardId(next.id);
      setQuantityText('1');
      setStockNotice(`${soldOutTitle}이 품절되어 다른 리워드로 옮겼습니다.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);
  const [selectionRestored, setSelectionRestored] = useState(false);
  useEffect(() => {
    if (lockedReward) return;
    try {
      const raw = window.sessionStorage.getItem(lastSelectionKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { at?: unknown; rewardId?: unknown; quantity?: unknown };
      if (typeof saved?.at !== 'number' || Date.now() - saved.at > LAST_SELECTION_TTL_MS) return;
      if (typeof saved.rewardId !== 'string' || !project.rewards.some((r) => r.id === saved.rewardId) || isSoldOut(remaining, saved.rewardId)) return;
      const cap = Math.max(1, Math.min(MAX_QUANTITY, remaining[saved.rewardId] ?? MAX_QUANTITY));
      const quantity = Math.min(cap, Math.floor(Number(saved.quantity)));
      if (!Number.isFinite(quantity) || quantity < 1) return;
      setRewardId(saved.rewardId);
      setQuantityText(String(quantity));
      setSelectionRestored(true);
    } catch {
      /* 저장소가 막혔거나 값이 깨졌다 — 처음 상태로 둔다. */
    }
    // 마운트 시 한 번만 — remaining이 폴링으로 바뀔 때마다 되살리면 사용자가 바꾼 선택이 돌아온다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSelectionKey]);
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
    if (draft.shipName || draft.shipPhone) setShipToOther(true);
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

  useEffect(() => {
    if (!addressSearchOpen) return;
    let cancelled = false;
    loadKakaoPostcode()
      .then((Postcode) => {
        const el = addressEmbedRef.current;
        if (cancelled || !el) return;
        el.innerHTML = '';
        new Postcode({
          width: '100%', height: '100%',
          oncomplete: (data) => {
            setShip((prev) => ({ ...prev, postcode: data.zonecode, address1: formatKakaoAddress(data) }));
            setAddressSearchOpen(false);
            window.setTimeout(() => address2Ref.current?.focus(), 0);
          },
        }).embed(el);
      })
      .catch(() => {
        if (cancelled) return;
        setAddressSearchOpen(false);
        setAddressManual(true);
      });
    return () => { cancelled = true; };
  }, [addressSearchOpen]);

  // 전 리워드 품절 — 제출을 막고 이유를 밝힌다. 막지 않으면 무엇을 눌러도 409만 돌아온다.
  const allSoldOut = project.rewards.every((r) => isSoldOut(remaining, r.id));
  const quantityCap = Math.max(1, Math.min(MAX_QUANTITY, remaining[reward.id] ?? MAX_QUANTITY));
  // 화면 요약·서버 전송에 쓰는 값은 언제나 정규화본이다 — 입력 칸의 문자열은 건드리지 않는다.
  const quantity = clampQuantity(quantityText, quantityCap);
  const needsShipping = reward.requiresShipping;
  const additional = clampAdditional(additionalText);
  const preview = useMemo(() => computeFundingAmounts(reward.amount, quantity, additional), [reward.amount, quantity, additional]);

  /**
   * 결제수단 — 카드·간편결제(토스 위젯) 또는 계좌로 직접 입금.
   *
   * 계좌 입금은 한정 수량 리워드에 못 쓴다. 판정은 서버 검증(lib/funding/validation.ts)과
   * **같은 함수·같은 인자**다(bankTransferBlockReason) — 한쪽만 바뀌면 화면은 고르게 두는데 서버가
   * 거절하는 죽은 선택지가 생긴다. 고른 뒤에 한정 리워드로 바꾸면 카드로 되돌린다(아래 effect).
   */
  const [payMethod, setPayMethod] = useState<'toss' | 'bank_transfer'>('toss');
  const bankBlocked = bankTransferBlockReason([reward]);
  const usingBank = payMethod === 'bank_transfer' && bankBlocked === null;
  useEffect(() => {
    if (bankBlocked && payMethod === 'bank_transfer') setPayMethod('toss');
  }, [bankBlocked, payMethod]);

  /**
   * 결제위젯을 **폼 안에** 띄운다(기본). 기능 플래그가 켜지면 위젯 대신 우리가 그린 결제수단
   * 목록(PaymentMethodPicker)을 보이고 고른 수단의 결제창으로 바로 보낸다(usePaymentCheckout).
   *
   * 금액은 후원자가 수량·추가 후원금을 고칠 때마다 위젯에 알린다. 다시 그리지는 않는다.
   */
  const {
    methodsId, agreementId, ready: paymentReady, error: paymentError, retry: retryPayment, requestPayment,
    agreedRequiredTerms, picker, choice: pickerChoice, setChoice: setPickerChoice, applePaySupported,
  } = usePaymentCheckout(preview.totalAmount);

  const submit = async () => {
    // 재진입 가드는 **ref**여야 한다. `submitting` 상태는 비동기로 갱신돼서, 같은 tick에
    // 두 번 불리면(수량 칸에서 Enter 연타·키 리피트) 둘 다 통과해 pending 주문이 두 건
    // 생긴다. 한정 리워드면 본인이 남은 재고를 잠근 채 한 건만 결제하게 된다.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    if (allSoldOut) { submittingRef.current = false; setError(ALL_SOLD_OUT_MESSAGE); return; }
    if (needsShipping && (!ship.postcode.trim() || !ship.address1.trim())) {
      submittingRef.current = false;
      setError(EMPTY_ADDRESS_MESSAGE);
      return;
    }
    if (usingBank) {
      // 계좌 입금 — 결제창이 없다. 신청을 만들고 펀딩 확인 페이지(입금 안내)로 옮긴다.
      setQuantityText(String(quantity));
      setAdditionalText(String(additional));
      setSubmitting(true);
      try {
        const res = await fetch('/api/funding/pledges', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectSlug: project.slug,
            items: [{ rewardId: reward.id, quantity }],
            additionalAmount: additional, paymentMethod: 'bank_transfer',
            ...form, supporterMessage: form.supporterMessage || undefined,
            termsAgreed: true,
            shipping: needsShipping
              ? { ...ship, ...(shipToOther ? {} : { name: form.customerName, phone: form.customerPhone }) }
              : undefined,
          }),
        });
        if (!res.headers.get('content-type')?.includes('application/json')) { setError('서버 오류가 발생했습니다.'); return; }
        const json = await res.json();
        if (!res.ok || typeof json.manageUrl !== 'string') { setError(json.message ?? '펀딩 신청에 실패했습니다.'); return; }
        // 신청이 만들어졌으니 임시 저장은 비운다(토스는 success 화면이 비운다).
        clearStoredDraft(draftKey);
        // 문서 이동이다 — 도착지는 관리 토큰이 실린 비밀 주소라 클라이언트 전환·측정 대상이 아니다
        // (lib/analytics/privatePaths.ts). 금액은 그 화면이 서버에서 다시 읽는다.
        window.location.assign(json.manageUrl);
      } catch {
        setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }
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
          projectSlug: project.slug,
          items: [{ rewardId: reward.id, quantity }],
          additionalAmount: additional, paymentMethod: 'toss',
          ...(previousOrderNo ? { previousOrderNo } : {}),
          ...form, supporterMessage: form.supporterMessage || undefined,
          // 동의는 **결제하기를 누르는 행위**로 받는다(버튼 위 고지). 서버 검증과
          // terms_version 기록은 그대로라, 누른 시점의 판본이 증거로 남는다.
          termsAgreed: true,
          shipping: needsShipping
            ? { ...ship, ...(shipToOther ? {} : { name: form.customerName, phone: form.customerPhone }) }
            : undefined,
        }),
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        setError('서버 오류가 발생했습니다.');
        return;
      }
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? '펀딩 신청에 실패했습니다.'); return; }
      if (typeof json.orderNo === 'string') rememberOrderNo(json.orderNo);
      try {
        window.sessionStorage.setItem(lastSelectionKey, JSON.stringify({ at: Date.now(), rewardId: reward.id, quantity }));
      } catch {
        /* 기억하지 못해도 결제는 진행된다. */
      }

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
      // 결제창을 연다는 사실을 먼저 남긴다 — 만료 주문이 "결제창까지는 갔는가"를 가르는 근거.
      reportPaymentWindowOpen(json.orderNo);
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
        // 신용·체크카드를 고르고 카드사를 안 고른 채 누른 경우다(이 분기는 약관 동의 뒤에만 온다).
        // 2026-09-29 한 후원자가 옛 문구("결제 수단과 약관 동의를 확인해 주세요")를 보고 30초에 네 번 다시 눌렀다.
        setError('카드 결제는 카드사를 먼저 골라 주세요. 결제 방법 아래에서 카드사를 선택한 뒤 다시 눌러 주세요.');
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
    // 위젯이 아직 안 떴으면 Enter도 제출하지 않는다 — 안 막으면 동의 상태를 못 받은 것이
    // "약관을 빼먹었다"로 읽혀, 후원자가 고칠 수 없는 약관 문구를 본다. 계좌 입금은 위젯이 필요 없다.
    if (!paymentReady && !usingBank) return;
    void submit();
  };

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {/*
        리워드는 **하나만 고른다**(2026-10-04, 되돌림 — 위 lockedReward 주석). 모달에서 카드를
        눌러 들어왔으면 그 리워드로 **시작**하지만, 다른 리워드도 볼 수 있다 — 목록은 접어 두고
        "다른 리워드 보기"로 펼친다(2026-10-04). 완전히 숨기면(초기 되돌림에서는 그랬다) 바꾸려면
        모달을 닫고 다른 카드를 눌러야 해서 불편하다는 지적을 받았다. 펼친 목록에서 고르면 그
        리워드로 **바뀐다**(여러 개를 더하는 "담기"가 아니다 — 그 방식을 되돌린 이유는 위 주석).
      */}
      <fieldset className={cardClass} aria-labelledby={lockedReward && !showAllRewards ? undefined : `${uid}-step-reward`}>
        {lockedReward && !showAllRewards ? (
          <Notice tone="brand" icon={false} className="mb-5">
            <p className="typo-card-meta">고르신 리워드</p>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatPriceAmount(reward.amount)}원</p>
            <p className="typo-card-meta">{reward.title}</p>
          </Notice>
        ) : (
          <StepHeader id={`${uid}-step-reward`} n={1} title="리워드" hint="펀딩 금액에 따라 돌려드릴 구성입니다." />
        )}
        {stockNotice && (
          <Notice tone="warning" role="status" className="mb-3">{stockNotice}</Notice>
        )}
        {selectionRestored && (
          <p role="status" className="mb-3 typo-card-meta">지난번 결제를 시도할 때 고른 리워드를 다시 담아 두었습니다.</p>
        )}
        {(!lockedReward || showAllRewards) && (
          <div className="space-y-2">
            {project.rewards.map((r) => {
              const left = remaining[r.id];
              const soldOut = isSoldOut(remaining, r.id);
              return (
                <ChoiceCard
                  key={r.id}
                  name="reward"
                  value={r.id}
                  checked={rewardId === r.id}
                  disabled={soldOut}
                  onChange={() => { setRewardId(r.id); setQuantityText('1'); }}
                  title={`${formatPriceAmount(r.amount)}원`}
                  description={`${r.title}${soldOut ? ' (품절)' : left != null ? ` · ${left}개 남음` : ''}${r.requiresShipping ? ' · 배송' : ''}`}
                />
              );
            })}
          </div>
        )}
        {lockedReward && project.rewards.length > 1 && (
          <button
            type="button"
            onClick={() => setShowAllRewards((open) => !open)}
            aria-expanded={showAllRewards}
            className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-primary transition-colors hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:text-primary-lighter dark:hover:text-white dark:focus-visible:ring-primary-lighter/70"
          >
            {showAllRewards ? '접기' : `다른 리워드 보기 (${project.rewards.length - 1})`}
          </button>
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
        <StepHeader id={`${uid}-step-backer`} n={2} title="후원자 정보" hint="펀딩 확인 메일과 리워드 발송에 씁니다." />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Field id={`${uid}-name`} label="이름" required>
              <TextInput required maxLength={PLEDGE_TEXT_LIMITS.customerName} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </Field>
          </div>
          <div>
            <Field id={`${uid}-phone`} label="연락처" required>
              <TextInput required inputMode="tel" maxLength={PLEDGE_TEXT_LIMITS.customerPhone} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id={`${uid}-email`} label="이메일" required>
              <TextInput required type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
            </Field>
          </div>
        </div>

        {needsShipping && (
          <Panel variant="outline" className="mt-5">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">배송지</p>
            <p className={helpClass}>고르신 리워드는 배송이 있습니다.</p>
            <Checkbox
              className="mt-2"
              emphasis
              checked={shipToOther}
              onChange={(e) => {
                setShipToOther(e.target.checked);
                if (!e.target.checked) setShip((prev) => ({ ...prev, name: '', phone: '' }));
              }}
              label="후원자가 아닌 다른 분이 받습니다"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {shipToOther && (
                <>
                  <div>
                    <Field id={`${uid}-sname`} label="받는 분" required>
                      <TextInput required maxLength={PLEDGE_TEXT_LIMITS.shippingName} value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} />
                    </Field>
                  </div>
                  <div>
                    <Field id={`${uid}-sphone`} label="받는 분 연락처" required>
                      <TextInput required inputMode="tel" maxLength={PLEDGE_TEXT_LIMITS.shippingPhone} value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} />
                    </Field>
                  </div>
                </>
              )}
              <div className="flex items-end gap-2 sm:col-span-2">
                <Field id={`${uid}-post`} label="우편번호" required className="w-32 shrink-0">
                  <TextInput
                    required
                    readOnly={!addressManual}
                    inputMode="numeric"
                    maxLength={PLEDGE_TEXT_LIMITS.shippingPostcode}
                    value={ship.postcode}
                    onClick={() => { if (!addressManual) setAddressSearchOpen(true); }}
                    onChange={(e) => setShip({ ...ship, postcode: e.target.value })}
                  />
                </Field>
                {!addressManual && (
                  <Button type="button" variant="weak" onClick={() => setAddressSearchOpen((open) => !open)} aria-expanded={addressSearchOpen}>
                    {addressSearchOpen ? '검색 닫기' : '주소 검색'}
                  </Button>
                )}
              </div>
              {addressSearchOpen && (
                <div className="sm:col-span-2">
                  <div ref={addressEmbedRef} className="h-[440px] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700" />
                </div>
              )}
              {addressManual && (
                <p className="typo-card-meta sm:col-span-2" role="status">주소 검색을 불러오지 못했습니다. 우편번호와 주소를 직접 적어 주세요.</p>
              )}
              <div className="sm:col-span-2">
                <Field id={`${uid}-addr1`} label="주소" required>
                  <TextInput
                    required
                    readOnly={!addressManual}
                    maxLength={PLEDGE_TEXT_LIMITS.shippingAddress1}
                    value={ship.address1}
                    placeholder={addressManual ? undefined : '주소 검색을 눌러 찾아 주세요'}
                    onClick={() => { if (!addressManual && !ship.address1) setAddressSearchOpen(true); }}
                    onChange={(e) => setShip({ ...ship, address1: e.target.value })}
                  />
                </Field>
              </div>
              <div>
                <Field id={`${uid}-addr2`} label="상세주소">
                  <TextInput ref={address2Ref} maxLength={PLEDGE_TEXT_LIMITS.shippingAddress2} value={ship.address2} onChange={(e) => setShip({ ...ship, address2: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field id={`${uid}-memo`} label="배송 메모">
                  <TextInput maxLength={PLEDGE_TEXT_LIMITS.shippingMemo} value={ship.memo} onChange={(e) => setShip({ ...ship, memo: e.target.value })} />
                </Field>
              </div>
            </div>
          </Panel>
        )}

        {/*
          응원 메시지와 명단 공개를 **한 덩어리**로 둔다. 예전에는 공개 체크가 메시지 칸 아래
          떨어진 회색 한 줄이라, 메시지를 써 놓고도 체크를 못 보고 지나가 메시지가 아무 데도
          안 뜨는 일이 잦았다(2026-09-25 운영 확인).

          2026-09-28부터 메시지는 이름과 **따로** 간다 — 이름을 표시하지 않으면 메시지가 "익명"으로
          올라간다(ANONYMOUS_MESSAGE_TERMS_FROM 판본 이후 후원만, 약관 제13조 2항). 이름 없는 메시지는
          누구의 것인지 알 수 없어 동의 체크를 받지 않고 칸 바로 아래에서 알린다 — 쓰는 행위가
          곧 선택이다. 동의가 필요한 것은 **이름 표시** 하나만 남았고, 그 체크는 여전히 미리
          켜 두지 않는다(선택 항목 동의를 기본 체크로 받으면 적법한 동의로 보기 어렵다).

          테두리 박스는 두르지 않는다 — 필수 약관 동의처럼 보이면 안 된다(토스 위젯의 [필수]
          체크와 나란히 셋이 비슷해 보였던 이유). 옅은 바탕의 "선택" 구획으로 구분한다.
        */}
        <Panel variant="inset" padding="compact" className="mt-5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            응원 메시지 · 후원자 명단 <span className="font-normal text-gray-500 dark:text-gray-400">(선택)</span>
          </p>
          <p className={helpClass}>남겨 주신 메시지는 프로젝트 페이지 후원자 명단에 올라갑니다. 이름을 표시하지 않으면 &ldquo;{ANONYMOUS_LABEL}&rdquo;으로 보입니다.</p>
          <div className="mt-3">
            <Field id={`${uid}-msg`} label="응원 메시지">
              <TextArea rows={3} className="min-h-0" maxLength={PLEDGE_TEXT_LIMITS.supporterMessage} value={form.supporterMessage} onChange={(e) => setForm({ ...form, supporterMessage: e.target.value })} />
            </Field>
          </div>

          <Checkbox
            className="mt-2"
            emphasis
            checked={form.displayNamePublic}
            onChange={(e) => setForm({ ...form, displayNamePublic: e.target.checked })}
            label="후원자 명단에 이름 표시"
            hint="실명 대신 가린 이름이나 닉네임도 고를 수 있습니다."
          />

          {form.displayNamePublic && (
            <PublicNameChoice
              customerName={form.customerName}
              style={form.publicNameStyle}
              nickname={form.publicNickname}
              onStyleChange={(publicNameStyle) => setForm({ ...form, publicNameStyle })}
              onNicknameChange={(publicNickname) => setForm({ ...form, publicNickname })}
              message={form.supporterMessage}
            />
          )}
        </Panel>
      </fieldset>

      {/*
        결제수단 — 위에서 **카드·간편결제(토스)**와 **계좌로 직접 입금** 중 하나를 고른다. 토스 쪽 수단
        목록과 결제 약관 동의는 **위젯이 그린다**(우리 목록을 따로 두지 않는다 — 계약된 수단이 늘면 그대로
        따라온다). 계좌 입금을 고르면 위젯을 **숨기기만 한다** — 언마운트하면 훅이 iframe을 걷었다가
        되돌아올 때 다시 그리며 동의 상태가 풀린다. 숨긴 동안 위젯 약관은 제출 조건에서 빠진다.

        기능 플래그(`?pay=v2`, lib/payments/paymentPickerFlag.ts)가 켜지면 위젯 대신 결제수단 목록을 우리가
        그린다 — 카드·계좌 입금·간편결제가 한 목록이고, 고른 수단의 결제창으로 바로 간다(위젯 약관 없음).
      */}
      <fieldset className={cardClass} aria-labelledby={`${uid}-step-pay`}>
        <StepHeader
          id={`${uid}-step-pay`} n={3} title="결제수단"
          hint={usingBank ? '신청하시면 입금하실 계좌를 바로 알려 드립니다.' : '고르신 수단으로 바로 결제창이 열립니다.'}
        />
        {picker === null ? (
          <PaymentMethodSkeleton />
        ) : picker ? (
          <>
            <PaymentMethodPicker
              name={`${uid}-paymethod`}
              value={usingBank ? 'bank_transfer' : pickerChoice}
              onChange={(next) => {
                if (next === 'bank_transfer') { setPayMethod('bank_transfer'); return; }
                setPayMethod('toss');
                setPickerChoice(next);
              }}
              applePaySupported={applePaySupported}
              bankBlockedMessage={bankBlocked ? BANK_TRANSFER_BLOCK_MESSAGES[bankBlocked] : null}
            />
            {paymentError && <Notice tone="error" className="mt-3">{paymentError}</Notice>}
          </>
        ) : (
          <>
          <div className="mb-4 space-y-2" role="radiogroup" aria-label="결제 방법">
            <ChoiceCard
              name={`${uid}-paymethod`}
              value="toss"
              checked={!usingBank}
              onChange={() => setPayMethod('toss')}
              title="카드·간편결제(토스)"
              description="결제가 끝나면 바로 확정됩니다."
            />
            <ChoiceCard
              name={`${uid}-paymethod`}
              value="bank_transfer"
              checked={usingBank}
              disabled={bankBlocked !== null}
              onChange={() => setPayMethod('bank_transfer')}
              title="계좌로 직접 입금"
              description={bankBlocked ? BANK_TRANSFER_BLOCK_MESSAGES[bankBlocked] : '은행·ATM에서 보내실 수 있습니다. 입금을 확인하면 메일로 알려 드립니다.'}
            />
          </div>
          <div hidden={usingBank}>
            {paymentError ? (
              <Notice tone="error" actions={<Button type="button" size="sm" variant="weak" onClick={retryPayment}>다시 시도</Button>}>
                {paymentError}
              </Notice>
            ) : (
              <>
                <div id={methodsId} />
                <div id={agreementId} />
              </>
            )}
          </div>
          </>
        )}
      </fieldset>

      {/*
        결제 요약은 **흐름 안의 카드**로 둔다. 예전엔 요약 전체를 바닥에 붙였는데, 모달에서는
        폼 위로 떠 겹쳐 모달만 따로 끄는 설정을 뒀다 — 같은 폼이 진입 경로에 따라 버튼 위치가
        달랐다. 이제 바닥에는 버튼 바만 둔다.
      */}
      <section className={cardClass} aria-labelledby={`${uid}-summary`}>
        <h2 id={`${uid}-summary`} className="typo-card-subtitle text-gray-900 dark:text-white">결제 요약</h2>
        {/* 리워드가는 VAT 포함 최종가라 부가세 줄이 없다 — 그 사실은 note로 적는다. */}
        <PriceSummary
          className="mt-3"
          items={[
            { label: reward.title, quantity, amount: reward.amount * quantity },
            ...(additional > 0 ? [{ label: '추가 펀딩', amount: additional }] : []),
          ]}
          total={preview.totalAmount}
          totalLabel="예상 합계"
          note="VAT 포함. 실제 청구액은 서버가 확정합니다."
        />
      </section>

      {/*
        결제 버튼 바 — **어디서든 바닥에 고정**(모바일 주 버튼 통일 규칙). 약관 고지는 버튼과
        떨어지면 안 되므로(아래 주석) 바 안에 함께 둔다. 모달 상세 단계의 고정 바
        (RewardModal)와 같은 모양·같은 "금액 · 동작" 문구다.

        모달에서는 `bottom`을 본문 패딩만큼 음수로 둔다. sticky는 스크롤 컨테이너의 패딩 안쪽에
        붙어서, `bottom-0`이면 바가 모달 바닥에서 패딩(20px)만큼 떠 그 틈으로 아래 입력칸이
        비쳤다(2026-09-29 운영 캡처).
      */}
      <div
        className={layout === 'modal'
          ? 'sticky -bottom-5 z-10 -mx-5 -mb-5 border-t border-gray-200 bg-gray-50 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 dark:border-gray-700 dark:bg-gray-900'
          : 'sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:rounded-t-2xl sm:border-x sm:px-6 dark:border-gray-700 dark:bg-gray-900/95'}
      >
        {allSoldOut && (
          <Notice tone="neutral" role="status" className="mb-3">{ALL_SOLD_OUT_MESSAGE}</Notice>
        )}
        {error && <Notice tone="error" className="mb-3">{error}</Notice>}
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
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {usingBank ? '계좌 안내 받기' : '결제하기'}를 누르면{' '}
          <Link href="/ko/funding/terms" target="_blank" className="underline">펀딩 약관(청약철회·환불)</Link>과{' '}
          <Link href="/ko/privacy-policy" target="_blank" className="underline">개인정보 처리방침</Link>에 동의하는 것으로 봅니다.
        </p>

        {/* 위젯이 아직 안 떴으면 누를 수 없다 — 누르면 주문만 만들어지고 결제창은 안 열린다.
            계좌 입금은 위젯이 필요 없고, 마지막 버튼 말만 "계좌 안내 받기"다(버튼 규칙의 "결제하기" 자리). */}
        <Button type="submit" size="lg" fullWidth className="mt-3" disabled={submitting || allSoldOut || (!usingBank && !paymentReady)}>
          {submitting ? '처리 중…' : `${formatPriceAmount(preview.totalAmount)}원 · ${usingBank ? '계좌 안내 받기' : '결제하기'}`}
        </Button>
      </div>
    </form>
  );
}
