import type { NextApiRequest, NextApiResponse } from 'next';

import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { logoutCreatorSession } from '../../../../lib/funding/creatorAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  // login.ts와 같은 이유(SameSite=lax) — 상태를 바꾸는 요청은 우리 사이트 오리진만 받는다.
  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  await logoutCreatorSession(req, res);
  return res.status(200).json({ ok: true });
}
