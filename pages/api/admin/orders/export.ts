import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { toCsv } from '../../../../lib/funding/csv';
import { listSalesLedgerRows, SALES_LEDGER_COLUMNS, validateLedgerRange } from '../../../../lib/ops/salesLedger';

/**
 * 토스 결제 장부 CSV — 기간 안에 승인된 결제 전부(서비스 구분 없음). 부가세·정산용.
 *
 * 연락처가 실리는 다운로드라 관리자 세션 필수, no-store. 기간은 KST 달력 날짜로 받고
 * (`?from=2026-09-01&to=2026-09-30`), 한 번에 366일까지다. 모집단·환불 합산 규칙은
 * lib/ops/salesLedger.ts에 있다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }

  const from = typeof req.query.from === 'string' ? req.query.from : '';
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  const rangeError = validateLedgerRange({ from, to });
  if (rangeError) return res.status(400).json({ ok: false, message: rangeError });

  try {
    const rows = await listSalesLedgerRows({ from, to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sales-${from}_${to}.csv"`);
    return res.status(200).send(toCsv(rows, [...SALES_LEDGER_COLUMNS]));
  } catch (error: unknown) {
    console.error('[API/admin/orders/export] 장부 조회 실패:', error);
    return res.status(500).json({ ok: false, message: '장부를 만들지 못했습니다.' });
  }
}
