import type { NextApiRequest, NextApiResponse } from 'next';

import {
  isAdminLoginThrottled,
  recordAdminLoginFailure,
  resetAdminLoginRateLimit,
} from '../../../lib/contracts/admin-rate-limit';
import { loginAdminSession, logoutAdminSession } from '../../../lib/contracts/admin-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    // 1) 이 IP가 이미 창 한도를 넘겼는지만 읽는다(전역은 안 본다 — 전역으로 막으면
    //    공격자가 운영자를 봉쇄할 수 있다. admin-rate-limit.ts 주석 참조).
    if (await isAdminLoginThrottled(req)) {
      return res.status(429).json({
        ok: false,
        message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      });
    }

    // 2) 비밀번호를 대조한다. 올바른 비밀번호는 아래 어떤 상한과도 무관하게 통과한다.
    const login = await loginAdminSession(req, res);
    if (login.ok) {
      // 3) 성공 = 진짜 관리자. subject·global 카운터를 모두 비운다.
      await resetAdminLoginRateLimit(req);
      return res.status(200).json({ ok: true });
    }

    // 4) 틀렸을 때만 실패로 계수한다. 전역 상한을 넘겼으면(IP 회전 신호) 429, 아니면 401.
    const { globalExceeded } = await recordAdminLoginFailure(req);
    if (globalExceeded) {
      return res.status(429).json({
        ok: false,
        message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
    return res.status(401).json({ ok: false, message: '비밀번호가 올바르지 않습니다.' });
  }

  if (req.method === 'DELETE') {
    await logoutAdminSession(req, res);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
