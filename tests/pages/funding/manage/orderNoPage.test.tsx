import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import FundingManagePage from '../../../../pages/[locale]/funding/manage/[orderNo]';

const baseProps = {
  orderNo: 'FND-1', token: 'tok', projectSlug: 'demo', projectTitle: '데모', rewardTitle: '감사 메일',
  quantity: 1, additionalAmount: 0, totalAmount: 30000, status: 'paid', fulfillmentStatus: 'none', shipping: null,
  canCancel: true, cancelBlockedReason: null, refundRequested: false, depositUrl: null,
};

beforeEach(() => {
  window.confirm = jest.fn().mockReturnValue(true);
});

it('토스 결제 취소 성공 → 환불 금액 확인 문구', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, headers: { get: () => 'application/json' },
    json: async () => ({ ok: true, mode: 'refunded', refundAmount: 30000 }),
  }) as never;
  render(<FundingManagePage {...baseProps} paymentMethod="toss" />);
  await userEvent.click(screen.getByRole('button', { name: /후원 취소/ }));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('환불받을까요'));
  expect(await screen.findByText('취소되었습니다. 30,000원이 환불됩니다.')).toBeInTheDocument();
});

it('무통장 취소 요청 → 계좌 회신 안내 문구, confirm 문구도 무통장 전용', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, headers: { get: () => 'application/json' },
    json: async () => ({ ok: true, mode: 'refund_requested' }),
  }) as never;
  render(<FundingManagePage {...baseProps} paymentMethod="bank_transfer" />);
  await userEvent.click(screen.getByRole('button', { name: /후원 취소/ }));
  expect(window.confirm).toHaveBeenCalledWith('취소를 요청할까요? 환불은 운영자가 계좌로 진행합니다.');
  expect(await screen.findByText('취소 요청을 접수했습니다. 환불 계좌를 메일로 회신해 주세요.')).toBeInTheDocument();
});

it('비JSON 응답이면 서버 오류 문구', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, headers: { get: () => 'text/html' },
    json: async () => { throw new Error('should not be called'); },
  }) as never;
  render(<FundingManagePage {...baseProps} paymentMethod="toss" />);
  await userEvent.click(screen.getByRole('button', { name: /후원 취소/ }));
  expect(await screen.findByText('서버 오류가 발생했습니다.')).toBeInTheDocument();
});

// 이 페이지의 URL에는 관리 토큰이 실린다. 이탈 링크가 클라 전환이면 공개 페이지에 나갔다
// 뒤로가기 할 때 gtag가 토큰 붙은 URL로 page_view를 보낸다 — 링크 종류(next/link 아님)는
// tests/pages/privateLinkNavigation.test.ts가 소스로 단언하고, 여기서는 href를 확인한다.
it('프로젝트·무통장 안내 링크는 href를 가진 앵커다', () => {
  render(<FundingManagePage {...baseProps} status="pending" paymentMethod="bank_transfer" depositUrl="/ko/funding/deposit/FND-1?token=tok" />);
  expect(screen.getByRole('link', { name: '데모' })).toHaveAttribute('href', '/ko/funding/demo');
  expect(screen.getByRole('link', { name: /무통장입금 안내/ })).toHaveAttribute('href', '/ko/funding/deposit/FND-1?token=tok');
});

// 부분환불 건은 상태 코드가 그대로 노출돼 고객이 'partially_refunded'를 읽고 있었다.
it('partially_refunded 상태는 한국어 라벨로 보인다', () => {
  render(<FundingManagePage {...baseProps} status="partially_refunded" canCancel={false} paymentMethod="toss" />);
  expect(screen.getByText('일부 환불')).toBeInTheDocument();
});
