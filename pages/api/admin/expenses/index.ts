import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { kstDateString } from '../../../../lib/booking/kst';
import { createExpense, deleteExpense, endExpenseRepeat, parseExpenseInput } from '../../../../lib/ops/expenses';

/**
 * 지출 항목 등록·삭제·반복 끝내기. 규칙은 lib/ops/expenses.ts. 개인정보를 받지 않는 장부라 접속기록 대상이 아니다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  try {
    if (req.method === 'POST') {
      const parsed = parseExpenseInput(req.body, kstDateString(new Date()));
      if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
      const id = await createExpense(parsed.value, auth.actor);
      return res.status(201).json({ ok: true, id });
    }

    if (req.method === 'PATCH') {
      const { id, repeatUntil } = (req.body ?? {}) as { id?: unknown; repeatUntil?: unknown };
      if (typeof id !== 'string' || typeof repeatUntil !== 'string') return res.status(400).json({ ok: false, message: '요청이 올바르지 않습니다.' });
      const ended = await endExpenseRepeat(id, repeatUntil);
      return ended ? res.status(200).json({ ok: true }) : res.status(404).json({ ok: false, message: '반복 지출을 찾을 수 없거나 날짜가 올바르지 않습니다.' });
    }

    if (req.method === 'DELETE') {
      const { id } = (req.body ?? {}) as { id?: unknown };
      if (typeof id !== 'string') return res.status(400).json({ ok: false, message: '요청이 올바르지 않습니다.' });
      const deleted = await deleteExpense(id, auth.actor);
      return deleted ? res.status(200).json({ ok: true }) : res.status(404).json({ ok: false, message: '기록을 찾을 수 없습니다.' });
    }

    res.setHeader('Allow', 'POST, PATCH, DELETE');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  } catch (error: unknown) {
    console.error('[API/admin/expenses] 실패:', error);
    return res.status(500).json({ ok: false, message: '처리하지 못했습니다. 마이그레이션 0080이 적용됐는지 확인해 주세요.' });
  }
}
