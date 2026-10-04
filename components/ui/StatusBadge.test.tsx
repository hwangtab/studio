import { render, screen } from '@testing-library/react';

import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('톤마다 다크 짝이 있고 알약 모양이다', () => {
    const { rerender } = render(<StatusBadge tone="active">예매 중</StatusBadge>);
    let el = screen.getByText('예매 중');
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('dark:text-primary-lighter');
    rerender(<StatusBadge tone="warning">취소됨</StatusBadge>);
    el = screen.getByText('취소됨');
    expect(el.className).toContain('dark:bg-amber-900/40');
    rerender(<StatusBadge>종료</StatusBadge>);
    expect(screen.getByText('종료').className).toContain('dark:text-gray-300');
  });
});
