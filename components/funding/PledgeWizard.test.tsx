import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import PledgeWizard from './PledgeWizard';
import { parseFundingProject } from '../../lib/funding/projects';

jest.mock('../booking/TossPaymentWidget', () => function MockTossPaymentWidget() { return <div data-testid="toss-widget" />; });
jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

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

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({
    ok: true, orderNo: 'FND-1', paymentMethod: 'toss', holdExpiresAt: new Date(Date.now() + 900000).toISOString(),
    itemAmount: 27273, vatAmount: 2727, totalAmount: 30000,
  }) }) as never;
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
});
