/**
 * 관리자 정산 구획. 여기서 지키는 것은 **화면이 내놓는 숫자가 스스로 모순되지 않는 것**이다.
 * 이 구획의 버튼 하나가 되돌릴 수 없는 기록을 만들기 때문에, 운영자가 눈으로 하는 검산이
 * 마지막 방어선이다.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('기록 버튼과 막는 이유', () => {
  it('막을 이유가 없으면 버튼이 살아 있고 이유 목록도 없다', () => {
    renderSection(VIEW);
    expect(screen.getByRole('button', { name: '정산 기록' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('모금 진행 중·계좌 없음·세금 구분 없음·후원 없음을 모두 적고 버튼을 막는다', () => {
    renderSection({ ...VIEW, closed: false, hasPayoutAccount: false, hasTaxType: false, grossAmount: 0 });
    const list = screen.getByRole('status');
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(list).toHaveTextContent('모금이 아직 끝나지 않았습니다');
    expect(list).toHaveTextContent('정산 계좌가 등록되지 않았습니다');
    expect(list).toHaveTextContent('세금 처리 구분');
    expect(list).toHaveTextContent('결제된 후원이 없어');
    expect(screen.getByRole('button', { name: '정산 기록' })).toBeDisabled();
  });

  /**
   * 회귀: 막는 이유 목록은 `!recorded`일 때만 렌더되는데, 그 목록 첫 항목이 "이미 기록된
   * 정산입니다"였다 — 조건상 절대 보이지 않는 문장이다. 기록 뒤에는 기록 버튼 자체가
   * 사라지고 지급 버튼이 대신 뜬다.
   */
  it('기록 뒤에는 기록 버튼이 사라지고 "이미 기록됐다"는 안내도 뜨지 않는다', () => {
    renderSection({ ...VIEW, recorded: RECORD });
    expect(screen.queryByRole('button', { name: '정산 기록' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지급 완료로 표시' })).toBeInTheDocument();
    expect(screen.queryByText(/이미 기록된 정산입니다/)).not.toBeInTheDocument();
  });

  it('지급까지 끝나면 버튼이 둘 다 없다', () => {
    renderSection({ ...VIEW, recorded: { ...RECORD, status: 'paid' } });
    expect(screen.queryByRole('button', { name: '정산 기록' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지급 완료로 표시' })).not.toBeInTheDocument();
    expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument();
  });
});

describe('입금 계좌', () => {
  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch;
  });

  /** 계좌는 props에 실리지 않는다 — 누를 때만 별도 라우트로 가져온다. */
  it('버튼을 눌러야 서버에서 가져온다', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        account: { bankName: '국민은행', account: '123-45-6789', holder: '홍길동', taxType: 'withholding' },
      }),
    });
    (global as { fetch?: unknown }).fetch = fetchMock;

    renderSection(VIEW);
    expect(screen.queryByText('국민은행')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '계좌 보기' }));

    await waitFor(() => expect(screen.getByText('국민은행')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/funding/projects/proj-1/payout-account', {
      credentials: 'same-origin',
    });
    expect(screen.getByText('123-45-6789')).toBeInTheDocument();
    expect(screen.getByText(/개인 — 원천징수/)).toBeInTheDocument();
  });

  it('읽지 못하면 서버가 준 이유를 적는다', async () => {
    (global as { fetch?: unknown }).fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({ ok: false, message: '권한이 없습니다.' }) });

    renderSection(VIEW);
    await userEvent.click(screen.getByRole('button', { name: '계좌 보기' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('권한이 없습니다.'));
  });

  it('네트워크가 끊겨도 빈 칸으로 두지 않는다', async () => {
    (global as { fetch?: unknown }).fetch = jest.fn().mockRejectedValue(new Error('offline'));

    renderSection(VIEW);
    await userEvent.click(screen.getByRole('button', { name: '계좌 보기' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('네트워크 오류'));
  });
});

describe('집계를 못 읽었을 때', () => {
  /**
   * 이 구획은 승인된 프로젝트에서만 렌더된다(`pages/admin/funding/projects/[id].tsx`).
   * 그래서 payout이 null인 유일한 경우는 집계 질의가 실패한 것이다 — 승인 여부를 이유로
   * 대면 운영자는 멀쩡한 프로젝트를 의심하게 된다.
   */
  it('실패 사실만 적는다 — 승인 상태를 이유로 대지 않는다', () => {
    renderSection(null);
    expect(screen.getByText(/정산 현황을 불러오지 못했습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/승인된 프로젝트에서만/)).not.toBeInTheDocument();
  });
});
