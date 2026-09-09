import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('../../../../components/admin/fundingActions', () => ({ patchPledge: jest.fn() }));
// admin-auth는 iron-session(ESM)을 끌고 들어온다 — getServerSideProps는 이 테스트 대상이 아니다.
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminFundingDetailPage from '../../../../pages/admin/funding/[id]';
import { patchPledge } from '../../../../components/admin/fundingActions';
import type { AdminPledgeItem } from '../../../../lib/funding/admin-serialize';

const PLEDGE = {
  id: 'order-1', orderNo: 'FND-1', projectSlug: 'demo', status: 'paid', paymentMethod: 'toss',
  entrySource: 'online', customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@b.com',
  rewardTitle: 'CD', quantity: 1, additionalAmount: 0, totalAmount: 30000, fulfillmentStatus: 'shipped',
  trackingCompany: 'CJ', trackingNumber: '123', shipping: null, supporterMessage: null,
  refundRequestedAt: null, paidAt: null, holdExpiresAt: new Date().toISOString(),
  createdAt: new Date().toISOString(), adminMemo: null, notificationError: null,
  hasPayment: true, mismatch: false, duplicateWarning: false,
} as AdminPledgeItem;

// 예전엔 빈 값을 `|| undefined`로 걸러 보내지 않아, 잘못 입력한 운송장을 지울 수 없었다.
it('운송장을 비우고 저장하면 빈 문자열을 그대로 보낸다', () => {
  (patchPledge as jest.Mock).mockResolvedValue({ ok: true });
  render(<AdminFundingDetailPage pledge={PLEDGE} />);
  fireEvent.change(screen.getByDisplayValue('CJ'), { target: { value: '' } });
  fireEvent.change(screen.getByDisplayValue('123'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(patchPledge).toHaveBeenCalledWith('order-1', {
    action: 'set_fulfillment', fulfillmentStatus: 'shipped', trackingCompany: '', trackingNumber: '',
  });
});
