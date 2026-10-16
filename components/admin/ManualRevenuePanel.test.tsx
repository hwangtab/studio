import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const replace = jest.fn().mockResolvedValue(true);
jest.mock('next/router', () => ({ useRouter: () => ({ replace, asPath: '/admin/revenue' }) }));

import { ManualRevenuePanel } from './ManualRevenuePanel';

const base = {
  today: '2026-10-16',
  types: [{ value: 'session', label: '세션 예약' }, { value: 'other', label: '기타' }],
  methods: ['계좌 입금', '현금'],
  entries: [],
  periodLabel: '2026년 10월',
};

const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, id: 'x' }) });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value } });

it('입력을 채워 기록하면 숫자를 정수로 바꿔 POST하고 페이지를 새로 읽는다', async () => {
  render(<ManualRevenuePanel {...base} />);
  fill('내용', '녹음 3시간 — 김OO');
  fill('받은 금액', '275,000');
  fireEvent.click(screen.getByRole('button', { name: '기록하기' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/admin/revenue/manual');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toMatchObject({ receivedOn: '2026-10-16', type: 'session', description: '녹음 3시간 — 김OO', totalAmount: 275000, vatMode: 'included', method: '계좌 입금' });
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/revenue'));
  expect(await screen.findByText(/275,000원을 기록했습니다/)).toBeInTheDocument();
});

it('서버가 거절하면 그 사유를 보여 주고 폼 값은 지우지 않는다', async () => {
  fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, message: '금액이 너무 큽니다.' }) });
  render(<ManualRevenuePanel {...base} />);
  fill('내용', '큰 금액');
  fill('받은 금액', '999999999');
  fireEvent.click(screen.getByRole('button', { name: '기록하기' }));
  expect(await screen.findByText('금액이 너무 큽니다.')).toBeInTheDocument();
  expect(screen.getByLabelText(/내용/)).toHaveValue('큰 금액');
  expect(replace).not.toHaveBeenCalled();
});

it('표를 못 읽는 상태(unavailable)면 폼 대신 안내만 보인다', () => {
  render(<ManualRevenuePanel {...base} unavailable="마이그레이션이 필요합니다." />);
  expect(screen.getByText('마이그레이션이 필요합니다.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '기록하기' })).not.toBeInTheDocument();
});

it('기록 삭제는 확인을 거치고, 취소하면 요청하지 않는다', async () => {
  const entries = [{ id: 'm1', receivedOn: '2026-10-03', typeLabel: '기타', description: '현금 판매', method: '현금', memo: null, totalAmount: 50000, refundedAmount: 0 }];
  const confirm = jest.spyOn(window, 'confirm');
  render(<ManualRevenuePanel {...base} entries={entries} />);

  confirm.mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  expect(fetchMock).not.toHaveBeenCalled();

  confirm.mockReturnValueOnce(true);
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ id: 'm1' });
});
