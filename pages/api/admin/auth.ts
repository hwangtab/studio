import type { NextApiRequest, NextApiResponse } from 'next';

import {
  checkAdminLoginRateLimit,
  resetAdminLoginRateLimit,
} from '../../../lib/contracts/admin-rate-limit';
import { loginAdminSession, logoutAdminSession } from '../../../lib/contracts/admin-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    const allowed = await checkAdminLoginRateLimit(req);
    if (!allowed) {
      return res.status(429).json({
        ok: false,
        message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      });
    }

    const login = await loginAdminSession(req, res);
    if (!login.ok) {
      return res.status(401).json({ ok: false, message: '비밀번호가 올바르지 않습니다.' });
    }

    // 성공했으면 이 주체의 실패 누적을 지운다 — 그러지 않으면 정상 로그인이 한도를
    // 채워, 비밀번호를 아는 관리자가 자기 시스템에서 잠긴다.
    await resetAdminLoginRateLimit(req);

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await logoutAdminSession(req, res);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
