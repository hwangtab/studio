import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import CreatorLoginForm from './CreatorLoginForm';

const terms = { href: '/ko/shows/organizer-terms', label: '공연 주최자 약관', purpose: '주최자', condition: '등록 조건' };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const sentBody = async (next?: 'shows') => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<CreatorLoginForm terms={terms} {...(next ? { next } : {})} />);
  fireEvent.change(screen.getByLabelText(/이메일 주소/), { target: { value: 'a@b.com' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인 링크 받기' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  return JSON.parse(fetchMock.mock.calls[0][1].body as string);
};

it('공연 안내 페이지의 폼은 next=shows를 함께 보낸다', async () => {
  expect(await sentBody('shows')).toEqual({ email: 'a@b.com', next: 'shows' });
});

it('next가 없으면 이메일만 보낸다', async () => {
  expect(await sentBody()).toEqual({ email: 'a@b.com' });
});
