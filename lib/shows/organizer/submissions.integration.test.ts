/** @jest-environment node */
import { createTestDb, type ShowsTestDb } from '../../../tests/helpers/showsDb';
import { fundingCreators, showSubmissions, showTicketTypes, showtimes, shows, showZones } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { FUNDING_MEDIA_URL_PREFIX } from '../../funding/mediaPath';
import { buildShowDefinition, emptyDraft, kstWallToDate, type ShowSubmissionDraft } from './draft';
import { seedShow } from '../seed';
import {
  createSubmission,
  listSubmissionsForCreator,
  loadSubmissionForCreator,
  saveSubmission,
  submitSubmission,
  withdrawSubmission,
} from './submissions';
import { notifyOperatorShowEdited, notifyOperatorShowSubmitted } from './email';
import { SHOW_ORGANIZER_TERMS_VERSION } from './policy';

let mockDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
let betweenReadAndWrite: (() => Promise<unknown>) | null = null;
jest.mock('./draft', () => {
  const actual = jest.requireActual('./draft');
  return {
    ...actual,
    mergeApprovedEdit: (...a: unknown[]) => {
      // 동기 함수라 훅은 결과를 기다리지 않고 바로 발사한다(in-memory DB 쓰기는 다음 await 전에 끝난다).
      if (betweenReadAndWrite) void betweenReadAndWrite();
      return actual.mergeApprovedEdit(...a);
    },
  };
});
jest.mock('./email', () => ({
  notifyOperatorShowSubmitted: jest.fn(async () => {}),
  notifyOperatorShowEdited: jest.fn(async () => {}),
}));

const NOW = new Date('2026-10-14T03:00:00Z');
const FIRST = '2026-11-20T19:00';

async function seedCreator() {
  const [c] = await mockDb
    .insert(fundingCreators)
    .values({ email: `c-${crypto.randomUUID()}@example.com`, name: '주최자' })
    .returning();
  return c.id;
}

const fullDraft = (creatorId: string): ShowSubmissionDraft => ({
  ...emptyDraft(),
  title: '가을 공연',
  subtitle: '부제',
  presenterName: '주최팀',
  description: '첫 문단입니다.',
  posterUrl: `${FUNDING_MEDIA_URL_PREFIX}${creatorId}-poster.webp`,
  ageRating: '전체 관람가',
  runningMinutes: 90,
  venueName: '작은 극장',
  venueAddress: '서울시 어딘가 1',
  showtimes: [FIRST],
  capacity: 50,
  ticketTypes: [{ name: '일반', price: 20000 }],
  performers: [{ name: '가수', bio: '소개', photoUrl: null }],
});

beforeEach(async () => {
  ({ db: mockDb } = await createTestDb());
  jest.clearAllMocks();
});

describe('주최자 제출물 저장소', () => {
  it('만들기·목록·불러오기', async () => {
    const cid = await seedCreator();
    const id = await createSubmission(cid);
    const view = await loadSubmissionForCreator(cid, id);
    expect(view).toMatchObject({ id, reviewStatus: 'draft', showSlug: null });
    const list = await listSubmissionsForCreator(cid);
    expect(list).toEqual([{ id, title: '', reviewStatus: 'draft', showSlug: null, showStatus: null, firstShowtime: null }]);
  });

  it('남의 제출물은 null/404', async () => {
    const a = await seedCreator();
    const b = await seedCreator();
    const id = await createSubmission(a);
    expect(await loadSubmissionForCreator(b, id)).toBeNull();
    expect(await saveSubmission(b, id, fullDraft(b), NOW)).toMatchObject({ ok: false, status: 404 });
    expect(await submitSubmission(b, id, { agreedTerms: true }, NOW)).toMatchObject({ ok: false, status: 404 });
    expect(await withdrawSubmission(b, id, NOW)).toMatchObject({ ok: false, status: 404 });
    expect(await listSubmissionsForCreator(b)).toEqual([]);
  });

  it('draft: 저장되고 제출하면 submitted + 판본·시각 + 메일', async () => {
    const cid = await seedCreator();
    const id = await createSubmission(cid);
    expect(await saveSubmission(cid, id, fullDraft(cid), NOW)).toEqual({ ok: true });
    expect((await loadSubmissionForCreator(cid, id))!.draft.title).toBe('가을 공연');
    expect(await submitSubmission(cid, id, { agreedTerms: true }, NOW)).toEqual({ ok: true });
    const [row] = await mockDb.select().from(showSubmissions).where(eq(showSubmissions.id, id));
    expect(row.reviewStatus).toBe('submitted');
    expect(row.organizerTermsVersion).toBe(SHOW_ORGANIZER_TERMS_VERSION);
    expect(row.organizerTermsAgreedAt).toEqual(new Date(Math.floor(NOW.getTime() / 1000) * 1000));
    expect(row.submittedAt).not.toBeNull();
    expect(notifyOperatorShowSubmitted).toHaveBeenCalledWith(id);
  });

  it('draft: 철회는 409', async () => {
    const cid = await seedCreator();
    const id = await createSubmission(cid);
    expect(await withdrawSubmission(cid, id, NOW)).toMatchObject({ ok: false, status: 409 });
  });

  it('submit: agreedTerms false는 400', async () => {
    const cid = await seedCreator();
    const id = await createSubmission(cid);
    await saveSubmission(cid, id, fullDraft(cid), NOW);
    expect(await submitSubmission(cid, id, { agreedTerms: false }, NOW)).toMatchObject({ ok: false, status: 400 });
    expect(notifyOperatorShowSubmitted).not.toHaveBeenCalled();
  });

  it('submit: 미완성 초안은 400 + problems', async () => {
    const cid = await seedCreator();
    const id = await createSubmission(cid);
    const res = await submitSubmission(cid, id, { agreedTerms: true }, NOW);
    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(res.ok === false && res.problems!.length).toBeGreaterThan(0);
  });

  it('submitted: 저장·제출 409(심사 중 문구), 철회하면 draft로 돌아가 다시 고칠 수 있다', async () => {
    const cid = await seedCreator();
    const id = await createSubmission(cid);
    await saveSubmission(cid, id, fullDraft(cid), NOW);
    await submitSubmission(cid, id, { agreedTerms: true }, NOW);
    expect(await saveSubmission(cid, id, fullDraft(cid), NOW)).toEqual({
      ok: false, status: 409, message: '심사 중에는 고칠 수 없어요. 철회하면 고칠 수 있어요.',
    });
    expect(await submitSubmission(cid, id, { agreedTerms: true }, NOW)).toMatchObject({ ok: false, status: 409 });
    expect(await withdrawSubmission(cid, id, NOW)).toEqual({ ok: true });
    expect((await loadSubmissionForCreator(cid, id))!.reviewStatus).toBe('draft');
    expect(await saveSubmission(cid, id, fullDraft(cid), NOW)).toEqual({ ok: true });
  });

  it('changes_requested: 저장하고 다시 제출할 수 있다', async () => {
    const cid = await seedCreator();
    const id = await createSubmission(cid);
    await saveSubmission(cid, id, fullDraft(cid), NOW);
    await mockDb.update(showSubmissions).set({ reviewStatus: 'changes_requested', reviewNote: '포스터 교체' }).where(eq(showSubmissions.id, id));
    expect(await saveSubmission(cid, id, fullDraft(cid), NOW)).toEqual({ ok: true });
    expect(await submitSubmission(cid, id, { agreedTerms: true }, NOW)).toEqual({ ok: true });
    expect((await loadSubmissionForCreator(cid, id))!.reviewStatus).toBe('submitted');
  });

  it('rejected: 저장·제출·철회 모두 409', async () => {
    const cid = await seedCreator();
    const id = await createSubmission(cid);
    await mockDb.update(showSubmissions).set({ reviewStatus: 'rejected' }).where(eq(showSubmissions.id, id));
    expect(await saveSubmission(cid, id, fullDraft(cid), NOW)).toMatchObject({ ok: false, status: 409 });
    expect(await submitSubmission(cid, id, { agreedTerms: true }, NOW)).toMatchObject({ ok: false, status: 409 });
    expect(await withdrawSubmission(cid, id, NOW)).toMatchObject({ ok: false, status: 409 });
  });

  it('메일 실패는 warnings로 돌려주고 제출은 성공한다', async () => {
    (notifyOperatorShowSubmitted as jest.Mock).mockRejectedValueOnce(new Error('smtp'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const cid = await seedCreator();
    const id = await createSubmission(cid);
    await saveSubmission(cid, id, fullDraft(cid), NOW);
    const res = await submitSubmission(cid, id, { agreedTerms: true }, NOW);
    expect(res.ok && res.warnings).toHaveLength(1);
    expect((await loadSubmissionForCreator(cid, id))!.reviewStatus).toBe('submitted');
    errSpy.mockRestore();
  });

  describe('approved', () => {
    async function approve(cid: string) {
      const id = await createSubmission(cid);
      const draft = fullDraft(cid);
      await seedShow(mockDb, buildShowDefinition(draft, `show-${id.slice(0, 8)}`), { apply: true, now: NOW });
      const [show] = await mockDb.select().from(shows).where(eq(shows.slug, `show-${id.slice(0, 8)}`));
      await mockDb
        .update(showSubmissions)
        .set({ reviewStatus: 'approved', showId: show.id, draftJson: JSON.stringify(draft), approvedDraftJson: JSON.stringify(draft) })
        .where(eq(showSubmissions.id, id));
      return { id, show, draft };
    }

    it('잠긴 칸(가격·회차)은 그대로, 소개는 바뀌고, organizer_edited_at과 메일', async () => {
      const cid = await seedCreator();
      const { id, show, draft } = await approve(cid);
      const res = await saveSubmission(
        cid,
        id,
        { ...draft, description: '고친 소개', ticketTypes: [{ name: '일반', price: 1500 }], showtimes: ['2027-01-01T19:00'], capacity: 5 },
        NOW,
      );
      expect(res).toEqual({ ok: true });
      const [tt] = await mockDb.select().from(showTicketTypes).where(eq(showTicketTypes.showId, show.id));
      expect(tt.price).toBe(20000);
      const sts = await mockDb.select().from(showtimes).where(eq(showtimes.showId, show.id));
      expect(sts).toHaveLength(1);
      expect(sts[0].startsAt).toBe(Math.floor(kstWallToDate(FIRST)!.getTime() / 1000));
      const [s] = await mockDb.select().from(shows).where(eq(shows.id, show.id));
      expect(s.description).toBe('고친 소개');
      const [row] = await mockDb.select().from(showSubmissions).where(eq(showSubmissions.id, id));
      expect(row.organizerEditedAt).not.toBeNull();
      expect(parseCap(row.draftJson)).toBe(50);
      expect(notifyOperatorShowEdited).toHaveBeenCalledWith(id);
    });

    it('공연이 7일 안으로 다가와도 소개 수정은 된다', async () => {
      const cid = await seedCreator();
      const { id, draft } = await approve(cid);
      const res = await saveSubmission(cid, id, { ...draft, description: '임박 수정' }, new Date('2026-11-19T00:00:00Z'));
      expect(res).toEqual({ ok: true });
    });

    it('필수 칸을 비우면 400이고 공연·초안은 그대로', async () => {
      const cid = await seedCreator();
      const { id, show, draft } = await approve(cid);
      const res = await saveSubmission(cid, id, { ...draft, description: '' }, NOW);
      expect(res).toMatchObject({ ok: false, status: 400 });
      const [s] = await mockDb.select().from(shows).where(eq(shows.id, show.id));
      expect(s.description).toBe(draft.description);
      const [row] = await mockDb.select().from(showSubmissions).where(eq(showSubmissions.id, id));
      expect(row.organizerEditedAt).toBeNull();
    });

    it('운영자가 DB에서 바꾼 회차·가격·정원은 주최자 저장이 덮어쓰지 않는다', async () => {
      const cid = await seedCreator();
      const { id, show, draft } = await approve(cid);
      await mockDb.update(showtimes).set({ startsAt: 1_900_000_000 }).where(eq(showtimes.showId, show.id));
      await mockDb.update(showTicketTypes).set({ price: 31000 }).where(eq(showTicketTypes.showId, show.id));
      await mockDb.update(showZones).set({ capacity: 80 }).where(eq(showZones.showId, show.id));
      expect(await saveSubmission(cid, id, { ...draft, description: '새 소개', notices: ['안내 하나'] }, NOW)).toEqual({ ok: true });
      const sts = await mockDb.select().from(showtimes).where(eq(showtimes.showId, show.id));
      expect(sts.map((x) => x.startsAt)).toEqual([1_900_000_000]);
      expect((await mockDb.select().from(showTicketTypes).where(eq(showTicketTypes.showId, show.id)))[0].price).toBe(31000);
      expect((await mockDb.select().from(showZones).where(eq(showZones.showId, show.id)))[0].capacity).toBe(80);
      const [s] = await mockDb.select().from(shows).where(eq(shows.id, show.id));
      expect(s.description).toBe('새 소개');
      expect(s.noticesJson).toContain('안내 하나');
    });

    it('승인본이 없으면 409', async () => {
      const cid = await seedCreator();
      const { id, draft } = await approve(cid);
      await mockDb.update(showSubmissions).set({ approvedDraftJson: null }).where(eq(showSubmissions.id, id));
      expect(await saveSubmission(cid, id, draft, NOW)).toMatchObject({ ok: false, status: 409 });
    });

    it('읽은 뒤 상태가 바뀌면 409이고 공연은 그대로(가드)', async () => {
      const cid = await seedCreator();
      const { id, show, draft } = await approve(cid);
      // 읽기와 쓰기 사이(병합 시점)에 상태가 바뀐 상황.
      betweenReadAndWrite = () =>
        mockDb.update(showSubmissions).set({ reviewStatus: 'rejected' }).where(eq(showSubmissions.id, id)).execute();
      const res = await saveSubmission(cid, id, { ...draft, description: '바뀌면 안 됨' }, NOW);
      betweenReadAndWrite = null;
      expect(res).toMatchObject({ ok: false, status: 409 });
      const [s] = await mockDb.select().from(shows).where(eq(shows.id, show.id));
      expect(s.description).toBe(draft.description);
    });

    it('제출·철회는 409', async () => {
      const cid = await seedCreator();
      const { id } = await approve(cid);
      expect(await submitSubmission(cid, id, { agreedTerms: true }, NOW)).toMatchObject({ ok: false, status: 409 });
      expect(await withdrawSubmission(cid, id, NOW)).toMatchObject({ ok: false, status: 409 });
    });
  });
});

function parseCap(json: string): number | null {
  return (JSON.parse(json) as ShowSubmissionDraft).capacity;
}
