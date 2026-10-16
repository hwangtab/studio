import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { toCsv } from '../../../../lib/funding/csv';
import {
  listPartnerPayoutExportRows, PARTNER_PAYOUT_EXPORT_COLUMNS, parseExportKind, validatePartnerPayoutRange,
} from '../../../../lib/partnerPayouts/export';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../lib/privacy/accessLog';

/**
 * 상점·공연 정산 CSV — 세무사에게 넘기는 정산 내역. `GET ?kind=shop|show|all&from=YYYY-MM&to=YYYY-MM`(KST 달, 한 번에 24개월까지).
 *
 * 수취인 이름과 금액만 실린다 — 주민등록번호·계좌번호·이메일·연락처는 파일 어디에도 없다(`lib/partnerPayouts/export.ts`).
 * 그래도 이름+소득 금액이 한 파일로 나가므로 관리자 세션 필수, no-store, 내려받은 사실은 접속기록에 남긴다(`partner_payout_export`).
 * 기록에는 **기간과 행 수**뿐이다 — 값은 한 칸도 적지 않는다. 성공과 오류 모두 남기고, 형식이 틀린 400은 아무것도 조회하지 않았으니 남기지 않는다
 * (`pages/api/admin/orders/export.ts`와 같은 틀).
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
  const kind = parseExportKind(typeof req.query.kind === 'string' ? req.query.kind : undefined);
  if (!kind) return res.status(400).json({ ok: false, message: 'kind는 shop, show, all 중 하나여야 합니다.' });
  const rangeError = validatePartnerPayoutRange({ from, to });
  if (rangeError) return res.status(400).json({ ok: false, message: rangeError });

  /** 기록 경로의 예외가 다운로드를 끊지 않게 한 겹 더 받는다. */
  const log = (result: PrivacyAccessResult, rowCount?: number) =>
    recordAdminPrivacyAccess(req, auth.actor, 'partner_payout_export', `${kind}_${from}_${to}`, result, rowCount).catch(
      (error: unknown) => {
        console.error('[privacy] 접속기록 호출 실패 — 다운로드는 계속됩니다', error);
      },
    );

  try {
    const rows = await listPartnerPayoutExportRows({ kind, from, to });
    await log('success', rows.length);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="partner-payouts-${kind}-${from}_${to}.csv"`);
    return res.status(200).send(toCsv(rows, [...PARTNER_PAYOUT_EXPORT_COLUMNS]));
  } catch (error: unknown) {
    await log('error');
    console.error('[API/admin/partner-payouts/export] 정산 조회 실패:', error);
    return res.status(500).json({ ok: false, message: '정산 내역을 만들지 못했습니다. 마이그레이션 0067이 적용됐는지 확인해 주세요.' });
  }
}
