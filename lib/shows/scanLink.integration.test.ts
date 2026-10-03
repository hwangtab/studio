/** @jest-environment node */
import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shows, showtimes } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));

import { issueScanLink, verifyScanLink } from './scanLink';

describe('스캔 링크 토큰은 경로에 실려도 살아남는다', () => {
  beforeEach(async () => {
    testDb = (await createTestDb()).db;
    await testDb.insert(shows).values({ id: 'show-1', slug: 's', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'a', description: 'd', status: 'published' });
    await testDb.insert(showtimes).values({ id: 'st-1', showId: 'show-1', startsAt: 2000000000, salesCloseAt: 1999990000 });
  });

  it('토큰은 소문자 hex라 middleware의 소문자 308을 거쳐도 해시가 같다', async () => {
    const { token } = await issueScanLink('st-1', '입구', 24, new Date(1900000000 * 1000));
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(token).toBe(token.toLowerCase());
    const r = await verifyScanLink(token, new Date(1900000000 * 1000));
    expect(r.ok).toBe(true);
  });
});
