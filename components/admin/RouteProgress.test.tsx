/**
 * 전환 표시의 규칙은 두 가지고, 둘 다 어기면 없느니만 못하다.
 *
 * - 빠른 전환에서는 뜨지 않는다. 관리자 화면 안 전환은 실측 55~67ms라, 지연 없이 띄우면
 *   대부분의 클릭에서 막대가 깜빡하고 사라진다.
 * - 느린 전환에서는 뜨고, 끝나면 반드시 걷힌다. 실패(routeChangeError)에도 걷혀야 한다 —
 *   남으면 영원히 로딩 중인 화면이 된다.
 */
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

type Handler = () => void;
const handlers: Record<string, Handler[]> = {};
const events = {
  on: (name: string, fn: Handler) => { (handlers[name] ||= []).push(fn); },
  off: (name: string, fn: Handler) => { handlers[name] = (handlers[name] || []).filter((h) => h !== fn); },
};
const emit = (name: string) => act(() => { (handlers[name] || []).forEach((h) => h()); });

jest.mock('next/router', () => ({ useRouter: () => ({ events }) }));

// eslint-disable-next-line import/first
import RouteProgress from './RouteProgress';

const bar = () => document.querySelector('.bg-primary') as HTMLElement;
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  for (const key of Object.keys(handlers)) delete handlers[key];
});
afterEach(() => {
  jest.useRealTimers();
});

it('지연 안에 끝난 전환에서는 막대가 뜨지 않는다', () => {
  render(<RouteProgress />);

  emit('routeChangeStart');
  advance(60);
  emit('routeChangeComplete');
  advance(1000);

  expect(bar()).toHaveClass('w-0');
  expect(screen.queryByText('페이지를 불러오는 중입니다')).not.toBeInTheDocument();
});

it('오래 걸리는 전환에서는 막대가 뜨고, 끝나면 100%를 찍고 걷힌다', () => {
  render(<RouteProgress />);

  emit('routeChangeStart');
  advance(200);
  expect(bar()).toHaveClass('w-2/3');
  expect(screen.getByText('페이지를 불러오는 중입니다')).toBeInTheDocument();

  emit('routeChangeComplete');
  expect(bar()).toHaveClass('w-full');

  advance(300);
  expect(bar()).toHaveClass('w-0');
  expect(screen.queryByText('페이지를 불러오는 중입니다')).not.toBeInTheDocument();
});

it('전환이 실패해도 막대는 걷힌다', () => {
  render(<RouteProgress />);

  emit('routeChangeStart');
  advance(200);
  expect(bar()).toHaveClass('w-2/3');

  emit('routeChangeError');
  advance(300);
  expect(bar()).toHaveClass('w-0');
});

it('연속 전환에서 이전 전환의 정리 타이머가 새 막대를 지우지 않는다', () => {
  render(<RouteProgress />);

  emit('routeChangeStart');
  advance(200);
  emit('routeChangeComplete');
  // 걷히는 중(100% 유지 구간)에 다음 전환이 시작된다.
  advance(50);
  emit('routeChangeStart');
  advance(200);

  // 이전 전환의 hide 타이머가 살아 있었다면 여기서 w-0으로 지워진다.
  advance(200);
  expect(bar()).toHaveClass('w-2/3');
});

it('언마운트하면 라우터 구독을 해제한다', () => {
  const { unmount } = render(<RouteProgress />);
  expect(handlers.routeChangeStart).toHaveLength(1);

  unmount();

  expect(handlers.routeChangeStart).toHaveLength(0);
  expect(handlers.routeChangeComplete).toHaveLength(0);
  expect(handlers.routeChangeError).toHaveLength(0);
});
