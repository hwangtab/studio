import { slugRejectionReason } from './reservedSlugs';

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
   * 개설자 한 명이 동시에 가질 수 있는 프로젝트(초안 포함) 수.
   *
   * 로그인이 "처음 보는 이메일이면 계정 자동 생성"이라 계정 자체가 사실상 무료다.
   * `creator_save:<creatorId>` 요청 제한(분당 30회)만으로는 한 계정으로 하루 최대
   * 4.3만 개 초안 행을 만들 수 있다 — 초안 생성 API가 이 값을 별도로 세어 막는다.
   */
  draftsMax: 10,
} as const;

type Fail = { ok: false; message: string };
const fail = (message: string): Fail => ({ ok: false, message });

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
    if (!v) return fail('리워드 이미지 주소를 확인해 주세요.');
    imageUrl = v;
  }

  return {
    ok: true,
    value: { rewardId, title, description, amount, totalQuantity, requiresShipping, estimatedDelivery, imageUrl },
  };
};
