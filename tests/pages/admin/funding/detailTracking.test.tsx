import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('../../../../components/admin/fundingActions', () => ({ patchPledge: jest.fn() }));
// admin-auth는 iron-session(ESM)을 끌고 들어온다 — getServerSideProps는 이 테스트 대상이 아니다.
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminFundingDetailPage from '../../../../pages/admin/funding/[id]';
import { patchPledge } from '../../../../components/admin/fundingActions';
import type { AdminPledgeItem } from '../../../../lib/funding/admin-serialize';

// `as AdminPledgeItem` 대신 타입 주석을 쓴다 — 캐스팅은 신규 필수 필드가 빠져도 컴파일을
// 통과시키므로, 직렬화가 새로 내려보내는 값을 테스트가 조용히 놓친다.
const PLEDGE: AdminPledgeItem = {
  id: 'order-1', orderNo: 'FND-1', projectSlug: 'demo', status: 'paid', paymentMethod: 'toss',
  entrySource: 'online', customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@b.com',
  rewardTitle: 'CD', quantity: 1, additionalAmount: 0, totalAmount: 30000, fulfillmentStatus: 'shipped',
  trackingCompany: 'CJ', trackingNumber: '123', shipping: null, supporterMessage: null,
  refundRequestedAt: null, paidAt: null, holdExpiresAt: new Date().toISOString(),
  createdAt: new Date().toISOString(), adminMemo: null, notificationError: null,
  hasPayment: true, mismatch: false, duplicateWarning: false, refundRequested: false,
};

// 예전엔 빈 값을 `|| undefined`로 걸러 보내지 않아, 잘못 입력한 운송장을 지울 수 없었다.
it('운송장을 비우고 저장하면 빈 문자열을 그대로 보낸다', () => {
  (patchPledge as jest.Mock).mockResolvedValue({ ok: true });
  render(<AdminFundingDetailPage pledge={PLEDGE} refundableAmount={30000} />);
  fireEvent.change(screen.getByDisplayValue('CJ'), { target: { value: '' } });
  fireEvent.change(screen.getByDisplayValue('123'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(patchPledge).toHaveBeenCalledWith('order-1', {
    action: 'set_fulfillment', fulfillmentStatus: 'shipped', trackingCompany: '', trackingNumber: '',
  });
});

// 부분환불 건은 환불 버튼 자체가 사라져 남은 금액을 정리할 방법이 없었다.
it('partially_refunded도 환불 버튼이 보이고, confirm에 남은 잔액을 알린다', () => {
  (patchPledge as jest.Mock).mockResolvedValue({ ok: true });
  window.confirm = jest.fn().mockReturnValue(false);
  render(<AdminFundingDetailPage pledge={{ ...PLEDGE, status: 'partially_refunded' }} refundableAmount={18000} />);
  fireEvent.click(screen.getByRole('button', { name: /환불/ }));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('18,000원'));
});

// 상세 화면도 API와 같은 판정을 보여야 한다 — 저장을 눌렀다가 409를 보고서야 아는 건
// 이미 늦다(운영자는 그 사이 송장을 입력했다).
it('환불 요청 건은 발송 저장이 잠기고, 되돌릴 경로를 안내한다', () => {
  render(
    <AdminFundingDetailPage
      pledge={{ ...PLEDGE, refundRequested: true, refundRequestedAt: '2026-10-16T02:00:00Z' }}
      refundableAmount={30000}
    />,
  );
  expect(screen.getByText(/후원자가 취소를 요청했습니다/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '환불 요청 취소' })).toBeInTheDocument();
});

// 사유 없이 지우면 청약철회가 조용히 사라진다 — 화면도 API와 같은 판정이어야 한다.
it('환불 요청 취소는 사유를 받고, 빈 사유면 요청을 보내지 않는다', () => {
  // 이 파일에는 공용 beforeEach가 없다 — 앞선 케이스의 호출이 남아 있으면 오판한다.
  (patchPledge as jest.Mock).mockReset().mockResolvedValue({ ok: true });
  const pledge = { ...PLEDGE, refundRequested: true, refundRequestedAt: '2026-10-16T02:00:00Z' };

  window.prompt = jest.fn().mockReturnValue('  ');
  render(<AdminFundingDetailPage pledge={pledge} refundableAmount={30000} />);
  fireEvent.click(screen.getByRole('button', { name: '환불 요청 취소' }));
  expect(patchPledge).not.toHaveBeenCalled();
  // 확인 문구는 "후원자가 직접 철회 의사를 밝힌 경우"로 좁혀 둔다.
  expect((window.prompt as jest.Mock).mock.calls[0][0]).toContain('후원자가 직접 철회 의사를 밝힌 경우에만');

  window.prompt = jest.fn().mockReturnValue(' 후원자 전화 철회 ');
  fireEvent.click(screen.getByRole('button', { name: '환불 요청 취소' }));
  expect(patchPledge).toHaveBeenCalledWith('order-1', { action: 'clear_refund_request', reason: '후원자 전화 철회' });
});
