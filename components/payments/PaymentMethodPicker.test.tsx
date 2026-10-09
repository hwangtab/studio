import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import PaymentMethodPicker from './PaymentMethodPicker';

describe('PaymentMethodPicker', () => {
  it('fieldset/legend 라디오 그룹이고 고른 줄만 checked다', () => {
    const onChange = jest.fn();
    render(<PaymentMethodPicker name="t" value="kakaopay" onChange={onChange} applePaySupported={false} />);
    const group = screen.getByRole('group', { name: '결제수단' });
    expect(within(group).getByRole('radio', { name: '카카오페이' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: '신용·체크카드' })).not.toBeChecked();
    fireEvent.click(within(group).getByRole('radio', { name: '네이버페이' }));
    expect(onChange).toHaveBeenCalledWith('naverpay');
    expect(screen.getByText('카카오페이 결제창으로 바로 이동해요. 결제가 끝나면 바로 확정돼요.')).toBeInTheDocument();
  });

  it('애플페이는 지원 환경에서만 줄이 생긴다', () => {
    const { rerender } = render(<PaymentMethodPicker name="t" value="card" onChange={() => {}} applePaySupported={false} />);
    expect(screen.queryByRole('radio', { name: '애플페이' })).toBeNull();
    rerender(<PaymentMethodPicker name="t" value="card" onChange={() => {}} applePaySupported />);
    expect(screen.getByRole('radio', { name: '애플페이' })).toBeInTheDocument();
    expect(screen.getByAltText('애플페이')).toBeInTheDocument();
  });

  it('계좌 줄 오른쪽 보조 문구, 막히면 비활성 + 이유', () => {
    const { rerender } = render(<PaymentMethodPicker name="t" value="card" onChange={() => {}} applePaySupported={false} confirmLabel="티켓이 발권" />);
    expect(screen.getByText('카카오뱅크')).toBeInTheDocument();
    expect(screen.getByText('· 입금 확인 후 티켓이 발권')).toBeInTheDocument();
    rerender(<PaymentMethodPicker name="t" value="card" onChange={() => {}} applePaySupported={false} bankBlockedMessage="2시간 안이라 안 됩니다." />);
    expect(screen.getByRole('radio', { name: '계좌로 직접 입금' })).toBeDisabled();
    expect(screen.getByText(/계좌 입금: 2시간 안이라 안 됩니다\./)).toBeInTheDocument();
  });
});
