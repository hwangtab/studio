/** @jest-environment node */
import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { fundingCreators, fundingProjects, showSubmissions, shows } from '../../db/schema';
import { isApprovedFundingMedia } from './mediaAccess';
import { FUNDING_MEDIA_URL_PREFIX } from './mediaPath';

let mockDb: ShowsTestDb;
let client: Awaited<ReturnType<typeof createTestDb>>['client'];
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

const url = (name: string) => `${FUNDING_MEDIA_URL_PREFIX}${name}?w=800&h=1200`;

async function seedCreator() {
  const [c] = await mockDb
    .insert(fundingCreators)
    .values({ email: `c-${crypto.randomUUID()}@example.com`, name: '주최자' })
    .returning();
  return c.id;
}

async function seedShow(opts: {
  creatorId: string;
  reviewStatus: 'submitted' | 'approved';
  showStatus?: 'draft' | 'published' | 'cancelled';
  cover?: string | null;
  performersJson?: string | null;
  withShow?: boolean;
}) {
  let showId: string | null = null;
  if (opts.withShow !== false) {
    const [s] = await mockDb
      .insert(shows)
      .values({
        slug: `s-${crypto.randomUUID()}`, title: 't', presenterName: 'p', performers: 'x', ageRating: '전체',
        runningMinutes: 60, venueName: 'v', venueAddress: 'a', description: 'd',
        coverImage: opts.cover ?? null, performersJson: opts.performersJson ?? null,
        status: opts.showStatus ?? 'published',
      })
      .returning();
    showId = s.id;
  }
  await mockDb.insert(showSubmissions).values({
    creatorId: opts.creatorId, showId, draftJson: '{}', reviewStatus: opts.reviewStatus,
  });
}

beforeEach(async () => {
  ({ db: mockDb, client } = await createTestDb());
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('공연 갈래 미디어 공개 판정', () => {
  it('제출만 됐고 공연이 없으면 비공개', async () => {
    const c = await seedCreator();
    await seedShow({ creatorId: c, reviewStatus: 'submitted', withShow: false });
    expect(await isApprovedFundingMedia(`${c}-p.webp`)).toBe(false);
  });

  it('승인 + published + cover_image 참조면 공개', async () => {
    const c = await seedCreator();
    await seedShow({ creatorId: c, reviewStatus: 'approved', cover: url(`${c}-p.webp`) });
    expect(await isApprovedFundingMedia(`${c}-p.webp`)).toBe(true);
  });

  it('승인이어도 shows.status가 draft면 비공개', async () => {
    const c = await seedCreator();
    await seedShow({ creatorId: c, reviewStatus: 'approved', showStatus: 'draft', cover: url(`${c}-p.webp`) });
    expect(await isApprovedFundingMedia(`${c}-p.webp`)).toBe(false);
  });

  it('다른 개설자의 공연 칸에 적은 남의 파일명은 비공개', async () => {
    const c = await seedCreator();
    const d = await seedCreator();
    await seedShow({ creatorId: d, reviewStatus: 'approved', cover: url(`${c}-p.webp`) });
    expect(await isApprovedFundingMedia(`${c}-p.webp`)).toBe(false);
  });

  it('출연진 사진으로만 참조돼도 공개', async () => {
    const c = await seedCreator();
    await seedShow({
      creatorId: c, reviewStatus: 'approved',
      performersJson: JSON.stringify([{ name: '가수', photo: url(`${c}-q.webp`) }]),
    });
    expect(await isApprovedFundingMedia(`${c}-q.webp`)).toBe(true);
  });

  it('show_submissions 표가 없어도 승인된 펀딩 표지는 공개로 판정된다', async () => {
    const c = await seedCreator();
    await mockDb.insert(fundingProjects).values({
      slug: 'proj', creatorId: c, title: 't', summary: 's', content: 'c', coverUrl: url('cover.webp'),
      goalAmount: 1000, startAt: new Date(), endAt: new Date(), reviewStatus: 'approved',
    });
    await client.execute('drop table show_submissions');
    expect(await isApprovedFundingMedia('cover.webp')).toBe(true);
    expect(await isApprovedFundingMedia('other.webp')).toBe(false);
  });
});
