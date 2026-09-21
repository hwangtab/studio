import { act, fireEvent, render, screen } from '@testing-library/react';
import SupporterTicker from './SupporterTicker';

/**
 * jsdom에는 `window.matchMedia`가 없다. 컴포넌트가 prefers-reduced-motion을 직접 물어보므로
 * 테스트마다 대답을 정해 준다.
 */
const mockReducedMotion = (reduced: boolean) => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
};

/**
 * jsdom은 레이아웃을 계산하지 않아 scrollHeight가 언제나 0이다 — "두 줄을 넘겨 잘렸는가"를
 * 실제 DOM 높이로 재는 컴포넌트에게는 늘 "안 잘렸다"로 보인다. 잘린 상태를 흉내 내야
 * '더 보기'가 나오는 경로를 볼 수 있다.
 */
const mockClamped = (clamped: boolean) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get() {
      return clamped ? 200 : 0;
    },
  });
};

const msg = (name: string, message: string) => ({ name, message, at: 1758000000 });
const TWO = [msg('김정곤', '첫 번째 응원'), msg('솔지', '두 번째 응원')];

beforeEach(() => {
  mockReducedMotion(false);
  mockClamped(false);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('메시지가 없으면 아무것도 그리지 않는다', () => {
  // 히어로 아래 자리라, 빈 상자를 그리면 "아직 아무도 후원하지 않았다"가 첫 화면에 박힌다.
  const { container } = render(<SupporterTicker messages={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it('메시지가 하나뿐이면 순환 장치를 두지 않는다', () => {
  render(<SupporterTicker messages={[msg('김정곤', '침략전쟁 반대한다!')]} />);
  expect(screen.getByText(/침략전쟁 반대한다!/)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

// 1.5초는 참고한 구현(saf-2026)의 값이다. 빨리 도는 대신 두 줄에서 자르고, 더 읽고 싶으면
// '더 보기'로 펼치거나 일시정지한다 — 그 셋이 한 벌로 움직이는 설계다. 주기만 늘리면
// 큰 글씨가 한자리에 오래 멈춰 있어 전광판이 아니라 그냥 인용 카드가 된다.
it('메시지가 둘 이상이면 1.5초마다 다음 메시지로 넘어간다', () => {
  render(<SupporterTicker messages={TWO} />);
  expect(screen.getByText(/첫 번째 응원/)).toBeInTheDocument();

  act(() => {
    jest.advanceTimersByTime(1500);
  });

  expect(screen.getByText(/두 번째 응원/)).toBeInTheDocument();
  expect(screen.queryByText(/첫 번째 응원/)).not.toBeInTheDocument();
});

it('일시정지하면 시간이 지나도 넘어가지 않는다', () => {
  // WCAG 2.2.2 — 자동으로 움직이는 콘텐츠에는 멈출 수단이 있어야 한다.
  render(<SupporterTicker messages={TWO} />);

  fireEvent.click(screen.getByRole('button', { name: /일시정지/ }));
  act(() => {
    jest.advanceTimersByTime(1500 * 5);
  });

  expect(screen.getByText(/첫 번째 응원/)).toBeInTheDocument();
});

it('prefers-reduced-motion이면 자동으로 넘어가지 않는다', () => {
  mockReducedMotion(true);
  render(<SupporterTicker messages={TWO} />);

  act(() => {
    jest.advanceTimersByTime(1500 * 5);
  });

  expect(screen.getByText(/첫 번째 응원/)).toBeInTheDocument();
});

it('자동 순환 중에는 스크린리더에 읽어 주지 않고, 멈추면 읽어 준다', () => {
  // 1.5초마다 읽어 주면 화면을 보지 않는 사람에게는 페이지가 계속 끊긴다. 멈춘 뒤 바뀌는
  // 것은 사용자가 스스로 넘긴 결과이므로 그때는 읽어 준다.
  render(<SupporterTicker messages={TWO} />);
  const live = screen.getByRole('region', { name: '응원 메시지' }).querySelector('[aria-live]');
  expect(live).toHaveAttribute('aria-live', 'off');

  fireEvent.click(screen.getByRole('button', { name: /일시정지/ }));

  expect(live).toHaveAttribute('aria-live', 'polite');
});

// 잘리지 않았는데 '더 보기'가 있으면 눌러도 아무 일이 일어나지 않는 버튼이 된다.
it('메시지가 잘리지 않으면 더 보기를 두지 않는다', () => {
  render(<SupporterTicker messages={[msg('김정곤', '짧은 응원')]} />);
  expect(screen.queryByRole('button', { name: /더 보기/ })).not.toBeInTheDocument();
});

it('메시지가 잘리면 더 보기가 나오고, 펼치는 동안 자동 순환이 멈춘다', () => {
  mockClamped(true);
  render(<SupporterTicker messages={TWO} />);

  fireEvent.click(screen.getByRole('button', { name: /더 보기/ }));

  // 읽는 중에 다음 메시지로 넘어가면 펼친 의미가 없다.
  act(() => {
    jest.advanceTimersByTime(1500 * 5);
  });
  expect(screen.getByText(/첫 번째 응원/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /접기/ })).toBeInTheDocument();
});
