jest.mock('../../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

let mockRow: Record<string, unknown> | undefined;
jest.mock('../../../db/client', () => {
  const chain: Record<string, unknown> = {};
  for (const k of ['select', 'from', 'innerJoin', 'leftJoin', 'where']) chain[k] = () => chain;
  chain.limit = () => Promise.resolve(mockRow ? [mockRow] : []);
  return { getDb: () => chain };
});

import { sendEmail } from '../../email/resend';
import { OPERATOR_EMAIL } from '../../operatorContact';

import { emptyDraft } from './draft';
import { notifyOperatorShowEdited, notifyOperatorShowSubmitted, sendShowReviewResultEmail } from './email';

const draft = {
  ...emptyDraft(),
  title: '<script>alert(1)</script>밤공연',
  presenterName: '홍길동 & 밴드',
  showtimes: ['2026-11-21T19:00'],
  capacity: 40,
  ticketTypes: [{ name: '일반', price: 15000 }, { name: '학생', price: 10000 }],
};

const row = (over: Record<string, unknown> = {}) => ({
  draftJson: JSON.stringify(draft),
  reviewNote: '포스터를 <b>교체</b>해 주세요',
  creatorName: '김주최',
  creatorEmail: 'org@example.com',
  slug: 'night-show',
  ...over,
});

const sent = () => (sendEmail as jest.Mock).mock.calls[0][0];

beforeEach(() => {
  (sendEmail as jest.Mock).mockClear();
  (sendEmail as jest.Mock).mockResolvedValue({ ok: true });
  mockRow = row();
});

describe('운영자 메일', () => {
  it('새 제출: 제목이 escape되고 딥링크·rows·html+text가 간다', async () => {
    await notifyOperatorShowSubmitted('sub1');
    const m = sent();
    expect(m.to).toBe(OPERATOR_EMAIL);
    expect(m.html).not.toContain('<script>alert(1)');
    expect(m.html).toContain('&lt;script&gt;');
    expect(m.html).toContain('/admin/shows/submissions/sub1');
    expect(m.html).toContain('홍길동 &amp; 밴드');
    expect(m.html).toContain('2026년 11월 21일(토) 19:00');
    expect(m.html).toContain('40명');
    expect(m.html).toContain('15,000원');
    expect(m.text).toContain('/admin/shows/submissions/sub1');
    expect(m.text).toContain('학생 10,000원');
  });

  it('첫 회차는 입력 순서가 아니라 가장 이른 회차다', async () => {
    mockRow = row({ draftJson: JSON.stringify({ ...draft, showtimes: ['2026-11-28T19:00', '', '2026-11-20T15:00'] }) });
    await notifyOperatorShowSubmitted('sub1');
    expect(sent().text).toContain('첫 회차: 2026년 11월 20일(금) 15:00');
  });

  it('승인 뒤 수정: 수정 알림 제목', async () => {
    await notifyOperatorShowEdited('sub1');
    expect(sent().subject).toContain('공개된 공연 수정');
    expect(sent().html).toContain('/admin/shows/submissions/sub1');
  });
});

describe('주최자 메일', () => {
  it('승인: 공개 주소 버튼', async () => {
    await sendShowReviewResultEmail('sub1', 'approved');
    const m = sent();
    expect(m.to).toBe('org@example.com');
    expect(m.html).toContain('/ko/shows/night-show');
    expect(m.text).toContain('/ko/shows/night-show');
    expect(m.html).not.toContain('<script>alert(1)');
  });

  it('승인됐지만 아직 공개 전: 공개 주소 없이 곧 열린다고 알린다', async () => {
    await sendShowReviewResultEmail('sub1', 'approved_pending');
    const m = sent();
    expect(m.subject).toContain('공연이 승인됐어요');
    expect(m.text).toContain('곧 공개');
    expect(m.text).not.toContain('지금 공개됐어요');
    expect(m.html).not.toContain('/ko/shows/night-show');
    expect(m.text).not.toContain('/ko/shows/night-show');
    expect(m.html).toContain('/ko/funding/creator/shows/sub1');
  });

  it('보완 요청: 메모 escape + 편집 화면 버튼', async () => {
    await sendShowReviewResultEmail('sub1', 'changes_requested');
    const m = sent();
    expect(m.html).toContain('/ko/funding/creator/shows/sub1');
    expect(m.html).toContain('&lt;b&gt;교체&lt;/b&gt;');
    expect(m.html).not.toContain('<b>교체</b>');
    expect(m.text).toContain('포스터를 <b>교체</b>해 주세요');
  });

  it('반려: 메모만, 버튼 주소 없음', async () => {
    await sendShowReviewResultEmail('sub1', 'rejected');
    const m = sent();
    expect(m.html).toContain('&lt;b&gt;교체&lt;/b&gt;');
    expect(m.html).not.toContain('/ko/funding/creator/shows/');
  });

  it('발송 실패와 없는 신청서는 던진다', async () => {
    (sendEmail as jest.Mock).mockResolvedValueOnce({ ok: false, errorCode: 'X' });
    await expect(notifyOperatorShowSubmitted('sub1')).rejects.toThrow();
    mockRow = undefined;
    await expect(sendShowReviewResultEmail('nope', 'approved')).rejects.toThrow('not found');
  });
});
