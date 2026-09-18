import { and, eq, ne, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingProjects } from '../../db/schema';
import { loadProjectForAdmin } from './adminProjects';
import { findMissingRequiredSections } from './creatorValidation';
import { getFundingProject } from './projects';
import { nextReviewStatus, type ReviewAction } from './reviewTransition';
import { normalizeFundingSlug, slugRejectionReason } from './reservedSlugs';

/** 관리자 심사 화면이 실제로 실행하는 판정. `nextReviewStatus`의 전체 액션 중 이 셋만 쓴다. */
export type AdminReviewAction = Extract<ReviewAction, 'approve' | 'request_changes' | 'reject'>;

export type DecisionResult =
  | { ok: true; slug: string }
  | {
      ok: false;
      code: 'not_found' | 'conflict' | 'invalid_slug' | 'duplicate_slug' | 'incomplete';
      message: string;
    };

const deny = (code: Exclude<DecisionResult, { ok: true }>['code'], message: string): DecisionResult => ({
  ok: false,
  code,
  message,
});

/**
 * 심사 판정.
 *
 * 전이 판정은 `nextReviewStatus`가 정본이다 — 여기서 조건문을 새로 쓰면 개설자 API와
 * 표가 갈라지고, 그 틈으로 승인된 프로젝트가 되돌아가는 경로가 생긴다.
 *
 * **승인은 세 가지를 한 묶음으로 한다: slug 확정 · 리워드 `lockedAt` · `status` 열기.**
 * 하나라도 빠지면 조용히 잘못된다 — `lockedAt`이 없으면 2차에서 만든 잠금 가드가 전부
 * 무효이고(승인된 리워드의 금액을 바꿀 수 있다), `status`가 안 열리면 승인했는데 공개가
 * 안 되고, slug가 확정 안 되면 주소가 개설자 입력 그대로 남는다.
 */
export const decideProject = async (
  projectId: string,
  action: AdminReviewAction,
  input: { note?: string; slug?: string },
  now: Date = new Date(),
): Promise<DecisionResult> => {
  const project = await loadProjectForAdmin(projectId);
  if (!project) return deny('not_found', '프로젝트를 찾을 수 없습니다.');

  const next = nextReviewStatus(project.reviewStatus, action);
  if (!next) return deny('conflict', '지금 상태에서는 그 판정을 할 수 없습니다.');

  const note = input.note?.trim() || null;
  // 보완 요청은 무엇을 고쳐야 하는지 개설자에게 알려주는 것이 목적이라, 메모 없이는
  // 의미가 없다 — 빈 보완 요청은 개설자를 "왜 반려됐는지 모르는" 상태로 되돌려보낸다.
  if (action === 'request_changes' && !note) {
    return deny('incomplete', '보완 요청에는 안내 메모가 필요합니다.');
  }

  if (action !== 'approve') {
    // 반려·보완 요청 — status는 건드리지 않는다. 승인 전 프로젝트는 schema 주석대로
    // 항상 status='draft'이고, 반려·보완 요청은 그 불변식을 유지한 채 reviewStatus만 옮긴다.
    const result = await getDb()
      .update(fundingProjects)
      .set({
        reviewStatus: next,
        reviewNote: note,
        ...(action === 'reject' ? { rejectedAt: now } : {}),
        updatedAt: now,
      })
      .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.reviewStatus, project.reviewStatus)));

    if (Number(result.rowsAffected) === 0) {
      return deny('conflict', '그 사이 상태가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.');
    }
    return { ok: true, slug: project.slug };
  }

  // --- 승인 경로 ---

  // 슬러그 확정: 운영자가 새 값을 넣었으면 그것을, 아니면 개설자가 고른 기존 값을 쓴다.
  const slugRaw = input.slug?.trim() || project.slug;
  const slugReason = slugRejectionReason(slugRaw);
  if (slugReason) return deny('invalid_slug', slugReason);
  // slugRejectionReason이 통과시킨 형태 그대로 정규화한다(소문자·트림) — saveBasicSection과
  // 같은 정규화를 거치지 않으면 화면에 보이는 slug와 DB에 저장되는 slug가 대소문자만
  // 다른 채로 어긋날 수 있다.
  const slug = normalizeFundingSlug(slugRaw)!;

  // 파일이 이긴다(lib/funding/repository.ts) — 같은 slug로 승인하면 이 프로젝트는 어떤
  // 주소로도 열리지 않는다.
  if (getFundingProject(slug)) {
    return deny('duplicate_slug', '이미 사이트가 쓰고 있는 주소라 사용할 수 없습니다. 다른 주소를 적어 주세요.');
  }

  const [taken] = await getDb()
    .select({ id: fundingProjects.id })
    .from(fundingProjects)
    .where(and(eq(fundingProjects.slug, slug), ne(fundingProjects.id, projectId)))
    .limit(1);
  if (taken) return deny('duplicate_slug', '이미 쓰이고 있는 주소입니다. 다른 주소를 적어 주세요.');

  // 필수값 검사. 제출 시점엔 채워져 있었어도 제출과 승인 사이에 무엇이 바뀌었을 수 있다
  // (이 계획엔 승인된 뒤에만 편집을 막는 가드가 있지만, submitted 상태에서 다시 draft로
  // 돌아가는 withdraw 경로가 있어 재제출 흐름이 남아 있다 — 방어적으로 다시 본다).
  const missing = findMissingRequiredSections({
    title: project.title,
    summary: project.summary,
    coverUrl: project.coverUrl,
    content: project.content,
    rewardsCount: project.rewards.length,
  });
  if (missing.length > 0) {
    return deny('incomplete', `다음 항목이 비어 있어 승인할 수 없습니다: ${missing.join(', ')}`);
  }

  const db = getDb();
  const epoch = Math.floor(now.getTime() / 1000);

  /**
   * 프로젝트를 먼저 승인 상태로 옮기고, **그 다음** 리워드를 잠근다.
   *
   * `db.batch`는 실패 시 전부 롤백되지만, 프로젝트 UPDATE가 경합으로 0행이어도 리워드
   * UPDATE는 그 자체로 유효한 SQL이라 성공해 버린다 — 그러면 "잠겼는데 공개는 안 된"
   * 프로젝트가 남는다. 막는 방법은 리워드 UPDATE의 WHERE에도 "프로젝트가 이미
   * approved"라는 EXISTS 조건을 함께 거는 것이다. 프로젝트 UPDATE를 배치의 앞에 두면
   * 그 EXISTS는 (같은 트랜잭션 안에서) 방금 그 UPDATE가 반영한 값을 본다 — 프로젝트
   * UPDATE가 0행이었다면 review_status는 그대로 승인 전 값이므로 EXISTS가 거짓이 되어
   * 리워드도 함께 안 잠긴다.
   */
  const batchResult = await db.batch([
    db
      .update(fundingProjects)
      .set({
        reviewStatus: next,
        status: 'auto',
        slug,
        approvedAt: now,
        reviewNote: note,
        updatedAt: now,
      })
      .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.reviewStatus, project.reviewStatus))),
    db.run(sql`
      UPDATE funding_rewards SET locked_at = ${epoch}, updated_at = unixepoch()
      WHERE project_id = ${projectId} AND locked_at IS NULL
        AND EXISTS (
          SELECT 1 FROM funding_projects p
          WHERE p.id = funding_rewards.project_id AND p.review_status = 'approved'
        )
    `),
  ]);

  if (Number(batchResult[0].rowsAffected) === 0) {
    return deny('conflict', '그 사이 상태가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.');
  }

  return { ok: true, slug };
};
