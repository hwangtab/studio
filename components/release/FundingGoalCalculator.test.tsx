import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import FundingGoalCalculator from './FundingGoalCalculator';
import { EP_BUNDLE_PRICE, formatPriceAmount, FUNDING_DESIGN_PRICE } from '../../data/pricing';
import { computeFundingGoal } from '../../lib/funding/goal';
import { VAT_RATE } from '../../lib/booking/amounts';

jest.mock('../../utils/analytics', () => ({ trackLeadEvent: jest.fn(), trackMicroEvent: jest.fn() }));

const withVat = (n: number) => Math.round(n * (1 + VAT_RATE));
const won = (n: number) => `${formatPriceAmount(n)}원`;
const goalFor = (productionCost: number, otherCost = 0) =>
  computeFundingGoal({ productionCost, otherCost, withholding: true }).goal;

/**
 * 작은 펀딩도 같은 흐름(2026-09-28 운영자) — 제작 없음·직접 개설을 고르면 그 항목이 0으로
 * 빠질 뿐 같은 식(수수료·원천징수까지 거꾸로)으로 목표액이 나온다.
 */
describe('펀딩 목표액 계산기', () => {
  it('발매 페이지 기본값은 EP 번들 + 설계비', () => {
    render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" />);
    expect(screen.getByText(won(goalFor(withVat(EP_BUNDLE_PRICE) + withVat(FUNDING_DESIGN_PRICE))))).toBeInTheDocument();
  });

  it('제작 없음 + 설계 대행이면 설계비만으로 계산한다', () => {
    render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" defaultProduction="none" />);
    expect(screen.getByText(won(goalFor(withVat(FUNDING_DESIGN_PRICE))))).toBeInTheDocument();
  });

  it('제작 없음 + 직접 개설이면 리워드 원가만으로 계산한다 — 작은 펀딩도 같은 식', () => {
    render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" defaultProduction="none" />);
    fireEvent.click(screen.getByLabelText('직접 개설'));
    fireEvent.change(screen.getByLabelText('리워드 원가·기타 비용'), { target: { value: '300000' } });
    expect(screen.getByText(won(goalFor(0, 300_000)))).toBeInTheDocument();
  });
});
