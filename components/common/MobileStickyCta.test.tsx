import { act, fireEvent, render, screen } from '@testing-library/react';

import MobileStickyCta from './MobileStickyCta';

type IoCallback = (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;

describe('MobileStickyCta', () => {
  let trigger: IoCallback = () => {};
  beforeEach(() => {
    class FakeIO {
      constructor(cb: IoCallback) {
        trigger = cb;
      }
      observe() {}
      disconnect() {}
    }
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO;
    document.body.innerHTML = '<div id="book"></div>';
  });

  it('하단 고정(z-50)·lg:hidden이고 링크로 간다', () => {
    const { container } = render(<MobileStickyCta href="#book" label="예매하기" />);
    const bar = container.querySelector('div.fixed') as HTMLElement;
    expect(bar.className).toContain('z-50');
    expect(bar.className).toContain('lg:hidden');
    expect(screen.getByRole('link', { name: '예매하기' }).getAttribute('href')).toBe('#book');
  });

  it('visible=false면 아무것도 그리지 않는다', () => {
    const { container } = render(<MobileStickyCta href="#book" label="예매하기" visible={false} />);
    expect(container.querySelector('div.fixed')).toBeNull();
  });

  it('hideWhenInView 대상이 보이면 숨고, 사라지면 다시 보인다', () => {
    const { container } = render(<MobileStickyCta href="#book" label="예매하기" hideWhenInView={['#book']} />);
    const target = document.getElementById('book') as Element;
    expect(container.querySelector('div.fixed')).not.toBeNull();
    act(() => trigger([{ target, isIntersecting: true }]));
    expect(container.querySelector('div.fixed')).toBeNull();
    act(() => trigger([{ target, isIntersecting: false }]));
    expect(container.querySelector('div.fixed')).not.toBeNull();
  });

  it('onOpen이 있으면 클릭을 가로채되, 새 탭 열기(⌘ 클릭)는 그대로 둔다', () => {
    const onOpen = jest.fn();
    render(<MobileStickyCta href="/pledge" label="펀딩하기" onOpen={onOpen} />);
    const link = screen.getByRole('link', { name: '펀딩하기' });
    fireEvent.click(link, { metaKey: true });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
