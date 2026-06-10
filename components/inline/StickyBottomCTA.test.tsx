import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import StickyBottomCTA from './StickyBottomCTA';
import '@testing-library/jest-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') {
        return fallback;
      }
      return fallback?.defaultValue ?? _key;
    },
  }),
}));

// IntersectionObserver mock
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observed: Element[] = [];
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = cb;
    this.options = options;
  }
  observe(target: Element) { this.observed.push(target); }
  unobserve() {}
  disconnect() {}
  trigger(entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

let mockObserverInstance: MockIntersectionObserver | null = null;
beforeAll(() => {
  // @ts-expect-error IntersectionObserver 전역 mock
  global.IntersectionObserver = function(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
    mockObserverInstance = new MockIntersectionObserver(cb, opts);
    return mockObserverInstance;
  };
});

beforeEach(() => {
  localStorage.clear();
  mockObserverInstance = null;
});

const TestHarness = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={ref} data-testid="marker" />
      <StickyBottomCTA markerRef={ref} locale="ko" />
    </>
  );
};

describe('StickyBottomCTA', () => {
  it('marker가 viewport 안에 있으면 hidden', () => {
    render(<TestHarness />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('marker가 viewport 위로 올라가면 visible', () => {
    render(<TestHarness />);
    act(() => {
      mockObserverInstance!.trigger([{
        isIntersecting: false,
        boundingClientRect: { top: -100 } as DOMRectReadOnly,
      }]);
    });
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('marker가 viewport 아래에 있으면 hidden', () => {
    render(<TestHarness />);
    act(() => {
      mockObserverInstance!.trigger([{
        isIntersecting: false,
        boundingClientRect: { top: 1000 } as DOMRectReadOnly,
      }]);
    });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('dismiss 클릭 시 hidden + localStorage 기록', () => {
    render(<TestHarness />);
    act(() => {
      mockObserverInstance!.trigger([{
        isIntersecting: false,
        boundingClientRect: { top: -100 } as DOMRectReadOnly,
      }]);
    });
    const dismissButton = screen.getByRole('button', { name: /닫기/ });
    fireEvent.click(dismissButton);
    expect(screen.queryByRole('region')).toBeNull();
    const stored = localStorage.getItem('sticky-cta-dismissed-until');
    expect(stored).not.toBeNull();
    expect(parseInt(stored!, 10)).toBeGreaterThan(Date.now());
  });

  it('localStorage TTL 만료 안 되었으면 mount 시 hidden 유지', () => {
    localStorage.setItem('sticky-cta-dismissed-until', String(Date.now() + 60_000));
    render(<TestHarness />);
    act(() => {
      mockObserverInstance?.trigger([{
        isIntersecting: false,
        boundingClientRect: { top: -100 } as DOMRectReadOnly,
      }]);
    });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('localStorage TTL 만료된 경우 정상 노출', () => {
    localStorage.setItem('sticky-cta-dismissed-until', String(Date.now() - 60_000));
    render(<TestHarness />);
    act(() => {
      mockObserverInstance!.trigger([{
        isIntersecting: false,
        boundingClientRect: { top: -100 } as DOMRectReadOnly,
      }]);
    });
    expect(screen.getByRole('region')).toBeInTheDocument();
  });
});
