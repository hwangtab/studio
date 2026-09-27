import { render, screen } from '@testing-library/react';
import BackerWall from './BackerWall';

it('이름 뒤에 익명 후원 수만큼 "익명"을 잇는다', () => {
  render(<BackerWall names={['김후원', '연대하는 청취자']} anonymousCount={2} messages={[]} />);
  expect(screen.getByText('김후원 · 연대하는 청취자 · 익명 · 익명')).toBeInTheDocument();
});

it('공개 이름이 없어도 익명 후원이 있으면 명단을 그린다', () => {
  render(<BackerWall names={[]} anonymousCount={3} messages={[]} />);
  expect(screen.getByText('익명 · 익명 · 익명')).toBeInTheDocument();
});

it('익명이 많으면 100개까지만 잇고 나머지는 접는다', () => {
  const { container } = render(<BackerWall names={['김후원']} anonymousCount={130} messages={[]} />);
  const text = container.querySelector('p')!.textContent!;
  expect(text.match(/익명/g)!.length).toBe(101);
  expect(text.endsWith(' 외 익명 30명')).toBe(true);
});

it('아무도 없으면 그리지 않는다', () => {
  const { container } = render(<BackerWall names={[]} anonymousCount={0} messages={[]} />);
  expect(container).toBeEmptyDOMElement();
});
