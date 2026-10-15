import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { trackMicroEvent } from '../../utils/analytics';

import FundingGoalCalculator from './FundingGoalCalculator';
import { EP_BUNDLE_PRICE, SINGLE_BUNDLE_PRICE, formatPriceAmount, FUNDING_DESIGN_PRICE } from '../../data/pricing';
import { computeFundingGoal } from '../../lib/funding/goal';

jest.mock('../../utils/analytics', () => ({ trackLeadEvent: jest.fn(), trackMicroEvent: jest.fn() }));

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
    expect(screen.getByText(won(goalFor(EP_BUNDLE_PRICE + FUNDING_DESIGN_PRICE)))).toBeInTheDocument();
  });

  it('제작 없음 + 설계 대행이면 설계비만으로 계산한다', () => {
    render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" defaultProduction="none" />);
    expect(screen.getByText(won(goalFor(FUNDING_DESIGN_PRICE)))).toBeInTheDocument();
  });

  it('제작 없음 + 직접 개설이면 리워드 원가만으로 계산한다 — 작은 펀딩도 같은 식', () => {
    render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" defaultProduction="none" />);
    fireEvent.click(screen.getByLabelText('직접 개설'));
    fireEvent.change(screen.getByLabelText('리워드 원가·기타 비용'), { target: { value: '300000' } });
    expect(screen.getByText(won(goalFor(0, 300_000)))).toBeInTheDocument();
  });

  describe('발매 페이지(calm) — 압박을 줄인 형태', () => {
    afterEach(() => window.history.replaceState(null, '', '/'));

    it('한 줄로 접혀 있고, 펼치면 싱글 기준 목표액과 열림 이벤트가 나온다', () => {
      const { container } = render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" defaultProduction="single" calm />);
      const details = container.querySelector('details') as HTMLDetailsElement;
      expect(details.open).toBe(false);
      expect(screen.queryByText('펀딩 목표액 계산기')).toBeNull();
      details.open = true;
      fireEvent(details, new Event('toggle'));
      expect(details.open).toBe(true);
      expect(screen.getByText(won(goalFor(SINGLE_BUNDLE_PRICE + FUNDING_DESIGN_PRICE)))).toBeInTheDocument();
      expect(trackMicroEvent).toHaveBeenCalledWith('micro_pipeline_calc', expect.objectContaining({ cta_id: 'pipeline_calc_open' }));
    });

    it('공제 내역은 접혀 있고, 다른 펀딩 중앙값 비교는 싣지 않는다', () => {
      const { container } = render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" calm />);
      const inner = container.querySelectorAll('details')[1] as HTMLDetailsElement;
      expect(inner.querySelector('summary')?.textContent).toContain('계산 내역 보기');
      expect(inner.open).toBe(false);
      expect(container.textContent).not.toContain('중앙값');
    });

    it('#funding-goal로 오면 펼친다 — 같은 페이지의 링크로 해시가 바뀔 때도', () => {
      const { container } = render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" calm />);
      const details = container.querySelector('details') as HTMLDetailsElement;
      expect(details.open).toBe(false);
      act(() => {
        window.history.replaceState(null, '', '/#funding-goal');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      expect(details.open).toBe(true);
    });

    it('펀딩 설계 페이지(기본)는 펼친 그대로 — 제목·중앙값 비교가 있다', () => {
      const { container } = render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" />);
      expect(container.querySelector('details')).toBeNull();
      expect(screen.getByText('펀딩 목표액 계산기')).toBeInTheDocument();
      expect(container.textContent).toContain('중앙값');
    });
  });
});
