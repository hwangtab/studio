/**
 * 사업자 정보 패널의 정산 계좌 — 공연·상점 개설자는 펀딩 정산 절이 없어 여기서만 계좌를 연다.
 * 계좌는 마운트 때 가져오지 않고, 누른 순간에만 개설자 단위 경로에서 가져온다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { CreatorTaxProfilePanel } from './CreatorTaxProfilePanel';

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn(async (url: string) => {
    if (url.endsWith('/tax-profile')) return jsonResponse({ ok: true, taxType: 'withholding', business: null });
    if (url.endsWith('/payout-account')) {
      return jsonResponse({ ok: true, account: { bankName: '국민은행', account: '123-456-789012', holder: '주최자' } });
    }
    throw new Error(`unexpected ${url}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

it('마운트 때는 계좌를 가져오지 않고, 계좌 보기를 누르면 개설자 단위 경로에서 가져와 보여 준다', async () => {
  render(<CreatorTaxProfilePanel creatorId="creator-1" />);
  await screen.findByText(/개인\(원천징수\)/);
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/payout-account'))).toBe(false);

  await userEvent.click(screen.getByRole('button', { name: '계좌 보기' }));
  expect(await screen.findByText('123-456-789012')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/admin/creators/creator-1/payout-account', { credentials: 'same-origin' });
});

it('서버가 거절하면 그 사유를 보인다', async () => {
  fetchMock.mockImplementation(async (url: string) =>
    url.endsWith('/tax-profile')
      ? jsonResponse({ ok: true, taxType: null, business: null })
      : jsonResponse({ ok: false, message: '등록된 정산 계좌가 없습니다. 개설자에게 등록을 요청해 주세요.' }, false),
  );
  render(<CreatorTaxProfilePanel creatorId="creator-1" />);
  await userEvent.click(await screen.findByRole('button', { name: '계좌 보기' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('등록된 정산 계좌가 없습니다'));
});

it('payoutAccount={false}면 계좌 보기가 없다 — 펀딩 프로젝트 상세는 정산 절에 같은 버튼이 있다', async () => {
  render(<CreatorTaxProfilePanel creatorId="creator-1" payoutAccount={false} />);
  await screen.findByText(/개인\(원천징수\)/);
  expect(screen.queryByRole('button', { name: '계좌 보기' })).not.toBeInTheDocument();
});
