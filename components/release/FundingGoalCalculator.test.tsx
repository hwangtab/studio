import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import FundingGoalCalculator, { goalPrefillFromQuery } from './FundingGoalCalculator';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
import { computeReleaseBudget, fundingGoalForBudget, fundingGoalLinkFor } from '../../lib/release/budget';
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
  it('기본값은 EP 번들 + 설계비', () => {
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

  it('펼친 그대로 — 제목·중앙값 비교가 있다(접는 모드는 2026-10-22에 없앴다)', () => {
    const { container } = render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" />);
    expect(container.querySelector('details')).toBeNull();
    expect(screen.getByText('펀딩 목표액 계산기')).toBeInTheDocument();
    expect(container.textContent).toContain('중앙값');
  });

  describe('발매 페이지 예산 계산기에서 넘어올 때(?cost=&from=release)', () => {
    afterEach(() => {
      window.history.replaceState(null, '', '/');
      jest.clearAllMocks();
    });

    it('주소 값 해석 — 숫자가 아니거나 범위 밖이면 버린다', () => {
      expect(goalPrefillFromQuery(new URLSearchParams('cost=2400000&from=release'))).toEqual({ customCost: 2400000, fromRelease: true });
      expect(goalPrefillFromQuery(new URLSearchParams('cost=-5'))).toEqual({ customCost: null, fromRelease: false });
      expect(goalPrefillFromQuery(new URLSearchParams('cost=1e9'))).toEqual({ customCost: null, fromRelease: false });
      expect(goalPrefillFromQuery(new URLSearchParams('cost=999999999'))).toEqual({ customCost: null, fromRelease: false });
    });

    it('예산 계산기와 같은 목표액으로 시작한다 — "제작 없음"(0원)으로 열리지 않는다', () => {
      const budget = computeReleaseBudget({ songs: 4, trackScale: 'l2', arrangementSongs: 1, vocalTuning: true, fundingSource: 'funding' });
      const href = fundingGoalLinkFor(budget);
      window.history.replaceState(null, '', href.replace('#funding-goal', ''));
      render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" defaultProduction="none" component="CrowdfundingDesignCalculator" />);
      expect(screen.getByText(won(fundingGoalForBudget(budget).goal))).toBeInTheDocument();
      expect(screen.getByLabelText(/발매 예산 계산 결과/)).toBeChecked();
    });

    it('cost 없이 from=release면 싱글로 시작하고, 사용·상담 이벤트를 발매 출처로 가른다', () => {
      window.history.replaceState(null, '', '/ko/crowdfunding-design?from=release');
      render(<FundingGoalCalculator kakaoUrl="https://open.kakao.com/x" defaultProduction="none" />);
      expect(screen.getByText(won(goalFor(SINGLE_BUNDLE_PRICE + FUNDING_DESIGN_PRICE)))).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('직접 개설'));
      expect(trackMicroEvent).toHaveBeenCalledWith('micro_pipeline_calc', expect.objectContaining({ cta_id: 'pipeline_calc_use_from_release' }));
      fireEvent.click(screen.getByRole('link', { name: /발매 자금 상담/ }));
      expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_kakao', expect.objectContaining({ cta_id: 'release_funding_consult_from_release' }));
    });
  });
});
