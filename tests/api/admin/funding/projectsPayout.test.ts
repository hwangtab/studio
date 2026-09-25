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
jest.mock('../../../../lib/privacy/accessLog', () => ({ recordAdminPrivacyAccess: jest.fn() }));
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
import { recordAdminPrivacyAccess } from '../../../../lib/privacy/accessLog';

const call = async (body: unknown, method = 'PATCH', headers: Record<string, string> = {}) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status, revalidate: jest.fn() } as unknown as NextApiResponse;
  await handler(
    { method, query: { id: 'proj-1' }, body, headers, socket: {} } as unknown as NextApiRequest,
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
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha', name: '황경하' });
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
  (recordAdminPrivacyAccess as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('record_payout', () => {
  it('인증 없으면 401이고 기록을 시도하지 않는다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call({ action: 'record_payout', expectedNetAmount: PAYOUT.netAmount });
    expect(r.status).toBe(401);
    expect(recordFundingPayout).not.toHaveBeenCalled();
  });

  it('기록 성공 → 201, 개설자에게 메일', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    const r = await call({ action: 'record_payout', expectedNetAmount: PAYOUT.netAmount });
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
   * 실패 코드 일곱은 운영자가 할 일이 서로 다르다 — 전부 같은 400으로 뭉개면 화면이 이유를
   * 구분해 보여줄 수 없다.
   */
  it.each([
    ['not_found', 404],
    ['already_recorded', 409],
    ['nothing_to_pay', 409],
    ['not_closed', 409],
    ['no_payout_account', 409],
    ['no_tax_type', 409],
    ['no_resident_number', 409],
  ])('%s → %i', async (code, expected) => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: false, code });
    const r = await call({ action: 'record_payout', expectedNetAmount: PAYOUT.netAmount });
    expect(r.status).toBe(expected);
    expect(r.body.code).toBe(code);
    expect(r.body.message).toEqual(expect.any(String));
    expect(sendFundingPayoutRecordedEmail).not.toHaveBeenCalled();
  });

  it('확인 금액을 그대로 recordFundingPayout에 넘긴다 — 서버가 임의로 정하지 않는다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    await call({ action: 'record_payout', expectedNetAmount: 777_000 });
    expect(recordFundingPayout).toHaveBeenCalledWith('proj-1', expect.any(Date), 777_000, 'kyungha', null);
  });

  /**
   * 네 번째 인자는 접속기록용 IP다 — 정산 기록은 주민등록번호를 한 번 복호화하고
   * (`residentNumberReadable`), 그 처리가 `privacy_access_logs`에 남는다.
   */
  it('요청 IP를 recordFundingPayout에 함께 넘긴다 — 접속기록에 들어간다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    await call({ action: 'record_payout', expectedNetAmount: 777_000 }, 'PATCH', {
      'x-vercel-forwarded-for': '203.0.113.7',
    });
    expect(recordFundingPayout).toHaveBeenCalledWith('proj-1', expect.any(Date), 777_000, 'kyungha', '203.0.113.7');
  });

  /**
   * 회귀: 이 값이 안 실려 오면 낙관적 잠금을 우회하는 경로가 다시 생긴다 — 서버가 뭐라도
   * 기본값을 골라 넣으면 화면이 승인한 금액과 대조할 것이 없어진다.
   */
  it('확인 금액이 안 오면 400 — 기록을 시도하지 않는다', async () => {
    const r = await call({ action: 'record_payout' });
    expect(r.status).toBe(400);
    expect(recordFundingPayout).not.toHaveBeenCalled();
  });

  it('그 사이에 금액이 바뀌면 409와 두 금액을 문구로 돌려준다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({
      ok: false,
      code: 'amount_changed',
      expectedNetAmount: 880_937,
      netAmount: 792_782,
    });
    const r = await call({ action: 'record_payout', expectedNetAmount: 880_937 });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('amount_changed');
    expect(r.body.message).toContain('880,937');
    expect(r.body.message).toContain('792,782');
    expect(sendFundingPayoutRecordedEmail).not.toHaveBeenCalled();
  });

  it('두 번째 기록은 already_recorded로 막힌다 — 두 번 기록되지 않는다', async () => {
    (recordFundingPayout as jest.Mock)
      .mockResolvedValueOnce({ ok: true, payout: PAYOUT })
      .mockResolvedValueOnce({ ok: false, code: 'already_recorded' });
    expect((await call({ action: 'record_payout', expectedNetAmount: PAYOUT.netAmount })).status).toBe(201);
    expect((await call({ action: 'record_payout', expectedNetAmount: PAYOUT.netAmount })).status).toBe(409);
  });

  /**
   * 메일 실패가 기록을 깨뜨리면 운영자는 같은 버튼을 다시 눌러 409만 받는다 — 기록은 이미
   * DB에 있는데 화면은 실패라고 말하는 상태가 된다.
   */
  it('메일이 실패해도 201 — warnings로만 알린다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    (sendFundingPayoutRecordedEmail as jest.Mock).mockResolvedValue('creator:send_failed');
    const r = await call({ action: 'record_payout', expectedNetAmount: PAYOUT.netAmount });
    expect(r.status).toBe(201);
    expect(r.body.warnings).toEqual(['creator:send_failed']);
    expect(sendFundingPayoutOperatorFallback).toHaveBeenCalled();
  });

  it('메일 경로가 통째로 던져도 201 — 기록은 살아 있다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    (loadProjectForAdmin as jest.Mock).mockRejectedValue(new Error('DB 장애'));
    const r = await call({ action: 'record_payout', expectedNetAmount: PAYOUT.netAmount });
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

/**
 * **값이 서버 밖으로 나가는 유일한 복호화**가 이 경로다 — 정산 안내 메일 본문에 은행명과
 * 예금주가 실린다(계좌번호는 뒤 4자리까지만). 운영자 조회 버튼·기록 직전 점검은 이미
 * 접속기록에 남는데 여기만 비어 있으면, 사후에 "무엇이 개설자 메일함으로 나갔는가"를
 * 재구성할 수 없다.
 */
describe('정산 안내 메일의 계좌 복호화도 접속기록에 남는다', () => {
  const recordCall = () => call({ action: 'record_payout', expectedNetAmount: PAYOUT.netAmount });

  beforeEach(() => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
  });

  it('메일을 만들며 연 사실을 남긴다 — 값은 넘기지 않는다', async () => {
    expect((await recordCall()).status).toBe(201);
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(
      expect.anything(),
      'kyungha',
      'funding_payout_account_email',
      'proj-1',
      'success',
    );
    expect(JSON.stringify((recordAdminPrivacyAccess as jest.Mock).mock.calls)).not.toContain('국민은행');
    expect(JSON.stringify((recordAdminPrivacyAccess as jest.Mock).mock.calls)).not.toContain('9012');
  });

  it('복호화에 실패해 은행명·예금주가 비면 decrypt_failed로 남는다', async () => {
    (loadFundingPayoutAccountMasked as jest.Mock).mockResolvedValue({
      bankName: null, holder: null, accountLast4: '9012', taxType: 'withholding',
    });
    await recordCall();
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(
      expect.anything(), 'kyungha', 'funding_payout_account_email', 'proj-1', 'decrypt_failed',
    );
  });

  it('등록된 계좌가 없으면 not_found로 남는다', async () => {
    (loadFundingPayoutAccountMasked as jest.Mock).mockResolvedValue(null);
    await recordCall();
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(
      expect.anything(), 'kyungha', 'funding_payout_account_email', 'proj-1', 'not_found',
    );
  });

  it('기록이 실패해도 정산 알림은 나간다 — 기록 경로가 업무를 멈추지 않는다', async () => {
    (recordAdminPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
    const r = await recordCall();
    expect(r.status).toBe(201);
    expect(sendFundingPayoutRecordedEmail).toHaveBeenCalled();
  });

  it('지급 표시에서도 남는다', async () => {
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue({ recorded: PAYOUT, netAmount: PAYOUT.netAmount });
    (markFundingPayoutPaid as jest.Mock).mockResolvedValue(true);
    await call({ action: 'mark_payout_paid' });
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(
      expect.anything(), 'kyungha', 'funding_payout_account_email', 'proj-1', 'success',
    );
  });
});

/**
 * 계좌를 열지 못한 사유는 운영자가 할 일을 정반대로 가른다. 키 문제면 값이 멀쩡하니
 * 재등록을 요청하면 안 되고, `malformed`이면 재등록이 유일한 복구 경로다.
 */
describe.each([
  ['payout_account_unreadable', '정산 계좌'],
  ['resident_number_unreadable', '주민등록번호'],
] as const)('%s 문구는 사유로 갈린다', (code, what) => {
  const failWith = (cryptoCode: string) => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: false, code, cryptoCode });
    return call({ action: 'record_payout', expectedNetAmount: PAYOUT.netAmount });
  };

  it('어느 값이 안 열렸는지 말한다', async () => {
    expect(String((await failWith('missing_key')).body.message)).toContain(what);
  });

  it('키 문제면 키를 확인하라고 하고, 재등록을 요청하지 말라고 적는다', async () => {
    const r = await failWith('key_mismatch');
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ code, cryptoCode: 'key_mismatch' });
    expect(String(r.body.message)).toContain('FUNDING_FIELD_KEY');
    expect(String(r.body.message)).toContain('재등록을 요청하지 마세요');
  });

  it('malformed면 반대로 재등록을 요청하라고 적는다 — 키를 되찾아도 안 열린다', async () => {
    const r = await failWith('malformed');
    expect(r.status).toBe(503);
    expect(String(r.body.message)).toContain('다시 등록해 달라고 요청해 주세요');
    expect(String(r.body.message)).not.toContain('재등록을 요청하지 마세요');
  });
});
