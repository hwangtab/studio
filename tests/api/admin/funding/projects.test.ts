/** @jest-environment node */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/funding/adminProjects', () => ({ loadProjectForAdmin: jest.fn() }));
jest.mock('../../../../lib/funding/reviewDecision', () => ({
  ...jest.requireActual('../../../../lib/funding/reviewDecision'),
  decideProject: jest.fn(),
}));
jest.mock('../../../../lib/funding/revalidate', () => ({ revalidateFundingPaths: jest.fn() }));
jest.mock('../../../../lib/funding/reviewEmail', () => ({
  sendReviewDecisionEmail: jest.fn(),
  sendReviewDecisionOperatorFallback: jest.fn(),
}));

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
import { sendReviewDecisionEmail, sendReviewDecisionOperatorFallback } from '../../../../lib/funding/reviewEmail';

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
  (sendReviewDecisionOperatorFallback as jest.Mock).mockResolvedValue(null);
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
it('decideProject가 slug unique 제약 예외를 던지면(경합) 500이 아니라 409', async () => {
  (decideProject as jest.Mock).mockRejectedValue(new Error('UNIQUE constraint failed: funding_projects.slug'));
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve', slug: 'demo' });
  expect(r.status).toBe(409);
  expect(r.body.ok).toBe(false);
  expect(sendReviewDecisionEmail).not.toHaveBeenCalled();
});

/**
 * catch를 slug 경합으로만 좁혔다는 것을 확인하는 테스트. 이전 버전은 decideProject 전체를
 * 감싼 catch가 원인과 무관하게 "주소 중복" 409를 돌려줬다 — Turso 연결 실패든 request_changes
 * 경로(슬러그를 아예 안 건드리는)의 예외든 전부 같은 문구를 받았다. 지금은 unique 제약이
 * 아닌 예외를 500으로 올리고, 메시지도 "주소 중복"이 아니어야 한다.
 */
it('decideProject가 slug와 무관한 예외를 던지면 500이고 "주소 중복" 메시지가 아니다', async () => {
  (decideProject as jest.Mock).mockRejectedValue(new Error('libsql: connection closed'));
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve', slug: 'demo' });
  expect(r.status).toBe(500);
  expect(r.body.ok).toBe(false);
  expect(r.body.message).not.toMatch(/주소를 먼저 사용/);
  expect(sendReviewDecisionEmail).not.toHaveBeenCalled();
});

it('보완 요청·반려 경로에서 예외가 나도 "주소 중복" 409가 아니라 500이다(슬러그와 무관한 경로)', async () => {
  (decideProject as jest.Mock).mockRejectedValue(new Error('unexpected failure'));
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'reject', note: '사유' });
  expect(r.status).toBe(500);
});

/**
 * 판정 뒤 loadProjectForAdmin이 null을 돌려주면(예: 그 사이 삭제) 메일을 조용히 건너뛰고
 * 200만 나가서는 안 된다 — 이 태스크가 막으려던 "운영자는 통보됐다고 착각" 상태가 재현된다.
 */
it('판정 성공 뒤 프로젝트를 다시 읽지 못하면(null) 200이되 경고를 남기고 메일을 보내지 않는다', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo' });
  (loadProjectForAdmin as jest.Mock).mockResolvedValue(null);
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve' });
  expect(r.status).toBe(200);
  expect(r.body.warnings).toContain('개설자 정보를 다시 읽지 못해 알림 메일을 보내지 못했습니다.');
  expect(sendReviewDecisionEmail).not.toHaveBeenCalled();
});

/** 개설자 메일이 실패하면 운영자에게 폴백 알림을 보낸다 — 실패 사실이 응답에만 남지 않도록. */
it('개설자 메일 실패 → 운영자 폴백 알림을 보낸다', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo' });
  (sendReviewDecisionEmail as jest.Mock).mockResolvedValue('creator:5xx');
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve' });
  expect(r.status).toBe(200);
  expect(sendReviewDecisionOperatorFallback).toHaveBeenCalledWith(BASE_PROJECT, 'approve', 'demo', 'creator:5xx');
  expect(r.body.warnings).toContain('creator:5xx');
});

/** 폴백 알림도 실패하면 그 사실까지 warnings에 추가로 담는다. */
it('개설자 메일과 운영자 폴백이 둘 다 실패하면 두 사유가 모두 warnings에 남는다', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo' });
  (sendReviewDecisionEmail as jest.Mock).mockResolvedValue('creator:5xx');
  (sendReviewDecisionOperatorFallback as jest.Mock).mockResolvedValue('operator:TIMEOUT');
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve' });
  expect(r.status).toBe(200);
  expect(r.body.warnings).toContain('creator:5xx');
  expect(r.body.warnings.some((w: string) => w.includes('operator:TIMEOUT'))).toBe(true);
});

/** 재검증이 예기치 않게 던져도(동기/비동기 예외) 500이 아니라 200 + 경고로 나간다. */
it('revalidateFundingPaths가 예외를 던져도 200이고 경고를 남긴다', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo' });
  (revalidateFundingPaths as jest.Mock).mockRejectedValue(new Error('boom'));
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'approve' });
  expect(r.status).toBe(200);
  expect(r.body.ok).toBe(true);
  expect(r.body.warnings.some((w: string) => w.includes('재검증'))).toBe(true);
});

/** sendReviewDecisionEmail이 예기치 않게 던져도(반환이 아니라 throw) 500이 아니라 200 + 경고로 나간다. */
it('sendReviewDecisionEmail이 예외를 던져도 200이고 경고를 남긴다', async () => {
  (decideProject as jest.Mock).mockResolvedValue({ ok: true, slug: 'demo' });
  (sendReviewDecisionEmail as jest.Mock).mockRejectedValue(new Error('boom'));
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'reject', note: '사유' });
  expect(r.status).toBe(200);
  expect(r.body.ok).toBe(true);
  expect(r.body.warnings.some((w: string) => w.includes('재검증·메일 처리 중 오류'))).toBe(true);
});

describe('set_review_note', () => {
  it('없는 프로젝트 → 404', async () => {
    (loadProjectForAdmin as jest.Mock).mockResolvedValue(null);
    const r = await call('PATCH', { id: 'ghost' }, { action: 'set_review_note', note: '메모' });
    expect(r.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('판정 없이 개설자에게 보일 안내문(reviewNote)만 저장한다 — decideProject·메일·재검증을 부르지 않는다', async () => {
    const r = await call('PATCH', { id: 'proj-1' }, { action: 'set_review_note', note: '심사 중 확인할 것' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ reviewNote: '심사 중 확인할 것' }));
    expect(decideProject).not.toHaveBeenCalled();
    expect(sendReviewDecisionEmail).not.toHaveBeenCalled();
    expect(revalidateFundingPaths).not.toHaveBeenCalled();
  });

  it('빈 문자열 메모는 null로 저장한다(지우기)', async () => {
    await call('PATCH', { id: 'proj-1' }, { action: 'set_review_note', note: '' });
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ reviewNote: null }));
  });
});

/** 옛 이름은 더 이상 유효한 action이 아니다 — 이름 변경이 실제로 반영됐는지 확인. */
it('옛 action 이름 set_note는 더 이상 통하지 않는다 → 400', async () => {
  const r = await call('PATCH', { id: 'proj-1' }, { action: 'set_note', note: '메모' });
  expect(r.status).toBe(400);
  expect(mockUpdate).not.toHaveBeenCalled();
});
