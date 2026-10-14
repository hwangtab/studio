import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import BankDepositFallback from './BankDepositFallback';
import { bankFallbackHref, wantsBankFallback } from '../../lib/payments/bankFallback';

describe('BankDepositFallback', () => {
  it('비활성: 링크 한 줄이고 누르면 onEnter', () => {
    const onEnter = jest.fn();
    render(<BankDepositFallback active={false} onEnter={onEnter} onLeave={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '계좌번호로 직접 보내기' }));
    expect(onEnter).toHaveBeenCalled();
  });

  it('막히면 링크 대신 이유만 보인다', () => {
    render(<BankDepositFallback active={false} blockedMessage="2시간 안이라 안 됩니다." onEnter={() => {}} onLeave={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/2시간 안이라 안 됩니다/)).toBeInTheDocument();
  });

  it('활성: 안내와 토스로 돌아가는 버튼', () => {
    const onLeave = jest.fn();
    render(<BankDepositFallback active confirmLabel="예약이 확정" onEnter={() => {}} onLeave={onLeave} />);
    expect(screen.getByText(/입금을 확인하면 예약이 확정되고/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /돌아가기/ }));
    expect(onLeave).toHaveBeenCalled();
  });
});

describe('bankFallback 주소 규칙', () => {
  it('쿼리가 없으면 ?로, 있으면 &로 잇는다', () => {
    expect(bankFallbackHref('/ko/booking/recording')).toBe('/ko/booking/recording?bank=1');
    expect(bankFallbackHref('/ko/pay/x?a=1')).toBe('/ko/pay/x?a=1&bank=1');
  });
  it('bank=1만 폴백으로 읽는다', () => {
    expect(wantsBankFallback('?bank=1')).toBe(true);
    expect(wantsBankFallback('?x=1&bank=1')).toBe(true);
    expect(wantsBankFallback('?bank=0')).toBe(false);
    expect(wantsBankFallback('')).toBe(false);
  });
});
