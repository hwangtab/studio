import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * `auth.tsx`의 로그인 버튼(session.ts를 POST로 부르는 쪽)이 401과 5xx를 구분해 다른
 * 문구를 보여주는지 본다. session.ts는 토큰을 먼저 소진하고 세션을 나중에 만들기 때문에,
 * 세션 생성이 실패(5xx)해도 화면이 "링크가 만료됐거나 이미 사용되었습니다"라고 말하면
 * 개설자는 새 링크를 받아도 같은 문구를 반복해서 보게 된다 — 그 회귀를 잡는다.
 */
// eslint-disable-next-line import/first
import CreatorAuth from '../../../../pages/[locale]/funding/creator/auth';

const originalFetch = global.fetch;
const originalReplaceState = window.history.replaceState;

beforeEach(() => {
  window.history.replaceState = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  window.history.replaceState = originalReplaceState;
  jest.restoreAllMocks();
});

it('세션 API가 401이면 "만료됐거나 이미 사용됨" 문구를 보여준다', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  render(<CreatorAuth token="raw-token" />);

  fireEvent.click(screen.getByRole('button', { name: /로그인하기/ }));

  await waitFor(() => {
    expect(screen.getByText(/링크가 만료됐거나 이미 사용되었습니다/)).toBeInTheDocument();
  });
  expect(screen.queryByText(/일시적인 오류/)).not.toBeInTheDocument();
});

it('세션 API가 5xx면 "일시적인 오류" 문구를 보여준다(만료 문구를 지어내지 않는다)', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
  render(<CreatorAuth token="raw-token" />);

  fireEvent.click(screen.getByRole('button', { name: /로그인하기/ }));

  await waitFor(() => {
    expect(screen.getByText(/일시적인 오류로 로그인하지 못했습니다/)).toBeInTheDocument();
  });
  expect(screen.queryByText(/만료됐거나 이미 사용되었습니다/)).not.toBeInTheDocument();
});
