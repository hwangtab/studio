import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { roomTenancies, roomTenancyPayments, type RoomTenancy } from '../../db/schema';
import { sealPrivate } from './privateData';
import { addMonthsOnBillingDay, isPlausibleDate, isValidDate, kstToday, type TenancyInput } from './rules';
import { syncTenancyCalendar } from './calendar';

/**
 * 월 입주 서비스 — 모든 쓰기는 여기를 지난다(관리자 API·CSV 가져오기 공통). 쓰기 뒤에 캘린더를 맞추되 실패는 삼키고 결과에 싣는다
 * (정본은 DB). 개인정보는 `private_enc`로만 저장하고, 목록 조회는 그 칸을 읽지 않는다.
 */

export type TenancyListRow = Omit<RoomTenancy, 'privateEnc' | 'createdAt' | 'updatedAt'> & { hasPrivate: boolean; lastPaidOn: string | null; lastPaidAmount: number | null };

export type ServiceResult<T = object> = ({ ok: true; calendarError?: string | null } & T) | { ok: false; message: string };

const calendarNote = async (id: string): Promise<{ calendarError: string | null }> => {
  const r = await syncTenancyCalendar(id);
  return { calendarError: r.ok ? null : r.error };
};

/** DB의 부분 유일 인덱스(`room_tenancies_active_room_uq`)가 동시 요청의 두 번째 쓰기를 막았는가 — drizzle은 원인 오류를 `cause`에 싣는다. */
const isActiveRoomConflict = (error: unknown): boolean => {
  const text = (e: unknown): string => (e instanceof Error ? `${e.message} ${text((e as { cause?: unknown }).cause)}` : typeof e === 'string' ? e : '');
  return /UNIQUE constraint failed/i.test(text(error));
};

/** 활성 입주자가 같은 방에 둘이 되면 안 된다(비상주는 방이 없어 제외). */
const roomTaken = async (roomNumber: string | null, exceptId?: string): Promise<boolean> => {
  if (!roomNumber) return false;
  const rows = await getDb()
    .select({ id: roomTenancies.id })
    .from(roomTenancies)
    .where(and(eq(roomTenancies.roomNumber, roomNumber), eq(roomTenancies.status, 'active'), exceptId ? ne(roomTenancies.id, exceptId) : sql`1 = 1`))
    .limit(1);
  return rows.length > 0;
};

export const listTenancies = async (): Promise<TenancyListRow[]> => {
  const db = getDb();
  const rows = await db.select().from(roomTenancies).orderBy(asc(roomTenancies.kind), asc(roomTenancies.roomNumber), asc(roomTenancies.tenantName));
  const payments = await db.select().from(roomTenancyPayments).orderBy(desc(roomTenancyPayments.paidOn), desc(roomTenancyPayments.createdAt));
  const last = new Map<string, { paidOn: string; amount: number }>();
  for (const p of payments) if (!last.has(p.tenancyId)) last.set(p.tenancyId, { paidOn: p.paidOn, amount: p.amount });
  // Date 컬럼(createdAt·updatedAt)은 Next 페이지 props로 직렬화되지 않는다(dev에서 오류) — 화면이 안 쓰므로 뺀다.
  return rows.map(({ privateEnc, createdAt: _createdAt, updatedAt: _updatedAt, ...rest }) => ({
    ...rest, hasPrivate: !!privateEnc, lastPaidOn: last.get(rest.id)?.paidOn ?? null, lastPaidAmount: last.get(rest.id)?.amount ?? null,
  }));
};

export const createTenancy = async (input: TenancyInput, opts: { lastPaid?: { paidOn: string; amount: number } } = {}): Promise<ServiceResult<{ id: string }>> => {
  if (await roomTaken(input.roomNumber)) return { ok: false, message: `${input.roomNumber}에 이미 입주 중인 사람이 있어요. 먼저 퇴실 처리해 주세요.` };
  const db = getDb();
  let row: { id: string };
  try {
    [row] = await db
      .insert(roomTenancies)
      .values({
      kind: input.kind, roomNumber: input.roomNumber, tenantName: input.tenantName, monthlyAmount: input.monthlyAmount,
      depositAmount: input.depositAmount, startDate: input.startDate, endDate: input.endDate, billingDay: input.billingDay,
      nextDueOn: input.nextDueOn, hasWindow: input.hasWindow, furnishings: input.furnishings, roomListPrice: input.roomListPrice,
      note: input.note, contractId: input.contractId, privateEnc: sealPrivate(input.private),
    })
      .returning({ id: roomTenancies.id });
  } catch (error) {
    if (isActiveRoomConflict(error)) return { ok: false, message: `${input.roomNumber}에 이미 입주 중인 사람이 있어요(방금 다른 요청이 먼저 등록했어요).` };
    throw error;
  }
  if (opts.lastPaid) {
    await db.insert(roomTenancyPayments).values({ tenancyId: row.id, paidOn: opts.lastPaid.paidOn, amount: opts.lastPaid.amount, memo: '가져오기(기존 시트의 최종 입금)' });
  }
  return { ok: true, id: row.id, ...(await calendarNote(row.id)) };
};

export const updateTenancy = async (id: string, input: TenancyInput, opts: { keepPrivate: boolean }): Promise<ServiceResult> => {
  const current = await getDb().query.roomTenancies.findFirst({ where: (c, { eq: e }) => e(c.id, id) });
  if (!current) return { ok: false, message: '입주 기록을 찾을 수 없어요.' };
  if (current.status === 'active' && (await roomTaken(input.roomNumber, id))) return { ok: false, message: `${input.roomNumber}에 이미 입주 중인 사람이 있어요.` };
  try {
    await getDb()
      .update(roomTenancies)
      .set({
      kind: input.kind, roomNumber: input.roomNumber, tenantName: input.tenantName, monthlyAmount: input.monthlyAmount,
      depositAmount: input.depositAmount, startDate: input.startDate, endDate: input.endDate, billingDay: input.billingDay,
      nextDueOn: input.nextDueOn, hasWindow: input.hasWindow, furnishings: input.furnishings, roomListPrice: input.roomListPrice,
      note: input.note, contractId: input.contractId,
      // 상세를 열어 보지 않은 채 저장하면(keepPrivate) 암호문을 그대로 둔다 — 빈 값으로 덮어쓰지 않는다.
      ...(opts.keepPrivate ? {} : { privateEnc: sealPrivate(input.private) }),
      updatedAt: new Date(),
    })
      .where(eq(roomTenancies.id, id));
  } catch (error) {
    if (isActiveRoomConflict(error)) return { ok: false, message: `${input.roomNumber}에 이미 입주 중인 사람이 있어요.` };
    throw error;
  }
  return { ok: true, ...(await calendarNote(id)) };
};

/** 입금 기록 — 입금 예정일을 한 달 넘긴다(납부일 기준). 기본 금액은 월 이용료, 입금일은 오늘. */
export const recordPayment = async (id: string, input: { paidOn?: string; amount?: number; memo?: string | null }): Promise<ServiceResult<{ nextDueOn: string }>> => {
  const db = getDb();
  const t = await db.query.roomTenancies.findFirst({ where: (c, { eq: e }) => e(c.id, id) });
  if (!t || t.status !== 'active') return { ok: false, message: '입주 중인 기록만 입금을 기록할 수 있어요.' };
  const paidOn = input.paidOn ?? kstToday();
  if (!isValidDate(paidOn) || !isPlausibleDate(paidOn, new Date(), 1)) return { ok: false, message: '입금일을 확인해 주세요(2020년 이후, 내일까지).' };
  const amount = input.amount ?? t.monthlyAmount;
  if (!Number.isInteger(amount) || amount < 0 || amount > 100_000_000) return { ok: false, message: '입금액을 확인해 주세요.' };
  const nextDueOn = addMonthsOnBillingDay(t.nextDueOn, 1, t.billingDay);
  // 같은 예정일 치를 두 번 기록하지 못하게 예정일을 조건으로 건다(더블클릭·동시 요청).
  const moved = await db.run(sql`UPDATE room_tenancies SET next_due_on = ${nextDueOn}, updated_at = unixepoch() WHERE id = ${id} AND next_due_on = ${t.nextDueOn} AND status = 'active'`);
  if (Number(moved.rowsAffected) === 0) return { ok: false, message: '방금 다른 곳에서 바뀌었어요. 새로고침 후 다시 눌러 주세요.' };
  await db.insert(roomTenancyPayments).values({ tenancyId: id, paidOn, amount, forDueOn: t.nextDueOn, memo: input.memo ?? null });
  return { ok: true, nextDueOn, ...(await calendarNote(id)) };
};

export const endTenancy = async (id: string, endedOn: string = kstToday()): Promise<ServiceResult> => {
  if (!isValidDate(endedOn) || !isPlausibleDate(endedOn, new Date(), 31)) return { ok: false, message: '퇴실일을 확인해 주세요(2020년 이후, 한 달 안).' };
  // 퇴실일이 입주 시작일보다 앞서면 거절한다 — 그런 오타가 들어가면 파기 크론이 입금 이력까지 지운다(감사 2026-10-19).
  const r = await getDb().run(sql`UPDATE room_tenancies SET status = 'ended', ended_on = ${endedOn}, updated_at = unixepoch() WHERE id = ${id} AND status = 'active' AND start_date <= ${endedOn}`);
  if (Number(r.rowsAffected) === 0) return { ok: false, message: '입주 중인 기록이 아니거나, 퇴실일이 입주 시작일보다 앞서요.' };
  return { ok: true, ...(await calendarNote(id)) };
};

/** 퇴실을 되돌린다(잘못 눌렀을 때). 방이 그새 다른 사람에게 가 있으면 거절한다. */
export const reopenTenancy = async (id: string): Promise<ServiceResult> => {
  const t = await getDb().query.roomTenancies.findFirst({ where: (c, { eq: e }) => e(c.id, id) });
  if (!t || t.status !== 'ended') return { ok: false, message: '퇴실한 기록이 아니에요.' };
  if (await roomTaken(t.roomNumber, id)) return { ok: false, message: `${t.roomNumber}에 지금 다른 입주자가 있어 되돌릴 수 없어요.` };
  try {
    await getDb().update(roomTenancies).set({ status: 'active', endedOn: null, updatedAt: new Date() }).where(eq(roomTenancies.id, id));
  } catch (error) {
    if (isActiveRoomConflict(error)) return { ok: false, message: `${t.roomNumber}에 지금 다른 입주자가 있어 되돌릴 수 없어요.` };
    throw error;
  }
  return { ok: true, ...(await calendarNote(id)) };
};

export const listPayments = (id: string) =>
  getDb().select().from(roomTenancyPayments).where(eq(roomTenancyPayments.tenancyId, id)).orderBy(desc(roomTenancyPayments.paidOn), desc(roomTenancyPayments.createdAt));
