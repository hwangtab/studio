import { and, eq } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../../db/client';
import { fundingProjects } from '../../../../../../db/schema';
import { consumeRateLimit } from '../../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../../lib/funding/creatorAuth';
import { loadProjectForCreator } from '../../../../../../lib/funding/creatorProjectWrite';
import { sendFundingCreatorWithdrawalEmail } from '../../../../../../lib/funding/email';
import { nextReviewStatus, type FundingReviewStatus } from '../../../../../../lib/funding/reviewTransition';

/**
 * 심사 신청 철회 — `reviewTransition.ts`의 `submitted --withdraw--> draft`.
 *
 * 전이표에는 이 액션이 있었는데 그것을 부르는 API가 없어서, 제출 뒤 오타를 발견해도
 * `EDITABLE_SECTIONS.submitted: []`에 막혀 운영자가 보완 요청을 눌러 줄 때까지 아무것도
 * 못 고쳤다. 이 라우트가 그 유일한 탈출구다.
 *
 * `submit.ts`의 반대 방향이라 모양도 같다 — 인증·Origin 검사·레이트리밋·낙관적 잠금·메일
 * 호출까지 그대로 따른다. 조건문을 새로 쓰지 않고 `nextReviewStatus`(전이표)를 그대로
 * 쓴다 — 표가 `submitted`에서만 `withdraw`를 허용하므로 별도 상태 검사가 필요 없다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });

  const projectId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!projectId) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  // submit.ts와 같은 예산을 공유한다 — 둘 다 "개설자가 자기 프로젝트 상태를 바꾸는" 같은
  // 범주의 쓰기라, 따로 두면 한쪽 예산만 소진해 다른 쪽을 우회하는 경로가 생긴다.
  if (!(await consumeRateLimit(`creator_save:${auth.creatorId}`, 30, 60))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }

  const project = await loadProjectForCreator(auth.creatorId, projectId);
  if (!project) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });

  const next = nextReviewStatus(project.reviewStatus as FundingReviewStatus, 'withdraw');
  if (!next) return res.status(409).json({ ok: false, message: '지금 상태에서는 철회할 수 없습니다.' });

  const now = new Date();
  // submit.ts와 같은 이유의 낙관적 잠금이다 — 읽고 나서 쓰는 사이(loadProjectForCreator
  // 이후) 운영자가 먼저 승인·반려를 확정할 수 있다. 조건 없이 id만으로 UPDATE하면 이미
  // 판정이 끝난 행을 draft로 되돌려 reviewTransition.ts의 표를 우회한다. 영향 행이 0이면
  // 그 사이 상태가 바뀐 것이므로 409로 되돌린다.
  //
  // creator_terms_version은 건드리지 않는다 — 재제출 때 submit.ts가 다시 찍는다.
  const result = await getDb().update(fundingProjects).set({
    reviewStatus: next,
    updatedAt: now,
  }).where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.reviewStatus, project.reviewStatus as FundingReviewStatus)));

  if (Number(result.rowsAffected) === 0) {
    return res.status(409).json({ ok: false, message: '지금 상태에서는 철회할 수 없습니다.' });
  }

  try {
    const mailError = await sendFundingCreatorWithdrawalEmail(project);
    if (mailError) {
      // 메일 실패는 삼키고 기록만 남긴다 — 철회(상태 전이)는 이미 커밋됐다. 여기서 실패를
      // 응답에 흘리면 "철회는 됐는데 응답은 실패"라는 상태 불일치가 생긴다.
      console.error('[funding/creator/withdraw] 심사 철회 알림 메일 실패:', mailError);
    }
  } catch (error: unknown) {
    console.error('[funding/creator/withdraw] 심사 철회 알림 메일 처리 중 오류:', error);
  }

  return res.status(200).json({ ok: true });
}
