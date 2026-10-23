import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { kstDateString } from '../../../../lib/booking/kst';
import { createExpense, deleteExpense, endExpenseRepeat, isExpenseCheckViolation, parseExpenseInput, updateExpenseClassification } from '../../../../lib/ops/expenses';

/**
 * 지출 항목 등록·삭제·반복 끝내기·구분/항목/메모 고치기. 규칙은 lib/ops/expenses.ts. 개인정보를 받지 않는 장부라 접속기록 대상이 아니다.
 * PATCH는 `repeatUntil`이 있으면 반복 끝내기, `scope`·`category`·`memo` 중 하나가 있으면 분류 고치기(메모에 변경 기록이 붙는다).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  try {
    if (req.method === 'POST') {
      const parsed = parseExpenseInput(req.body, kstDateString(new Date()));
      if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
      try {
        const id = await createExpense(parsed.value, auth.actor);
        return res.status(201).json({ ok: true, id });
      } catch (error: unknown) {
        // 새 구분(녹음·제작·플랫폼)·항목(대출 원금)은 마이그레이션 0084의 CHECK가 받아 준다 — 그 전에는 여기서 걸린다.
        if (isExpenseCheckViolation(error)) {
          return res.status(503).json({ ok: false, message: '이 구분·항목은 아직 저장할 수 없어요(마이그레이션 0084 적용 전). 연습실·공통과 기존 항목은 저장됩니다.' });
        }
        throw error;
      }
    }

    if (req.method === 'PATCH') {
      const b = (req.body ?? {}) as { id?: unknown; repeatUntil?: unknown; scope?: unknown; category?: unknown; memo?: unknown };
      if (typeof b.id !== 'string') return res.status(400).json({ ok: false, message: '요청이 올바르지 않습니다.' });
      if ('scope' in b || 'category' in b || 'memo' in b) {
        const pick = (v: unknown) => (typeof v === 'string' ? v : undefined);
        const memo = b.memo === null ? null : pick(b.memo);
        if (typeof memo === 'string' && memo.trim().length > 1000) return res.status(400).json({ ok: false, message: '메모는 1,000자까지 적을 수 있습니다.' });
        try {
          const result = await updateExpenseClassification(b.id, { scope: pick(b.scope), category: pick(b.category), memo }, auth.actor);
          if (result === 'not_found') return res.status(404).json({ ok: false, message: '기록을 찾을 수 없습니다.' });
          if (result === 'invalid') return res.status(400).json({ ok: false, message: '구분·항목을 다시 골라 주세요.' });
          return res.status(200).json({ ok: true, unchanged: result === 'unchanged' });
        } catch (error: unknown) {
          if (isExpenseCheckViolation(error)) {
            return res.status(503).json({ ok: false, message: '이 구분·항목은 아직 저장할 수 없어요(마이그레이션 0084 적용 전). 연습실·공통과 기존 항목은 저장됩니다.' });
          }
          throw error;
        }
      }
      if (typeof b.repeatUntil !== 'string') return res.status(400).json({ ok: false, message: '요청이 올바르지 않습니다.' });
      const ended = await endExpenseRepeat(b.id, b.repeatUntil);
      return ended ? res.status(200).json({ ok: true }) : res.status(404).json({ ok: false, message: '반복 지출을 찾을 수 없거나, 끝나는 날이 올바르지 않습니다(시작일보다 앞일 수 없어요).' });
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
