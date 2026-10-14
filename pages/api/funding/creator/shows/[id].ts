import type { NextApiRequest, NextApiResponse } from 'next';

import { guardOrganizerRequest, limitOrganizerWrites, queryId, respondWrite } from '../../../../../lib/shows/organizer/http';
import { loadSubmissionForCreator, saveSubmission } from '../../../../../lib/shows/organizer/submissions';

/** GET: 신청서 하나 · PUT: 초안 저장(body = 초안 JSON). 남의 id는 404. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const creatorId = await guardOrganizerRequest(req, res, ['GET', 'PUT']);
  if (!creatorId) return;
  const id = queryId(req);
  if (!id) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });

  if (req.method === 'GET') {
    const submission = await loadSubmissionForCreator(creatorId, id);
    if (!submission) return res.status(404).json({ ok: false, message: '찾을 수 없어요.' });
    return res.status(200).json({ ok: true, submission });
  }

  if (!(await limitOrganizerWrites(req, res, creatorId))) return;
  return respondWrite(res, await saveSubmission(creatorId, id, req.body, new Date()));
}
