import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import PledgeWizard from './PledgeWizard';
import { parseFundingProject } from '../../lib/funding/projects';
import { trackMicroEvent } from '../../utils/analytics';
import { MAX_ADDITIONAL_AMOUNT } from '../../lib/funding/policy';

jest.mock('../booking/TossPaymentWidget', () => function MockTossPaymentWidget() { return <div data-testid="toss-widget" />; });
jest.mock('../../utils/analytics', () => ({ trackMicroEvent: jest.fn() }));

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: cd
    title: CD
    description: d
    amount: 30000
    totalQuantity: 5
    requiresShipping: true
    estimatedDelivery: 2026-12
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

/**
 * 무통장 안내 페이지 이동은 router.push(클라 전환)가 아니라 전체 페이지 이동이어야 한다 —
 * 클라 전환이면 이미 로드된 gtag가 ?token=이 붙은 URL로 page_view를 보낸다.
 */
const assignMock = jest.fn();
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: assignMock },
  });
});

beforeEach(() => {
  assignMock.mockClear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, status: 201, headers: { get: () => 'application/json' },
    json: async () => ({
      ok: true, orderNo: 'FND-1', paymentMethod: 'toss', holdExpiresAt: new Date(Date.now() + 900000).toISOString(),
      itemAmount: 27273, vatAmount: 2727, totalAmount: 30000,
    }),
  }) as never;
});

it('배송 리워드는 배송지 입력이 보이고, 한정 수량이면 무통장 선택지가 없다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
  expect(screen.getByLabelText('받는 분')).toBeInTheDocument();
  expect(screen.queryByLabelText(/무통장/)).toBeNull();
});
it('무제한 리워드는 무통장 선택지가 있고, 제출하면 서버 금액으로 결제 단계가 뜬다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  expect(screen.getByLabelText(/무통장/)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('이름'), '김후원');
  await userEvent.type(screen.getByLabelText('연락처'), '010-1111-2222');
  await userEvent.type(screen.getByLabelText('이메일'), 'a@b.com');
  await userEvent.click(screen.getByLabelText(/약관/));
  await userEvent.click(screen.getByRole('button', { name: /결제로 이동/ }));
  expect(await screen.findByTestId('toss-widget')).toBeInTheDocument();
  expect(screen.getByText(/합계 30,000원/)).toBeInTheDocument();
  // funding_pledge_start는 페이지 진입 시 pledge.tsx에서 발화한다 — 제출에서는 발화하지 않는다.
  expect(trackMicroEvent).not.toHaveBeenCalled();
});

it('remaining보다 큰 수량을 입력하면 remaining으로 클램프된다', () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 3, mail: null }} />);
  const quantityInput = screen.getByLabelText('수량') as HTMLInputElement;
  fireEvent.change(quantityInput, { target: { value: '10' } });
  expect(quantityInput.value).toBe('3');
});

it('선택된 리워드의 remaining이 0이어도(품절) 수량이 0이 아니라 1로 바닥 고정된다', () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 0, mail: null }} />);
  const quantityInput = screen.getByLabelText('수량') as HTMLInputElement;
  fireEvent.change(quantityInput, { target: { value: '5' } });
  expect(quantityInput.value).toBe('1');
});

it('리워드를 바꾸면 수량이 1로 리셋된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
  const quantityInput = screen.getByLabelText('수량') as HTMLInputElement;
  fireEvent.change(quantityInput, { target: { value: '4' } });
  expect(quantityInput.value).toBe('4');
  await userEvent.click(screen.getByLabelText(/감사 메일/));
  expect((screen.getByLabelText('수량') as HTMLInputElement).value).toBe('1');
});

it('한정 수량 리워드는 무통장을 고를 수 없고, 제출하면 결제수단이 toss로 나간다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText('이름'), '김후원');
  await userEvent.type(screen.getByLabelText('연락처'), '010-1111-2222');
  await userEvent.type(screen.getByLabelText('이메일'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('받는 분'), '김후원');
  await userEvent.type(screen.getByLabelText('받는 분 연락처'), '010-1111-2222');
  await userEvent.type(screen.getByLabelText('우편번호'), '12345');
  await userEvent.type(screen.getByLabelText('주소'), '서울시 어딘가');
  await userEvent.click(screen.getByLabelText(/약관/));
  await userEvent.click(screen.getByRole('button', { name: /결제로 이동/ }));
  await screen.findByTestId('toss-widget');
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.paymentMethod).toBe('toss');
});

it('무제한 리워드에서 무통장을 고른 뒤 한정 리워드로 바꾸면 결제수단이 toss로 되돌아가 그대로 제출된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await userEvent.click(screen.getByLabelText(/무통장/));
  await userEvent.click(screen.getByLabelText(/CD/));
  expect(screen.queryByLabelText(/무통장/)).toBeNull();
  await userEvent.type(screen.getByLabelText('이름'), '김후원');
  await userEvent.type(screen.getByLabelText('연락처'), '010-1111-2222');
  await userEvent.type(screen.getByLabelText('이메일'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('받는 분'), '김후원');
  await userEvent.type(screen.getByLabelText('받는 분 연락처'), '010-1111-2222');
  await userEvent.type(screen.getByLabelText('우편번호'), '12345');
  await userEvent.type(screen.getByLabelText('주소'), '서울시 어딘가');
  await userEvent.click(screen.getByLabelText(/약관/));
  await userEvent.click(screen.getByRole('button', { name: /결제로 이동/ }));
  await screen.findByTestId('toss-widget');
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.paymentMethod).toBe('toss');
});

// 실명 공개는 옵트인이어야 한다 — 기본 체크는 후원자가 모르는 사이에 이름이 명단에 올라간다.
it('후원자 명단 이름 공개는 기본 해제', () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  expect(screen.getByLabelText(/이름 공개/)).not.toBeChecked();
});

// 상한 없이 두면 5,000,000원을 넘긴 값이 그대로 서버로 가서 400으로 튕긴다 —
// 입력 단계에서 잘라내야 후원자가 이유 없이 실패를 본다는 느낌을 받지 않는다.
it('추가 후원금은 MAX_ADDITIONAL_AMOUNT로 클램프된다', () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText(/추가 후원금/) as HTMLInputElement;
  fireEvent.change(input, { target: { value: '99999999' } });
  expect(Number(input.value)).toBe(MAX_ADDITIONAL_AMOUNT);
});

// 만료 뒤 "다시 신청"을 누르면 remainingMs가 0으로 남아, 새로 만든 주문의 결제 화면이
// 뜨자마자 다시 "시간이 지났습니다"로 보였다.
it('"다시 신청"은 남은 시간을 초기화한다 — 재제출이 곧바로 만료로 보이지 않는다', async () => {
  jest.useFakeTimers();
  try {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true, status: 201, headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, orderNo: 'FND-1', holdExpiresAt: new Date(Date.now() - 1000).toISOString(), itemAmount: 4545, vatAmount: 455, totalAmount: 5000 }),
    });
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '김후원' } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '010-1111-2222' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByLabelText(/약관/));
    fireEvent.submit(screen.getByRole('button', { name: /결제로 이동/ }).closest('form')!);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('alert')).toHaveTextContent('결제 대기 시간이 지났습니다');

    fireEvent.click(screen.getByRole('button', { name: '다시 신청' }));
    // 폼으로 돌아오고, 남은 시간 표시도 만료 상태가 아니다.
    expect(screen.getByLabelText('이름')).toBeInTheDocument();
    expect(screen.queryByText(/결제 대기 시간이 지났습니다/)).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

it('무통장 제출은 depositUrl로 전체 페이지 이동한다 — 토큰이 붙은 URL을 클라 전환으로 열지 않는다', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true, status: 201, headers: { get: () => 'application/json' },
    json: async () => ({
      ok: true, orderNo: 'FND-1', paymentMethod: 'bank_transfer',
      holdExpiresAt: new Date(Date.now() + 900000).toISOString(),
      itemAmount: 4545, vatAmount: 455, totalAmount: 5000,
      depositUrl: '/ko/funding/deposit/FND-1?token=tok',
    }),
  });
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await userEvent.click(screen.getByLabelText(/무통장/));
  await userEvent.type(screen.getByLabelText('이름'), '김후원');
  await userEvent.type(screen.getByLabelText('연락처'), '010-1111-2222');
  await userEvent.type(screen.getByLabelText('이메일'), 'a@b.com');
  await userEvent.click(screen.getByLabelText(/약관/));
  await userEvent.click(screen.getByRole('button', { name: /결제로 이동|신청/ }));
  expect(assignMock).toHaveBeenCalledWith('/ko/funding/deposit/FND-1?token=tok');
});
