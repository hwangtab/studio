/** @jest-environment node */
import { createTestDb, type ShowsTestDb } from '../../../tests/helpers/showsDb';
import { fundingCreators, showSubmissions, shows } from '../../../db/schema';
import { eq } from 'drizzle-orm';

let db: ShowsTestDb;

beforeEach(async () => {
  ({ db } = await createTestDb());
});

async function seedCreator() {
  const [creator] = await db
    .insert(fundingCreators)
    .values({ email: `c-${crypto.randomUUID()}@example.com`, name: '주최자' })
    .returning();
  return creator;
}

describe('show_submissions 표', () => {
  it('초안 행을 넣으면 draft·showId null로 읽힌다', async () => {
    const creator = await seedCreator();
    const [row] = await db
      .insert(showSubmissions)
      .values({ creatorId: creator.id, draftJson: '{}' })
      .returning();
    const [read] = await db.select().from(showSubmissions).where(eq(showSubmissions.id, row.id));
    expect(read.reviewStatus).toBe('draft');
    expect(read.showId).toBeNull();
    expect(read.creatorId).toBe(creator.id);
    expect(read.approvedDraftJson).toBeNull();
  });

  it('같은 showId를 두 행에 넣으면 unique 위반으로 던진다', async () => {
    const creator = await seedCreator();
    const [show] = await db
      .insert(shows)
      .values({ slug: `s-${crypto.randomUUID()}`, title: '공연', presenterName: '주최', performers: '[]', ageRating: '전체', runningMinutes: 60, venueName: '장소', venueAddress: '주소', description: '소개' })
      .returning();
    await db.insert(showSubmissions).values({ creatorId: creator.id, showId: show.id, draftJson: '{}' });
    await expect(
      db.insert(showSubmissions).values({ creatorId: creator.id, showId: show.id, draftJson: '{}' }),
    ).rejects.toThrow();
  });

  it('showId가 null인 행은 여러 개 넣을 수 있다', async () => {
    const creator = await seedCreator();
    await db.insert(showSubmissions).values({ creatorId: creator.id, draftJson: '{}' });
    await db.insert(showSubmissions).values({ creatorId: creator.id, draftJson: '{}' });
    const rows = await db.select().from(showSubmissions);
    expect(rows).toHaveLength(2);
  });
});
