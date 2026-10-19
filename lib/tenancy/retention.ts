import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { deleteEventOnCalendar } from '../booking/gcal';
import { tenancyCalendarId } from './calendar';

/**
 * 월 입주 기록의 보관 기간 — 퇴실일(`ended_on`)로부터 **3년**이면 개인정보(`private_enc`: 연락처·비상연락처·이메일·사업자번호·성별)를 비우고,
 * **5년**이면 입금 이력과 기록 전체를 지운다(상거래 기록 보존 기준, 처리방침 19항). 입주 중인 기록은 건드리지 않는다.
 * 계약서에서 가져온 연락처 사본이 계약 파기(3년) 뒤에도 남지 않게 하는 장치이기도 하다(가져오기가 계약서 연락처를 이 표로 복사한다).
 * 월 1회 크론(`/api/cron/purge-contracts`)이 부른다. 이미 지운 건은 건너뛰므로 재시도해도 안전하다.
 */
export const TENANCY_PERSONAL_DATA_YEARS = 3;
export const TENANCY_RECORD_YEARS = 5;

const yearsAgo = (now: Date, years: number): string => {
  const d = new Date(now.getTime() + 9 * 3600 * 1000);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
};

export const purgeEndedTenancies = async (now: Date = new Date()): Promise<{ personalCleared: number; recordsDeleted: number }> => {
  const db = getDb();
  const cleared = await db.run(sql`
    UPDATE room_tenancies SET private_enc = NULL, updated_at = unixepoch()
    WHERE status = 'ended' AND private_enc IS NOT NULL AND ended_on IS NOT NULL AND ended_on < ${yearsAgo(now, TENANCY_PERSONAL_DATA_YEARS)}
  `);
  const old = await db.all<{ id: string; due: string | null; end: string | null }>(sql`
    SELECT id, due_event_id AS due, end_event_id AS end FROM room_tenancies WHERE status = 'ended' AND ended_on IS NOT NULL AND ended_on < ${yearsAgo(now, TENANCY_RECORD_YEARS)}
  `);
  const calId = tenancyCalendarId();
  for (const { id, due, end } of old) {
    // 퇴실 때 캘린더 일정 삭제가 실패했다면 연락처가 적힌 일정이 구글에 남는다 — 행을 지우기 전에 한 번 더 지워 본다(실패해도 파기는 계속한다).
    if (calId) for (const eventId of [due, end]) if (eventId) await deleteEventOnCalendar(calId, eventId).catch(() => undefined);
    await db.batch([db.run(sql`DELETE FROM room_tenancy_payments WHERE tenancy_id = ${id}`), db.run(sql`DELETE FROM room_tenancies WHERE id = ${id}`)]);
  }
  return { personalCleared: Number(cleared.rowsAffected), recordsDeleted: old.length };
};
