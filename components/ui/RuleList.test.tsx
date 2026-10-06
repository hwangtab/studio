import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RuleList from './RuleList';

const items = [
  { heading: '전문 엔지니어가 처음부터 끝까지 직접', body: 'Neumann U87Ai 등 하이엔드 장비로 1:1 디렉팅.' },
  { heading: '세션 전에 확정되는 투명한 가격', body: '숨은 비용 없이 카카오톡으로 무료 견적.' },
  { heading: '녹음·연습실·발매까지 한 곳에서', body: '연신내역 도보 5분.' },
];

describe('RuleList — 괘선 목록', () => {
  it('번호는 장식이라 숨기고, 제목·본문을 괘선 위에 그린다', () => {
    const { container } = render(<RuleList numbered columns={3} items={items} />);
    expect(container.querySelector('ol')).not.toBeNull();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    const numbers = container.querySelectorAll('[aria-hidden="true"]');
    expect(numbers).toHaveLength(3);
    expect(numbers[0].textContent).toBe('01');
    expect(screen.getByText('연신내역 도보 5분.')).toBeInTheDocument();
    for (const li of container.querySelectorAll('li')) expect(li.className).toMatch(/border-t-2/);
  });

  it('labelPrefix로 Q1·Q2 라벨을 붙이고, 순서가 정보가 아니면 ul로 둔다', () => {
    const { container } = render(<RuleList numbered labelPrefix="Q" as="ul" items={items} />);
    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('Q1');
  });

  it('카드도 모션도 아니다 — 그림자·hover 스케일·글래스 클래스가 없다', () => {
    const { container } = render(<RuleList numbered items={items} />);
    expect(container.innerHTML).not.toMatch(/shadow-|hover:scale|glass-card|hover:-translate/);
  });

  it('빈 목록은 아무것도 그리지 않는다', () => {
    const { container } = render(<RuleList items={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
