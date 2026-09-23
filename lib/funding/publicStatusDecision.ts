import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingProjects } from '../../db/schema';
import { loadProjectForAdmin } from './adminProjects';
import { toKstDateString } from './creatorDateInput';

/**
 * 승인된 프로젝트의 공개 상태(`status`)·목록 노출(`hidden`)을 바꾸는 판정.
 *
 * `reviewTransition.ts`의 심사 상태 전이표와는 다른 축이다 — `approved`는 심사 상태로는
 * 종결이고 되돌릴 이유가 없다(후원 기록이 slug로 이 프로젝트를 참조하므로 심사 상태를
 * 되감으면 그 참조가 끊긴다). 대신 "모금을 멈춘다"는 `status: closed`로, "목록에서 뺀다"는
 * `hidden`으로 표현한다 — 종료는 페이지가 남고 새 후원만 막히고, 숨김은 목록·사이트맵에서만
 * 빠지고 주소를 아는 사람은 여전히 볼 수 있다. 둘 다 되돌릴 수 있다 — 이 파일이 막으려는
 * 것 자체가 "한 번 승인하면 되돌릴 수단이 없다"였던 만큼, 또 다른 편도가 되면 안 된다.
 */
export type PublicStatusAction = 'close' | 'reopen' | 'hide' | 'unhide';

export type PublicStatusResult =
  | { ok: true; slug: string }
  | { ok: false; code: 'not_found' | 'conflict' | 'incomplete'; message: string };

const deny = (code: Exclude<PublicStatusResult, { ok: true }>['code'], message: string): PublicStatusResult => ({
  ok: false,
  code,
  message,
});

export const decidePublicStatus = async (
  projectId: string,
  action: PublicStatusAction,
  input: { note?: string },
  now: Date = new Date(),
): Promise<PublicStatusResult> => {
  const project = await loadProjectForAdmin(projectId);
  if (!project) return deny('not_found', '프로젝트를 찾을 수 없습니다.');

  // 승인 전에는 공개된 적이 없다 — status·hidden을 바꿔도 어떤 화면에도 드러나지 않아
  // 운영자가 "됐다"고 착각할 위험만 남는다.
  if (project.reviewStatus !== 'approved') {
    return deny('conflict', '승인된 프로젝트만 공개 상태를 바꿀 수 있습니다.');
  }

  const note = input.note?.trim() || null;
  // 종료만 사유를 필수로 받는다 — 개설자가 "왜 멈췄는지" 알아야 하는 쪽은 모금을 멈추는
  // 쪽이다. 다시 열기·숨김 토글은 되돌리는 조작이라 강제하지 않는다.
  if (action === 'close' && !note) {
    return deny('incomplete', '종료에는 사유 메모가 필요합니다.');
  }

  const db = getDb();
  const lastmod = toKstDateString(now);

  if (action === 'close' || action === 'reopen') {
    const fromStatus = action === 'close' ? 'auto' : 'closed';
    const toStatus = action === 'close' ? 'closed' : 'auto';
    // 낙관적 잠금: id·reviewStatus뿐 아니라 "지금 이 상태에서 시작하는가"까지 WHERE에
    // 건다 — 그 사이 다른 운영자(또는 중복 클릭)가 먼저 같은 방향으로 바꿔 놓았으면
    // 0행이라 conflict를 돌려준다.
    const result = await db
      .update(fundingProjects)
      .set({
        status: toStatus,
        // reopen에 메모를 안 보내면(선택 사항) 기존 reviewNote를 보존한다 — decideProject의
        // approveReviewNote와 같은 이유: input.note가 아예 안 왔을 때만 기존 값을 지킨다.
        ...(input.note !== undefined ? { reviewNote: note } : {}),
        lastmod,
        updatedAt: now,
      })
      .where(
        and(
          eq(fundingProjects.id, projectId),
          eq(fundingProjects.reviewStatus, 'approved'),
          eq(fundingProjects.status, fromStatus),
        ),
      );
    if (Number(result.rowsAffected) === 0) {
      return deny(
        'conflict',
        action === 'close'
          ? '이미 종료됐거나 그 사이 상태가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.'
          : '이미 공개 중이거나 그 사이 상태가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.',
      );
    }
    return { ok: true, slug: project.slug };
  }

  // hide / unhide — 사유는 강제하지 않지만(개설자 화면 프롬프트는 선택), 운영자가
  // 적었으면(예: 신고 대응) close·reopen과 같은 규칙으로 reviewNote에 남긴다. 여기서만
  // 저장하고 메일에는 안 싣는 비대칭이 생기면 개설자는 이유를 알 방법이 메일뿐인데
  // 그 메일과 DB 기록이 어긋난다.
  const fromHidden = action === 'hide' ? false : true;
  const toHidden = action === 'hide';
  const result = await db
    .update(fundingProjects)
    .set({
      hidden: toHidden,
      ...(input.note !== undefined ? { reviewNote: note } : {}),
      lastmod,
      updatedAt: now,
    })
    .where(
      and(
        eq(fundingProjects.id, projectId),
        eq(fundingProjects.reviewStatus, 'approved'),
        eq(fundingProjects.hidden, fromHidden),
      ),
    );
  if (Number(result.rowsAffected) === 0) {
    return deny(
      'conflict',
      action === 'hide'
        ? '이미 숨겨져 있거나 그 사이 상태가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.'
        : '이미 노출 중이거나 그 사이 상태가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.',
    );
  }
  return { ok: true, slug: project.slug };
};
