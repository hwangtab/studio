import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { reportPaymentFailure, reportPaymentWindowOpen } from '../../utils/reportPaymentFailure';

import { TOSS_TERMS_REQUIRED_MESSAGE, useTossPaymentWidgets } from '../booking/useTossPaymentWidgets';
import { Button } from '../ui/Button';
import { formatPriceAmount } from '../../data/pricing';
import { computeFundingAmountsForLines } from '../../lib/funding/amounts';
import { pledgeLinesShortTitle } from '../../lib/funding/pledgeLines';
import { ADDITIONAL_AMOUNT_STEP, ANONYMOUS_LABEL, MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY, PLEDGE_TEXT_LIMITS } from '../../lib/funding/policy';
import type { FundingProject } from '../../lib/funding/projects';
import type { PublicNameStyle } from '../../lib/funding/publicName';
import { draftStorageKey, readStringDraft, writeStringDraft } from '../../lib/formDraft';
import { Field, TextArea, TextInput } from '../ui/Field';
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
 * - 담은 리워드(`cart`)·`additionalText` — 재고는 그 사이 바뀐다. 되살린 선택이
 *   지금도 유효한 재고인지 이 모듈은 알 수 없다. (결제를 **시도한** 장바구니는 따로
 *   `cartKey`로 되살린다 — 거기서는 지금 재고로 다시 자른다.)
 */
const DRAFT_FIELDS = [
  'customerName', 'customerPhone', 'customerEmail', 'supporterMessage',
  'shipName', 'shipPhone', 'shipPostcode', 'shipAddress1', 'shipAddress2', 'shipMemo',
] as const;

interface Props {
  project: FundingProject;
  /**
   * 처음부터 1개 담아 둘 리워드. 리워드 카드를 눌러 연 모달·`?reward=` 링크가 넘긴다. 담긴
   * 채로 시작할 뿐 다른 리워드도 함께 담을 수 있다(2026-09-28 — 한 주문에 여러 리워드).
   */
  initialRewardId: string | null;
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
const EMPTY_CART_MESSAGE = '리워드를 하나 이상 담아 주세요.';
const EMPTY_ADDRESS_MESSAGE = '주소 검색으로 받으실 주소를 넣어 주세요.';
/** 결제를 시도한 장바구니를 되살리는 기한 — 아래 cartKey 주석. */
const LAST_CART_TTL_MS = 30 * 60 * 1000;

const cardClass = 'glass-card rounded-2xl p-5 sm:p-6';
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

/** 이 리워드를 한 주문에 몇 개까지 담을 수 있나 — 남은 수량과 MAX_QUANTITY 중 작은 쪽. */
const capOf = (remaining: Record<string, number | null>, rewardId: string): number =>
  Math.max(0, Math.min(MAX_QUANTITY, remaining[rewardId] ?? MAX_QUANTITY));

const stepButtonClass =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-300 text-lg font-bold text-gray-800 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-100 dark:hover:border-primary-lighter dark:hover:text-primary-lighter dark:focus-visible:ring-primary-lighter/70';

export default function PledgeWizard({ project, initialRewardId, remaining, layout = 'page' }: Props) {
  const uid = useId();
  /**
   * 담은 리워드. **담은 순서**를 지킨다 — 요약·메일·관리자 화면이 이 순서로 보여 준다.
   *
   * 넘겨받은 리워드가 있으면 그것을 1개 담고 시작한다. 없으면(하단 바·히어로의 "펀딩하기",
   * 리워드 없이 연 /pledge) **빈 채로** 시작해 목록을 펼쳐 보인다 — 예전엔 첫 리워드를 멋대로
   * 담아 두어, 고른 적 없는 것이 담긴 채 시작했다. 품절인 리워드는 담지 않는다 — 담긴 채
   * 시작하면 후원자가 폼을 다 채운 뒤에야 409를 본다.
   */
  const [cart, setCart] = useState<Array<{ rewardId: string; quantity: number }>>(() => {
    const start = initialRewardId;
    return start && project.rewards.some((r) => r.id === start) && !isSoldOut(remaining, start) ? [{ rewardId: start, quantity: 1 }] : [];
  });
  /** 담지 않은 리워드 목록을 펼쳤는가. 기본은 접힘 — 위 주석(맨 위에는 담은 것만). */
  const [showAllRewards, setShowAllRewards] = useState(false);
  const quantityOf = (rewardId: string): number => cart.find((c) => c.rewardId === rewardId)?.quantity ?? 0;
  /** 0이면 빼고, 처음이면 맨 뒤에 담고, 있으면 수량만 바꾼다. 상한은 남은 수량·MAX_QUANTITY. */
  const setQuantity = (rewardId: string, next: number) => {
    const quantity = Math.min(capOf(remaining, rewardId), Math.max(0, next));
    setCart((prev) => {
      if (quantity === 0) return prev.filter((c) => c.rewardId !== rewardId);
      if (prev.some((c) => c.rewardId === rewardId)) return prev.map((c) => (c.rewardId === rewardId ? { ...c, quantity } : c));
      return [...prev, { rewardId, quantity }];
    });
  };
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
   * 마지막으로 **결제를 시도한 장바구니**. 결제창은 토스로 전체 이동했다가 돌아오므로, 실패·
   * 취소 뒤 다시 들어오면 담아 둔 리워드가 전부 사라지고 처음 하나만 남았다 — 여러 개를 담은
   * 사람이 다시 담아야 했다. 탭 단위(sessionStorage)로 두고 결제가 확정되면 지운다(success).
   *
   * 되살릴 때 **지금의 재고로 다시 자른다** — 그 사이 품절된 것은 빼고 상한을 넘으면 줄인다.
   * 이름·주소 초안(formDraft)에서 담은 리워드를 빼 둔 이유가 "재고가 바뀐다"였는데, 여기서는
   * 그 검사를 직접 하므로 되살려도 된다. 시간 제한(30분)은 홀드 수명의 두 배쯤 — 한참 뒤에
   * 다시 온 사람에게 예전 선택을 들이밀지 않는다.
   */
  const cartKey = `funding:lastCart:${project.slug}`;
  /**
   * 폼을 열어 둔 사이 한정 리워드가 팔려 나가면(상태 폴링이 `remaining`을 새로 준다) 담아 둔
   * 수량을 **지금 남은 만큼으로 자른다**. 예전엔 화면에 그대로 남아 있다가 제출하면 서버가
   * "남은 수량보다 많이 신청했다"로 거절했다 — 초과 판매는 없지만 폼을 다 채운 뒤에야 안다.
   * 줄인 사실은 바로 위에서 알린다(말없이 바꾸면 합계가 왜 줄었는지 모른다).
   */
  const [stockNotice, setStockNotice] = useState<string | null>(null);
  useEffect(() => {
    const adjusted: string[] = [];
    let changed = false;
    const next = cart.flatMap((c) => {
      const cap = capOf(remaining, c.rewardId);
      if (c.quantity <= cap) return [c];
      changed = true;
      const title = project.rewards.find((r) => r.id === c.rewardId)?.title ?? c.rewardId;
      adjusted.push(cap === 0 ? `${title}(품절)` : `${title}(${cap}개로)`);
      return cap > 0 ? [{ ...c, quantity: cap }] : [];
    });
    if (!changed) return;
    setCart(next);
    setStockNotice(`남은 수량이 바뀌어 조정했습니다: ${adjusted.join(', ')}`);
    // cart는 일부러 뺀다 — 사용자가 담을 때는 setQuantity가 이미 상한으로 자른다. 여기서는
    // 재고(remaining)가 움직였을 때만 다시 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);
  const [cartRestored, setCartRestored] = useState(false);
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(cartKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { at?: unknown; items?: unknown };
      if (typeof saved?.at !== 'number' || Date.now() - saved.at > LAST_CART_TTL_MS || !Array.isArray(saved.items)) return;
      const items = saved.items as Array<{ rewardId?: unknown; quantity?: unknown }>;
      // 카드를 눌러 들어왔는데 그 리워드가 지난 장바구니에 없으면, 새로 고른 것이다 — 덮지 않는다.
      if (initialRewardId && !items.some((i) => i.rewardId === initialRewardId)) return;
      const restored = items.flatMap((i) => {
        if (typeof i.rewardId !== 'string' || !project.rewards.some((r) => r.id === i.rewardId)) return [];
        const quantity = Math.min(capOf(remaining, i.rewardId), Math.floor(Number(i.quantity)));
        return Number.isFinite(quantity) && quantity > 0 ? [{ rewardId: i.rewardId, quantity }] : [];
      });
      if (restored.length > 0) {
        setCart(restored);
        setCartRestored(true);
      }
    } catch {
      /* 저장소가 막혔거나 값이 깨졌다 — 처음 상태로 둔다. */
    }
    // 마운트 시 한 번만 — remaining이 폴링으로 바뀔 때마다 되살리면 사용자가 뺀 것이 돌아온다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);
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
  // 화면 요약·서버 전송에 쓰는 값은 언제나 정규화본이다 — 입력 칸의 문자열은 건드리지 않는다.
  const lines = useMemo(
    () => cart.flatMap((c) => {
      const reward = project.rewards.find((r) => r.id === c.rewardId);
      return reward ? [{ reward, quantity: c.quantity }] : [];
    }),
    [cart, project.rewards],
  );
  const needsShipping = lines.some((l) => l.reward.requiresShipping);
  const additional = clampAdditional(additionalText);
  const preview = useMemo(
    () => computeFundingAmountsForLines(lines.map((l) => ({ unitAmount: l.reward.amount, quantity: l.quantity })), additional),
    [lines, additional],
  );

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
    if (lines.length === 0) { submittingRef.current = false; setError(EMPTY_CART_MESSAGE); return; }
    if (needsShipping && (!ship.postcode.trim() || !ship.address1.trim())) {
      submittingRef.current = false;
      setError(EMPTY_ADDRESS_MESSAGE);
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
    setAdditionalText(String(additional));
    setSubmitting(true);
    // 결제창 실패를 서버에 알릴 때 쓴다 — catch에서 주문번호가 보여야 한다.
    let createdOrderNo: string | null = null;
    try {
      const res = await fetch('/api/funding/pledges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: project.slug,
          items: lines.map((l) => ({ rewardId: l.reward.id, quantity: l.quantity })),
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
        window.sessionStorage.setItem(cartKey, JSON.stringify({
          at: Date.now(), items: lines.map((l) => ({ rewardId: l.reward.id, quantity: l.quantity })),
        }));
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
        orderName: `[펀딩] ${project.title} · ${pledgeLinesShortTitle(lines.map((l) => ({ rewardTitle: l.reward.title })))}`.slice(0, 100),
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

  const notInCart = project.rewards.filter((r) => quantityOf(r.id) === 0);
  // 담은 것이 없으면 목록을 펼친다 — 접어 두면 무엇을 담아야 할지 보이지 않는다.
  const listOpen = showAllRewards || lines.length === 0;
  // 담지 않은 **추가 상품**(`addOn`)만 한 줄 제안으로. 목록을 펼쳤으면 거기 있으니 겹쳐 보이지 않는다.
  const suggestions = lines.length > 0 && !listOpen
    ? notInCart.filter((r) => r.addOn && !isSoldOut(remaining, r.id)).slice(0, 2)
    : [];

  const renderRewardRow = (r: FundingProject['rewards'][number]) => {
    const left = remaining[r.id];
    const soldOut = isSoldOut(remaining, r.id);
    const qty = quantityOf(r.id);
    const cap = capOf(remaining, r.id);
    return (
      <li
        key={r.id}
        className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
          qty > 0
            ? 'border-primary bg-primary/5 dark:border-primary-light dark:bg-primary-light/10'
            : 'border-gray-200 dark:border-gray-700'
        } ${soldOut && qty === 0 ? 'opacity-50' : ''}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-gray-900 dark:text-white">{formatPriceAmount(r.amount)}원</span>
          <span className="typo-card-meta block">{r.title}{soldOut ? ' (품절)' : left != null ? ` · ${left}개 남음` : ''}{r.requiresShipping ? ' · 배송' : ''}</span>
        </span>
        {qty === 0 ? (
          <Button type="button" size="sm" variant="outline" disabled={soldOut} onClick={() => setQuantity(r.id, 1)} aria-label={`${r.title} 담기`}>
            담기
          </Button>
        ) : (
          <span className="flex shrink-0 items-center gap-2">
            <button type="button" className={stepButtonClass} onClick={() => setQuantity(r.id, qty - 1)} aria-label={`${r.title} 하나 빼기`}>−</button>
            <output className="w-6 text-center font-bold tabular-nums text-gray-900 dark:text-white" aria-live="polite" aria-label={`${r.title} 수량`}>{qty}</output>
            <button type="button" className={stepButtonClass} disabled={qty >= cap} onClick={() => setQuantity(r.id, qty + 1)} aria-label={`${r.title} 하나 더`}>+</button>
          </span>
        )}
      </li>
    );
  };

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {/*
        리워드는 **담는다**(2026-09-28). 예전엔 라디오로 하나만 골랐고, 두 가지를 원하는 사람은
        결제를 두 번 해야 했다. 세트 리워드는 조합이 너무 많아 두지 않는다(운영자 결정).
        리워드가는 배송비까지 포함한 최종가라 담은 만큼 그대로 더한다 — 배송비 줄은 없다.

        **맨 위에는 담은 것만 보인다**(2026-09-29 회의 결정). 카드·모달에서 이미 고르고 온
        사람에게 리워드 전체 목록을 다시 펼치면 "방금 고른 게 빠졌나" 하고 같은 결정을 한 번
        더 하게 되고, 모바일에서는 결제위젯이 두 화면 아래로 밀린다. 결제 완료 12건이 전부
        리워드 1개였다 — 대다수에게 목록은 지나가야 할 장애물이다. 나머지는 접어 둔다.

        예외 하나: 담지 않은 **추가 상품**(리워드 `addOn: true`, 시/노래집 같은 것)은 한 줄
        제안으로 보인다. 티어는 서로 대체재라(MP3 대신 WAV, CD 대신 CD+부적) 권하지 않는다.
        "배송이면 제안"으로 추론했다가 실물 티어 프로젝트에서 상위 티어를 권하는 오답이 나서
        파일에 명시하게 했다(lib/funding/shape.ts addOn). 담은 것이 없으면(전부 뺐거나 품절로
        시작) 목록을 펼쳐서 보여 준다.
      */}
      <fieldset className={cardClass} aria-labelledby={`${uid}-step-reward`}>
        <StepHeader id={`${uid}-step-reward`} n={1} title="리워드" hint={lines.length > 0 ? '담은 리워드입니다. 수량을 바꾸거나 다른 리워드를 함께 담을 수 있습니다.' : '펀딩할 리워드를 담아 주세요.'} />
        {stockNotice && (
          <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">{stockNotice}</p>
        )}
        {cartRestored && lines.length > 0 && (
          <p role="status" className="typo-card-meta mb-3">지난번 결제를 시도할 때 담은 리워드를 다시 담아 두었습니다.</p>
        )}
        {lines.length > 0 && (
          <ul className="space-y-2" aria-label="담은 리워드">
            {lines.map((l) => renderRewardRow(l.reward))}
          </ul>
        )}
        {suggestions.length > 0 && (
          <>
          <p className="typo-card-meta mt-4">함께 담을 수 있는 리워드</p>
          <ul className="mt-2 space-y-2" aria-label="함께 담을 수 있는 리워드">
            {suggestions.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-3 dark:border-gray-600">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium text-gray-900 dark:text-white">{r.title}</span>
                  <span className="typo-card-meta block">+{formatPriceAmount(r.amount)}원{r.requiresShipping ? ' · 배송' : ''}</span>
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => setQuantity(r.id, 1)} aria-label={`${r.title} 담기`}>
                  담기
                </Button>
              </li>
            ))}
          </ul>
          </>
        )}
        {notInCart.length > 0 && !listOpen && (
          <button
            type="button"
            onClick={() => setShowAllRewards(true)}
            aria-expanded={false}
            className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-primary transition-colors hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:text-primary-lighter dark:hover:text-white dark:focus-visible:ring-primary-lighter/70"
          >
            다른 리워드 보기 ({notInCart.length})
          </button>
        )}
        {notInCart.length > 0 && listOpen && (
          <div className={lines.length > 0 ? 'mt-4' : ''}>
            {lines.length > 0 && (
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="typo-card-meta">다른 리워드</p>
                <button
                  type="button"
                  onClick={() => setShowAllRewards(false)}
                  aria-expanded
                  className="inline-flex min-h-[44px] items-center text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:text-gray-300 dark:hover:text-white dark:focus-visible:ring-primary-lighter/70"
                >
                  접기
                </button>
              </div>
            )}
            <ul className="space-y-2">
              {notInCart.map((r) => renderRewardRow(r))}
            </ul>
          </div>
        )}
        <div className="mt-5">
          <Field id={`${uid}-add`} label="추가 펀딩 금액" hint={`선택 항목입니다. 1,000원 단위로 최대 ${formatPriceAmount(MAX_ADDITIONAL_AMOUNT)}원까지 올릴 수 있습니다.`}>
            <TextInput type="number" inputMode="numeric" min={0} max={MAX_ADDITIONAL_AMOUNT} step={ADDITIONAL_AMOUNT_STEP} value={additionalText}
              onChange={(e) => setAdditionalText(e.target.value)}
              onKeyDown={handleNumericEnter}
              onBlur={() => setAdditionalText(String(clampAdditional(additionalText)))} />
          </Field>
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
          <div className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">배송지</p>
            <p className={helpClass}>담은 리워드에 배송 리워드가 있습니다. 한 번에 보내 드립니다.</p>
            <label className="mt-4 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className={radioClass}
                checked={shipToOther}
                onChange={(e) => {
                  setShipToOther(e.target.checked);
                  if (!e.target.checked) setShip((prev) => ({ ...prev, name: '', phone: '' }));
                }}
              />
              <span className="typo-card-meta text-gray-900 dark:text-white">후원자가 아닌 다른 분이 받습니다</span>
            </label>
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
                  <Button type="button" variant="outline" onClick={() => setAddressSearchOpen((open) => !open)} aria-expanded={addressSearchOpen}>
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
          </div>
        )}

        {/*
          응원 메시지와 명단 공개를 **한 덩어리**로 둔다. 예전에는 공개 체크가 메시지 칸 아래
          떨어진 회색 한 줄이라, 메시지를 써 놓고도 체크를 못 보고 지나가 메시지가 아무 데도
          안 뜨는 일이 잦았다(2026-09-25 운영 확인).

          2026-09-28부터 메시지는 이름과 **따로** 간다 — 이름을 표시하지 않으면 메시지가 "익명"으로
          올라간다(FUNDING_TERMS_VERSION 판본 이후 후원만, 약관 제13조 2항). 이름 없는 메시지는
          누구의 것인지 알 수 없어 동의 체크를 받지 않고 칸 바로 아래에서 알린다 — 쓰는 행위가
          곧 선택이다. 동의가 필요한 것은 **이름 표시** 하나만 남았고, 그 체크는 여전히 미리
          켜 두지 않는다(선택 항목 동의를 기본 체크로 받으면 적법한 동의로 보기 어렵다).

          테두리 박스는 두르지 않는다 — 필수 약관 동의처럼 보이면 안 된다(토스 위젯의 [필수]
          체크와 나란히 셋이 비슷해 보였던 이유). 옅은 바탕의 "선택" 구획으로 구분한다.
        */}
        <div className="mt-5 rounded-xl bg-gray-50/70 p-4 dark:bg-gray-800/40">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            응원 메시지 · 후원자 명단 <span className="font-normal text-gray-500 dark:text-gray-400">(선택)</span>
          </p>
          <p className={helpClass}>남겨 주신 메시지는 프로젝트 페이지 후원자 명단에 올라갑니다. 이름을 표시하지 않으면 &ldquo;{ANONYMOUS_LABEL}&rdquo;으로 보입니다.</p>
          <div className="mt-3">
            <Field id={`${uid}-msg`} label="응원 메시지">
              <TextArea rows={3} className="min-h-0" maxLength={PLEDGE_TEXT_LIMITS.supporterMessage} value={form.supporterMessage} onChange={(e) => setForm({ ...form, supporterMessage: e.target.value })} />
            </Field>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input type="checkbox" className={radioClass} checked={form.displayNamePublic} onChange={(e) => setForm({ ...form, displayNamePublic: e.target.checked })} />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              후원자 명단에 이름 표시
              <span className="mt-0.5 block font-normal text-gray-600 dark:text-gray-300">실명 대신 가린 이름이나 닉네임도 고를 수 있습니다.</span>
            </span>
          </label>

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
        </div>
      </fieldset>

      {/* 결제수단과 결제 약관 동의는 **위젯이 그린다.** 우리 목록을 따로 두지 않는다 —
          계약된 수단이 늘면 그대로 따라오고, 갈라지면 화면과 실제가 어긋난다. */}
      <fieldset className={cardClass} aria-labelledby={`${uid}-step-pay`}>
        <StepHeader id={`${uid}-step-pay`} n={3} title="결제수단" hint="고르신 수단으로 바로 결제창이 열립니다." />
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

      {/*
        결제 요약은 **흐름 안의 카드**로 둔다. 예전엔 요약 전체를 바닥에 붙였는데, 담은 줄이
        늘면 그 덩어리가 화면 절반을 덮었고 모달에서는 폼 위로 떠 겹쳐 모달만 따로 끄는 설정을
        뒀다 — 같은 폼이 진입 경로에 따라 버튼 위치가 달랐다. 이제 바닥에는 버튼 바만 둔다.
      */}
      <section className={cardClass} aria-labelledby={`${uid}-summary`}>
        <h2 id={`${uid}-summary`} className="typo-card-subtitle text-gray-900 dark:text-white">결제 요약</h2>
        <dl className="mt-3 space-y-1.5">
          {lines.length === 0 ? (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="typo-card-meta">담은 리워드</dt>
              <dd className="text-sm text-gray-500 dark:text-gray-400">아직 없습니다</dd>
            </div>
          ) : (
            lines.map((l) => (
              <div key={l.reward.id} className="flex items-baseline justify-between gap-4">
                <dt className="typo-card-meta min-w-0 truncate">{l.reward.title} × {l.quantity}</dt>
                <dd className="shrink-0 text-sm font-medium tabular-nums text-gray-900 dark:text-white">{formatPriceAmount(l.reward.amount * l.quantity)}원</dd>
              </div>
            ))
          )}
          {additional > 0 && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="typo-card-meta">추가 펀딩</dt>
              <dd className="shrink-0 text-sm font-medium tabular-nums text-gray-900 dark:text-white">{formatPriceAmount(additional)}원</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-gray-200 pt-2 dark:border-gray-700">
            <dt className="text-sm font-semibold text-gray-900 dark:text-white">예상 합계</dt>
            <dd className="text-lg font-bold text-gray-900 dark:text-white">{formatPriceAmount(preview.totalAmount)}원</dd>
          </div>
        </dl>
        <p className={helpClass}>VAT 포함. 실제 청구액은 서버가 확정합니다.</p>
      </section>

      {/*
        결제 버튼 바 — **어디서든 바닥에 고정**(모바일 주 버튼 통일 규칙). 약관 고지는 버튼과
        떨어지면 안 되므로(아래 주석) 바 안에 함께 둔다. 모달 상세 단계의 고정 바
        (RewardModal)와 같은 모양·같은 "금액 · 동작" 문구다.
      */}
      <div
        className={layout === 'modal'
          ? 'sticky bottom-0 z-10 -mx-5 -mb-5 border-t border-gray-200 bg-gray-50 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-6 sm:-mb-6 sm:px-6 dark:border-gray-700 dark:bg-gray-900'
          : 'sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:rounded-t-2xl sm:border-x sm:px-6 dark:border-gray-700 dark:bg-gray-900/95'}
      >
        {allSoldOut && (
          <p role="status" className="mb-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200">{ALL_SOLD_OUT_MESSAGE}</p>
        )}
        {error && (
          <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</p>
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
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          결제하기를 누르면{' '}
          <Link href="/ko/funding/terms" target="_blank" className="underline">펀딩 약관(청약철회·환불)</Link>과{' '}
          <Link href="/ko/privacy-policy" target="_blank" className="underline">개인정보 처리방침</Link>에 동의하는 것으로 봅니다.
        </p>

        {/* 위젯이 아직 안 떴으면 누를 수 없다 — 누르면 주문만 만들어지고 결제창은 안 열린다. */}
        <Button type="submit" size="lg" fullWidth className="mt-3" disabled={submitting || allSoldOut || lines.length === 0 || !paymentReady}>
          {submitting ? '처리 중…' : lines.length === 0 ? '리워드를 담아 주세요' : `${formatPriceAmount(preview.totalAmount)}원 · 결제하기`}
        </Button>
      </div>
    </form>
  );
}
