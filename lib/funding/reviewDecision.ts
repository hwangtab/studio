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
  | { ok: true; slug: string; warnings?: string[] }
  | {
      ok: false;
      code:
        | 'not_found'
        | 'conflict'
        | 'invalid_slug'
        | 'duplicate_slug'
        | 'incomplete'
        | 'expired'
        | 'terms_not_agreed';
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
  // 보완 요청·반려 둘 다 "왜"를 개설자에게 알리는 것이 약관 §2의 약속이다(승인은 사유라는
  // 개념이 없어 제외). 메모 없는 반려는 개설자를 원인도 모른 채 끝난 상태로 돌려보낸다 —
  // 반려는 되돌릴 수 없는 종착 상태라(reviewTransition.ts) 보완 요청보다 오히려 더 절실하다.
  if ((action === 'request_changes' || action === 'reject') && !note) {
    return deny(
      'incomplete',
      action === 'reject' ? '반려에는 사유 메모가 필요합니다.' : '보완 요청에는 안내 메모가 필요합니다.',
    );
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

  /**
   * 모금 기간 재검사.
   *
   * `submit.ts`가 제출 시점에 startAt이 "오늘 + leadDays일 뒤"인지 본 것과 같은 이유로,
   * 승인 시점에도 다시 봐야 한다 — 심사가 leadDays(3일)보다 오래 걸리면 그 사이에 날짜가
   * 저절로 무효해진다. `submitted` 상태에서는 `canCreatorEdit`이 false라 개설자가 직접
   * 고칠 수 없으므로, 이 재검사가 유일한 안전망이다.
   *
   * 둘을 다르게 다룬다: **종료일이 지났으면 거부한다** — 이미 끝난 모금을 여는 것은
   * 항상 틀렸고 되돌릴 방법도 없다. **시작일만 지났으면 통과시키되 경고한다** — 막으면
   * 개설자도 운영자도 날짜를 고칠 길이 없는 막다른 상태가 된다(보완 요청으로 돌려보내면
   * 개설자가 직접 고칠 수 있으니, 그 판단은 운영자에게 맡긴다).
   */
  const startAt = new Date(project.startAt);
  const endAt = new Date(project.endAt);
  if (endAt.getTime() <= now.getTime()) {
    return deny('expired', '모금 종료일이 이미 지났습니다. 보완 요청으로 돌려보내 기간을 다시 잡게 해 주세요.');
  }
  const warnings: string[] = [];
  if (startAt.getTime() < now.getTime()) {
    warnings.push('시작일이 이미 지나 승인 즉시 모금이 시작됩니다.');
  }

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

  /**
   * 동의 기록 재확인.
   *
   * `submit.ts`가 `creatorTermsVersion`을 기록하는 게이트는 이 배포(3차) 이후에 생겼다 —
   * 그 전에 이미 `submitted` 상태로 남아 있던 프로젝트는 동의 기록 없이 제출됐다. 승인이
   * 이걸 안 보면 "그때 이 내용에 동의했다"는 증거가 없는 채로 공개된다.
   *
   * 막다른 길이 아니다 — `request_changes`로 돌려보내면 개설자가 `canCreatorEdit`
   * (changes_requested)로 다시 접근해 재제출할 수 있고, 재제출은 지금의 `submit.ts`를
   * 거치므로 이번엔 반드시 판본이 찍힌다.
   */
  if (!project.creatorTermsVersion) {
    return deny(
      'terms_not_agreed',
      '개설자 약관 동의 기록이 없어 승인할 수 없습니다. 보완 요청으로 돌려보내 다시 제출하게 해 주세요.',
    );
  }

  const db = getDb();
  const epoch = Math.floor(now.getTime() / 1000);

  /**
   * 프로젝트를 먼저 승인 상태로 옮기고, **그 다음** 리워드를 잠근다.
   *
   * `db.batch`는 실패 시 전부 롤백되지만, 프로젝트 UPDATE가 경합으로 0행이어도 리워드
   * UPDATE는 그 자체로 유효한 SQL이라 성공해 버린다 — 그러면 "잠겼는데 공개는 안 된"
   * 프로젝트가 남는다.
   *
   * `p.review_status = 'approved'`만으로는 이걸 못 막는다 — 다른 관리자(또는 중복 클릭)가
   * 이 함수보다 먼저 같은 프로젝트를 승인해 놓았다면, **이 호출의 프로젝트 UPDATE가
   * 0행이어도** review_status는 이미 'approved'이므로 EXISTS가 참이 되어 리워드가
   * 잠긴다 — 정작 이 호출은 rowsAffected===0을 보고 `conflict`를 돌려주면서 실제로는
   * 썼다는 모순이 생긴다. 그래서 "review_status가 approved"뿐 아니라 **이 배치가 방금
   * 그 값을 썼다는 증거**까지 요구한다 — 프로젝트 UPDATE가 같은 `updatedAt`(epoch)을
   * 쓰므로, 리워드 UPDATE의 EXISTS에 `p.updated_at = ${epoch}`를 더하면 "이 호출이
   * approved로 만든 바로 그 행"만 통과한다. 남이 먼저 승인한 경우 그 행의 updated_at은
   * 그 남의 호출이 쓴 값이라 이 epoch와 다르므로 EXISTS가 거짓이 되어 리워드는 안 잠긴다.
   *
   * 프로젝트 UPDATE를 배치의 앞에 두는 이유는 그대로다 — 같은 트랜잭션 안에서 리워드
   * UPDATE의 EXISTS가 방금 그 UPDATE가 반영한 값을 보게 하기 위해서다.
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
          WHERE p.id = funding_rewards.project_id AND p.review_status = 'approved' AND p.updated_at = ${epoch}
        )
    `),
  ]);

  if (Number(batchResult[0].rowsAffected) === 0) {
    return deny('conflict', '그 사이 상태가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.');
  }

  return { ok: true, slug, ...(warnings.length > 0 ? { warnings } : {}) };
};
