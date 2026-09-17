import { count, eq } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { fundingProjects } from '../../../../db/schema';
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { getClientIp } from '../../../../lib/contracts/client-ip';
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
import { createDraftProject } from '../../../../lib/funding/creatorProjectWrite';
import { CREATOR_LIMITS } from '../../../../lib/funding/creatorValidation';

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

  // 로그인이 "처음 보는 이메일이면 계정 자동 생성"이라 creatorId 하나만 보면 메일함
  // N개로 N배가 된다 — upload.ts(IP+계정 두 겹)와 같은 이유로 IP 한 겹을 더한다.
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`creator_save:ip:${ip}`, 30, 60))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }
  if (!(await consumeRateLimit(`creator_save:${auth.creatorId}`, 30, 60))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }

  // 초안도 계정당 상한이 있다 — CREATOR_LIMITS.draftsMax 주석 참조. 승인·반려된 것까지
  // 포함해 그 개설자의 전체 프로젝트 수를 센다(심사를 통과한 프로젝트도 계정 자원을
  // 차지하는 것은 같다).
  const [{ value: existingCount }] = await getDb()
    .select({ value: count() })
    .from(fundingProjects)
    .where(eq(fundingProjects.creatorId, auth.creatorId));
  if (existingCount >= CREATOR_LIMITS.draftsMax) {
    return res.status(400).json({
      ok: false,
      message: '만들 수 있는 프로젝트 수를 넘었습니다. 쓰지 않는 초안을 정리한 뒤 다시 시도해 주세요.',
    });
  }

  const { id } = await createDraftProject(auth.creatorId);
  return res.status(200).json({ ok: true, id });
}
