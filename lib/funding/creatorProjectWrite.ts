import { and, count, eq, ne } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingProjects, fundingRewards, type FundingProjectRow, type FundingRewardRow } from '../../db/schema';
import { getFundingProject } from './projects';
import { canCreatorEditSection, type CreatorSectionName } from './reviewTransition';
import {
  CREATOR_LIMITS, isDefaultCreatorName, type BasicSection, type CreatorSection, type RewardInput, type StorySection,
} from './creatorValidation';
import { stripTrustedDirectives } from './creatorContent';
import { toKstDateString } from './creatorDateInput';

export type WriteResult =
  | { ok: true }
  | {
      ok: false;
      code: 'not_found' | 'locked' | 'not_editable' | 'duplicate_slug' | 'too_many' | 'duplicate_reward';
      message: string;
    };

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
    /**
     * 심사 신청(`submit.ts`)이 `isDefaultCreatorName` 판정에 쓰려고만 필요하다 — 서버
     * 안에서만 돌아야 한다. 화면 props로 흘리지 않는다(`toEditorProject`가 이 필드를
     * 고르지 않는다. `tests/pages/funding/creator/edit.test.ts`가 누수를 고정한다).
     */
    email: string;
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
 *
 * `section`은 구획별로 다르다 — 승인 뒤에는 basic·story만 열리고 rewards는 통째로
 * 닫힌다(`reviewTransition.ts`의 `EDITABLE_SECTIONS`). 호출부마다 자신의 구획을 넘긴다.
 */
const guard = async (creatorId: string, projectId: string, section: CreatorSectionName) => {
  const [row] = await getDb().select().from(fundingProjects)
    .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.creatorId, creatorId))).limit(1);
  if (!row) return { row: null, denial: deny('not_found', '프로젝트를 찾을 수 없습니다.') };
  if (!canCreatorEditSection(row.reviewStatus, section)) {
    return { row, denial: deny('not_editable', '지금 상태에서는 이 항목을 고칠 수 없습니다.') };
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
  // sortOrder로 정렬한다 — ORDER BY 없이는 순서가 sqlite의 내부 저장 순서에 좌우돼,
  // 리워드를 지웠다 다시 만들면 화면의 카드 순서가 예고 없이 바뀔 수 있다(2026-09-17
  // 리뷰 지적). 순서를 바꾸는 쓰기 경로(mode: 'reorder')는 아직 없어 sortOrder는 지금
  // 전부 0(삽입 기본값)이지만, 그 경로가 생기면 이 조회가 바로 반영한다.
  const rewards = await getDb().select().from(fundingRewards)
    .where(eq(fundingRewards.projectId, projectId))
    .orderBy(fundingRewards.sortOrder);

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
      email: creator?.email ?? '',
      contactName: creator?.contactName ?? null,
      phone: creator?.phone ?? null,
      bio: creator?.bio ?? null,
      links: creator?.links ? (JSON.parse(creator.links) as string[]) : null,
    },
    rewards,
  };
};

/**
 * 승인된 프로젝트의 기본정보에서 바뀌면 안 되는 것.
 *
 * 구획 자체는 열려 있다(제목·요약·표지를 고칠 수 있어야 한다 — 잘못 올라간 표지가 영영
 * 남는 것을 막는다). 하지만 아래 셋은 후원자와의 약속이거나 이미 공개된 주소다.
 */
const basicLockedViolation = (
  existing: FundingProjectRow,
  next: BasicSection,
): string | null => {
  if (existing.reviewStatus !== 'approved') return null;
  if (existing.slug !== next.slug) {
    return '공개된 프로젝트의 주소는 바꿀 수 없습니다. 후원자가 후원 확인 페이지에서 이 주소로 프로젝트를 찾습니다.';
  }
  if (existing.goalAmount !== next.goalAmount) return '공개된 프로젝트의 목표 금액은 바꿀 수 없습니다.';
  if (existing.startAt.getTime() !== next.startAt.getTime()
    || existing.endAt.getTime() !== next.endAt.getTime()) {
    return '공개된 프로젝트의 모금 기간은 바꿀 수 없습니다.';
  }
  return null;
};

export const saveBasicSection = async (creatorId: string, projectId: string, value: BasicSection): Promise<WriteResult> => {
  const { row, denial } = await guard(creatorId, projectId, 'basic');
  if (denial) return denial;

  const locked = basicLockedViolation(row!, value);
  if (locked) return deny('locked', locked);

  // 파일 프로젝트가 이긴다(lib/funding/repository.ts). 파일과 같은 slug로 승인되면
  // 그 DB 프로젝트는 어떤 주소로도 열리지 않는다 — 여기서 막는 편이 훨씬 싸다.
  if (getFundingProject(value.slug)) return deny('duplicate_slug', '이미 쓰이고 있는 주소입니다. 다른 주소를 적어 주세요.');

  const [taken] = await getDb().select({ id: fundingProjects.id }).from(fundingProjects)
    .where(and(eq(fundingProjects.slug, value.slug), ne(fundingProjects.id, projectId))).limit(1);
  if (taken) return deny('duplicate_slug', '이미 쓰이고 있는 주소입니다. 다른 주소를 적어 주세요.');

  const now = new Date();
  // 승인된 뒤의 저장만 찍는다. updated_at으로는 알 수 없다 — 관리자 쓰기도 그 값을
  // 갱신하므로 운영자가 메모만 달아도 "개설자가 고쳤다"로 보인다.
  // 같은 조건에서 사이트맵 lastmod도 함께 찍는다 — 공개 필드(제목·요약·표지 등)가
  // 실제로 바뀌는 시점이 정확히 여기다.
  const editedAt = row!.reviewStatus === 'approved' ? { creatorEditedAt: now, lastmod: toKstDateString(now) } : {};

  await getDb().update(fundingProjects).set({
    title: value.title, summary: value.summary, slug: value.slug,
    goalAmount: value.goalAmount, startAt: value.startAt, endAt: value.endAt,
    coverUrl: value.coverUrl, updatedAt: now, ...editedAt,
  }).where(eq(fundingProjects.id, row!.id));
  return { ok: true };
};

export const saveStorySection = async (creatorId: string, projectId: string, value: StorySection): Promise<WriteResult> => {
  const { row, denial } = await guard(creatorId, projectId, 'story');
  if (denial) return denial;

  const now = new Date();
  const editedAt = row!.reviewStatus === 'approved' ? { creatorEditedAt: now, lastmod: toKstDateString(now) } : {};

  // 렌더 시점이 아니라 저장 시점에 벗긴다 — 렌더 경로가 여럿(상세·미리보기·OG·llms)이라
  // 한 곳을 빠뜨리면 그 경로로만 새어 나간다. 저장된 값 자체를 깨끗하게 둔다.
  await getDb().update(fundingProjects)
    .set({ content: stripTrustedDirectives(value.content), updatedAt: now, ...editedAt })
    .where(eq(fundingProjects.id, row!.id));
  return { ok: true };
};

/**
 * 개설자 프로필(소개·연락처·링크)은 프로젝트가 아니라 **계정**(fundingCreators) 소속이다.
 *
 * `guard(creatorId, projectId)`를 타지 않는다 — 프로필은 그 개설자의 모든 프로젝트에
 * 공유되므로, 아무 프로젝트 하나(초안이든 뭐든)의 편집 가능 여부로 막는 것 자체가 잘못된
 * 조건이다. 개설자가 승인된 프로젝트 A와 초안 B를 함께 갖고 있을 때 B를 편집 중이라는
 * 이유로 A에서도 보이는 프로필을 심사 없이 바꿀 수 있으면 안 되는데, projectId를 받아
 * guard를 태우면 정확히 그 구멍이 생긴다.
 *
 * "프로필 변경이 이미 공개된 프로젝트 화면에 그대로 반영되는 것을 심사로 막을지"는 3차
 * (관리자 심사)에서 정했다: **이름만 잠근다.** Task 10이 공개 상세의 판매자 표시 옆에
 * `creator.name`을 그리기 시작하면서, 승인된 프로젝트를 가진 개설자가 이름을 아무
 * 문자열로 바꾸면 ISR 60초 안에 공개 페이지에 그대로 뜨게 됐다(심사도 알림도 없이). 그래서
 * 그 개설자에게 `approved` 프로젝트가 하나라도 있으면 이름 변경만 거부한다. `bio`·연락처·
 * `links`는 공개 화면에 실리지 않으므로 계속 자유롭게 고칠 수 있다. 새 컬럼 없이
 * `funding_projects`를 그때그때 조회해 판정한다.
 *
 * **예외: 지금 이름이 가입 시 채워진 기본값(이메일 로컬파트)이면 잠그지 않는다.** 설정한
 * 적 없는 값을 잠그는 것은 잠금이 아니라 사고다(`isDefaultCreatorName` 주석 참조). 기존에
 * 이미 로컬파트 이름으로 남아 있던 행도 이 예외로 스스로 풀린다.
 */
/** `saveCreatorSection`의 이름 잠금 조건과 `isCreatorNameLocked`가 공유하는 조회 — 승인된 프로젝트가 하나라도 있는지. */
const hasApprovedProject = async (creatorId: string): Promise<boolean> => {
  const [approvedProject] = await getDb().select({ id: fundingProjects.id }).from(fundingProjects)
    .where(and(eq(fundingProjects.creatorId, creatorId), eq(fundingProjects.reviewStatus, 'approved'))).limit(1);
  return Boolean(approvedProject);
};

/**
 * 지금 이 개설자의 이름이 잠겨 있는지 — 편집 화면이 이름 칸을 비활성화하고 이유를
 * 보여줄지 판단하는 힌트다. 판정 조건은 `saveCreatorSection`이 실제로 거부하는 조건과
 * 정확히 같아야 한다(`hasApprovedProject`를 함께 쓰는 이유) — 둘이 갈리면 화면은 열려
 * 있는데 저장은 막히거나, 화면은 잠겨 있는데 저장은 되는 모순이 생긴다.
 *
 * **이 힌트는 집행자가 아니다.** 서버는 여전히 `saveCreatorSection`이 유일하게 막는다 —
 * 이 함수는 편집 화면 로드 시점에 한 번만 불러 안내 문구를 미리 보여주는 용도다.
 */
export const isCreatorNameLocked = async (creatorId: string): Promise<boolean> => {
  const [existing] = await getDb().select({ name: fundingCreators.name, email: fundingCreators.email })
    .from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
  if (!existing) return false;
  if (isDefaultCreatorName(existing.name, existing.email)) return false;
  return hasApprovedProject(creatorId);
};

export const saveCreatorSection = async (creatorId: string, value: CreatorSection): Promise<WriteResult> => {
  const [existing] = await getDb().select({ id: fundingCreators.id, name: fundingCreators.name, email: fundingCreators.email })
    .from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
  if (!existing) return deny('not_found', '개설자 계정을 찾을 수 없습니다.');

  if (value.name !== existing.name && !isDefaultCreatorName(existing.name, existing.email)) {
    if (await hasApprovedProject(creatorId)) {
      return deny('locked', '승인된 프로젝트가 있어 이름은 더 이상 바꿀 수 없습니다. 소개·연락처·링크는 계속 고칠 수 있습니다.');
    }
  }

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
 * 한정 여부가 바뀌면 재고 계산 자체가 다른 길로 간다. `requiresShipping`이 바뀌면 이미
 * 결제를 마친 후원자에게 사후로 배송지 제출 의무가 생기거나(반대로 배송 준비 중인 리워드가
 * 갑자기 배송 불필요로 바뀌거나) 하는 이행 조건 변경이 된다.
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
  if (existing.requiresShipping !== next.requiresShipping) return '공개된 리워드의 배송 여부는 바꿀 수 없습니다.';
  return null;
};

export const upsertReward = async (
  creatorId: string,
  projectId: string,
  value: RewardInput,
  previousRewardId?: string,
): Promise<WriteResult> => {
  const { denial } = await guard(creatorId, projectId, 'rewards');
  if (denial) return denial;

  // 개명 경로. rewardId로만 기존 행을 찾으면 id를 바꿔 제출한 입력이 "없는 리워드"로
  // 보여 lockedViolation을 타지 않고 새 행이 insert된다 — 재고는 안 깨지지만(옛 행과 그
  // 후원이 그대로 남아서) 공개 화면에는 티어가 하나 더 생기고, 옛 id는 고칠 방법이 없어진다.
  if (previousRewardId !== undefined && previousRewardId !== value.rewardId) {
    const [previous] = await getDb().select().from(fundingRewards)
      .where(and(eq(fundingRewards.projectId, projectId), eq(fundingRewards.rewardId, previousRewardId))).limit(1);
    if (!previous) return deny('not_found', '리워드를 찾을 수 없습니다.');
    if (previous.lockedAt) {
      return deny('locked', '공개된 리워드의 주소는 바꿀 수 없습니다. 새 리워드를 추가해 주세요.');
    }

    const [taken] = await getDb().select({ id: fundingRewards.id }).from(fundingRewards)
      .where(and(eq(fundingRewards.projectId, projectId), eq(fundingRewards.rewardId, value.rewardId))).limit(1);
    if (taken) return deny('duplicate_reward', '이미 쓰고 있는 리워드 주소입니다.');

    await getDb().update(fundingRewards).set({
      rewardId: value.rewardId,
      title: value.title,
      description: value.description,
      amount: value.amount,
      totalQuantity: value.totalQuantity,
      requiresShipping: value.requiresShipping,
      estimatedDelivery: value.estimatedDelivery,
      imageUrl: value.imageUrl,
      updatedAt: new Date(),
    }).where(eq(fundingRewards.id, previous.id));
    return { ok: true };
  }

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
  const { denial } = await guard(creatorId, projectId, 'rewards');
  if (denial) return denial;

  const [existing] = await getDb().select().from(fundingRewards)
    .where(and(eq(fundingRewards.projectId, projectId), eq(fundingRewards.rewardId, rewardId))).limit(1);
  if (!existing) return deny('not_found', '리워드를 찾을 수 없습니다.');
  if (existing.lockedAt) return deny('locked', '공개된 리워드는 지울 수 없습니다.');

  await getDb().delete(fundingRewards).where(eq(fundingRewards.id, existing.id));
  return { ok: true };
};
