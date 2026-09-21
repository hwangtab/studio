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

const msg = (name: string, message: string) => ({ name, message, at: 1758000000 });
const TWO = [msg('김정곤', '첫 번째 응원'), msg('솔지', '두 번째 응원')];

beforeEach(() => {
  mockReducedMotion(false);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('메시지가 없으면 아무것도 그리지 않는다', () => {
  // 히어로 바로 아래 자리라, 빈 상자를 그리면 "아직 아무도 후원하지 않았다"가 첫 화면에
  // 박힌다. 오픈 직후 프로젝트에 가장 해로운 표시다.
  const { container } = render(<SupporterTicker messages={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it('메시지가 하나뿐이면 순환 장치를 두지 않는다', () => {
  // 넘길 곳이 없는데 일시정지 버튼이 있으면 누를 것이 없는 버튼이 된다.
  render(<SupporterTicker messages={[msg('김정곤', '침략전쟁 반대한다!')]} />);
  expect(screen.getByText('침략전쟁 반대한다!')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('메시지가 둘 이상이면 시간이 지나 다음 메시지로 넘어간다', () => {
  render(<SupporterTicker messages={TWO} />);
  expect(screen.getByText('첫 번째 응원')).toBeInTheDocument();

  act(() => {
    jest.advanceTimersByTime(5500);
  });

  expect(screen.getByText('두 번째 응원')).toBeInTheDocument();
  expect(screen.queryByText('첫 번째 응원')).not.toBeInTheDocument();
});

it('일시정지하면 시간이 지나도 넘어가지 않는다', () => {
  // WCAG 2.2.2 — 5초를 넘겨 자동으로 움직이는 콘텐츠에는 멈출 수단이 있어야 한다.
  render(<SupporterTicker messages={TWO} />);

  fireEvent.click(screen.getByRole('button', { name: /일시정지/ }));
  act(() => {
    jest.advanceTimersByTime(5500 * 3);
  });

  expect(screen.getByText('첫 번째 응원')).toBeInTheDocument();
});

it('마우스를 올리면 읽는 동안 넘어가지 않는다', () => {
  render(<SupporterTicker messages={TWO} />);

  fireEvent.mouseEnter(screen.getByRole('region', { name: '응원 메시지' }));
  act(() => {
    jest.advanceTimersByTime(5500 * 3);
  });

  expect(screen.getByText('첫 번째 응원')).toBeInTheDocument();
});

it('prefers-reduced-motion이면 자동으로 넘어가지 않는다', () => {
  mockReducedMotion(true);
  render(<SupporterTicker messages={TWO} />);

  act(() => {
    jest.advanceTimersByTime(5500 * 3);
  });

  expect(screen.getByText('첫 번째 응원')).toBeInTheDocument();
});

it('자동 순환 중에는 스크린리더에 읽어 주지 않고, 멈추면 읽어 준다', () => {
  // 5.5초마다 읽어 주면 화면을 보지 않는 사람에게는 페이지가 계속 끊긴다. 멈춘 뒤 바뀌는
  // 것은 사용자가 스스로 넘긴 결과이므로 그때는 읽어 준다.
  render(<SupporterTicker messages={TWO} />);
  const region = screen.getByRole('region', { name: '응원 메시지' });
  expect(region).toHaveAttribute('aria-live', 'off');

  fireEvent.click(screen.getByRole('button', { name: /일시정지/ }));

  expect(region).toHaveAttribute('aria-live', 'polite');
});
