import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
import { createDraftProject } from '../../../../lib/funding/creatorProjectWrite';

/**
 * 초안 프로젝트 생성.
 *
 * 입력이 없다 — slug·제목 등은 전부 나중에 기본정보 구획 저장(`projects/[id].ts`)이 채운다.
 * `createDraftProject`가 임시 slug(`draft-<uuid>`)로 행을 만들어 두는 이유는
 * lib/funding/creatorProjectWrite.ts의 주석 참조.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });

  if (!(await consumeRateLimit(`creator_save:${auth.creatorId}`, 30, 60))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }

  const { id } = await createDraftProject(auth.creatorId);
  return res.status(200).json({ ok: true, id });
}
