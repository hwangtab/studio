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

describe('지금 보고 있는 예약 화면(라인)에 맞춰 종류·상품이 미리 골라져 있다', () => {
  const kindSelect = () => screen.getByLabelText(/종류/) as HTMLSelectElement;
  const productSelect = () => screen.getByLabelText(/^상품/) as HTMLSelectElement;
  const optionTexts = (select: HTMLSelectElement) => Array.from(select.options).map((o) => o.textContent ?? '');

  it('믹싱 화면이면 믹싱·마스터링 주문이 골라져 있다', () => {
    render(<ManualBookingPanel today="2026-10-16" onCreated={jest.fn()} line="mixing" />);
    open();
    expect(kindSelect().value).toBe('mixing');
    expect(screen.getByLabelText(/곡 수/)).toBeInTheDocument();
  });

  it('녹음실 화면이면 녹음실 예약·녹음 상품이고, 연습실 상품은 목록에 없다', async () => {
    render(<ManualBookingPanel today="2026-10-16" onCreated={jest.fn()} line="studio" />);
    open();
    expect(kindSelect().value).toBe('session');
    expect(kindSelect().options[0].textContent).toBe('녹음실 예약');
    expect(productSelect().value).toBe('recording-pro');
    expect(optionTexts(productSelect()).some((t) => t.includes('연습실'))).toBe(false);
  });

  it('연습실 화면이면 연습실 시간제가 골라져 있고 녹음 상품은 목록에 없다', () => {
    render(<ManualBookingPanel today="2026-10-16" onCreated={jest.fn()} line="practice" />);
    open();
    expect(kindSelect().options[0].textContent).toBe('연습실 예약');
    expect(productSelect().value).toBe('practice-room-hourly');
    expect(optionTexts(productSelect()).some((t) => t.includes('녹음'))).toBe(false);
  });

  it('같은 화면에서 라인을 옮기면 기본값도 따라간다', () => {
    const { rerender } = render(<ManualBookingPanel today="2026-10-16" onCreated={jest.fn()} line="studio" />);
    open();
    rerender(<ManualBookingPanel today="2026-10-16" onCreated={jest.fn()} line="mixing" />);
    expect(kindSelect().value).toBe('mixing');
    rerender(<ManualBookingPanel today="2026-10-16" onCreated={jest.fn()} line="practice" />);
    expect(kindSelect().value).toBe('session');
    expect(productSelect().value).toBe('practice-room-hourly');
  });

  it('라인을 모르는 전체 화면에서는 예전처럼 모든 상품이 보인다', () => {
    render(<ManualBookingPanel today="2026-10-16" onCreated={jest.fn()} />);
    open();
    expect(kindSelect().options[0].textContent).toBe('세션·연습실 예약');
    expect(optionTexts(productSelect()).some((t) => t.includes('연습실'))).toBe(true);
    expect(optionTexts(productSelect()).some((t) => t.includes('녹음'))).toBe(true);
  });
});
