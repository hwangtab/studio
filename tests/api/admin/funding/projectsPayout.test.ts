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
  loadRecordedFundingPayout: jest.fn(),
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
  loadRecordedFundingPayout,
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

/** 화면이 보내는 확인 금액 — 실이체액과 설계비·제작비 공제액·차액(payout.ts `ExpectedPayoutAmounts`). */
const recordBody = (netAmount: number, over: Record<string, unknown> = {}) => ({
  action: 'record_payout',
  expectedNetAmount: netAmount,
  expectedDesignFeeOffsetAmount: 0,
  expectedProductionFeeOffsetAmount: 0,
  expectedShortfallAmount: 0,
  ...over,
});
const expectedAmounts = (netAmount: number) => ({
  netAmount,
  designFeeOffsetAmount: 0,
  productionFeeOffsetAmount: 0,
  shortfallAmount: 0,
});

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
  // clearAllMocks는 구현을 남긴다 — 앞 시험이 넣은 "금액이 바뀐 집계"가 뒤 시험으로 새지 않게 매번 되돌린다.
  (buildFundingPayoutPreview as jest.Mock).mockReset();
});

afterEach(() => jest.restoreAllMocks());

describe('record_payout', () => {
  it('인증 없으면 401이고 기록을 시도하지 않는다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call(recordBody(PAYOUT.netAmount));
    expect(r.status).toBe(401);
    expect(recordFundingPayout).not.toHaveBeenCalled();
  });

  it('기록 성공 → 201, 개설자에게 메일', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    const r = await call(recordBody(PAYOUT.netAmount));
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
    const r = await call(recordBody(PAYOUT.netAmount));
    expect(r.status).toBe(expected);
    expect(r.body.code).toBe(code);
    expect(r.body.message).toEqual(expect.any(String));
    expect(sendFundingPayoutRecordedEmail).not.toHaveBeenCalled();
  });

  it('확인 금액을 그대로 recordFundingPayout에 넘긴다 — 서버가 임의로 정하지 않는다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    await call(recordBody(777_000));
    expect(recordFundingPayout).toHaveBeenCalledWith('proj-1', expect.any(Date), expectedAmounts(777_000), null, 'kyungha');
  });

  /**
   * 네 번째 인자는 접속기록용 IP다 — 정산 기록은 주민등록번호를 한 번 복호화하고
   * (`residentNumberReadable`), 그 처리가 `privacy_access_logs`에 남는다.
   */
  it('요청 IP를 recordFundingPayout에 함께 넘긴다 — 접속기록에 들어간다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    await call(recordBody(777_000), 'PATCH', {
      'x-vercel-forwarded-for': '203.0.113.7',
    });
    expect(recordFundingPayout).toHaveBeenCalledWith('proj-1', expect.any(Date), expectedAmounts(777_000), '203.0.113.7', 'kyungha');
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

  /**
   * 실이체액만 오고 공제액·차액이 빠지면 거부한다 — 실이체액이 0원으로 같은 채 약정 제작비가
   * 바뀌는 경우를 서버가 대조할 수 없게 된다. 화면과 라우트는 같은 배포로 나간다.
   */
  it.each(['expectedDesignFeeOffsetAmount', 'expectedProductionFeeOffsetAmount', 'expectedShortfallAmount'])(
    '%s가 빠지면 400 — 기록을 시도하지 않는다',
    async (field) => {
      const r = await call(recordBody(PAYOUT.netAmount, { [field]: undefined }));
      expect(r.status).toBe(400);
      expect(recordFundingPayout).not.toHaveBeenCalled();
    },
  );

  it('공제액을 그대로 recordFundingPayout에 넘긴다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    await call(
      recordBody(0, {
        expectedDesignFeeOffsetAmount: 550_000,
        expectedProductionFeeOffsetAmount: 251_732,
        expectedShortfallAmount: 1_728_268,
      }),
    );
    expect(recordFundingPayout).toHaveBeenCalledWith(
      'proj-1',
      expect.any(Date),
      { netAmount: 0, designFeeOffsetAmount: 550_000, productionFeeOffsetAmount: 251_732, shortfallAmount: 1_728_268 },
      null,
      'kyungha',
    );
  });

  it('실이체액은 같은데 공제액·차액이 바뀌었으면 409와 무엇이 바뀌었는지 말한다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: false, code: 'amount_changed', expectedNetAmount: 0, netAmount: 0 });
    const r = await call(recordBody(0));
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('amount_changed');
    expect(r.body.message).toContain('차액');
    expect(sendFundingPayoutRecordedEmail).not.toHaveBeenCalled();
  });

  it('그 사이에 금액이 바뀌면 409와 두 금액을 문구로 돌려준다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({
      ok: false,
      code: 'amount_changed',
      expectedNetAmount: 880_937,
      netAmount: 792_782,
    });
    const r = await call(recordBody(880_937));
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
    expect((await call(recordBody(PAYOUT.netAmount))).status).toBe(201);
    expect((await call(recordBody(PAYOUT.netAmount))).status).toBe(409);
  });

  /**
   * 메일 실패가 기록을 깨뜨리면 운영자는 같은 버튼을 다시 눌러 409만 받는다 — 기록은 이미
   * DB에 있는데 화면은 실패라고 말하는 상태가 된다.
   */
  it('메일이 실패해도 201 — warnings로만 알린다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    (sendFundingPayoutRecordedEmail as jest.Mock).mockResolvedValue('creator:send_failed');
    const r = await call(recordBody(PAYOUT.netAmount));
    expect(r.status).toBe(201);
    expect(r.body.warnings).toEqual(['creator:send_failed']);
    expect(sendFundingPayoutOperatorFallback).toHaveBeenCalled();
  });

  it('메일 경로가 통째로 던져도 201 — 기록은 살아 있다', async () => {
    (recordFundingPayout as jest.Mock).mockResolvedValue({ ok: true, payout: PAYOUT });
    (loadProjectForAdmin as jest.Mock).mockRejectedValue(new Error('DB 장애'));
    const r = await call(recordBody(PAYOUT.netAmount));
    expect(r.status).toBe(201);
    expect(r.body.warnings).toHaveLength(1);
  });
});

describe('mark_payout_paid', () => {
  const previewWith = (recorded: unknown, netAmount: number = PAYOUT.netAmount) => ({ projectId: 'proj-1', recorded, netAmount });

  it('인증 없으면 401', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call({ action: 'mark_payout_paid' });
    expect(r.status).toBe(401);
    expect(markFundingPayoutPaid).not.toHaveBeenCalled();
  });

  it('기록이 없으면 409 — 먼저 기록해야 한다', async () => {
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(null);
    const r = await call({ action: 'mark_payout_paid' });
    expect(r.status).toBe(409);
    expect(markFundingPayoutPaid).not.toHaveBeenCalled();
  });

  it('없는 프로젝트 → 404', async () => {
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(null);
    (loadProjectForAdmin as jest.Mock).mockResolvedValue(null);
    const r = await call({ action: 'mark_payout_paid' });
    expect(r.status).toBe(404);
  });

  it('지급 표시 성공 → 200, 메모를 함께 저장하고 개설자에게 메일', async () => {
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(PAYOUT);
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
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(PAYOUT);
    (markFundingPayoutPaid as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await call({ action: 'mark_payout_paid' })).status).toBe(200);
    expect((await call({ action: 'mark_payout_paid' })).status).toBe(409);
  });

  it('기록값과 현재 계산값이 다르면 409(amount_changed)로 한 번 멈추고, acknowledgeAmountChanged면 기록한다', async () => {
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(PAYOUT);
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue(previewWith(PAYOUT, PAYOUT.netAmount - 10_000));
    (markFundingPayoutPaid as jest.Mock).mockResolvedValue(true);
    const blocked = await call({ action: 'mark_payout_paid' });
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ code: 'amount_changed', recordedNetAmount: PAYOUT.netAmount, currentNetAmount: PAYOUT.netAmount - 10_000 });
    expect(markFundingPayoutPaid).not.toHaveBeenCalled();
    // 확인창과 클릭 사이에 금액이 또 바뀌었으면(본 값 ≠ 지금 값) 다시 409.
    const stale = await call({ action: 'mark_payout_paid', acknowledgedNetAmount: PAYOUT.netAmount - 20_000 });
    expect(stale.status).toBe(409);
    const ok = await call({ action: 'mark_payout_paid', acknowledgedNetAmount: PAYOUT.netAmount - 10_000 });
    expect(ok.status).toBe(200);
    expect(markFundingPayoutPaid).toHaveBeenCalled();
  });

  it('메일이 실패해도 200', async () => {
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(PAYOUT);
    (markFundingPayoutPaid as jest.Mock).mockResolvedValue(true);
    (sendFundingPayoutPaidEmail as jest.Mock).mockResolvedValue('creator:send_failed');
    const r = await call({ action: 'mark_payout_paid' });
    expect(r.status).toBe(200);
    expect(r.body.warnings).toContain('creator:send_failed');
  });

  // 정산 집계가 죽어도(서비스 표·사업자 표 조회 실패 등) 이미 끝낸 이체는 기록할 수 있어야 한다.
  it('정산 집계가 실패해도 지급 완료를 기록한다', async () => {
    (buildFundingPayoutPreview as jest.Mock).mockRejectedValue(new Error('no such table: funding_project_services'));
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(PAYOUT);
    (markFundingPayoutPaid as jest.Mock).mockResolvedValue(true);
    const r = await call({ action: 'mark_payout_paid' });
    expect(r.status).toBe(200);
    expect(markFundingPayoutPaid).toHaveBeenCalledWith('pay-1', null, expect.any(Date));
    // 금액 불일치 가드가 집계를 한 번 묻지만, 집계가 죽어도 가드를 건너뛰고 기록은 된다.
    expect(buildFundingPayoutPreview).toHaveBeenCalled();
  });
});

/**
 * **값이 서버 밖으로 나가는 유일한 복호화**가 이 경로다 — 정산 안내 메일 본문에 은행명과
 * 예금주가 실린다(계좌번호는 뒤 4자리까지만). 운영자 조회 버튼·기록 직전 점검은 이미
 * 접속기록에 남는데 여기만 비어 있으면, 사후에 "무엇이 개설자 메일함으로 나갔는가"를
 * 재구성할 수 없다.
 */
describe('정산 안내 메일의 계좌 복호화도 접속기록에 남는다', () => {
  const recordCall = () => call(recordBody(PAYOUT.netAmount));

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
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(PAYOUT);
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
    return call(recordBody(PAYOUT.netAmount));
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

describe('resend_payout_notice — 정산 안내 메일 재발송', () => {
  it('이체 대기 정산이면 "정산 기록" 안내를 다시 보내고 상태는 건드리지 않는다', async () => {
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(PAYOUT);
    const r = await call({ action: 'resend_payout_notice' });
    expect(r.status).toBe(200);
    expect(sendFundingPayoutRecordedEmail).toHaveBeenCalledWith('creator@example.com', '데모 프로젝트', PAYOUT, expect.anything());
    expect(sendFundingPayoutPaidEmail).not.toHaveBeenCalled();
    expect(markFundingPayoutPaid).not.toHaveBeenCalled();
  });

  it('지급 완료 정산이면 "정산 지급" 안내를 보낸다', async () => {
    const paid = { ...PAYOUT, status: 'paid' as const, paidAt: new Date('2026-10-05T00:00:00Z') };
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(paid);
    const r = await call({ action: 'resend_payout_notice' });
    expect(r.status).toBe(200);
    expect(sendFundingPayoutPaidEmail).toHaveBeenCalledWith('creator@example.com', '데모 프로젝트', paid, expect.anything());
    expect(sendFundingPayoutRecordedEmail).not.toHaveBeenCalled();
  });

  it('계좌가 담긴 메일이라 계좌 복호화를 접속기록에 남긴다', async () => {
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(PAYOUT);
    await call({ action: 'resend_payout_notice' });
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'funding_payout_account_email', 'proj-1', expect.any(String));
  });

  it('메일이 또 실패하면 200이되 경고를 돌려준다', async () => {
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(PAYOUT);
    (sendFundingPayoutRecordedEmail as jest.Mock).mockResolvedValue('creator:send_failed');
    const r = await call({ action: 'resend_payout_notice' });
    expect(r.status).toBe(200);
    expect(r.body.warnings).toContain('creator:send_failed');
  });

  it('기록된 정산이 없으면 409, 프로젝트가 없으면 404 — 메일은 보내지 않는다', async () => {
    (loadRecordedFundingPayout as jest.Mock).mockResolvedValue(null);
    expect((await call({ action: 'resend_payout_notice' })).status).toBe(409);
    (loadProjectForAdmin as jest.Mock).mockResolvedValue(null);
    expect((await call({ action: 'resend_payout_notice' })).status).toBe(404);
    expect(sendFundingPayoutRecordedEmail).not.toHaveBeenCalled();
  });

  it('인증이 없으면 401', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    expect((await call({ action: 'resend_payout_notice' })).status).toBe(401);
    expect(sendFundingPayoutRecordedEmail).not.toHaveBeenCalled();
  });
});
