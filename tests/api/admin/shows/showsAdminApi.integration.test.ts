/** @jest-environment node */

/**
 * 관리자 공연 API — 인증(401)·소속 확인·주요 액션. 도메인 함수 자체는 lib/shows의 통합 테스트가 맡고,
 * 여기서는 라우트가 (1) 세션 없으면 막는지 (2) 다른 공연의 id로 조작하지 못하게 하는지를 본다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../../helpers/showsDb';
import { shows, showTickets, showtimes, showTicketTypes, showZones } from '../../../../db/schema';
import { seedShow } from '../../../../lib/shows/seed';
import { bakkeojiShow } from '../../../../data/shows/bakkeoji-anneun-maeumdeul';

let mockDb: ShowsTestDb;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/booking/toss', () => ({ cancelPayment: jest.fn() }));
jest.mock('../../../../lib/shows/scanLink', () => ({ issueScanLink: jest.fn(async () => ({ token: 'tok-secret-1234567890', id: 'l1', expiresAt: 1 })), SCAN_LINK_MAX_TTL_HOURS: 72, verifyScanLink: jest.fn() }));
jest.mock('../../../../lib/privacy/accessLog', () => ({ recordAdminPrivacyAccess: jest.fn(async () => undefined) }));

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { recordAdminPrivacyAccess } from '../../../../lib/privacy/accessLog';
import handler from '../../../../pages/api/admin/shows/[id]';
import rosterHandler from '../../../../pages/api/admin/shows/[id]/roster';

type MockRes = NextApiResponse & { status: jest.Mock; json: jest.Mock; send: jest.Mock; setHeader: jest.Mock; revalidate: jest.Mock };
const makeRes = () => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.revalidate = jest.fn().mockResolvedValue(undefined);
  return res as unknown as MockRes;
};
const call = async (h: typeof handler, req: Partial<NextApiRequest>) => {
  const res = makeRes();
  await h({ method: 'POST', query: {}, body: {}, headers: {}, ...req } as NextApiRequest, res);
  return res;
};

describe('관리자 공연 API', () => {
  let showId: string;
  let showtimeId: string;
  let ticketTypeId: string;

  beforeEach(async () => {
    mockDb = (await createTestDb()).db;
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha', name: '황경하' });
    // 판매 가능한 미래 회차가 필요하다 — 정의의 고정 날짜(2026-10-24)는 시계에 따라 지났을 수 있어 새로 만든다.
    const future = new Date(Date.now() + 14 * 86400 * 1000);
    await seedShow(mockDb, { ...bakkeojiShow, showtimes: [{ startsAt: future }], ticketTypes: [{ ...bakkeojiShow.ticketTypes[0], compQuota: 5 }] }, { apply: true });
    const show = (await mockDb.select().from(shows))[0];
    showId = show.id;
    showtimeId = (await mockDb.select().from(showtimes))[0].id;
    ticketTypeId = (await mockDb.select().from(showTicketTypes))[0].id;
  });

  it('세션이 없으면 401', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const res = await call(handler, { query: { id: showId }, body: { action: 'set_status', status: 'published' } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect((await mockDb.select().from(shows))[0].status).toBe('draft');
  });

  it('명단 CSV도 세션이 없으면 401이고 접속기록을 남기지 않는다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const res = await call(rosterHandler, { method: 'GET', query: { id: showId, showtimeId } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  });

  it('POST만 받는다', async () => {
    const res = await call(handler, { method: 'GET', query: { id: showId } });
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('공개 → 비공개 전환', async () => {
    let res = await call(handler, { query: { id: showId }, body: { action: 'set_status', status: 'published' } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect((await mockDb.select().from(shows))[0].status).toBe('published');
    res = await call(handler, { query: { id: showId }, body: { action: 'set_status', status: 'draft' } });
    expect((await mockDb.select().from(shows))[0].status).toBe('draft');
    res = await call(handler, { query: { id: showId }, body: { action: 'set_status', status: 'cancelled' } });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('예정된 회차가 없으면 공개할 수 없다', async () => {
    await mockDb.update(showtimes).set({ status: 'cancelled' }).where(eq(showtimes.id, showtimeId));
    const res = await call(handler, { query: { id: showId }, body: { action: 'set_status', status: 'published' } });
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('초대권 발급(compQuota 안)과 취소', async () => {
    const res = await call(handler, { query: { id: showId }, body: { action: 'issue_comp', showtimeId, ticketTypeId, quantity: 2, note: '출연진' } });
    expect(res.status).toHaveBeenCalledWith(200);
    const tickets = await mockDb.select().from(showTickets);
    expect(tickets).toHaveLength(2);
    expect(tickets.every((t) => t.issuedBy === 'organizer_comp' && t.status === 'issued')).toBe(true);

    const rev = await call(handler, { query: { id: showId }, body: { action: 'revoke_comp', ticketId: tickets[0].id } });
    expect(rev.status).toHaveBeenCalledWith(200);
    expect((await mockDb.select().from(showTickets).where(eq(showTickets.id, tickets[0].id)))[0].status).toBe('void');
  });

  it('compQuota가 0이면 초대권은 거절되고 안내가 나간다', async () => {
    await mockDb.update(showTicketTypes).set({ compQuota: 0 });
    const res = await call(handler, { query: { id: showId }, body: { action: 'issue_comp', showtimeId, ticketTypeId, quantity: 1, note: 'x' } });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(JSON.stringify(res.json.mock.calls[0][0])).toContain('compQuota');
  });

  it('다른 공연의 회차·티켓 id로는 조작할 수 없다', async () => {
    const otherShowId = 'other-show';
    await mockDb.insert(shows).values({ id: otherShowId, slug: 'other', title: 't', presenterName: 'p', performers: 'a', ageRating: 'x', runningMinutes: 1, venueName: 'v', venueAddress: 'a', description: 'd' });
    await mockDb.insert(showZones).values({ id: 'oz', showId: otherShowId, code: 'A', label: 'A', capacity: 5 });
    await mockDb.insert(showtimes).values({ id: 'ost', showId: otherShowId, startsAt: Math.floor(Date.now() / 1000) + 99999, salesCloseAt: Math.floor(Date.now() / 1000) + 9999 });

    let res = await call(handler, { query: { id: showId }, body: { action: 'cancel_showtime', showtimeId: 'ost' } });
    expect(res.status).toHaveBeenCalledWith(404);
    expect((await mockDb.select().from(showtimes).where(eq(showtimes.id, 'ost')))[0].status).toBe('scheduled');
    res = await call(handler, { query: { id: showId }, body: { action: 'issue_scan_link', showtimeId: 'ost', label: 'a', ttlHours: 3 } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('스캔 링크 발급은 경로를 돌려준다(입력 검증 포함)', async () => {
    let res = await call(handler, { query: { id: showId }, body: { action: 'issue_scan_link', showtimeId, label: '현장1', ttlHours: 12 } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].path).toBe('/ko/shows/scan/tok-secret-1234567890');
    res = await call(handler, { query: { id: showId }, body: { action: 'issue_scan_link', showtimeId, label: '', ttlHours: 12 } });
    expect(res.status).toHaveBeenCalledWith(400);
    res = await call(handler, { query: { id: showId }, body: { action: 'issue_scan_link', showtimeId, label: 'a', ttlHours: 999 } });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('회차 시각 변경은 과거를 거부하고 판매마감을 다시 계산한다', async () => {
    let res = await call(handler, { query: { id: showId }, body: { action: 'change_showtime', showtimeId, startsAt: '2020-01-01T00:00:00+09:00' } });
    expect(res.status).toHaveBeenCalledWith(400);
    const next = new Date(Date.now() + 30 * 86400 * 1000);
    res = await call(handler, { query: { id: showId }, body: { action: 'change_showtime', showtimeId, startsAt: next.toISOString() } });
    expect(res.status).toHaveBeenCalledWith(200);
    const [st] = await mockDb.select().from(showtimes);
    expect(st.startsAt).toBe(Math.floor(next.getTime() / 1000));
    expect(st.previousStartsAt).not.toBeNull();
  });

  it('명단 CSV는 접속기록을 남기고 초대권 연락처 표식은 비운다', async () => {
    await call(handler, { query: { id: showId }, body: { action: 'issue_comp', showtimeId, ticketTypeId, quantity: 1, note: '게스트' } });
    const res = await call(rosterHandler, { method: 'GET', query: { id: showId, showtimeId } });
    expect(res.status).toHaveBeenCalledWith(200);
    const csv = String(res.send.mock.calls[0][0]);
    expect(csv).toContain('게스트');
    expect(csv).toContain('초대');
    expect(csv).not.toContain(',comp,');
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'show_roster_export', showtimeId, 'success', 1);
  });
});
