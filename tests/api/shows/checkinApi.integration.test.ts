/** @jest-environment node */

/** 입장 확인 API — 토큰 인증, 회차 격리, 코드 추출. 체크인 도메인 규칙은 lib/shows/checkin.integration.test.ts가 맡는다. */
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';
import { showtimes, showTickets, showTicketTypes } from '../../../db/schema';
import { seedShow } from '../../../lib/shows/seed';
import { issueCompTickets } from '../../../lib/shows/service';
import { bakkeojiShow } from '../../../data/shows/bakkeoji-anneun-maeumdeul';

let mockDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
const mockVerify = jest.fn();
jest.mock('../../../lib/shows/scanLink', () => ({ issueScanLink: jest.fn(), SCAN_LINK_MAX_TTL_HOURS: 72, verifyScanLink: (t: string) => mockVerify(t) }));

import handler from '../../../pages/api/shows/checkin';
import { extractTicketCode } from '../../../lib/shows/scanAccess';

type MockRes = NextApiResponse & { status: jest.Mock; json: jest.Mock; send: jest.Mock; setHeader: jest.Mock; revalidate: jest.Mock };
const makeRes = () => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as unknown as MockRes;
};
const post = async (body: Record<string, unknown>) => {
  const res = makeRes();
  await handler({ method: 'POST', body, query: {}, headers: {} } as unknown as NextApiRequest, res);
  return res;
};
const lastJson = (res: ReturnType<typeof makeRes>) => res.json.mock.calls[0][0];

describe('POST /api/shows/checkin', () => {
  let showtimeId: string;
  let code: string;

  beforeEach(async () => {
    mockDb = (await createTestDb()).db;
    mockVerify.mockReset();
    await seedShow(mockDb, { ...bakkeojiShow, showtimes: [{ startsAt: new Date(Date.now() + 14 * 86400 * 1000) }], ticketTypes: [{ ...bakkeojiShow.ticketTypes[0], compQuota: 5 }] }, { apply: true });
    showtimeId = (await mockDb.select().from(showtimes))[0].id;
    const ticketTypeId = (await mockDb.select().from(showTicketTypes))[0].id;
    const r = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 1, note: '테스트' }, new Date());
    if (!r.ok) throw new Error('setup');
    code = (await mockDb.select().from(showTickets))[0].code;
    mockVerify.mockResolvedValue({ ok: true, link: { id: 'l', showtimeId, label: '현장1', expiresAt: 9e9 } });
  });

  it('POST 외에는 405', async () => {
    const res = makeRes();
    await handler({ method: 'GET', body: {}, query: {}, headers: {} } as unknown as NextApiRequest, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('토큰이 유효하지 않으면 401 — 체크인되지 않는다', async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: 'invalid' });
    const res = await post({ token: 'bad-token-0000', code });
    expect(res.status).toHaveBeenCalledWith(401);
    expect((await mockDb.select().from(showTickets))[0].checkedInAt).toBeNull();
  });

  it('토큰이 없거나 너무 짧으면 검증 호출 없이 401', async () => {
    const res = await post({ code });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('유효한 코드는 입장 처리되고 집계가 돌아온다 — 두 번째 다른 스캐너는 already_checked_in', async () => {
    let res = await post({ token: 'tok-1234567890', code });
    expect(lastJson(res)).toMatchObject({ ok: true, status: 'checked_in', counts: { issued: 1, checkedIn: 1 } });
    mockVerify.mockResolvedValue({ ok: true, link: { id: 'l', showtimeId, label: '현장2', expiresAt: 9e9 } });
    res = await post({ token: 'tok-1234567890', code });
    expect(lastJson(res).status).toBe('already_checked_in');
  });

  it('URL에 담긴 코드도 읽는다', async () => {
    const res = await post({ token: 'tok-1234567890', code: `https://studionol.co.kr/ko/shows/ticket?c=${encodeURIComponent(code)}` });
    expect(lastJson(res).status).toBe('checked_in');
  });

  it('다른 회차 링크로는 이 회차 티켓을 입장시킬 수 없다', async () => {
    mockVerify.mockResolvedValue({ ok: true, link: { id: 'l', showtimeId: 'other-showtime', label: 'x', expiresAt: 9e9 } });
    const res = await post({ token: 'tok-1234567890', code });
    expect(lastJson(res).status).toBe('wrong_showtime');
    expect((await mockDb.select().from(showTickets))[0].checkedInAt).toBeNull();
  });

  it('없는 코드·형식 오류는 invalid', async () => {
    expect(lastJson(await post({ token: 'tok-1234567890', code: 'SNT1:AAAAAAAAAAAAAAAA' })).status).toBe('invalid');
    expect(lastJson(await post({ token: 'tok-1234567890', code: 'hello' })).status).toBe('invalid');
  });

  it('직접 스캔한 직후 undo로 되돌릴 수 있다', async () => {
    await post({ token: 'tok-1234567890', code });
    const res = await post({ token: 'tok-1234567890', code, action: 'undo' });
    expect(lastJson(res).status).toBe('undone');
    expect((await mockDb.select().from(showTickets))[0].checkedInAt).toBeNull();
  });

  it('extractTicketCode', () => {
    expect(extractTicketCode(' snt1:abcdefghijklmnop ')).toBe('SNT1:ABCDEFGHIJKLMNOP');
    expect(extractTicketCode('SNT1:ABC')).toBeNull();
    expect(extractTicketCode(123)).toBeNull();
  });
});
