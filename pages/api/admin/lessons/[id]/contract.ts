import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { buildLessonSignUrl } from '../../../../../lib/contracts/lesson/links';
import { cancelLessonContract, createLessonContract, sendLessonContract, validateLessonContractInput } from '../../../../../lib/contracts/lesson/service';

/**
 * 수강 계약의 관리자 조작 — 만들기(초안)·발송(운영자 서명)·재발송·취소. 한 엔드포인트에 `action`으로 가른다.
 * 발송은 **확정 전 문안이 남은 본문을 거절**한다(service.ts) — 환불 조항을 법률 확인하기 전에 실제로 나가지 않게.
 * 응답에 개인정보를 싣지 않는다(서명 링크만 — 운영자가 카톡으로 보낼 수 있게).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }
  const enrollmentId = typeof req.query.id === 'string' ? req.query.id : '';
  const b = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;

  try {
    if (b.action === 'create') {
      const input = validateLessonContractInput(b);
      if (!input.ok) return res.status(400).json({ ok: false, message: input.message });
      const result = await createLessonContract(enrollmentId, input.value, auth.actor);
      return result.ok ? res.status(201).json({ ok: true, contractId: result.contract.id }) : res.status(409).json({ ok: false, message: result.message });
    }

    // 이 수강의 계약만 건드린다.
    const contractId = typeof b.contractId === 'string' ? b.contractId : '';
    const owned = contractId
      ? await getDb().query.lessonContracts.findFirst({ where: (t, { and, eq }) => and(eq(t.id, contractId), eq(t.enrollmentId, enrollmentId)), columns: { id: true } })
      : undefined;
    if (!owned) return res.status(404).json({ ok: false, message: '계약을 찾을 수 없어요.' });

    if (b.action === 'send') {
      const result = await sendLessonContract(contractId, { adminActor: auth.actor, ipAddress: getClientIp(req) });
      return result.ok
        ? res.status(200).json({ ok: true, signUrl: result.signUrl, emailSent: result.emailSent })
        : res.status(409).json({ ok: false, code: result.code, message: result.message });
    }
    if (b.action === 'link') {
      // 보낸 계약의 서명 링크를 다시 보여 준다(운영자 화면 전용).
      const contract = await getDb().query.lessonContracts.findFirst({ where: (t, { eq }) => eq(t.id, contractId) });
      return contract?.signToken && contract.status === 'sent'
        ? res.status(200).json({ ok: true, signUrl: buildLessonSignUrl(contract.id, contract.signToken) })
        : res.status(409).json({ ok: false, message: '서명 대기 중인 계약이 아니에요.' });
    }
    if (b.action === 'cancel') {
      const cancelled = await cancelLessonContract(contractId);
      return cancelled ? res.status(200).json({ ok: true }) : res.status(409).json({ ok: false, message: '취소할 수 없는 상태예요.' });
    }
    return res.status(400).json({ ok: false, message: '알 수 없는 작업이에요.' });
  } catch (error: unknown) {
    console.error('[API/admin/lessons/[id]/contract] 실패:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ ok: false, message: '처리하지 못했습니다. 마이그레이션 0082가 적용됐는지 확인해 주세요.' });
  }
}
