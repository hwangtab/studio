import { generateTicketCode, generateShowOrderNo, SHOW_ORDER_NO_PATTERN } from './shape';

test('generateTicketCode는 SNT1: 접두 + 16자 base32', () => {
  const code = generateTicketCode();
  expect(code).toMatch(/^SNT1:[A-Z2-7]{16}$/);
});

test('generateTicketCode는 매번 다른 값', () => {
  expect(generateTicketCode()).not.toBe(generateTicketCode());
});

describe('generateShowOrderNo', () => {
  const now = new Date('2026-09-30T00:00:00Z');
  it('일반 주문은 TKT-YYYYMMDD-XXXXXXXX', () => {
    const orderNo = generateShowOrderNo(now, false);
    expect(orderNo).toMatch(/^TKT-\d{8}-[0-9A-F]{8}$/);
    expect(SHOW_ORDER_NO_PATTERN.test(orderNo)).toBe(true);
  });
  it('초대권은 TKT-C-YYYYMMDD-XXXXXXXX', () => {
    const orderNo = generateShowOrderNo(now, true);
    expect(orderNo).toMatch(/^TKT-C-\d{8}-[0-9A-F]{8}$/);
    expect(SHOW_ORDER_NO_PATTERN.test(orderNo)).toBe(true);
  });
});
