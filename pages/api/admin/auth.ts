import type { NextApiRequest, NextApiResponse } from 'next';

import {
  recordAdminLoginFailure,
  resetAdminLoginRateLimit,
} from '../../../lib/contracts/admin-rate-limit';
import {
  authenticateAdminApi,
  loginAdminSession,
  logoutAdminSession,
} from '../../../lib/contracts/admin-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  /**
   * GET — 지금 누구로 들어와 있는가.
   *
   * 관리자 화면 상단이 현재 사람 이름을 띄우려고 부른다. 세션에 이미 든 값을 돌려줄 뿐이라
   * 관리자 페이지 15곳의 GSSP에 prop을 하나씩 내리는 것보다 이 한 경로가 낫다 —
   * 화면 껍데기(AdminShell)가 마운트 때 한 번 부르고 끝이다.
   */
  if (req.method === 'GET') {
    const auth = await authenticateAdminApi(req, res);
    if (!auth.ok) return res.status(401).json({ ok: false });
    return res.status(200).json({ ok: true, id: auth.actor, name: auth.name });
  }

  if (req.method === 'POST') {
    /*
     * 1) 비밀번호를 **먼저** 대조한다.
     *
     * 시도 제한을 앞에 두면 상한이 정당한 사용을 지키려다 그 반대가 된다. 전역 상한은
     * 이미 그 이유로 대조 뒤에 있었고(공격자가 아무 요청 101번으로 운영자를 봉쇄할 수
     * 있었다), IP 한도도 같은 문제를 가진다 — 비밀번호가 사람별로 갈린 지금은 같은
     * 사무실 IP에서 한 사람의 오타 열 번이 비밀번호를 정확히 아는 동료를 막는다.
     * 무차별 대입은 전부 틀린 시도이므로 오답에만 상한을 걸어도 막는 힘은 그대로다.
     */
    const login = await loginAdminSession(req, res);
    if (login.ok) {
      // 2) 성공 = 진짜 관리자. subject·global 카운터를 모두 비운다.
      await resetAdminLoginRateLimit(req);
      return res.status(200).json({ ok: true });
    }

    // 3) 틀렸을 때만 실패로 계수한다. 어느 한도든 넘겼으면 429, 아니면 401.
    const { subjectExceeded, globalExceeded } = await recordAdminLoginFailure(req);
    if (subjectExceeded || globalExceeded) {
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

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
