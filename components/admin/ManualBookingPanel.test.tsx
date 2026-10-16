import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ManualBookingPanel } from './ManualBookingPanel';

const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, status: 'paid', orderNo: 'SNB-1', orderId: 'o1', warnings: [] }) });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

const open = () => fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value } });
const submit = () => fireEvent.click(screen.getAllByRole('button', { name: /^등록하기$|등록 중/ }).pop() as HTMLElement);

it('처음에는 접혀 있고, 열면 세션 예약 폼이 나온다', () => {
  render(<ManualBookingPanel today="2026-10-16" onCreated={jest.fn()} />);
  expect(screen.queryByLabelText(/고객 이름/)).not.toBeInTheDocument();
  open();
  expect(screen.getByLabelText(/고객 이름/)).toBeInTheDocument();
  expect(screen.getByLabelText(/이용 날짜/)).toBeInTheDocument();
});

it('등록하면 필드를 서버 형식으로 보내고 성공 안내와 상세 링크를 보여 준다', async () => {
  const onCreated = jest.fn().mockResolvedValue(undefined);
  render(<ManualBookingPanel today="2026-10-16" onCreated={onCreated} />);
  open();
  fill('고객 이름', '김전화');
  fill('협의 금액', '250000');
  submit();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/admin/bookings/manual');
  expect(JSON.parse(init.body)).toMatchObject({ kind: 'session', customerName: '김전화', totalAmount: 250000, received: true, method: '계좌 입금', date: '2026-10-16' });
  expect(await screen.findByText(/SNB-1 — 확정으로 등록했습니다/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '상세 보기' })).toHaveAttribute('href', '/admin/bookings/o1');
  expect(onCreated).toHaveBeenCalled();
});

it('"25만"처럼 숫자가 아닌 금액, 1,000원 미만 금액은 보내기 전에 막는다', async () => {
  render(<ManualBookingPanel today="2026-10-16" onCreated={jest.fn()} />);
  open();
  fill('고객 이름', '김전화');
  fill('협의 금액', '25');
  submit();
  expect(await screen.findByText(/금액이 너무 작아요/)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('서버가 시간대 충돌을 알리면 그 문구를 그대로 보여 준다', async () => {
  fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, message: '그 시간대에는 이미 예약이 있거나 막혀 있어요.' }) });
  render(<ManualBookingPanel today="2026-10-16" onCreated={jest.fn()} />);
  open();
  fill('고객 이름', '김전화');
  submit();
  expect(await screen.findByText('그 시간대에는 이미 예약이 있거나 막혀 있어요.')).toBeInTheDocument();
});
