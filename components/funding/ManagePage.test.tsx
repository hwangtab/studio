import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
jest.mock('../../lib/getStatic', () => ({ withI18nServerProps: jest.fn() }));
jest.mock('../../lib/funding/service', () => ({ expireStalePledges: jest.fn(), findFundingOrderByOrderNo: jest.fn() }));
jest.mock('../../lib/funding/repository', () => ({ getFundingProjectOrFailure: jest.fn() }));
jest.mock('./SupporterListingEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="listing-editor" />,
}));

// eslint-disable-next-line import/first
import FundingManagePage from '../../pages/[locale]/funding/manage/[orderNo]';

const baseProps = {
  orderNo: 'FD-1', token: 't', projectSlug: 'p', projectTitle: '프로젝트',
  rewardLabel: '『CD』 × 1', additionalAmount: 0, totalAmount: 30000, status: 'paid',
  paymentMethod: 'card', fulfillmentStatus: 'none', shipping: null,
  canCancel: true, cancelBlockedReason: null, refundRequested: false, lookupFailed: false,
  downloads: [{ label: '음원', key: 'k1' }],
  displayNamePublic: true, canEditDisplayName: true,
  customerName: '가나', publicName: null, supporterMessage: null,
  listingHidden: false, messageShownAnonymously: false,
};

describe('manage 화면 — 셀프 취소 직후', () => {
  it('취소 전에는 내려받기와 명단 편집이 보인다', () => {
    render(<FundingManagePage {...baseProps} />);
    expect(screen.getByRole('button', { name: /음원 내려받기/ })).toBeInTheDocument();
    expect(screen.getByTestId('listing-editor')).toBeInTheDocument();
  });

  it('취소가 성공하면 내려받기와 명단 편집이 사라진다', async () => {
    window.confirm = jest.fn(() => true);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ mode: 'refunded', refundAmount: 30000 }),
    }) as unknown as typeof fetch;
    render(<FundingManagePage {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: /펀딩 취소/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('취소되었습니다'));
    expect(screen.queryByRole('button', { name: /내려받기/ })).toBeNull();
    expect(screen.queryByTestId('listing-editor')).toBeNull();
  });
});
