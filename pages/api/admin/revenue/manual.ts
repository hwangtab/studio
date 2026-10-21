import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { kstDateString } from '../../../../lib/booking/kst';
import { acknowledgeManualDuplicate, createManualRevenue, deleteManualRevenue, parseManualRevenueInput, setManualRefund, setManualRevenueLine } from '../../../../lib/ops/manualRevenue';
import { saveLineAssignment } from '../../../../lib/ops/businessLineStore';
import { parseBusinessLine } from '../../../../lib/ops/businessLine';
import { describeDuplicateMatches, DUPLICATE_ACK_MARKER, findManualRevenueDuplicates, manualRef } from '../../../../lib/ops/manualRevenueDuplicates';
import { safeDbErrorSummary } from '../../../../lib/payments/dbErrorSummary';

/**
 * 수기 매출 등록·환불 기록·분야 변경·중복 아님 표시·삭제. 규칙은 lib/ops/manualRevenue.ts.
 * 개인정보를 받지 않는 장부라 접속기록 대상이 아니다.
 *
 * 등록 때 같은 금액의 사이트 주문(±3일)·같은 날 수기 매출이 있으면 저장하지 않고 409 `possible_duplicate`로 알린다(manualRevenueDuplicates.ts).
 * 운영자가 확인하고 `confirmDuplicate: true`로 다시 보내면 저장하고 메모에 `[중복 아님]`을 붙인다(운영 점검이 다시 묻지 않게).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  try {
    if (req.method === 'POST') {
      const parsed = parseManualRevenueInput(req.body, kstDateString(new Date()));
      if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
      const confirmDuplicate = (req.body as { confirmDuplicate?: unknown } | null)?.confirmDuplicate === true;
      let matches: { orderNos: string[]; manualIds: string[] } | null = null;
      try {
        matches = await findManualRevenueDuplicates({ receivedOn: parsed.value.receivedOn, totalAmount: parsed.value.totalAmount });
      } catch (error: unknown) {
        // 점검 조회가 실패해도 저장은 막지 않는다(경고일 뿐이다).
        console.error('[API/admin/revenue/manual] 중복 점검 실패 — 경고 없이 저장합니다:', safeDbErrorSummary(error));
      }
      const hasMatches = matches !== null && (matches.orderNos.length > 0 || matches.manualIds.length > 0);
      if (matches && hasMatches && !confirmDuplicate) {
        const refs = { orderNos: matches.orderNos, manualRefs: matches.manualIds.map(manualRef) };
        return res.status(409).json({
          ok: false,
          code: 'possible_duplicate',
          ...refs,
          message: `이미 적힌 것 같은 돈이 있어요: ${describeDuplicateMatches(refs)}. 같은 입금을 두 번 적으면 매출이 두 배가 됩니다.`,
        });
      }
      const input = hasMatches ? { ...parsed.value, memo: `${parsed.value.memo ? `${parsed.value.memo} ` : ''}${DUPLICATE_ACK_MARKER}`.slice(0, 500) } : parsed.value;
      const id = await createManualRevenue(input, auth.actor);
      // 분야는 따로 둔 표(0084)에 적는다 — 실패해도 매출 기록은 남기고, 분야가 기본값으로 셀 것이라고 알린다.
      if (input.businessLine && !(await saveLineAssignment('manual_revenue', id, input.businessLine, auth.actor))) {
        return res.status(201).json({ ok: true, id, warning: '매출은 기록했지만 분야는 저장하지 못했어요(마이그레이션 0084 적용 전). 유형의 기본 분야로 셉니다.' });
      }
      return res.status(201).json({ ok: true, id });
    }

    if (req.method === 'PATCH') {
      const b = (req.body ?? {}) as { id?: unknown; refundedAmount?: unknown; businessLine?: unknown; action?: unknown };
      if (typeof b.id !== 'string') return res.status(400).json({ ok: false, message: '요청이 올바르지 않습니다.' });

      // 중복 아님 표시 — 운영 점검·목록이 이 기록을 더 묻지 않는다.
      if (b.action === 'ackDuplicate') {
        return (await acknowledgeManualDuplicate(b.id, auth.actor))
          ? res.status(200).json({ ok: true })
          : res.status(404).json({ ok: false, message: '기록을 찾을 수 없습니다.' });
      }

      // 분야 변경 — '' 또는 null이면 유형의 기본 분야로 되돌린다.
      if ('businessLine' in b) {
        const line = b.businessLine === null || b.businessLine === '' ? null : parseBusinessLine(b.businessLine);
        if (line === null && !(b.businessLine === null || b.businessLine === '')) return res.status(400).json({ ok: false, message: '분야를 다시 골라 주세요.' });
        const result = await setManualRevenueLine(b.id, line, auth.actor);
        if (result === 'not_found') return res.status(404).json({ ok: false, message: '기록을 찾을 수 없습니다.' });
        if (result === 'unavailable') return res.status(503).json({ ok: false, message: '분야를 저장하지 못했어요(마이그레이션 0084 적용 전이거나 조회 오류).' });
        return res.status(200).json({ ok: true });
      }

      if (typeof b.refundedAmount !== 'number') return res.status(400).json({ ok: false, message: '요청이 올바르지 않습니다.' });
      const result = await setManualRefund(b.id, b.refundedAmount, auth.actor);
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
