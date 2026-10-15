/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { fundingCreators, showSubmissions, showTicketTypes, showtimes, shows, showZones } from '../../../db/schema';
import { createTestDb, type ShowsTestDb } from '../../../tests/helpers/showsDb';
import { FUNDING_MEDIA_URL_PREFIX } from '../../funding/mediaPath';
import { emptyDraft, type ShowSubmissionDraft } from './draft';
import { isPublishable } from '../revalidate';
import { sendShowReviewResultEmail } from './email';
import { decideShowSubmission } from './review';
import { createSubmission, saveSubmission, submitSubmission } from './submissions';

let mockDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./email', () => ({
  notifyOperatorShowSubmitted: jest.fn(async () => {}),
  notifyOperatorShowEdited: jest.fn(async () => {}),
  sendShowReviewResultEmail: jest.fn(async () => {}),
}));
jest.mock('../revalidate', () => {
  const actual = jest.requireActual('../revalidate');
  return { ...actual, isPublishable: jest.fn(actual.isPublishable) };
});

const NOW = new Date('2026-10-14T03:00:00Z');
const FIRST = '2026-11-20T19:00';

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
  ticketTypes: [{ name: '일반', price: 20000 }, { name: '학생', price: 10000 }],
  performers: [{ name: '가수', bio: '소개', photoUrl: null }],
});

async function submitted(): Promise<{ id: string; cid: string; submittedAt: string }> {
  const [c] = await mockDb.insert(fundingCreators).values({ email: `c-${crypto.randomUUID()}@example.com`, name: '주최자' }).returning();
  const id = await createSubmission(c.id);
  await saveSubmission(c.id, id, fullDraft(c.id), NOW);
  await submitSubmission(c.id, id, { agreedTerms: true }, NOW);
  const [row] = await mockDb.select().from(showSubmissions).where(eq(showSubmissions.id, id));
  return { id, cid: c.id, submittedAt: row.submittedAt!.toISOString() };
}

const row = async (id: string) => (await mockDb.select().from(showSubmissions).where(eq(showSubmissions.id, id)))[0];

beforeEach(async () => {
  ({ db: mockDb } = await createTestDb());
  jest.clearAllMocks();
});

describe('주최자 공연 심사', () => {
  it('없는 제출물은 not_found', async () => {
    expect(await decideShowSubmission('nope', 'approve', { slug: 'abc-show' }, NOW)).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('submitted가 아니면 conflict', async () => {
    const [c] = await mockDb.insert(fundingCreators).values({ email: 'x@example.com', name: 'x' }).returning();
    const id = await createSubmission(c.id);
    expect(await decideShowSubmission(id, 'approve', { slug: 'abc-show' }, NOW)).toMatchObject({ ok: false, code: 'conflict' });
    expect(await decideShowSubmission(id, 'reject', { note: '사유' }, NOW)).toMatchObject({ ok: false, code: 'conflict' });
  });

  it('expectedSubmittedAt이 다르면 conflict, 같으면 통과', async () => {
    const s = await submitted();
    expect(
      await decideShowSubmission(s.id, 'approve', { slug: 'abc-show', expectedSubmittedAt: '2020-01-01T00:00:00.000Z' }, NOW),
    ).toMatchObject({ ok: false, code: 'conflict' });
    expect(await decideShowSubmission(s.id, 'approve', { slug: 'abc-show', expectedSubmittedAt: s.submittedAt }, NOW)).toMatchObject({ ok: true });
  });

  it('약관 동의 판본이 없으면 terms_not_agreed', async () => {
    const s = await submitted();
    await mockDb.update(showSubmissions).set({ organizerTermsVersion: null }).where(eq(showSubmissions.id, s.id));
    expect(await decideShowSubmission(s.id, 'approve', { slug: 'abc-show' }, NOW)).toMatchObject({ ok: false, code: 'terms_not_agreed' });
  });

  it('승인 시점에 첫 회차가 7일 안이면 incomplete', async () => {
    const s = await submitted();
    const late = new Date('2026-11-15T00:00:00Z');
    expect(await decideShowSubmission(s.id, 'approve', { slug: 'abc-show' }, late)).toMatchObject({ ok: false, code: 'incomplete' });
    expect((await row(s.id)).reviewStatus).toBe('submitted');
  });

  it('slug 형식 오류·예약어(host)는 invalid_slug', async () => {
    const s = await submitted();
    for (const slug of [undefined, 'AB', 'Bad Slug', 'host', 'organizer-terms', 'scan']) {
      expect(await decideShowSubmission(s.id, 'approve', { slug }, NOW)).toMatchObject({ ok: false, code: 'invalid_slug' });
    }
  });

  it('이미 공개된 공연과 같은 slug는 duplicate_slug', async () => {
    const a = await submitted();
    const b = await submitted();
    expect(await decideShowSubmission(a.id, 'approve', { slug: 'abc-show' }, NOW)).toMatchObject({ ok: true });
    expect(await decideShowSubmission(b.id, 'approve', { slug: 'abc-show' }, NOW)).toMatchObject({ ok: false, code: 'duplicate_slug' });
    expect((await row(b.id)).reviewStatus).toBe('submitted');
  });

  it('승인: 공연이 만들어지고 published, 구역 GA·티켓 가격·승인본·메일', async () => {
    const s = await submitted();
    const res = await decideShowSubmission(s.id, 'approve', { slug: 'abc-show', note: '무시', expectedSubmittedAt: s.submittedAt }, NOW);
    expect(res).toMatchObject({ ok: true, slug: 'abc-show' });
    const [show] = await mockDb.select().from(shows).where(eq(shows.slug, 'abc-show'));
    expect(show.status).toBe('published');
    const zones = await mockDb.select().from(showZones).where(eq(showZones.showId, show.id));
    expect(zones).toMatchObject([{ code: 'GA', label: '전석', capacity: 50 }]);
    const types = await mockDb.select().from(showTicketTypes).where(eq(showTicketTypes.showId, show.id));
    expect(types.map((t) => [t.name, t.price]).sort()).toEqual([['일반', 20000], ['학생', 10000]]);
    expect(await mockDb.select().from(showtimes).where(eq(showtimes.showId, show.id))).toHaveLength(1);
    const r = await row(s.id);
    expect(r).toMatchObject({ reviewStatus: 'approved', showId: show.id, reviewNote: null });
    expect(r.approvedDraftJson).toBe(r.draftJson);
    expect(r.approvedAt).not.toBeNull();
    expect(sendShowReviewResultEmail).toHaveBeenCalledWith(s.id, 'approved');
  });

  it('공개하지 못하면 승인 메일은 "곧 열린다" 판으로 가고 운영자 경고가 남는다', async () => {
    (isPublishable as jest.Mock).mockReturnValueOnce(false);
    const s = await submitted();
    const res = await decideShowSubmission(s.id, 'approve', { slug: 'abc-show' }, NOW);
    expect(res).toMatchObject({ ok: true, slug: 'abc-show' });
    expect(res.ok && res.warnings).toEqual([expect.stringContaining('공개하지 못했어요')]);
    const [show] = await mockDb.select().from(shows).where(eq(shows.slug, 'abc-show'));
    expect(show.status).toBe('draft');
    expect((await row(s.id)).reviewStatus).toBe('approved');
    expect(sendShowReviewResultEmail).toHaveBeenCalledWith(s.id, 'approved_pending');
    expect(sendShowReviewResultEmail).not.toHaveBeenCalledWith(s.id, 'approved');
  });

  it('메일 실패는 warnings로 돌려주고 승인은 유지된다', async () => {
    (sendShowReviewResultEmail as jest.Mock).mockRejectedValueOnce(new Error('smtp'));
    const s = await submitted();
    const res = await decideShowSubmission(s.id, 'approve', { slug: 'abc-show' }, NOW);
    expect(res).toMatchObject({ ok: true });
    expect(res.ok && res.warnings?.length).toBe(1);
    expect((await row(s.id)).reviewStatus).toBe('approved');
  });

  it('보완 요청·반려는 note 필수, 기록·메일', async () => {
    const a = await submitted();
    expect(await decideShowSubmission(a.id, 'request_changes', {}, NOW)).toMatchObject({ ok: false, code: 'incomplete' });
    expect(await decideShowSubmission(a.id, 'request_changes', { note: '  포스터 교체  ' }, NOW)).toMatchObject({ ok: true });
    expect(await row(a.id)).toMatchObject({ reviewStatus: 'changes_requested', reviewNote: '포스터 교체' });
    expect(sendShowReviewResultEmail).toHaveBeenCalledWith(a.id, 'changes_requested');

    const b = await submitted();
    expect(await decideShowSubmission(b.id, 'reject', { note: '' }, NOW)).toMatchObject({ ok: false, code: 'incomplete' });
    expect(await decideShowSubmission(b.id, 'reject', { note: '부적합' }, NOW)).toMatchObject({ ok: true });
    const r = await row(b.id);
    expect(r).toMatchObject({ reviewStatus: 'rejected', reviewNote: '부적합' });
    expect(r.rejectedAt).not.toBeNull();
    expect(sendShowReviewResultEmail).toHaveBeenCalledWith(b.id, 'rejected');
  });

  it('제출물 갱신이 실패하면 새로 만든 초안 공연을 지우고 seed_failed, 같은 slug로 재승인하면 성공', async () => {
    const s = await submitted();
    const realUpdate = mockDb.update.bind(mockDb);
    let failNext = true;
    const spy = jest.spyOn(mockDb, 'update').mockImplementation(((table: unknown) => {
      if (failNext && table === showSubmissions) {
        failNext = false;
        throw new Error('disk full');
      }
      return realUpdate(table as never);
    }) as never);

    const first = await decideShowSubmission(s.id, 'approve', { slug: 'abc-show' }, NOW);
    expect(first).toMatchObject({ ok: false, code: 'seed_failed' });
    expect(await mockDb.select().from(shows).where(eq(shows.slug, 'abc-show'))).toHaveLength(0);
    expect(await mockDb.select().from(showZones)).toHaveLength(0);
    expect(await mockDb.select().from(showtimes)).toHaveLength(0);
    expect(await mockDb.select().from(showTicketTypes)).toHaveLength(0);
    expect((await row(s.id)).reviewStatus).toBe('submitted');
    spy.mockRestore();

    expect(await decideShowSubmission(s.id, 'approve', { slug: 'abc-show' }, NOW)).toMatchObject({ ok: true, slug: 'abc-show' });
    const [show] = await mockDb.select().from(shows).where(eq(shows.slug, 'abc-show'));
    expect(show.status).toBe('published');
    expect((await row(s.id)).showId).toBe(show.id);
  });

  it('같은 slug의 기존 공연(운영자 초안)이 있으면 duplicate_slug이고 그 공연은 그대로다', async () => {
    const s = await submitted();
    const [draftShow] = await mockDb
      .insert(shows)
      .values({ slug: 'abc-show', title: '운영자 초안', presenterName: '운영자', performers: '[]', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'a', description: 'd', status: 'draft' } as never)
      .returning();
    expect(await decideShowSubmission(s.id, 'approve', { slug: 'abc-show' }, NOW)).toMatchObject({ ok: false, code: 'duplicate_slug' });
    const all = await mockDb.select().from(shows).where(eq(shows.slug, 'abc-show'));
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: draftShow.id, status: 'draft', title: '운영자 초안' });
    expect(await mockDb.select().from(showtimes).where(eq(showtimes.showId, draftShow.id))).toHaveLength(0);
    expect((await row(s.id)).reviewStatus).toBe('submitted');
  });

  it('이미 승인된 제출물을 다시 승인하면 거절되고 공연은 공개 상태 그대로다', async () => {
    const s = await submitted();
    expect(await decideShowSubmission(s.id, 'approve', { slug: 'abc-show' }, NOW)).toMatchObject({ ok: true });
    const again = await decideShowSubmission(s.id, 'approve', { slug: 'abc-show' }, NOW);
    expect(again.ok).toBe(false);
    expect(again.ok === false && ['conflict', 'duplicate_slug']).toContain(again.ok === false ? again.code : '');
    const [show] = await mockDb.select().from(shows).where(eq(shows.slug, 'abc-show'));
    expect(show.status).toBe('published');
  });
});
