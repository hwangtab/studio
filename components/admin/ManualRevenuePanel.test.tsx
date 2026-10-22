import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const replace = jest.fn().mockResolvedValue(true);
jest.mock('next/router', () => ({ useRouter: () => ({ replace, asPath: '/admin/finance' }) }));

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
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/finance'));
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

it('중복 의심(409)이면 확인을 받고, 확인하면 confirmDuplicate로 다시 보낸다 — 취소하면 저장하지 않는다', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, code: 'possible_duplicate', message: '이미 적힌 것 같은 돈이 있어요: 사이트 주문 NO-1' }) });
  const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(true);
  render(<ManualRevenuePanel {...base} />);
  fill('내용', '녹음');
  fill('받은 금액', '165000');
  fireEvent.click(screen.getByRole('button', { name: '기록하기' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(confirm.mock.calls[0][0]).toMatch(/NO-1/);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ totalAmount: 165000, confirmDuplicate: true });

  fetchMock.mockClear();
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, code: 'possible_duplicate', message: '중복' }) });
  confirm.mockReturnValueOnce(false);
  fill('내용', '녹음 2');
  fill('받은 금액', '165000');
  fireEvent.click(screen.getByRole('button', { name: '기록하기' }));
  expect(await screen.findByText(/저장하지 않았습니다/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('저장하면 분야 선택을 비운다(다음 기록이 앞 분야를 물려받지 않게)', async () => {
  render(<ManualRevenuePanel {...base} />);
  fireEvent.change(screen.getByLabelText(/^분야/), { target: { value: 'practice' } });
  fill('내용', '연습실 3시간');
  fill('받은 금액', '33000');
  fireEvent.click(screen.getByRole('button', { name: '기록하기' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ businessLine: 'practice' });
  await waitFor(() => expect(screen.getByLabelText(/^분야/)).toHaveValue(''));
});

it('유형에 따라 안내가 바뀐다 — 세션은 연습실 분야, 수수료 유형은 수수료 몫만', () => {
  const types = [...base.types, { value: 'funding', label: '펀딩 수수료' }];
  render(<ManualRevenuePanel {...base} types={types} />);
  expect(screen.getByText(/연습실 시간제면 분야를 연습실로 고르세요/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^유형/), { target: { value: 'funding' } });
  expect(screen.getByText(/스튜디오 수수료 몫만 적으세요\(받은 전액 아님\)/)).toBeInTheDocument();
  expect(screen.queryByText(/연습실 시간제면/)).not.toBeInTheDocument();
});

it('목록에서 분야를 바꾸면 확인 뒤 PATCH하고, 중복 의심이면 "중복 아님"을 보낸다', async () => {
  const entries = [{ id: 'm1', receivedOn: '2026-10-03', typeLabel: '세션 예약', typeKey: 'session', assignedLine: null, duplicateOf: '사이트 주문 NO-9', description: '녹음', method: '현금', memo: null, totalAmount: 50000, refundedAmount: 0 }];
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ManualRevenuePanel {...base} entries={entries} />);
  fireEvent.change(screen.getByLabelText('녹음 분야'), { target: { value: 'practice' } });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ id: 'm1', businessLine: 'practice' });
  await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: '중복 아님' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '중복 아님' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ id: 'm1', action: 'ackDuplicate' });
});

it('분야로 연습실을 고르면 월 입주 이용료는 자동으로 잡힌다는 안내가 뜬다', () => {
  render(<ManualRevenuePanel {...base} />);
  expect(screen.queryByText(/월 입주 이용료는 자동으로 매출에 잡혀요/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^분야/), { target: { value: 'practice' } });
  expect(screen.getByText('연습실 월 입주 이용료는 자동으로 매출에 잡혀요 — 시간제·기타 수입만 적으세요')).toBeInTheDocument();
});

it('한 행의 요청이 진행 중이면 그 행의 분야 선택·중복 아님 버튼이 잠긴다', async () => {
  const entries = [{ id: 'm1', receivedOn: '2026-10-03', typeLabel: '세션 예약', typeKey: 'session', assignedLine: null, duplicateOf: '사이트 주문 NO-9', description: '녹음', method: '현금', memo: null, totalAmount: 50000, refundedAmount: 0 }];
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  let finish: (v: unknown) => void = () => undefined;
  fetchMock.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  render(<ManualRevenuePanel {...base} entries={entries} />);
  fireEvent.change(screen.getByLabelText('녹음 분야'), { target: { value: 'practice' } });
  await waitFor(() => expect(screen.getByLabelText('녹음 분야')).toBeDisabled());
  expect(screen.getByRole('button', { name: '중복 아님' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
  finish({ ok: true, json: async () => ({ ok: true }) });
  await waitFor(() => expect(screen.getByLabelText('녹음 분야')).toBeEnabled());
  expect(screen.getByRole('button', { name: '중복 아님' })).toBeEnabled();
});

it('행 요청이 실패하면 그 행 아래에 사유를 보이고 잠금을 푼다', async () => {
  const entries = [{ id: 'm1', receivedOn: '2026-10-03', typeLabel: '세션 예약', typeKey: 'session', assignedLine: null, duplicateOf: '사이트 주문 NO-9', description: '녹음', method: '현금', memo: null, totalAmount: 50000, refundedAmount: 0 }];
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, message: '기록을 찾을 수 없습니다.' }) });
  render(<ManualRevenuePanel {...base} entries={entries} />);
  fireEvent.click(screen.getByRole('button', { name: '중복 아님' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('기록을 찾을 수 없습니다.');
  expect(screen.getByRole('button', { name: '중복 아님' })).toBeEnabled();
  expect(replace).not.toHaveBeenCalled();
});
