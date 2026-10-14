/** @jest-environment node */
import { createTestDb, type ShowsTestDb } from '../../../tests/helpers/showsDb';
import { fundingCreators, showSubmissions } from '../../../db/schema';
import { emptyDraft } from './draft';
import { countPendingSubmissions, listSubmissionsForAdmin, loadSubmissionForAdmin } from './adminSubmissions';

let mockDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));

beforeEach(async () => {
  ({ db: mockDb } = await createTestDb());
});

async function seed(status: 'draft' | 'submitted' | 'approved', title: string, submittedAt: Date | null, times: string[]) {
  const [c] = await mockDb
    .insert(fundingCreators)
    .values({ email: `c-${crypto.randomUUID()}@example.com`, name: '주최자' })
    .returning();
  const [s] = await mockDb
    .insert(showSubmissions)
    .values({
      creatorId: c.id,
      reviewStatus: status,
      submittedAt,
      draftJson: JSON.stringify({ ...emptyDraft(), title, showtimes: times }),
    })
    .returning();
  return { sub: s, creator: c };
}

describe('운영자 제출물 조회', () => {
  it('목록은 작성중을 빼고 제출 시각 내림차순, 첫 회차는 가장 이른 것', async () => {
    await seed('draft', '초안', null, []);
    const old = await seed('submitted', '먼저', new Date('2026-10-10T00:00:00Z'), ['2026-12-02T19:00', '2026-12-01T19:00']);
    const recent = await seed('approved', '나중', new Date('2026-10-12T00:00:00Z'), ['2026-12-05T19:00']);
    const list = await listSubmissionsForAdmin();
    expect(list.map((r) => r.id)).toEqual([recent.sub.id, old.sub.id]);
    expect(list[1]).toMatchObject({
      title: '먼저', reviewStatus: 'submitted', creatorEmail: old.creator.email,
      firstShowtime: '2026-12-01T19:00', submittedAt: '2026-10-10T00:00:00.000Z',
    });
  });

  it('심사 대기 수는 submitted만 센다', async () => {
    await seed('draft', 'a', null, []);
    await seed('submitted', 'b', new Date(), []);
    await seed('approved', 'c', new Date(), []);
    expect(await countPendingSubmissions()).toBe(1);
  });

  it('상세는 초안·주최자·연결된 공연을 준다, 없으면 null', async () => {
    const { sub, creator } = await seed('submitted', '제목', new Date('2026-10-10T00:00:00Z'), ['2026-12-01T19:00']);
    const d = await loadSubmissionForAdmin(sub.id);
    expect(d).toMatchObject({
      id: sub.id, creatorEmail: creator.email, creatorName: '주최자', show: null,
      submittedAt: '2026-10-10T00:00:00.000Z',
    });
    expect(d!.draft.title).toBe('제목');
    expect(await loadSubmissionForAdmin('nope')).toBeNull();
  });
});
