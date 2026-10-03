import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { toCsv } from '../../../../../lib/funding/csv';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../../lib/privacy/accessLog';
import { listRosterRows, ROSTER_COLUMNS } from '../../../../../lib/shows/adminQueries';

/**
 * 회차 명단 CSV — 입장 확인용. 구매자 이름·연락처가 실리므로 관리자 세션 필수·no-store,
 * 내려받은 사실(대상 회차·건수)을 접속기록에 남긴다(funding 내보내기와 같은 규칙).
 * 환불·무효 티켓은 싣지 않는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false });
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const showtimeId = typeof req.query.showtimeId === 'string' ? req.query.showtimeId : '';
  const showtime = id && showtimeId
    ? await getDb().query.showtimes.findFirst({ where: (s, { and, eq }) => and(eq(s.id, showtimeId), eq(s.showId, id)), with: { show: true } })
    : undefined;
  if (!showtime) return res.status(404).json({ ok: false, message: '회차를 찾을 수 없습니다.' });

  const log = (result: PrivacyAccessResult, rowCount?: number) =>
    recordAdminPrivacyAccess(req, auth.actor, 'show_roster_export', showtimeId, result, rowCount).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 다운로드는 계속됩니다', error);
    });

  let rows;
  try {
    rows = await listRosterRows(showtimeId);
  } catch (error: unknown) {
    await log('error');
    console.error('[API/admin/shows/roster] 명단 조회 실패:', error);
    return res.status(500).json({ ok: false, message: '명단을 만들지 못했습니다.' });
  }
  await log('success', rows.length);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="roster-${showtime.show.slug}-${showtimeId.slice(0, 8)}.csv"`);
  return res.status(200).send(toCsv(rows as unknown as Array<Record<string, string | number | null>>, ROSTER_COLUMNS));
}
