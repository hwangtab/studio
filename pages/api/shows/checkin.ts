import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { checkInTicket, undoCheckIn } from '../../../lib/shows/checkin';
import { formatEntryNumber } from '../../../lib/shows/format';
import { extractTicketCode, resolveScanAccess, scanActorId } from '../../../lib/shows/scanAccess';

/**
 * 입장 확인 — 스캔 링크 토큰(URL의 비밀)이 곧 인증이다. 토큰은 **한 회차**에만 열려 있고,
 * 다른 회차(다른 날 공연)의 티켓은 코드가 유효해도 `wrong_showtime`으로 돌려 보낸다.
 *
 * 응답 본문에는 입장 번호와 회차 집계만 싣는다. 구매자 이름·연락처는 스태프 화면에도 내려보내지 않는다.
 *
 * 토큰 불일치·만료·폐기는 전부 401 하나로 답한다(어느 쪽인지 알려 주면 토큰 추측의 단서가 된다).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const body = (typeof req.body === 'object' && req.body) || {};
  const access = await resolveScanAccess(body.token);
  if (!access) return res.status(401).json({ ok: false, status: 'unauthorized' });

  const code = extractTicketCode(body.code);
  if (!code) return res.status(200).json({ ok: true, status: 'invalid' });

  const db = getDb();
  const ticket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.code, code) });
  if (!ticket) return res.status(200).json({ ok: true, status: 'invalid' });
  if (ticket.showtimeId !== access.showtimeId) return res.status(200).json({ ok: true, status: 'wrong_showtime' });

  const now = new Date();
  const actor = scanActorId(access.label);

  if (body.action === 'undo') {
    const undone = await undoCheckIn(ticket.id, actor, now);
    return res.status(200).json({ ok: true, status: undone ? 'undone' : 'undo_rejected', counts: await counts(access.showtimeId) });
  }

  const outcome = await checkInTicket(code, actor, now);
  if (outcome.status === 'checked_in') {
    return res.status(200).json({
      ok: true,
      status: 'checked_in',
      entryNumber: outcome.entryNumber != null ? formatEntryNumber(outcome.entryNumber) : null,
      counts: await counts(access.showtimeId),
    });
  }
  return res.status(200).json({ ok: true, status: outcome.status, counts: await counts(access.showtimeId) });

  async function counts(showtimeId: string) {
    const rows = (await db.all(sql`
      SELECT COUNT(*) as issued, COALESCE(SUM(CASE WHEN checked_in_at IS NOT NULL THEN 1 ELSE 0 END), 0) as checkedIn
      FROM show_tickets WHERE showtime_id = ${showtimeId} AND status = 'issued'
    `)) as Array<{ issued: number; checkedIn: number }>;
    return { issued: Number(rows[0]?.issued ?? 0), checkedIn: Number(rows[0]?.checkedIn ?? 0) };
  }
}
