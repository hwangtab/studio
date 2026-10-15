/** @jest-environment node */
import { renderToStaticMarkup } from 'react-dom/server';
jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: { children: unknown }) => <>{children}</> }));
/* eslint-disable import/first */
import ShopManagePage from '../../../pages/[locale]/shop/manage/[orderNo]';
/* eslint-enable import/first */
const base = { orderNo: 'SHP-1', token: 't', lines: [{ label: '앨범', quantity: 1, amount: 20000, serials: null }], shipsOn: null, shippingFee: 3000, totalAmount: 23000, recipient: 'a · b', address: '(03000) 서울', courier: null, trackingNumber: null, ships: true, downloads: [], downloadedAt: null, partiallyRefunded: false, customerName: '김구매' };
it('입금 대기 화면', () => {
  const html = renderToStaticMarkup(<ShopManagePage {...base} state="awaiting_deposit" depositDeadline="2026-10-18T00:00:00Z" bankPaid={false} />);
  expect(html).toContain('3333-12-5480849'); expect(html).toContain('입금 전 신청 취소하기'); expect(html).toContain('입금 대기');
});
it('입금 확정 주문의 취소 확인 화면에는 환불 계좌 입력이 있다 — 취소 버튼은 그대로', () => {
  const html = renderToStaticMarkup(<ShopManagePage {...base} state="preparing" depositDeadline={null} bankPaid />);
  expect(html).toContain('주문 취소하기');
});
