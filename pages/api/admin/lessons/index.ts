import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { kstDateString } from '../../../../lib/booking/kst';
import { parseEnrollmentInput } from '../../../../lib/lessons/rules';
import { createEnrollment } from '../../../../lib/lessons/service';

/** 수강 등록 — 과정 길이만큼 회차와 컨트롤 룸 예약 불가 블록을 함께 만든다(lib/lessons/service.ts). 개인정보(연락처)는 받지 않는다. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }
  const parsed = parseEnrollmentInput(req.body, kstDateString(new Date()));
  if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
  try {
    const result = await createEnrollment(parsed.value, auth.actor);
    return result.ok ? res.status(201).json({ ok: true, id: result.id }) : res.status(409).json({ ok: false, message: result.message });
  } catch (error: unknown) {
    console.error('[API/admin/lessons] 등록 실패:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ ok: false, message: '등록하지 못했습니다. 마이그레이션 0081이 적용됐는지 확인해 주세요.' });
  }
}
