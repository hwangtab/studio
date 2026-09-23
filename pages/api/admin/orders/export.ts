import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { toCsv } from '../../../../lib/funding/csv';
import { listSalesLedgerRows, SALES_LEDGER_COLUMNS, validateLedgerRange } from '../../../../lib/ops/salesLedger';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../lib/privacy/accessLog';

/**
 * 토스 결제 장부 CSV — 기간 안에 승인된 결제 전부(서비스 구분 없음). 부가세·정산용.
 *
 * 연락처가 실리는 다운로드라 관리자 세션 필수, no-store. 기간은 KST 달력 날짜로 받고
 * (`?from=2026-09-01&to=2026-09-30`), 한 번에 366일까지다. 모집단·환불 합산 규칙은
 * lib/ops/salesLedger.ts에 있다.
 *
 * 내려받은 사실은 접속기록에 남긴다(`privacy_access_logs`). 서비스 구분 없이 기간 전체의
 * 이름·연락처·이메일이 한 파일로 나가므로, 펀딩 CSV와 같은 무게의 동작이다. 기록에 담는
 * 것은 **기간과 건수**뿐이다 — 장부의 내용은 한 칸도 적지 않는다.
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

  /**
   * 기록 경로의 예외가 다운로드를 끊지 않게 한 겹 더 받는다(payout-account.ts와 같은 이유).
   * 기간이 검증을 통과한 뒤에만 부른다 — 형식이 틀린 400은 아무것도 조회하지 않았다.
   */
  const log = (result: PrivacyAccessResult, rowCount?: number) =>
    recordAdminPrivacyAccess(req, 'sales_ledger_export', `${from}_${to}`, result, rowCount).catch(
      (error: unknown) => {
        console.error('[privacy] 접속기록 호출 실패 — 다운로드는 계속됩니다', error);
      },
    );

  try {
    const rows = await listSalesLedgerRows({ from, to });
    await log('success', rows.length);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sales-${from}_${to}.csv"`);
    return res.status(200).send(toCsv(rows, [...SALES_LEDGER_COLUMNS]));
  } catch (error: unknown) {
    await log('error');
    console.error('[API/admin/orders/export] 장부 조회 실패:', error);
    return res.status(500).json({ ok: false, message: '장부를 만들지 못했습니다.' });
  }
}
