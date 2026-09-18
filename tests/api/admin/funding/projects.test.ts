/** @jest-environment node */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/funding/adminProjects', () => ({ loadProjectForAdmin: jest.fn() }));
jest.mock('../../../../lib/funding/reviewDecision', () => ({
  ...jest.requireActual('../../../../lib/funding/reviewDecision'),
  decideProject: jest.fn(),
}));
jest.mock('../../../../lib/funding/revalidate', () => ({ revalidateFundingPaths: jest.fn() }));
jest.mock('../../../../lib/funding/reviewEmail', () => ({ sendReviewDecisionEmail: jest.fn() }));

const mockWhere = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn(() => ({ where: mockWhere }));
const mockUpdate = jest.fn(() => ({ set: mockSet }));
jest.mock('../../../../db/client', () => ({ getDb: jest.fn(() => ({ update: mockUpdate })) }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/admin/funding/projects/[id]';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { loadProjectForAdmin } from '../../../../lib/funding/adminProjects';
import { decideProject } from '../../../../lib/funding/reviewDecision';
import { revalidateFundingPaths } from '../../../../lib/funding/revalidate';
import { sendReviewDecisionEmail } from '../../../../lib/funding/reviewEmail';

const call = async (method: string, query: unknown, body: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status, revalidate: jest.fn() } as unknown as NextApiResponse;
  await handler({ method, query, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

const BASE_PROJECT = {
  id: 'proj-1',
  slug: 'demo',
  title: '데모 프로젝트',
  reviewStatus: 'submitted',
  status: 'draft',
  hidden: false,
  submittedAt: '2026-09-01T00:00:00.000Z',
  approvedAt: null,
  creatorName: '개설자',
  creatorEmail: 'creator@example.com',
  goalAmount: 1000000,
  startAt: '2026-10-01T00:00:00.000Z',
  endAt: '2026-11-01T00:00:00.000Z',
  summary: '요약',
  content: '본문',
  coverUrl: '/cover.webp',
  reviewNote: null,
  creator: { contactName: null, phone: null, bio: null, links: null },
  rewards: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true });
  (loadProjectForAdmin as jest.Mock).mockResolvedValue(BASE_PROJECT);
  (revalidateFundingPaths as jest.Mock).mockResolvedValue(null);
  (sendReviewDecisionEmail as jest.Mock).mockResolvedValue(null);
});

it('인증 없음 → 401', async () => {
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve' });
  expect(r.status).toBe(401);
});

it('PATCH가 아니면 405', async () => {
  const r = await call('GET', { id: 'proj-1' }, {});
  expect(r.status).toBe(405);
});

it('모르는 action → 400', async () => {
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'nope' });
  expect(r.status).toBe(400);
  expect(decideProject).not.toHaveBeenCalled();
});

it('Cache-Control: no-store', async () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const res = { setHeader, status, revalidate: jest.fn() } as unknown as NextApiResponse;
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo' });
  await handler(
    { method: 'PATCH', query: { id: 'proj-1' }, body: { action: 'approve' }, headers: {}, socket: {} } as unknown as NextApiRequest,
    res,
  );
  expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});

it('없는 id → decideProject의 not_found를 404로 옮긴다', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: false, code: 'not_found', message: '프로젝트를 찾을 수 없습니다.' });
  const r = await call('PATCH', { id: 'ghost' }, { action: 'approve' });
  expect(r.status).toBe(404);
});

/**
 * submitted가 아닌 프로젝트 판정 → 409이고 DB 불변.
 * decideProject가 상태 전이표(nextReviewStatus)로 이미 conflict를 판정해 돌려주므로,
 * 핸들러는 그 code를 그대로 409로 옮기기만 하면 된다 — 재조회(loadProjectForAdmin)는
 * decideProject 실패 분기에서는 호출되지 않으므로 DB에 쓰기가 없었음을 그것으로 확인한다.
 */
it('submitted가 아닌 프로젝트 판정 → 409이고 후속 쓰기(재검증·메일)가 없다', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: false, code: 'conflict', message: '지금 상태에서는 그 판정을 할 수 없습니다.' });
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve' });
  expect(r.status).toBe(409);
  expect(revalidateFundingPaths).not.toHaveBeenCalled();
  expect(sendReviewDecisionEmail).not.toHaveBeenCalled();
});

it('invalid_slug·duplicate_slug·incomplete·expired → 400', async () => {
  for (const code of ['invalid_slug', 'duplicate_slug', 'incomplete', 'expired'] as const) {
    (decideProject as jest.Mock).mockResolvedValue({ ok: false, code, message: '사유' });
    const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve' });
    expect(r.status).toBe(400);
  }
});

it('승인 성공 → 200, revalidate·메일 호출, warnings 없음', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo' });
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve', slug: 'demo' });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true });
  expect(decideProject).toHaveBeenCalledWith('proj-1', 'approve', { note: undefined, slug: 'demo' }, expect.any(Date));
  expect(revalidateFundingPaths).toHaveBeenCalledWith(expect.anything(), 'demo');
  expect(sendReviewDecisionEmail).toHaveBeenCalledWith(BASE_PROJECT, 'approve', null, 'demo');
});

it('보완 요청·반려는 revalidate를 부르지 않는다(승인만 공개 화면을 바꾼다)', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo' });
  await call('PATCH', { id: 'proj-1' }, { action: 'request_changes', note: '사진을 바꿔주세요' });
  expect(revalidateFundingPaths).not.toHaveBeenCalled();
  expect(sendReviewDecisionEmail).toHaveBeenCalledWith(BASE_PROJECT, 'request_changes', '사진을 바꿔주세요', 'demo');
});

/** 재검증이 실패해도 200이고 warnings에 사유가 있다 — 판정 자체는 이미 끝났으므로. */
it('재검증이 실패해도 200이고 warnings에 사유가 있다', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo' });
  (revalidateFundingPaths as jest.Mock).mockResolvedValue('재검증 실패: /ko/funding');
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve' });
  expect(r.status).toBe(200);
  expect(r.body.ok).toBe(true);
  expect(r.body.warnings).toContain('재검증 실패: /ko/funding');
});

/** 메일이 실패해도 200이고 warnings에 사유가 있다 — 운영자가 개설자에게 연락이 갔다고 착각하면 안 된다. */
it('메일이 실패해도 200이고 warnings에 사유가 있다', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo' });
  (sendReviewDecisionEmail as jest.Mock).mockResolvedValue('creator:5xx');
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'reject', note: '사유' });
  expect(r.status).toBe(200);
  expect(r.body.ok).toBe(true);
  expect(r.body.warnings).toContain('creator:5xx');
});

it('decideProject의 warnings(시작일 경과)도 응답 warnings에 합쳐진다', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo', warnings: ['시작일이 이미 지나 승인 즉시 모금이 시작됩니다.'] });
  (revalidateFundingPaths as jest.Mock).mockResolvedValue('재검증 실패: /ko/funding');
  (sendReviewDecisionEmail as jest.Mock).mockResolvedValue('creator:5xx');
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve' });
  expect(r.status).toBe(200);
  expect(r.body.warnings).toEqual([
    '시작일이 이미 지나 승인 즉시 모금이 시작됩니다.',
    '재검증 실패: /ko/funding',
    'creator:5xx',
  ]);
});

/** decideProject가 unique 제약 예외를 던지면(경합) 500이 아니라 409로 바뀐다. */
it('decideProject가 예외를 던지면(slug 경합) 500이 아니라 409', async () => {
  (decideProject as jest.Mock).mockRejectedValue(new Error('UNIQUE constraint failed: funding_projects.slug'));
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve', slug: 'demo' });
  expect(r.status).toBe(409);
  expect(r.body.ok).toBe(false);
  expect(sendReviewDecisionEmail).not.toHaveBeenCalled();
});

describe('set_note', () => {
  it('없는 프로젝트 → 404', async () => {
    (loadProjectForAdmin as jest.Mock).mockResolvedValue(null);
    const r = await call('PATCH', { id: 'ghost' }, { action: 'set_note', note: '메모' });
    expect(r.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('판정 없이 메모만 저장한다 — decideProject·메일·재검증을 부르지 않는다', async () => {
    const r = await call('PATCH', { id: 'proj-1' }, { action: 'set_note', note: '심사 중 확인할 것' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ reviewNote: '심사 중 확인할 것' }));
    expect(decideProject).not.toHaveBeenCalled();
    expect(sendReviewDecisionEmail).not.toHaveBeenCalled();
    expect(revalidateFundingPaths).not.toHaveBeenCalled();
  });

  it('빈 문자열 메모는 null로 저장한다(지우기)', async () => {
    await call('PATCH', { id: 'proj-1' }, { action: 'set_note', note: '' });
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ reviewNote: null }));
  });
});
