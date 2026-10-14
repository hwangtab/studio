import type { NextApiRequest, NextApiResponse } from 'next';

import { guardOrganizerRequest, limitOrganizerWrites, queryId, respondWrite } from '../../../../../../lib/shows/organizer/http';
import { submitSubmission } from '../../../../../../lib/shows/organizer/submissions';

/** 심사 신청. body `{ agreedTerms: boolean }`. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const creatorId = await guardOrganizerRequest(req, res, ['POST']);
  if (!creatorId) return;
  const id = queryId(req);
  if (!id) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });
  if (!(await limitOrganizerWrites(req, res, creatorId))) return;
  return respondWrite(res, await submitSubmission(creatorId, id, { agreedTerms: req.body?.agreedTerms === true }, new Date()));
}
