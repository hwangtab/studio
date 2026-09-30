import { sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { rowsAffectedOf } from './service';

export type CheckInOutcome =
  | { status: 'checked_in'; entryNumber: number | null }
  | { status: 'already_checked_in' }
  | { status: 'invalid' };

const DEBOUNCE_SECONDS = 10;
const UNDO_WINDOW_SECONDS = 120;

export async function checkInTicket(code: string, checkedInBy: string, now: Date): Promise<CheckInOutcome> {
  const db = getDb();
  const nowSec = Math.floor(now.getTime() / 1000);

  const ticket = await db.query.showTickets.findFirst({
    where: (t, { eq }) => eq(t.code, code),
    with: { showtime: true },
  });
  if (!ticket) return { status: 'invalid' };
  if (ticket.status !== 'issued') return { status: 'invalid' };
  if ((ticket as any).showtime.status !== 'scheduled') return { status: 'invalid' };

  if (ticket.checkedInAt != null) {
    if (nowSec - ticket.checkedInAt < DEBOUNCE_SECONDS && ticket.checkedInBy === checkedInBy) {
      return { status: 'checked_in', entryNumber: ticket.entryNumber };
    }
    return { status: 'already_checked_in' };
  }

  const result = await db.run(sql`
    update show_tickets set checked_in_at = ${nowSec}, checked_in_by = ${checkedInBy}
    where id = ${ticket.id} and checked_in_at is null and status = 'issued'
      and exists (select 1 from showtimes where showtimes.id = ${ticket.showtimeId} and showtimes.status = 'scheduled')
  `);
  if (rowsAffectedOf(result) === 0) return { status: 'already_checked_in' };
  return { status: 'checked_in', entryNumber: ticket.entryNumber };
}

export async function undoCheckIn(ticketId: string, actorId: string, now: Date): Promise<boolean> {
  const db = getDb();
  const nowSec = Math.floor(now.getTime() / 1000);
  const ticket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, ticketId) });
  if (!ticket || ticket.checkedInAt == null) return false;
  const isAdmin = actorId === 'admin';
  if (!isAdmin) {
    if (ticket.checkedInBy !== actorId) return false;
    if (nowSec - ticket.checkedInAt > UNDO_WINDOW_SECONDS) return false;
  }
  const result = await db.run(sql`
    update show_tickets set checked_in_at = null, checked_in_by = null
    where id = ${ticketId}
  `);
  return rowsAffectedOf(result) > 0;
}
