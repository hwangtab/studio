import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import BankDepositGuide from './BankDepositGuide';

/** 결제 공용 안내 — 주문 종류마다 금액·기한·이름·호칭을 props로 받는다. */
describe('BankDepositGuide (결제 공용)', () => {
  it('기본 호칭은 "신청하신 분"', () => {
    render(<BankDepositGuide amount={12000} deadline="2026-10-07T06:00:00.000Z" customerName="홍길동" />);
    expect(screen.getByText('입금하실 때 보내는 분 이름은 신청하신 분 성함으로 해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('12,000원')).toBeInTheDocument();
    expect(screen.getByText(/홍길동님 성함과 금액으로/)).toBeInTheDocument();
  });
  it('예약·예매처럼 다른 호칭을 넘길 수 있다', () => {
    render(<BankDepositGuide amount={50000} deadline="2026-10-07T06:00:00.000Z" customerName="김예약" applicantLabel="예약하신 분" />);
    expect(screen.getByText('입금하실 때 보내는 분 이름은 예약하신 분 성함으로 해 주세요.')).toBeInTheDocument();
  });
});

it('계좌번호는 줄바꿈하지 않는다 — break-all 없이 nowrap, 좁은 폭에서는 글자를 줄인다', () => {
  const { container } = render(<BankDepositGuide amount={1} deadline="2026-10-07T06:00:00.000Z" customerName="a" />);
  const el = container.querySelector('[data-account-number]')!;
  expect(el.textContent).toBe('3333-12-5480849');
  expect(el.className).toContain('whitespace-nowrap');
  expect(el.className).not.toContain('break-all');
  expect(el.className).toMatch(/text-\[clamp\(/);
});
