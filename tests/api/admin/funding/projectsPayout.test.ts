/** @jest-environment node */
/**
 * 관리자 펀딩 프로젝트 라우트의 **정산 액션**만 본다. 판정·공개 상태·계정 수정 액션은
 * `projects.test.ts`가 이미 덮는다 — 같은 파일에 몰면 mock 목록이 두 배가 되고 무엇이
 * 무엇을 검증하는지 흐려진다.
 */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/funding/adminProjects', () => ({ loadProjectForAdmin: jest.fn() }));
jest.mock('../../../../lib/funding/reviewDecision', () => ({
  ...jest.requireActual('../../../../lib/funding/reviewDecision'),
  decideProject: jest.fn(),
}));
jest.mock('../../../../lib/funding/publicStatusDecision', () => ({
  ...jest.requireActual('../../../../lib/funding/publicStatusDecision'),
  decidePublicStatus: jest.fn(),
}));
jest.mock('../../../../lib/funding/revalidate', () => ({ revalidateFundingPaths: jest.fn() }));
jest.mock('../../../../lib/funding/reviewEmail', () => ({
  sendReviewDecisionEmail: jest.fn(),
  sendReviewDecisionOperatorFallback: jest.fn(),
  sendPublicStatusEmail: jest.fn(),
  sendPublicStatusOperatorFallback: jest.fn(),
}));
jest.mock('../../../../lib/funding/payout', () => ({
  buildFundingPayoutPreview: jest.fn(),
  markFundingPayoutPaid: jest.fn(),
  recordFundingPayout: jest.fn(),
}));
jest.mock('../../../../lib/funding/payoutAccount', () => ({ loadFundingPayoutAccountMasked: jest.fn() }));
jest.mock('../../../../lib/funding/payoutEmail', () => ({
  sendFundingPayoutRecordedEmail: jest.fn(),
  sendFundingPayoutPaidEmail: jest.fn(),
  sendFundingPayoutOperatorFallback: jest.fn(),
}));
jest.mock('../../../../db/client', () => ({ getDb: jest.fn(() => ({})) }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/admin/funding/projects/[id]';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { loadProjectForAdmin } from '../../../../lib/funding/adminProjects';
import {
  buildFundingPayoutPreview,
  markFundingPayoutPaid,
  recordFundingPayout,
} from '../../../../lib/funding/payout';
import { loadFundingPayoutAccountMasked } from '../../../../lib/funding/payoutAccount';
import {
  sendFundingPayoutOperatorFallback,
  sendFundingPayoutPaidEmail,
  sendFundingPayoutRecordedEmail,
} from '../../../../lib/funding/payoutEmail';

const call = async (body: unknown, method = 'PATCH') => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status, revalidate: jest.fn() } as unknown as NextApiResponse;
  await handler(
    { method, query: { id: 'proj-1' }, body, headers: {}, socket: {} } as unknown as NextApiRequest,
    res,
  );
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] as Record<string, unknown> };
};

const PAYOUT = {
  id: 'pay-1',
  projectId: 'proj-1',
  grossAmount: 1_000_000,
  refundAmount: 0,
  supplyAmount: 909_091,
  feeAmount: 89_000,
  platformFeeAmount: 55_000,
  paymentFeeAmount: 34_000,
  shareAmount: 911_000,
  withholdingAmount: 30_063,
  netAmount: 880_937,
  backerCount: 12,
  status: 'pending' as const,
  paidAt: null,
  memo: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true });
  (loadProjectForAdmin as jest.Mock).mockResolvedValue({
    id: 'proj-1',
    title: '데모 프로젝트',
    creatorEmail: 'creator@example.com',
  });
  (loadFundingPayoutAccountMasked as jest.Mock).mockResolvedValue({
    bankName: '국민은행',
    holder: '개설자',
    accountLast4: '9012',
    taxType: 'withholding',
  });
  (sendFundingPayoutRecordedEmail as jest.Mock).mockResolvedValue(null);
  (sendFundingPayoutPaidEmail as jest.Mock).mockResolvedValue(null);
  (sendFundingPayoutOperatorFallback as jest.Mock).mockResolvedValue(null);
});

afterEach(() => jest.restoreAllMocks());

describe('record_payout', () => {
  it('인증 없으면 401이고 기록을 시도하지 않는다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call({ action: 'record_payout' });
    expect(r.status).toBe(401);
    expect(recordFundingPayout).not.toHaveBeenCalled();
  });

  it('기록 성공 → 201, 개설자에게 메일', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    const r = await call({ action: 'record_payout' });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ ok: true });
    expect(sendFundingPayoutRecordedEmail).toHaveBeenCalledWith(
      'creator@example.com',
      '데모 프로젝트',
      PAYOUT,
      expect.objectContaining({ accountLast4: '9012' }),
    );
  });

  /**
   * 실패 코드 여섯은 운영자가 할 일이 서로 다르다 — 전부 같은 400으로 뭉개면 화면이 이유를
   * 구분해 보여줄 수 없다.
   */
  it.each([
    ['not_found', 404],
    ['already_recorded', 409],
    ['nothing_to_pay', 409],
    ['not_closed', 409],
    ['no_payout_account', 409],
    ['no_tax_type', 409],
  ])('%s → %i', async (code, expected) => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: false, code });
    const r = await call({ action: 'record_payout' });
    expect(r.status).toBe(expected);
    expect(r.body.code).toBe(code);
    expect(r.body.message).toEqual(expect.any(String));
    expect(sendFundingPayoutRecordedEmail).not.toHaveBeenCalled();
  });

  it('두 번째 기록은 already_recorded로 막힌다 — 두 번 기록되지 않는다', async () => {
    (recordFundingPayout as jest.Mock)
      .mockResolvedValueOnce({ ok: true, payout: PAYOUT })
      .mockResolvedValueOnce({ ok: false, code: 'already_recorded' });
    expect((await call({ action: 'record_payout' })).status).toBe(201);
    expect((await call({ action: 'record_payout' })).status).toBe(409);
  });

  /**
   * 메일 실패가 기록을 깨뜨리면 운영자는 같은 버튼을 다시 눌러 409만 받는다 — 기록은 이미
   * DB에 있는데 화면은 실패라고 말하는 상태가 된다.
   */
  it('메일이 실패해도 201 — warnings로만 알린다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    (sendFundingPayoutRecordedEmail as jest.Mock).mockResolvedValue('creator:send_failed');
    const r = await call({ action: 'record_payout' });
    expect(r.status).toBe(201);
    expect(r.body.warnings).toEqual(['creator:send_failed']);
    expect(sendFundingPayoutOperatorFallback).toHaveBeenCalled();
  });

  it('메일 경로가 통째로 던져도 201 — 기록은 살아 있다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    (loadProjectForAdmin as jest.Mock).mockRejectedValue(new Error('DB 장애'));
    const r = await call({ action: 'record_payout' });
    expect(r.status).toBe(201);
    expect(r.body.warnings).toHaveLength(1);
  });
});

describe('mark_payout_paid', () => {
  const previewWith = (recorded: unknown) => ({ projectId: 'proj-1', recorded });

  it('인증 없으면 401', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call({ action: 'mark_payout_paid' });
    expect(r.status).toBe(401);
    expect(markFundingPayoutPaid).not.toHaveBeenCalled();
  });

  it('기록이 없으면 409 — 먼저 기록해야 한다', async () => {
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue(previewWith(null));
    const r = await call({ action: 'mark_payout_paid' });
    expect(r.status).toBe(409);
    expect(markFundingPayoutPaid).not.toHaveBeenCalled();
  });

  it('없는 프로젝트 → 404', async () => {
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue(null);
    const r = await call({ action: 'mark_payout_paid' });
    expect(r.status).toBe(404);
  });

  it('지급 표시 성공 → 200, 메모를 함께 저장하고 개설자에게 메일', async () => {
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue(previewWith(PAYOUT));
    (markFundingPayoutPaid as jest.Mock).mockResolvedValue(true);
    const r = await call({ action: 'mark_payout_paid', memo: ' 9/30 이체 ' });
    expect(r.status).toBe(200);
    expect(markFundingPayoutPaid).toHaveBeenCalledWith('pay-1', '9/30 이체', expect.any(Date));
    expect(sendFundingPayoutPaidEmail).toHaveBeenCalledWith(
      'creator@example.com',
      '데모 프로젝트',
      expect.objectContaining({ status: 'paid', memo: '9/30 이체' }),
      expect.anything(),
    );
  });

  /** pending → paid 한 방향. 두 번째는 실패해야 하고, 되돌리는 경로는 없다. */
  it('두 번 누르면 두 번째는 409', async () => {
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue(previewWith(PAYOUT));
    (markFundingPayoutPaid as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await call({ action: 'mark_payout_paid' })).status).toBe(200);
    expect((await call({ action: 'mark_payout_paid' })).status).toBe(409);
  });

  it('메일이 실패해도 200', async () => {
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue(previewWith(PAYOUT));
    (markFundingPayoutPaid as jest.Mock).mockResolvedValue(true);
    (sendFundingPayoutPaidEmail as jest.Mock).mockResolvedValue('creator:send_failed');
    const r = await call({ action: 'mark_payout_paid' });
    expect(r.status).toBe(200);
    expect(r.body.warnings).toContain('creator:send_failed');
  });
});
