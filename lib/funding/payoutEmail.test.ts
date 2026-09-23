/** @jest-environment node */
import { buildFundingPayoutPaidText, buildFundingPayoutRecordedText } from './payoutEmail';

import type { FundingProjectPayout } from '../../db/schema';

const PAYOUT: FundingProjectPayout = {
  id: 'pay-1',
  projectId: 'proj-1',
  grossAmount: 1_000_000,
  refundAmount: 50_000,
  supplyAmount: 863_636,
  feeAmount: 84_550,
  platformFeeAmount: 52_250,
  paymentFeeAmount: 32_300,
  shareAmount: 865_450,
  withholdingAmount: 28_560,
  netAmount: 836_890,
  backerCount: 12,
  status: 'pending',
  paidAt: null,
  memo: null,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
};

const ACCOUNT = { bankName: '국민은행', holder: '개설자', accountLast4: '9012', taxType: 'withholding' as const };

describe('정산 메일 본문', () => {
  it('계산 내역을 항목별로 적는다', () => {
    const text = buildFundingPayoutRecordedText('데모 프로젝트', PAYOUT, ACCOUNT);
    for (const expected of ['1,000,000', '50,000', '52,250', '32,300', '28,560', '836,890', '12건']) {
      expect(text).toContain(expected);
    }
  });

  /**
   * 메일은 전달·보관되는 문서라 어디로 흘러갈지 통제하지 못한다. 어느 계좌로 보냈는지
   * 확인하는 데는 은행·예금주·뒤 4자리로 충분하다.
   */
  it('계좌번호 전체를 싣지 않는다 — 뒤 4자리까지', () => {
    const text = buildFundingPayoutPaidText('데모 프로젝트', { ...PAYOUT, status: 'paid' }, ACCOUNT);
    expect(text).toContain('9012');
    expect(text).toContain('국민은행');
    expect(text).not.toContain('123-456-789012');
    expect(text).not.toMatch(/\d{3}-\d{3}-\d{6}/);
  });

  it('사업자(원천징수 0)면 원천징수 줄을 적지 않는다', () => {
    const text = buildFundingPayoutRecordedText('데모', { ...PAYOUT, withholdingAmount: 0 }, ACCOUNT);
    expect(text).not.toContain('원천징수');
  });

  it('계좌를 읽지 못하면 그 사실을 적는다 — 빈 칸으로 두지 않는다', () => {
    const text = buildFundingPayoutRecordedText('데모', PAYOUT, null);
    expect(text).toContain('등록된 계좌 정보를 읽지 못했습니다');
  });

  it('지급 메일은 메모를 함께 싣는다', () => {
    const text = buildFundingPayoutPaidText('데모', { ...PAYOUT, status: 'paid', memo: '11/5 이체' }, ACCOUNT);
    expect(text).toContain('11/5 이체');
  });
});
