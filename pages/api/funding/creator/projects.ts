import { and, count, eq, inArray } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { fundingProjects } from '../../../../db/schema';
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { getClientIp } from '../../../../lib/contracts/client-ip';
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
import { createDraftProject } from '../../../../lib/funding/creatorProjectWrite';
import { CREATOR_LIMITS } from '../../../../lib/funding/creatorValidation';
import type { FundingReviewStatus } from '../../../../lib/funding/reviewTransition';

/**
 * 상한이 세는 상태 — `CREATOR_LIMITS.draftsMax` 주석 참조.
 *
 * `approved`·`rejected`는 뺀다. 둘 다 운영자가 사람 손으로 심사를 끝낸 행이라 스팸
 * 벡터가 아니다 — 포함하면 펀딩을 여러 번 성공시킨 개설자가, 또는 반려를 몇 번 받은
 * 개설자가 같은 막다른 길에 갇힌다(성공할수록·거절당할수록 더 못 만드는 상한은
 * 상한의 목적과 반대로 움직인다). `draft`·`submitted`·`changes_requested`는 아직
 * 운영자 검토를 안 거쳤거나 다시 손봐야 하는 행 — 계정 자동 생성(로그인 시 이메일만
 * 있으면 됨)과 결합하면 이 세 상태만 무한정 쌓는 것이 실제 스팸 벡터다.
 */
const UNREVIEWED_STATUSES: readonly FundingReviewStatus[] = ['draft', 'submitted', 'changes_requested'];

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

  // 초안도 계정당 상한이 있다 — CREATOR_LIMITS.draftsMax와 UNREVIEWED_STATUSES 주석 참조.
  // 심사를 거치지 않은(또는 다시 손봐야 하는) 행만 센다.
  const [{ value: existingCount }] = await getDb()
    .select({ value: count() })
    .from(fundingProjects)
    .where(and(eq(fundingProjects.creatorId, auth.creatorId), inArray(fundingProjects.reviewStatus, UNREVIEWED_STATUSES)));
  if (existingCount >= CREATOR_LIMITS.draftsMax) {
    return res.status(400).json({
      ok: false,
      // "정리해 달라"고 하지 않는다 — 개설자에게도 운영자에게도 프로젝트를 지우는
      // 경로가 아직 없다(할 수 없는 일을 시키지 않는다). submitted도 이 상한에 걸리는
      // 상태라 "제출하면 풀린다"도 아니다 — 실제로 풀리는 계기는 운영자 심사(승인·반려)
      // 뿐이라 그대로 안내한다.
      message: '아직 심사되지 않은 프로젝트가 너무 많습니다. 운영자 심사(승인 또는 반려)가 끝난 뒤 새 프로젝트를 만들 수 있습니다.',
    });
  }

  const { id } = await createDraftProject(auth.creatorId);
  return res.status(200).json({ ok: true, id });
}
