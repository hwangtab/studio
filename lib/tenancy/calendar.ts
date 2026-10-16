import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { roomTenancies, type RoomTenancy } from '../../db/schema';
import { createEventOnCalendar, deleteEventOnCalendar, patchEventOnCalendar, type RawEventBody } from '../booking/gcal';
import { addDays, kstToday } from './rules';
import { openPrivate } from './privateData';

/**
 * 월 입주 → 구글 캘린더. **캘린더는 `room_tenancies`의 투영이다** — 정본은 DB이고, 어긋나면 `syncTenancyCalendar`를 다시 돌리면 맞는다.
 *
 * 별도 캘린더(env `TENANCY_GCAL_ID`)를 쓴다. 예약 캘린더·연습실 캘린더는 "일정이 있으면 그 시간 웹 예약이 막히는" 캘린더라
 * 여기 올리면 시간제 방(R02)이 통째로 막힌다 — 이 일정들은 예약 가능 시간과 무관해야 한다.
 *
 * 입주자 한 명당 일정은 최대 둘, 둘 다 종일 일정이다:
 * - **입금 예정**: 다음 입금 예정일(`next_due_on`)에 한 건. 입금을 기록하면 다음 달로 옮겨진다(반복 일정이 아닌 이유: 입금했는지를
 *   반복 일정은 모른다). 예정일이 지났는데 그 자리에 그대로 있으면 연체다.
 * - **계약 종료**: 종료일이 오늘 이후일 때만. 종료일이 지났는데 계속 이용 중이면(자동 연장) 만들지 않는다.
 * 퇴실 처리하면 둘 다 지운다. env가 없으면 아무것도 하지 않는다(`skipped`).
 */

export const tenancyCalendarId = (): string | null => process.env.TENANCY_GCAL_ID || null;

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const labelOf = (t: Pick<RoomTenancy, 'kind' | 'roomNumber' | 'tenantName'>) => `${t.kind === 'virtual' ? '비상주' : t.roomNumber} ${t.tenantName}`;

const allDay = (date: string): Pick<RawEventBody, 'start' | 'end'> => ({ start: { date }, end: { date: addDays(date, 1) } });

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
    const wantEnd = t.status === 'active' && !!t.endDate && t.endDate >= today;
    if (wantDue) {
      ids.due = await upsert(calId, ids.due, {
        summary: `[입금 예정] ${labelOf(t)} ${won(t.monthlyAmount)}`, description: describe(t), ...allDay(t.nextDueOn),
      });
    } else if (ids.due) {
      await deleteEventOnCalendar(calId, ids.due);
      ids.due = null;
    }
    if (wantEnd) {
      ids.end = await upsert(calId, ids.end, { summary: `[계약 종료] ${labelOf(t)}`, description: describe(t), ...allDay(t.endDate as string) });
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
