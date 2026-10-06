import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import WaveRule from './WaveRule';

describe('WaveRule', () => {
  it('장식이라 접근성 트리에서 숨기고, 한 path로 그린다', () => {
    const { container } = render(<WaveRule />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('path')).toHaveLength(1);
    // 움직이지 않는다 — 애니메이션 클래스·요소 없음.
    expect(container.innerHTML).not.toMatch(/animate|<animate/);
  });
});
