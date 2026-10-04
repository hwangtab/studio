import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn().mockResolvedValue(true), asPath: '/admin/shows/s1', pathname: '/admin/shows/[id]' }) }));
jest.mock('../../../../components/admin/showActions', () => ({ postShowAction: jest.fn() }));
// admin-auth·db는 서버 전용(ESM 의존) — getServerSideProps는 이 테스트 대상이 아니다.
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../../lib/shows/adminQueries', () => ({ loadAdminShowDetail: jest.fn() }));
jest.mock('../../../../lib/payments/bankDepositOrders', () => ({ findSameNameDepositOrders: jest.fn() }));
jest.mock('../../../../lib/payments/refundAccount', () => ({ holderMatchesCustomer: jest.fn(), loadRefundAccountSummary: jest.fn() }));

import AdminShowDetailPage from '../../../../pages/admin/shows/[id]';
import { postShowAction } from '../../../../components/admin/showActions';
import type { AdminOrderRow, AdminShowDetail } from '../../../../lib/shows/adminQueries';

const ACCOUNT_NUMBER = '110-123-456789';

const order = (over: Partial<AdminOrderRow>): AdminOrderRow => ({
  orderId: 'o1', orderNo: 'TKT-1', bankDeposit: null, depositDeadline: null, customerName: '김관객', isComp: false,
  orderStatus: 'paid', buyerName: '김관객', buyerContact: '010-1111-2222', totalAmount: 30000, createdAt: 1790000000, tickets: [], ...over,
});

const ticket = { id: 't1', code: 'c', entryNumber: '001', status: 'issued', issuedBy: 'online', ticketTypeName: '일반', unitAmount: 30000, checkedInAt: null, checkedInBy: null };

const show = (orders: AdminOrderRow[]): AdminShowDetail => ({
  id: 's1', slug: 'demo', title: '데모 공연', status: 'published', venueName: '홀',
  zones: [{ id: 'z', code: 'A', label: '전석', capacity: 100 }],
  ticketTypes: [{ id: 'tt', name: '일반', price: 30000, quota: null, compQuota: 5, zoneCode: 'A' }],
  showtimes: [{
    id: 'st1', startsAt: 1790100000, label: '10/10 19:00', status: 'scheduled', salesCloseAt: 1790090000, capacity: 100, issued: 1, held: 1,
    awaitingDeposit: 1, comp: 0, checkedIn: 0, grossAmount: 30000, refundDueAmount: 0, orders, scanLinks: [],
  }],
});

beforeEach(() => {
  (postShowAction as jest.Mock).mockReset().mockResolvedValue({ ok: true, data: {} });
  window.confirm = jest.fn().mockReturnValue(true);
});

it('입금 대기 주문: 뱃지·기한·세 버튼과 확인 문구, 동명 경고', async () => {
  const o = order({ bankDeposit: 'awaiting', orderStatus: 'awaiting_deposit', depositDeadline: '2026-10-07T06:00:00.000Z' });
  render(<AdminShowDetailPage show={show([o])} sameNameDeposits={{ 'TKT-1': [{ id: 'x', orderNo: 'TKT-2', type: 'ticket', status: 'awaiting_deposit', totalAmount: 30000, createdAt: '2026-10-04T00:00:00.000Z' }] }} />);
  expect(screen.getAllByText('계좌 입금 대기').length).toBeGreaterThan(0);
  expect(screen.getByText(/안내 기한/)).toBeInTheDocument();
  expect(screen.getByText(/같은 이름의 다른 계좌 입금 신청이 1건/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '미입금 취소' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '입금 안내 재발송' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '입금 확인' }));
  const text = (window.confirm as jest.Mock).mock.calls[0][0] as string;
  expect(text.split('\n')[0]).toBe('통장에 실제로 입금됐는지 먼저 확인하세요.');
  expect(text).toContain('김관객');
  expect(text).toContain('30,000원');
  expect(text).toContain('QR');
  await waitFor(() => expect(postShowAction).toHaveBeenCalledWith('s1', { action: 'confirm_deposit', orderNo: 'TKT-1' }));

  fireEvent.click(screen.getByRole('button', { name: '미입금 취소' }));
  expect((window.confirm as jest.Mock).mock.calls[1][0]).toContain('좌석이 풀리고 메일은 가지 않습니다');
  await waitFor(() => expect(postShowAction).toHaveBeenCalledWith('s1', { action: 'cancel_unpaid_deposit', orderNo: 'TKT-1' }));
});

it('"입금 대기만 보기"는 다른 주문을 숨긴다', () => {
  const a = order({ bankDeposit: 'awaiting', orderStatus: 'awaiting_deposit', orderNo: 'TKT-A', depositDeadline: '2026-10-07T06:00:00.000Z' });
  const b = order({ orderNo: 'TKT-B', orderId: 'o2' });
  render(<AdminShowDetailPage show={show([a, b])} />);
  expect(screen.getByText('TKT-B')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('입금 대기만 보기'));
  expect(screen.queryByText('TKT-B')).not.toBeInTheDocument();
  expect(screen.getByText('TKT-A')).toBeInTheDocument();
});

it('계좌 입금 확정 주문: 계좌 입금 라벨·환불 계좌 요약, 계좌번호는 HTML에 없고 "계좌 보기"로만 나온다', async () => {
  const o = order({ bankDeposit: 'paid', tickets: [ticket] });
  const { container } = render(
    <AdminShowDetailPage show={show([o])} refundAccounts={{ 'TKT-1': { status: 'present', bankName: '국민', accountHolder: '박가족', holderMismatch: true, updatedAt: 1790000000, refundedAt: null } }} />,
  );
  expect(screen.getByText('계좌 입금')).toBeInTheDocument();
  expect(screen.getByText(/예금주 박가족/)).toBeInTheDocument();
  expect(screen.getByText(/예금주가 구매자 이름\(김관객\)과 다릅니다/)).toBeInTheDocument();
  expect(container.innerHTML).not.toContain(ACCOUNT_NUMBER);

  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, account: { bankName: '국민', accountNumber: ACCOUNT_NUMBER, accountHolder: '박가족' }, holderMismatch: true }) }) as unknown as typeof fetch;
  fireEvent.click(screen.getByRole('button', { name: '계좌 보기' }));
  await screen.findByText(ACCOUNT_NUMBER);
  expect(global.fetch).toHaveBeenCalledWith('/api/admin/orders/o1/refund-account', expect.anything());

  fireEvent.click(screen.getByRole('button', { name: '송금 완료' }));
  await waitFor(() => expect(postShowAction).toHaveBeenCalledWith('s1', { action: 'mark_refund_sent', orderNo: 'TKT-1' }));

  fireEvent.click(screen.getByRole('button', { name: '입장 전 티켓 환불' }));
  expect((window.confirm as jest.Mock).mock.calls.pop()[0]).toContain('계좌 입금 건입니다 — 토스로 돌려주지 않습니다. 고객 계좌로 송금을 마친 뒤 기록하세요');
});

it('송금 완료가 기록된 주문은 시각을 보이고 버튼이 없다', () => {
  render(<AdminShowDetailPage show={show([order({ bankDeposit: 'paid' })])} refundAccounts={{ 'TKT-1': { status: 'present', bankName: '국민', accountHolder: '김관객', holderMismatch: false, updatedAt: 1790000000, refundedAt: 1790001000 } }} />);
  expect(screen.queryByRole('button', { name: '송금 완료' })).not.toBeInTheDocument();
  expect(screen.getByText(/송금 완료 \d/)).toBeInTheDocument();
});
