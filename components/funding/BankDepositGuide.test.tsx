import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import BankDepositGuide from './BankDepositGuide';

const PROPS = { orderNo: 'FND-1', customerName: '김후원', totalAmount: 5000, holdExpiresAt: new Date().toISOString() };

it('paid → 확정 문구', () => {
  render(<BankDepositGuide {...PROPS} status="paid" />);
  expect(screen.getByText('입금이 확인되어 후원이 확정되었습니다.')).toBeInTheDocument();
});
it('pending → 입금 안내', () => {
  render(<BankDepositGuide {...PROPS} status="pending" />);
  expect(screen.getByText('입금 계좌')).toBeInTheDocument();
});
it('expired → 취소 문구', () => {
  render(<BankDepositGuide {...PROPS} status="expired" />);
  expect(screen.getByText('입금 기한이 지나 후원이 취소되었습니다. 다시 후원해 주세요.')).toBeInTheDocument();
});
it('refunded → 환불 문구', () => {
  render(<BankDepositGuide {...PROPS} status="refunded" />);
  expect(screen.getByText('환불 처리된 후원입니다.')).toBeInTheDocument();
});
it('그 외 상태 → 문의 문구', () => {
  render(<BankDepositGuide {...PROPS} status="failed" />);
  expect(screen.getByText('처리할 수 없는 상태입니다. 문의해 주세요.')).toBeInTheDocument();
});
