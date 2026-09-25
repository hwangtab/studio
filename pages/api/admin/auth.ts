import type { NextApiRequest, NextApiResponse } from 'next';

import {
  isAdminLoginThrottled,
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
     * 1) 이 IP가 이미 창 한도를 넘겼는지 **대조 전에** 읽는다(전역은 안 본다 — 전역으로
     *    막으면 공격자가 오답만 쌓아 운영자를 봉쇄할 수 있다).
     *
     * 이 순서가 무차별 대입을 막는 실제 벽이다. 잠긴 IP는 대조 자체를 건너뛰므로 10분에
     * 시도할 수 있는 횟수가 LIMIT으로 끝난다. 대조를 앞으로 옮기면 공격자는 429를
     * 받으면서 계속 추측하고, 맞힌 그 요청은 오답이 아니라 한도에 걸리지 않고 통과한다.
     * 공유 IP에서 서로를 막는 문제는 순서가 아니라 한도 숫자로 푼다
     * (admin-rate-limit.ts의 LIMIT 주석).
     */
    if (await isAdminLoginThrottled(req)) {
      return res.status(429).json({
        ok: false,
        message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      });
    }

    // 2) 비밀번호를 대조한다. 올바른 비밀번호는 전역 상한과 무관하게 통과한다.
    const login = await loginAdminSession(req, res);
    if (login.ok) {
      // 3) 성공 = 진짜 관리자. subject·global 카운터를 모두 비운다(다시 LIMIT만큼 여유).
      await resetAdminLoginRateLimit(req);
      return res.status(200).json({ ok: true });
    }

    // 4) 틀렸을 때만 실패로 계수한다. 전역 상한을 넘겼으면(IP 회전 신호) 429, 아니면 401.
    //    IP 한도는 여기서 보지 않는다 — 넘겼으면 다음 요청이 위 1)에 걸린다.
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

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
