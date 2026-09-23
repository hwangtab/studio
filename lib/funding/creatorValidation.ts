import { FUNDING_MEDIA_URL_PREFIX } from './mediaPath';
import { slugRejectionReason } from './reservedSlugs';

/**
 * coverUrl·리워드 imageUrl이 실제로 우리 업로드 경로에서 온 것인지 본다.
 *
 * 화면은 항상 업로드 API가 돌려준 주소만 이 필드에 넣지만, 서버는 그것을 강제할 수
 * 없다 — 클라이언트가 보낸 문자열이면 무엇이든 여기까지 온다. 두 필드 모두 `next/image`로
 * 흘러가는데, `next.config.mjs`의 `remotePatterns`에 없는 외부 호스트를 넣으면 렌더
 * 중간에 throw한다. 오늘은 개설자 본인의 미리보기가 죽고, 승인 뒤에는 그 상세 페이지와
 * `/ko/funding` 목록 페이지 전체가 ISR 렌더에서 함께 죽는다 — 다른 프로젝트까지 끌고
 * 들어간다. 쓰기 경로가 생기는 이 계획에서 가드도 함께 넣는다 — 나중에 붙이면 그 사이에
 * 만들어진 데이터가 규칙 밖에 남는다.
 */
const isOwnUploadedMedia = (value: string): boolean => value.startsWith(FUNDING_MEDIA_URL_PREFIX);

export const CREATOR_LIMITS = {
  titleMax: 60,
  summaryMax: 120,
  contentMax: 100_000,
  rewardTitleMax: 60,
  rewardDescriptionMax: 1_000,
  rewardsMax: 20,
  goalMin: 100_000,
  goalMax: 100_000_000,
  amountMin: 1_000,
  amountMax: 20_000_000,
  amountStep: 1_000,
  /** 심사에 쓸 시간. 시작일은 오늘 + 이 일수 뒤부터 고를 수 있다. */
  leadDays: 3,
  /** 모금 기간 상한. 길수록 이행 약속과 현실이 멀어진다. */
  maxDurationDays: 60,
  bioMax: 600,
  linksMax: 5,
  nameMax: 40,
  contactNameMax: 40,
  phoneMax: 40,
  rewardIdMax: 40,
  estimatedDeliveryMax: 40,
  /**
   * 정산 정보. 은행 목록은 하드코딩하지 않는다 — 인터넷전문은행·증권사 CMA·조합까지
   * 계속 늘어나는 목록이라, 우리가 들고 있으면 새 은행을 쓰는 개설자가 등록 자체를
   * 못 한다. 형식만 보고 실제 계좌 유효성은 이체 시점에 운영자가 확인한다.
   */
  payoutBankNameMax: 30,
  payoutAccountMax: 30,
  payoutHolderMax: 40,
  /**
   * 개설자 한 명이 동시에 가질 수 있는 **미심사** 프로젝트(draft·submitted·
   * changes_requested) 수. `approved`·`rejected`는 세지 않는다 — 둘 다 운영자가
   * 사람 손으로 심사를 끝낸 행이라 스팸 벡터가 아니다. 이 이름·주석·실제로 세는
   * 조건(`pages/api/funding/creator/projects.ts`의 `UNREVIEWED_STATUSES`)은 항상
   * 같이 맞춰 둘 것 — 어긋나면 "펀딩을 여러 번 성공시킨 개설자가 다음 프로젝트를
   * 영영 못 만드는" 것 같은, 상한의 목적과 반대로 움직이는 버그가 조용히 생긴다.
   *
   * 로그인이 "처음 보는 이메일이면 계정 자동 생성"이라 계정 자체가 사실상 무료다.
   * `creator_save:<creatorId>` 요청 제한(분당 30회)만으로는 한 계정으로 하루 최대
   * 4.3만 개 미심사 행을 만들 수 있다 — 초안 생성 API가 이 값을 별도로 세어 막는다.
   */
  draftsMax: 10,
} as const;

type Fail = { ok: false; message: string };
const fail = (message: string): Fail => ({ ok: false, message });

/** 제출·승인이 함께 보는 본문 최소 길이. */
export const STORY_MIN_LENGTH = 200;

/**
 * "다 채워졌는가"를 묻는 공용 검사.
 *
 * 개설자 제출 API(`pages/api/funding/creator/projects/[id]/submit.ts`)와 운영자 승인
 * (`lib/funding/reviewDecision.ts`)이 같은 정의를 쓴다 — 각자 조건문을 새로 쓰면 "제출은
 * 통과했는데 승인 시점엔 불완전"으로 보이는 경우의 판정이 두 곳에서 갈라지고, 언젠가
 * 한쪽만 고쳐 기준이 어긋난다.
 *
 * `slug`는 선택 입력이다 — 승인 쪽은 slug를 별도 트랙(`slugRejectionReason` → 파일 충돌
 * → DB 충돌)으로 검사하므로, 넘기지 않으면 그 항목은 이 함수의 판정에서 빠진다.
 *
 * `creatorName`도 선택 입력이지만 지금은 제출·승인 둘 다 넘긴다(승인은 `reviewDecision.ts`가
 * `AdminProjectSummary`의 `creatorName`·`creatorEmail`을 그대로 넘긴다) — 넘기지 않을 때만
 * 이 항목이 판정에서 빠진다. `creatorEmail`을 함께 넘기면 이름이 가입 기본값(이메일
 * 로컬파트, `creatorToken.ts` 참조)인지까지 보고, 안 넘기면 빈 이름만 보는 옛 동작이 남는다.
 */
export interface RequiredSectionsInput {
  title: string;
  summary: string;
  slug?: string;
  coverUrl: string;
  content: string;
  rewardsCount: number;
  creatorName?: string;
  /** 넘기면 이름이 가입 기본값(이메일 로컬파트)인지까지 본다. 안 넘기면 빈 이름만 본다. */
  creatorEmail?: string;
}

/**
 * 가입 시 채워 넣는 이메일 로컬파트(`creatorToken.ts`의 `name: normalized.split('@')[0]`)는
 * "개설자가 고른 이름"이 아니다. 이름 칸이 비어 있지 않아 미설정을 감지할 수 없었고,
 * 3차가 그 값을 공개 상세의 판매자 표시 옆에 그리면서(그리고 승인 뒤 잠그면서) 문제가 됐다.
 *
 * 로컬파트와 같은 글자를 일부러 고른 개설자는 기본값으로 오판되지만, 결과는 "이름을 한 번
 * 더 저장해야 하고 잠기지 않는다"라 안전한 방향이다. 반대 방향(설정 안 한 이름이 공개되고
 * 잠기는 것)이 실제로 난 사고다.
 */
export const isDefaultCreatorName = (name: string, email: string): boolean =>
  name.trim() === email.split('@')[0];

export const findMissingRequiredSections = (input: RequiredSectionsInput): string[] => {
  const missing: string[] = [];
  const basicFilled = Boolean(input.title) && Boolean(input.summary) && Boolean(input.coverUrl)
    && (input.slug === undefined || Boolean(input.slug));
  if (!basicFilled) missing.push('기본정보');
  if (input.content.trim().length < STORY_MIN_LENGTH) missing.push(`스토리(본문 ${STORY_MIN_LENGTH}자 이상)`);
  if (input.rewardsCount < 1) missing.push('리워드(최소 1개)');
  if (input.creatorName !== undefined) {
    const unset = !input.creatorName
      || (input.creatorEmail !== undefined && isDefaultCreatorName(input.creatorName, input.creatorEmail));
    if (unset) missing.push('개설자 정보(이름)');
  }
  return missing;
};

const str = (v: unknown): string | null => (typeof v === 'string' ? v.trim() : null);

/** http(s)만. 개설자가 넣는 링크라 스킴을 좁게 잡는다. */
export const isSafeCreatorLink = (value: string): boolean => /^https?:\/\/[^\s]+$/i.test(value);

export interface BasicSection {
  title: string; summary: string; slug: string; goalAmount: number;
  startAt: Date; endAt: Date; coverUrl: string;
}

export const validateBasicSection = (
  input: unknown,
  now: Date,
): { ok: true; value: BasicSection } | Fail => {
  const d = (input ?? {}) as Record<string, unknown>;
  const title = str(d.title);
  if (!title || title.length > CREATOR_LIMITS.titleMax) return fail(`제목은 1~${CREATOR_LIMITS.titleMax}자로 적어 주세요.`);
  const summary = str(d.summary);
  if (!summary || summary.length > CREATOR_LIMITS.summaryMax) return fail(`한 줄 요약은 1~${CREATOR_LIMITS.summaryMax}자로 적어 주세요.`);

  const slugRaw = str(d.slug) ?? '';
  const slugReason = slugRejectionReason(slugRaw);
  if (slugReason) return fail(slugReason);

  const goalAmount = typeof d.goalAmount === 'number' ? d.goalAmount : NaN;
  if (!Number.isInteger(goalAmount) || goalAmount < CREATOR_LIMITS.goalMin || goalAmount > CREATOR_LIMITS.goalMax) {
    return fail('목표 금액을 확인해 주세요.');
  }
  if (goalAmount % 10_000 !== 0) return fail('목표 금액은 만원 단위로 적어 주세요.');

  const coverUrl = str(d.coverUrl);
  if (!coverUrl) return fail('대표 이미지를 올려 주세요.');
  if (!isOwnUploadedMedia(coverUrl)) return fail('대표 이미지를 다시 올려 주세요.');

  const startAt = new Date(str(d.startAt) ?? '');
  const endAt = new Date(str(d.endAt) ?? '');
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return fail('날짜를 확인해 주세요.');

  const earliest = new Date(now.getTime() + CREATOR_LIMITS.leadDays * 86_400_000);
  if (startAt.getTime() < earliest.getTime()) {
    return fail(`심사에 시간이 걸립니다. 시작일은 오늘부터 ${CREATOR_LIMITS.leadDays}일 뒤부터 고를 수 있습니다.`);
  }
  if (endAt.getTime() <= startAt.getTime()) return fail('종료일이 시작일보다 뒤여야 합니다.');
  if (endAt.getTime() - startAt.getTime() > CREATOR_LIMITS.maxDurationDays * 86_400_000) {
    return fail(`모금 기간은 최대 ${CREATOR_LIMITS.maxDurationDays}일입니다.`);
  }

  return { ok: true, value: { title, summary, slug: slugRaw.trim().toLowerCase(), goalAmount, startAt, endAt, coverUrl } };
};

export interface StorySection {
  content: string;
}

export const validateStorySection = (input: unknown): { ok: true; value: StorySection } | Fail => {
  const d = (input ?? {}) as Record<string, unknown>;
  if (typeof d.content !== 'string') return fail('본문을 확인해 주세요.');
  const content = d.content;
  if (content.length > CREATOR_LIMITS.contentMax) {
    return fail(`본문은 ${CREATOR_LIMITS.contentMax}자를 넘을 수 없습니다.`);
  }
  return { ok: true, value: { content } };
};

export interface CreatorSection {
  name: string;
  contactName: string | null;
  phone: string | null;
  bio: string | null;
  links: string[] | null;
}

export const validateCreatorSection = (input: unknown): { ok: true; value: CreatorSection } | Fail => {
  const d = (input ?? {}) as Record<string, unknown>;

  const name = str(d.name);
  if (!name || name.length > CREATOR_LIMITS.nameMax) {
    return fail(`개설자 이름은 1~${CREATOR_LIMITS.nameMax}자로 적어 주세요.`);
  }

  let contactName: string | null = null;
  if (d.contactName !== undefined && d.contactName !== null) {
    const v = str(d.contactName);
    if (!v || v.length > CREATOR_LIMITS.contactNameMax) {
      return fail(`담당자 이름은 ${CREATOR_LIMITS.contactNameMax}자 이하로 적어 주세요.`);
    }
    contactName = v;
  }

  let phone: string | null = null;
  if (d.phone !== undefined && d.phone !== null) {
    const v = str(d.phone);
    if (!v || v.length > CREATOR_LIMITS.phoneMax) {
      return fail(`연락처는 ${CREATOR_LIMITS.phoneMax}자 이하로 적어 주세요.`);
    }
    phone = v;
  }

  let bio: string | null = null;
  if (d.bio !== undefined && d.bio !== null) {
    const v = str(d.bio);
    if (v === null || v.length > CREATOR_LIMITS.bioMax) {
      return fail(`소개는 ${CREATOR_LIMITS.bioMax}자 이하로 적어 주세요.`);
    }
    bio = v;
  }

  let links: string[] | null = null;
  if (d.links !== undefined && d.links !== null) {
    if (!Array.isArray(d.links) || d.links.length > CREATOR_LIMITS.linksMax) {
      return fail(`링크는 최대 ${CREATOR_LIMITS.linksMax}개까지 넣을 수 있습니다.`);
    }
    const parsed: string[] = [];
    for (const raw of d.links) {
      const v = str(raw);
      if (!v || !isSafeCreatorLink(v)) return fail('링크는 http(s)로 시작하는 주소만 넣을 수 있습니다.');
      parsed.push(v);
    }
    links = parsed;
  }

  return { ok: true, value: { name, contactName, phone, bio, links } };
};

export interface PayoutSection {
  taxType: 'withholding' | 'invoice';
  bankName: string;
  account: string;
  holder: string;
}

/** 숫자와 하이픈만. 은행마다 자릿수·구분 위치가 달라 그 이상은 보지 않는다. */
const PAYOUT_ACCOUNT_PATTERN = /^[0-9-]+$/;

/**
 * 하이픈을 뺀 숫자 최소 자릿수.
 *
 * 패턴만으로는 `-`·`--`도 통과한다. 그러면 `loadPayoutSummary`의 `registered`와
 * `buildFundingPayoutPreview`의 `hasPayoutAccount`가 둘 다 true인데 뒤 4자리
 * (`accountLast4`)는 null이다 — 화면은 "등록됨", 정산은 기록까지 간다. 그 두 곳이 이미
 * 숫자 4자리를 암묵적으로 요구하고 있으므로 입력 시점에 같은 기준으로 막는다.
 */
const PAYOUT_ACCOUNT_MIN_DIGITS = 4;

/**
 * 정산 정보 검증 — **최소한만** 본다.
 *
 * 빈 값, 과도한 길이, 계좌번호에 숫자·하이픈 외 문자. 그 이상(은행명 대조, 실명 확인,
 * 계좌 유효성)은 여기서 판정할 수단이 없고, 틀린 판정은 정상 계좌를 막는 쪽으로 튄다.
 * 실제 확인은 이체 직전 운영자가 한다.
 */
export const validatePayoutSection = (input: unknown): { ok: true; value: PayoutSection } | Fail => {
  const d = (input ?? {}) as Record<string, unknown>;

  const taxType = d.taxType;
  if (taxType !== 'withholding' && taxType !== 'invoice') {
    return fail('세금 유형을 골라 주세요.');
  }

  const bankName = str(d.bankName);
  if (!bankName || bankName.length > CREATOR_LIMITS.payoutBankNameMax) {
    return fail(`은행명은 1~${CREATOR_LIMITS.payoutBankNameMax}자로 적어 주세요.`);
  }

  const account = str(d.account);
  if (!account || account.length > CREATOR_LIMITS.payoutAccountMax) {
    return fail(`계좌번호는 1~${CREATOR_LIMITS.payoutAccountMax}자로 적어 주세요.`);
  }
  if (!PAYOUT_ACCOUNT_PATTERN.test(account)) {
    return fail('계좌번호는 숫자와 하이픈(-)만 넣어 주세요.');
  }
  if (account.replace(/[^0-9]/g, '').length < PAYOUT_ACCOUNT_MIN_DIGITS) {
    return fail(`계좌번호에 숫자를 ${PAYOUT_ACCOUNT_MIN_DIGITS}자리 이상 넣어 주세요.`);
  }

  const holder = str(d.holder);
  if (!holder || holder.length > CREATOR_LIMITS.payoutHolderMax) {
    return fail(`예금주는 1~${CREATOR_LIMITS.payoutHolderMax}자로 적어 주세요.`);
  }

  return { ok: true, value: { taxType, bankName, account, holder } };
};

export interface RewardInput {
  rewardId: string;
  title: string;
  description: string;
  amount: number;
  totalQuantity: number | null;
  requiresShipping: boolean;
  estimatedDelivery: string;
  imageUrl: string | null;
}

const REWARD_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const validateRewardInput = (input: unknown): { ok: true; value: RewardInput } | Fail => {
  const d = (input ?? {}) as Record<string, unknown>;

  const rewardId = str(d.rewardId);
  if (!rewardId || rewardId.length > CREATOR_LIMITS.rewardIdMax || !REWARD_ID_PATTERN.test(rewardId)) {
    return fail('리워드 id는 영문 소문자·숫자·하이픈만 쓸 수 있습니다.');
  }

  const title = str(d.title);
  if (!title || title.length > CREATOR_LIMITS.rewardTitleMax) {
    return fail(`리워드 이름은 1~${CREATOR_LIMITS.rewardTitleMax}자로 적어 주세요.`);
  }

  const description = str(d.description);
  if (!description || description.length > CREATOR_LIMITS.rewardDescriptionMax) {
    return fail(`리워드 설명은 1~${CREATOR_LIMITS.rewardDescriptionMax}자로 적어 주세요.`);
  }

  const amount = typeof d.amount === 'number' ? d.amount : NaN;
  if (
    !Number.isInteger(amount) ||
    amount < CREATOR_LIMITS.amountMin ||
    amount > CREATOR_LIMITS.amountMax ||
    amount % CREATOR_LIMITS.amountStep !== 0
  ) {
    return fail(`리워드 금액은 ${CREATOR_LIMITS.amountStep}원 단위로, 범위 안에서 적어 주세요.`);
  }

  let totalQuantity: number | null = null;
  if (d.totalQuantity !== null && d.totalQuantity !== undefined) {
    const v = d.totalQuantity;
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
      return fail('한정 수량은 1 이상의 정수여야 합니다.');
    }
    totalQuantity = v;
  }

  const requiresShipping = d.requiresShipping === true;

  const estimatedDelivery = str(d.estimatedDelivery);
  if (!estimatedDelivery || estimatedDelivery.length > CREATOR_LIMITS.estimatedDeliveryMax) {
    return fail(`예상 전달 시기는 1~${CREATOR_LIMITS.estimatedDeliveryMax}자로 적어 주세요.`);
  }

  let imageUrl: string | null = null;
  if (d.imageUrl !== null && d.imageUrl !== undefined) {
    const v = str(d.imageUrl);
    if (!v || !isOwnUploadedMedia(v)) return fail('리워드 이미지를 다시 올려 주세요.');
    imageUrl = v;
  }

  return {
    ok: true,
    value: { rewardId, title, description, amount, totalQuantity, requiresShipping, estimatedDelivery, imageUrl },
  };
};
