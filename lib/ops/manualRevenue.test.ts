/** @jest-environment node */
import { parseManualRevenueInput, vatOf } from './manualRevenue';

const base = { receivedOn: '2026-10-10', type: 'session', description: ' 녹음 3시간 ', totalAmount: 275000, vatMode: 'included', method: '계좌 입금', memo: '' };
const parse = (over: Record<string, unknown> = {}) => parseManualRevenueInput({ ...base, ...over }, '2026-10-15');

it('정상 입력은 다듬어서 통과한다', () => {
  expect(parse()).toEqual({
    ok: true,
    value: { receivedOn: '2026-10-10', type: 'session', description: '녹음 3시간', totalAmount: 275000, vatMode: 'included', method: '계좌 입금', memo: null, businessLine: null },
  });
});

it.each([
  ['미래 날짜', { receivedOn: '2026-10-16' }],
  ['없는 날짜', { receivedOn: '2026-02-30' }],
  ['형식 틀림', { receivedOn: '10/10' }],
  ['모르는 유형', { type: 'nope' }],
  ['빈 내용', { description: '  ' }],
  ['0원', { totalAmount: 0 }],
  ['소수', { totalAmount: 100.5 }],
  ['문자열 금액', { totalAmount: '1000' }],
  ['자릿수 실수', { totalAmount: 1_000_000_000 }],
  ['부가세 구분 없음', { vatMode: 'x' }],
  ['모르는 방법', { method: '카드' }],
  ['모르는 분야', { businessLine: 'studio' }],
])('거절: %s', (_name, over) => {
  expect(parse(over).ok).toBe(false);
});

it('분야는 고르면 그대로, 비우면 null(유형의 기본 분야)', () => {
  expect(parse({ businessLine: 'practice' })).toMatchObject({ ok: true, value: { businessLine: 'practice' } });
  expect(parse({ businessLine: '' })).toMatchObject({ ok: true, value: { businessLine: null } });
});

it('부가세는 총액/11 반올림, 면세는 0', () => {
  expect(vatOf(275000, 'included')).toBe(25000);
  expect(vatOf(100000, 'included')).toBe(9091);
  expect(vatOf(100000, 'exempt')).toBe(0);
});
