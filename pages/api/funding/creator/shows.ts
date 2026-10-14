import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { guardOrganizerRequest, limitOrganizerWrites } from '../../../../lib/shows/organizer/http';
import {
  countOpenSubmissions,
  createSubmission,
  listSubmissionsForCreator,
} from '../../../../lib/shows/organizer/submissions';

/** 열린(draft·submitted·changes_requested) 제출물 상한 — 승인·반려가 끝난 건은 세지 않는다(펀딩 projects.ts와 같다). */
const OPEN_SUBMISSIONS_MAX = 5;

/** GET: 내 공연 신청 목록 · POST: 새 신청서 만들기. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const creatorId = await guardOrganizerRequest(req, res, ['GET', 'POST']);
  if (!creatorId) return;

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, submissions: await listSubmissionsForCreator(creatorId) });
  }

  if (!(await limitOrganizerWrites(req, res, creatorId))) return;
  if (!(await consumeRateLimit(`creator_show_create:${creatorId}`, 10, 86_400))) {
    return res.status(429).json({ ok: false, message: '오늘은 더 만들 수 없어요. 내일 다시 시도해 주세요.' });
  }
  if ((await countOpenSubmissions(creatorId)) >= OPEN_SUBMISSIONS_MAX) {
    return res.status(400).json({
      ok: false,
      message: `진행 중인 신청서는 ${OPEN_SUBMISSIONS_MAX}개까지 둘 수 있어요. 심사가 끝난 뒤 새로 만들 수 있어요.`,
    });
  }
  return res.status(200).json({ ok: true, id: await createSubmission(creatorId) });
}
