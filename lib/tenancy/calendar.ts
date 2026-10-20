import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { roomTenancies, type RoomTenancy } from '../../db/schema';
import { createEventOnCalendar, deleteEventOnCalendar, patchEventOnCalendar, type RawEventBody } from '../booking/gcal';
import { addDays, currentTermEnd, kstToday } from './rules';
import { openPrivate } from './privateData';

/**
 * 월 입주 → 구글 캘린더. **캘린더는 `room_tenancies`의 투영이다** — 정본은 DB이고, 어긋나면 `syncTenancyCalendar`를 다시 돌리면 맞는다.
 *
 * 기존 연습실 캘린더(`PRACTICE_ROOM_GCAL_ID`)에 올린다(전용 `TENANCY_GCAL_ID`가 있으면 그쪽). 이 캘린더의 일정은 보통 웹 예약 시간을 막지만,
 * 모든 일정을 **"바쁨 아님"(`transparency: 'transparent'`)** 으로 올려 freeBusy에 잡히지 않는다 — 안 그러면 입금일마다 시간제 방(R02)이 하루 종일 막힌다.
 * 이 투명 표시를 빼지 말 것(테스트가 막는다). 녹음실 예약 캘린더(`BOOKING_GCAL_ID`)에는 올리지 않는다.
 *
 * 입주자 한 명당 일정은 최대 둘, 둘 다 종일 일정이다:
 * - **입금 예정**: 다음 입금 예정일(`next_due_on`)에 한 건. 입금을 기록하면 다음 달로 옮겨진다(반복 일정이 아닌 이유: 입금했는지를
 *   반복 일정은 모른다). 예정일이 지났는데 그 자리에 그대로 있으면 연체다.
 * - **계약 종료**: 현재 계약 기간의 종료일(`currentTermEnd`). 약정 만료일이 지났어도 입금이 이어지면 계약서 제3조①에 따라 1개월씩
 *   자동 갱신되므로, 일정은 갱신된 기간의 종료일로 옮겨 간다(`rollRenewedTenancyCalendars`가 매일 운영 점검 크론에서 옮긴다).
 * 퇴실 처리하면 둘 다 지운다. env가 없으면 아무것도 하지 않는다(`skipped`).
 */

/** 전용 캘린더(`TENANCY_GCAL_ID`)가 있으면 그것, 없으면 기존 연습실 캘린더(`PRACTICE_ROOM_GCAL_ID`). */
export const tenancyCalendarId = (): string | null => process.env.TENANCY_GCAL_ID || process.env.PRACTICE_ROOM_GCAL_ID || null;

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const labelOf = (t: Pick<RoomTenancy, 'kind' | 'roomNumber' | 'tenantName'>) => `${t.kind === 'virtual' ? '비상주' : t.roomNumber} ${t.tenantName}`;

const allDay = (date: string): Pick<RawEventBody, 'start' | 'end' | 'transparency'> => ({ start: { date }, end: { date: addDays(date, 1) }, transparency: 'transparent' });

const describe = (t: RoomTenancy): string => {
  let phone = '';
  try {
    phone = openPrivate(t.privateEnc).phone ?? '';
  } catch {
    // 복호화 실패는 일정을 막지 않는다 — 연락처만 빠진다.
  }
  return [
    `${t.kind === 'virtual' ? '비상주 사무실' : `방 ${t.roomNumber}`} · 월 ${won(t.monthlyAmount)}`,
    phone ? `연락처: ${phone}` : null,
    t.note ? `메모: ${t.note}` : null,
    '입금하면 관리자 화면 “입주 관리”에서 입금 기록을 누르세요(일정이 다음 달로 옮겨집니다).',
  ].filter(Boolean).join('\n');
};

type Slot = 'due' | 'end';

const upsert = async (calId: string, existingId: string | null, body: RawEventBody): Promise<string> => {
  if (existingId && (await patchEventOnCalendar(calId, existingId, body))) return existingId;
  return createEventOnCalendar(calId, body);
};

export type TenancySyncResult = { ok: true; skipped?: boolean } | { ok: false; error: string };

/** 입주자 한 명의 일정을 DB 상태에 맞춘다. 던지지 않는다 — 실패는 `gcal_error`에 적고 결과로 돌려준다. */
export const syncTenancyCalendar = async (id: string, now: Date = new Date()): Promise<TenancySyncResult> => {
  const calId = tenancyCalendarId();
  if (!calId) return { ok: true, skipped: true };
  const db = getDb();
  const t = await db.query.roomTenancies.findFirst({ where: (c, { eq: e }) => e(c.id, id) });
  if (!t) return { ok: false, error: '입주 기록을 찾을 수 없어요.' };
  const today = kstToday(now);
  const ids: Record<Slot, string | null> = { due: t.dueEventId, end: t.endEventId };
  try {
    const wantDue = t.status === 'active';
    const term = t.status === 'active' && t.endDate ? currentTermEnd(t.endDate, today) : null;
    const wantEnd = term !== null;
    if (wantDue) {
      ids.due = await upsert(calId, ids.due, {
        summary: `[입금 예정] ${labelOf(t)} ${won(t.monthlyAmount)}`, description: describe(t), ...allDay(t.nextDueOn),
      });
    } else if (ids.due) {
      await deleteEventOnCalendar(calId, ids.due);
      ids.due = null;
    }
    if (wantEnd) {
      const renewed = term.renewals > 0;
      ids.end = await upsert(calId, ids.end, {
        summary: `[계약 종료${renewed ? '·자동 갱신 중' : ''}] ${labelOf(t)}`,
        description: renewed ? `${describe(t)}\n약정 만료일 ${t.endDate} 이후 ${term.renewals}회 자동 갱신됨(계약서 제3조①). 종료하려면 퇴실 처리.` : describe(t),
        ...allDay(term.end),
      });
    } else if (ids.end) {
      await deleteEventOnCalendar(calId, ids.end);
      ids.end = null;
    }
    await db.update(roomTenancies).set({ dueEventId: ids.due, endEventId: ids.end, gcalError: null }).where(eq(roomTenancies.id, id));
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[tenancy-calendar] 동기화 실패', { id, detail });
    // 일부만 성공했을 수 있다 — 만든 일정 id는 잃지 않게 저장한다.
    await db.update(roomTenancies).set({ dueEventId: ids.due, endEventId: ids.end, gcalError: `${kstToday(now)}: ${detail}` }).where(eq(roomTenancies.id, id)).catch(() => undefined);
    return { ok: false, error: detail };
  }
};

/** 전체 다시 맞추기 — 복구용. 한 건이 실패해도 나머지를 계속한다. */
export const syncAllTenancyCalendars = async (now: Date = new Date()): Promise<{ total: number; failed: number; skipped: boolean }> => {
  if (!tenancyCalendarId()) return { total: 0, failed: 0, skipped: true };
  const rows = await getDb().select({ id: roomTenancies.id }).from(roomTenancies).where(sql`1 = 1`);
  let failed = 0;
  for (const row of rows) {
    const r = await syncTenancyCalendar(row.id, now);
    if (!r.ok) failed += 1;
  }
  return { total: rows.length, failed, skipped: false };
};

/**
 * 자동 갱신으로 현재 기간의 종료일이 어제와 달라진 입주자(또는 갱신 중인데 종료 일정이 없는 입주자)의 캘린더만 다시 맞춘다.
 * 매일 운영 점검 크론이 부른다. 던지지 않고 실패는 `gcal_error`에 남는다(점검 메일이 알린다).
 */
export const rollRenewedTenancyCalendars = async (now: Date = new Date()): Promise<{ synced: number; failed: number }> => {
  if (!tenancyCalendarId()) return { synced: 0, failed: 0 };
  const today = kstToday(now);
  const yesterday = addDays(today, -1);
  const rows = await getDb().select({ id: roomTenancies.id, endDate: roomTenancies.endDate, endEventId: roomTenancies.endEventId }).from(roomTenancies)
    .where(sql`status = 'active' AND end_date IS NOT NULL AND end_date < ${today}`);
  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    const end = row.endDate as string;
    if (row.endEventId && currentTermEnd(end, today).end === currentTermEnd(end, yesterday).end) continue;
    const r = await syncTenancyCalendar(row.id, now);
    if (r.ok) synced += 1;
    else failed += 1;
  }
  return { synced, failed };
};
