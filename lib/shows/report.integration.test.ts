/** @jest-environment node */
import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

let mockDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

import { createShowOrder, issueCompTickets } from './service';
import { confirmShowOrder } from './confirm';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { loadShowReport } from './report';
import { issueReportLink, revokeReportLink, verifyReportLink } from './reportLink';

async function seed(db: ShowsTestDb) {
  await db.insert(shows).values({ id: 'show-1', slug: 's1', title: '공연', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: '공연장', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId: 'show-1', code: 'A', label: 'A', capacity: 10 });
  const startsAt = Math.floor(Date.now() / 1000) + 86400;
  await db.insert(showtimes).values({ id: 'st-1', showId: 'show-1', startsAt, salesCloseAt: startsAt - 3600 });
  await db.insert(showTicketTypes).values([
    { id: 'type-1', showId: 'show-1', zoneId: 'zone-1', name: '일반', price: 20000, compQuota: 5 },
    { id: 'type-2', showId: 'show-1', zoneId: 'zone-1', name: '학생', price: 10000 },
  ]);
}

describe('기획자 현황', () => {
  beforeEach(async () => {
    mockDb = (await createTestDb()).db;
    await seed(mockDb);
  });

  it('회차·티켓 종류별 판매·초대·금액을 세고, 예매자 개인정보는 싣지 않는다', async () => {
    const created = await createShowOrder({ showtimeId: 'st-1', ticketTypeId: 'type-1', quantity: 2, buyerName: '홍길동', buyerContact: '01012345678' }, new Date(Date.now() - 3600 * 1000));
    if (!created.ok) throw new Error('setup failed');
    await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 40000 }, { trustedByWebhook: false }, createFakeToss());
    const comp = await issueCompTickets({ showtimeId: 'st-1', ticketTypeId: 'type-1', quantity: 1, note: '출연진 가족' }, new Date());
    expect(comp.ok).toBe(true);

    const report = await loadShowReport('show-1');
    expect(report).not.toBeNull();
    const [t] = report!.showtimes;
    expect(t).toMatchObject({ capacity: 10, sold: 2, comp: 1, amount: 40000, refunded: 0 });
    expect(t.ticketTypes.map((x) => [x.name, x.sold, x.comp, x.amount])).toEqual([['일반', 2, 1, 40000], ['학생', 0, 0, 0]]);
    expect(report!.totals).toMatchObject({ sold: 2, comp: 1, amount: 40000 });

    const json = JSON.stringify(report);
    for (const secret of ['홍길동', '01012345678', '5678', created.orderNo, '출연진 가족']) {
      expect(json).not.toContain(secret);
    }
  });

  it('링크는 발급·검증·폐기되고, 다른 공연 id로는 폐기되지 않는다', async () => {
    const { token, id } = await issueReportLink('show-1', '기획사', 30);
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    const ok = await verifyReportLink(token);
    expect(ok.ok && ok.link.showId).toBe('show-1');

    expect(await revokeReportLink('show-other', id)).toBe(false);
    expect(await revokeReportLink('show-1', id)).toBe(true);
    expect(await verifyReportLink(token)).toEqual({ ok: false, reason: 'revoked' });
  });

  it('만료된 링크는 열리지 않는다', async () => {
    const issuedAt = new Date('2026-01-01T00:00:00Z');
    const { token } = await issueReportLink('show-1', '기획사', 1, issuedAt);
    expect(await verifyReportLink(token, new Date(issuedAt.getTime() + 2 * 86400 * 1000))).toEqual({ ok: false, reason: 'expired' });
  });
});
