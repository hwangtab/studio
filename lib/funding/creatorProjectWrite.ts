import { and, count, eq, ne } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingProjects, fundingRewards, type FundingRewardRow } from '../../db/schema';
import { getFundingProject } from './projects';
import { canCreatorEdit } from './reviewTransition';
import { CREATOR_LIMITS, type BasicSection, type CreatorSection, type RewardInput, type StorySection } from './creatorValidation';
import { stripTrustedDirectives } from './creatorContent';

export type WriteResult =
  | { ok: true }
  | { ok: false; code: 'not_found' | 'locked' | 'not_editable' | 'duplicate_slug' | 'too_many'; message: string };

const deny = (code: Exclude<WriteResult, { ok: true }>['code'], message: string): WriteResult => ({ ok: false, code, message });

export interface CreatorProjectDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  coverUrl: string;
  goalAmount: number;
  startAt: Date;
  endAt: Date;
  reviewStatus: string;
  status: string;
  reviewNote: string | null;
  creator: {
    name: string;
    contactName: string | null;
    phone: string | null;
    bio: string | null;
    links: string[] | null;
  };
  rewards: FundingRewardRow[];
}

/**
 * 소유·편집 가능 여부를 한 번에 본다.
 *
 * **모든 쓰기 함수가 이것을 먼저 부른다.** 함수마다 조건을 다시 쓰면 언젠가 한 곳이
 * 빠지고, 그 하나가 남의 프로젝트를 여는 문이 된다. 남의 것이면 'not_found'다 —
 * '권한 없음'이라고 답하면 그 id가 존재한다는 사실을 알려 주는 셈이다.
 */
const guard = async (creatorId: string, projectId: string) => {
  const [row] = await getDb().select().from(fundingProjects)
    .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.creatorId, creatorId))).limit(1);
  if (!row) return { row: null, denial: deny('not_found', '프로젝트를 찾을 수 없습니다.') };
  if (!canCreatorEdit(row.reviewStatus)) {
    return { row, denial: deny('not_editable', '심사 중이거나 이미 판정이 난 프로젝트는 고칠 수 없습니다.') };
  }
  return { row, denial: null };
};

export const createDraftProject = async (creatorId: string): Promise<{ id: string }> => {
  const [row] = await getDb().insert(fundingProjects).values({
    creatorId,
    // slug는 유니크 제약이 있어 빈 문자열로 여러 초안을 만들 수 없다 — 행 id를 임시 주소로 쓴다.
    // 개설자가 기본 정보 구획을 저장하는 순간 진짜 slug로 덮인다(saveBasicSection).
    slug: `draft-${crypto.randomUUID()}`,
    title: '',
    summary: '',
    content: '',
    coverUrl: '',
    goalAmount: CREATOR_LIMITS.goalMin,
    startAt: new Date(),
    endAt: new Date(),
  }).returning({ id: fundingProjects.id });
  return { id: row.id };
};

export const loadProjectForCreator = async (
  creatorId: string,
  projectId: string,
): Promise<CreatorProjectDetail | null> => {
  const [row] = await getDb().select().from(fundingProjects)
    .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.creatorId, creatorId))).limit(1);
  if (!row) return null;

  const [creator] = await getDb().select().from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
  const rewards = await getDb().select().from(fundingRewards).where(eq(fundingRewards.projectId, projectId));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    coverUrl: row.coverUrl,
    goalAmount: row.goalAmount,
    startAt: row.startAt,
    endAt: row.endAt,
    reviewStatus: row.reviewStatus,
    status: row.status,
    reviewNote: row.reviewNote,
    creator: {
      name: creator?.name ?? '',
      contactName: creator?.contactName ?? null,
      phone: creator?.phone ?? null,
      bio: creator?.bio ?? null,
      links: creator?.links ? (JSON.parse(creator.links) as string[]) : null,
    },
    rewards,
  };
};

export const saveBasicSection = async (creatorId: string, projectId: string, value: BasicSection): Promise<WriteResult> => {
  const { row, denial } = await guard(creatorId, projectId);
  if (denial) return denial;

  // 파일 프로젝트가 이긴다(lib/funding/repository.ts). 파일과 같은 slug로 승인되면
  // 그 DB 프로젝트는 어떤 주소로도 열리지 않는다 — 여기서 막는 편이 훨씬 싸다.
  if (getFundingProject(value.slug)) return deny('duplicate_slug', '이미 쓰이고 있는 주소입니다. 다른 주소를 적어 주세요.');

  const [taken] = await getDb().select({ id: fundingProjects.id }).from(fundingProjects)
    .where(and(eq(fundingProjects.slug, value.slug), ne(fundingProjects.id, projectId))).limit(1);
  if (taken) return deny('duplicate_slug', '이미 쓰이고 있는 주소입니다. 다른 주소를 적어 주세요.');

  await getDb().update(fundingProjects).set({
    title: value.title, summary: value.summary, slug: value.slug,
    goalAmount: value.goalAmount, startAt: value.startAt, endAt: value.endAt,
    coverUrl: value.coverUrl, updatedAt: new Date(),
  }).where(eq(fundingProjects.id, row!.id));
  return { ok: true };
};

export const saveStorySection = async (creatorId: string, projectId: string, value: StorySection): Promise<WriteResult> => {
  const { row, denial } = await guard(creatorId, projectId);
  if (denial) return denial;
  // 렌더 시점이 아니라 저장 시점에 벗긴다 — 렌더 경로가 여럿(상세·미리보기·OG·llms)이라
  // 한 곳을 빠뜨리면 그 경로로만 새어 나간다. 저장된 값 자체를 깨끗하게 둔다.
  await getDb().update(fundingProjects)
    .set({ content: stripTrustedDirectives(value.content), updatedAt: new Date() })
    .where(eq(fundingProjects.id, row!.id));
  return { ok: true };
};

export const saveCreatorSection = async (creatorId: string, projectId: string, value: CreatorSection): Promise<WriteResult> => {
  const { denial } = await guard(creatorId, projectId);
  if (denial) return denial;

  // 개설자 프로필은 프로젝트가 아니라 계정(fundingCreators) 소속이다 — 같은 개설자의
  // 다른 프로젝트에도 그대로 반영된다. guard가 이미 이 프로젝트가 creatorId 소유임을
  // 확인했으므로 여기서 다시 소유를 묻지 않는다.
  await getDb().update(fundingCreators).set({
    name: value.name,
    contactName: value.contactName,
    phone: value.phone,
    bio: value.bio,
    links: value.links ? JSON.stringify(value.links) : null,
    updatedAt: new Date(),
  }).where(eq(fundingCreators.id, creatorId));
  return { ok: true };
};

/**
 * 잠긴 리워드에서 바뀌면 안 되는 것.
 *
 * `rewardId`가 바뀌면 재고 집계 조건(`fp.reward_id = ?`)이 기존 후원을 세지 못해 한정
 * 100개짜리가 200개 팔린다. `amount`가 바뀌면 DB의 단가와 화면·CSV·환불 금액이 어긋난다.
 * 한정 여부가 바뀌면 재고 계산 자체가 다른 길로 간다.
 *
 * 제목·설명·이미지·예상 전달 시기는 고칠 수 있다 — 오타 수정까지 막으면 운영이 안 된다.
 * 수량은 **늘리는 것만** 허용한다(재고 추가). 줄이면 이미 팔린 것보다 적어질 수 있다.
 */
const lockedViolation = (existing: FundingRewardRow, next: RewardInput): string | null => {
  if (!existing.lockedAt) return null;
  if (existing.amount !== next.amount) return '공개된 리워드의 금액은 바꿀 수 없습니다. 새 리워드를 추가해 주세요.';
  if ((existing.totalQuantity === null) !== (next.totalQuantity === null)) {
    return '공개된 리워드의 수량 제한 여부는 바꿀 수 없습니다.';
  }
  if (existing.totalQuantity !== null && next.totalQuantity !== null && next.totalQuantity < existing.totalQuantity) {
    return '수량은 늘릴 수만 있습니다.';
  }
  return null;
};

export const upsertReward = async (creatorId: string, projectId: string, value: RewardInput): Promise<WriteResult> => {
  const { denial } = await guard(creatorId, projectId);
  if (denial) return denial;

  const [existing] = await getDb().select().from(fundingRewards)
    .where(and(eq(fundingRewards.projectId, projectId), eq(fundingRewards.rewardId, value.rewardId))).limit(1);

  if (existing) {
    const violation = lockedViolation(existing, value);
    if (violation) return deny('locked', violation);

    await getDb().update(fundingRewards).set({
      title: value.title,
      description: value.description,
      amount: value.amount,
      totalQuantity: value.totalQuantity,
      requiresShipping: value.requiresShipping,
      estimatedDelivery: value.estimatedDelivery,
      imageUrl: value.imageUrl,
      updatedAt: new Date(),
    }).where(eq(fundingRewards.id, existing.id));
    return { ok: true };
  }

  const [{ value: existingCount }] = await getDb().select({ value: count() }).from(fundingRewards)
    .where(eq(fundingRewards.projectId, projectId));
  if (existingCount >= CREATOR_LIMITS.rewardsMax) {
    return deny('too_many', `리워드는 최대 ${CREATOR_LIMITS.rewardsMax}개까지 만들 수 있습니다.`);
  }

  await getDb().insert(fundingRewards).values({
    projectId,
    rewardId: value.rewardId,
    title: value.title,
    description: value.description,
    amount: value.amount,
    totalQuantity: value.totalQuantity,
    requiresShipping: value.requiresShipping,
    estimatedDelivery: value.estimatedDelivery,
    imageUrl: value.imageUrl,
  });
  return { ok: true };
};

export const deleteReward = async (creatorId: string, projectId: string, rewardId: string): Promise<WriteResult> => {
  const { denial } = await guard(creatorId, projectId);
  if (denial) return denial;

  const [existing] = await getDb().select().from(fundingRewards)
    .where(and(eq(fundingRewards.projectId, projectId), eq(fundingRewards.rewardId, rewardId))).limit(1);
  if (!existing) return deny('not_found', '리워드를 찾을 수 없습니다.');
  if (existing.lockedAt) return deny('locked', '공개된 리워드는 지울 수 없습니다.');

  await getDb().delete(fundingRewards).where(eq(fundingRewards.id, existing.id));
  return { ok: true };
};
