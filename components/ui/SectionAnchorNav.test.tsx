import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { SectionAnchorNav } from './SectionAnchorNav';

beforeAll(() => {
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView = jest.fn();
});

/** 앵커 메뉴를 누르면 위치만 바뀌고 포커스는 메뉴에 남았다 — 대상 섹션으로 옮긴다(2026-10-22 리뷰). */
describe('SectionAnchorNav 포커스', () => {
  it('누르면 대상 섹션으로 포커스가 간다', () => {
    render(
      <>
        <SectionAnchorNav ariaLabel="섹션" items={[{ id: 'price', label: '가격' }, { id: 'faq', label: '자주 묻는 질문' }]} />
        <section id="price"><h2>가격</h2></section>
        <section id="faq"><h2>FAQ</h2></section>
      </>,
    );
    fireEvent.click(screen.getByRole('link', { name: '자주 묻는 질문' }));
    const faq = document.getElementById('faq')!;
    expect(faq).toHaveFocus();
    expect(faq).toHaveAttribute('tabindex', '-1');
  });
});
