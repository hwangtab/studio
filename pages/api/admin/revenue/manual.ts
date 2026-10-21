import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { kstDateString } from '../../../../lib/booking/kst';
import { createManualRevenue, deleteManualRevenue, parseManualRevenueInput, setManualRefund } from '../../../../lib/ops/manualRevenue';
import { saveLineAssignment } from '../../../../lib/ops/businessLineStore';

/**
 * 수기 매출 등록·환불 기록·삭제. 규칙은 lib/ops/manualRevenue.ts.
 * 개인정보를 받지 않는 장부라 접속기록 대상이 아니다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  try {
    if (req.method === 'POST') {
      const parsed = parseManualRevenueInput(req.body, kstDateString(new Date()));
      if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
      const id = await createManualRevenue(parsed.value, auth.actor);
      // 분야는 따로 둔 표(0083)에 적는다 — 실패해도 매출 기록은 남기고, 분야가 기본값으로 셀 것이라고 알린다.
      if (parsed.value.businessLine && !(await saveLineAssignment('manual_revenue', id, parsed.value.businessLine, auth.actor))) {
        return res.status(201).json({ ok: true, id, warning: '매출은 기록했지만 분야는 저장하지 못했어요(마이그레이션 0083 적용 전). 유형의 기본 분야로 셉니다.' });
      }
      return res.status(201).json({ ok: true, id });
    }

    if (req.method === 'PATCH') {
      const { id, refundedAmount } = (req.body ?? {}) as { id?: unknown; refundedAmount?: unknown };
      if (typeof id !== 'string' || typeof refundedAmount !== 'number') return res.status(400).json({ ok: false, message: '요청이 올바르지 않습니다.' });
      const result = await setManualRefund(id, refundedAmount, auth.actor);
      if (result === 'not_found') return res.status(404).json({ ok: false, message: '기록을 찾을 수 없습니다.' });
      if (result === 'invalid') return res.status(400).json({ ok: false, message: '환불 금액은 0원 이상, 받은 금액 이하의 정수여야 합니다.' });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = (req.body ?? {}) as { id?: unknown };
      if (typeof id !== 'string') return res.status(400).json({ ok: false, message: '요청이 올바르지 않습니다.' });
      const deleted = await deleteManualRevenue(id, auth.actor);
      return deleted ? res.status(200).json({ ok: true }) : res.status(404).json({ ok: false, message: '기록을 찾을 수 없습니다.' });
    }

    res.setHeader('Allow', 'POST, PATCH, DELETE');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  } catch (error: unknown) {
    console.error('[API/admin/revenue/manual] 실패:', error);
    return res.status(500).json({ ok: false, message: '처리하지 못했습니다. 마이그레이션 0063·0065가 적용됐는지 확인해 주세요.' });
  }
}
