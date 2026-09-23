/**
 * 관리자 정산 구획. 여기서 지키는 것은 **화면이 내놓는 숫자가 스스로 모순되지 않는 것**이다.
 * 이 구획의 버튼 하나가 되돌릴 수 없는 기록을 만들기 때문에, 운영자가 눈으로 하는 검산이
 * 마지막 방어선이다.
 */
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { FundingPayoutSection, type AdminPayoutRecordView, type AdminPayoutView } from './FundingPayoutSection';

const RECORD: AdminPayoutRecordView = {
  id: 'pay-1',
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
  status: 'pending',
  paidAt: null,
  memo: null,
  createdAt: '2026-11-01T00:00:00.000Z',
};

const VIEW: AdminPayoutView = {
  grossAmount: 1_000_000,
  refundAmount: 0,
  manualGrossAmount: 0,
  supplyAmount: 909_091,
  platformFeeAmount: 55_000,
  paymentFeeAmount: 34_000,
  feeAmount: 89_000,
  shareAmount: 911_000,
  withholdingAmount: 30_063,
  netAmount: 880_937,
  backerCount: 12,
  closed: true,
  hasPayoutAccount: true,
  hasTaxType: true,
  recorded: null,
};

const renderSection = (payout: AdminPayoutView | null, over: Partial<Parameters<typeof FundingPayoutSection>[0]> = {}) =>
  render(
    <FundingPayoutSection
      projectId="proj-1"
      payout={payout}
      busy={false}
      onRecord={jest.fn()}
      onMarkPaid={jest.fn()}
      {...over}
    />,
  );

const recordedPanel = () => screen.getByRole('heading', { name: '기록된 값' }).parentElement as HTMLElement;

describe('기록된 값 패널', () => {
  /**
   * 회귀: 기록 행(`funding_project_payouts`)에는 요율 컬럼이 없고 금액만 있다. 그런데
   * 라벨이 현재 상수를 읽어 "결제 수수료 (3.4%)"로 적고 있었다 — 운영자가 토스 계약서로
   * 요율을 확정해 상수를 바꾸는 순간(이 기능이 전제하는 바로 그 사건) 옛 기록 옆에 서로
   * 안 맞는 두 숫자가 나란히 뜬다. 검산하라고 만든 패널이 검산을 못 하게 된다.
   */
  it('요율을 적지 않는다 — 기록에는 요율이 남아 있지 않다', () => {
    renderSection({ ...VIEW, recorded: RECORD });
    const panel = recordedPanel();
    expect(panel).not.toHaveTextContent('%');
    expect(within(panel).getByText('플랫폼 수수료')).toBeInTheDocument();
    expect(within(panel).getByText('결제 수수료')).toBeInTheDocument();
    expect(within(panel).getByText('원천징수')).toBeInTheDocument();
  });

  it('기록된 금액과 상태를 그대로 보여준다', () => {
    renderSection({ ...VIEW, recorded: { ...RECORD, status: 'paid', paidAt: '2026-11-05T00:00:00.000Z', memo: '11/5 이체' } });
    const panel = recordedPanel();
    expect(panel).toHaveTextContent('880,937원');
    expect(panel).toHaveTextContent('지급 완료');
    expect(panel).toHaveTextContent('11/5 이체');
  });

  it('기록 전에는 기록값 자리에 그 사실만 적는다', () => {
    renderSection(VIEW);
    expect(recordedPanel()).toHaveTextContent('아직 기록하지 않았습니다.');
  });

  it('기록 뒤 숫자가 갈리면 항목별로 드러낸다 — 보낼 금액은 기록값', () => {
    renderSection({ ...VIEW, refundAmount: 100_000, netAmount: 792_782, recorded: RECORD });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('환불: 기록 0 → 지금 100,000');
    expect(alert).toHaveTextContent('실이체액: 기록 880,937 → 지금 792,782');
  });
});
