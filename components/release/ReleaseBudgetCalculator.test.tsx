import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReleaseBudgetCalculator from './ReleaseBudgetCalculator';
import { EP_BUNDLE_PRICE, formatPriceAmount, FUNDING_DESIGN_PRICE, SINGLE_BUNDLE_PRICE } from '../../data/pricing';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

jest.mock('../../utils/analytics', () => ({ trackLeadEvent: jest.fn(), trackMicroEvent: jest.fn() }));

const won = (n: number) => `${formatPriceAmount(n)}원`;
const KAKAO = 'https://open.kakao.com/me/nol';

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
});

describe('발매 예산 계산기', () => {
  it('처음엔 1곡 싱글 번들 — 티어 카드의 가장 낮은 값과 같다', () => {
    render(<ReleaseBudgetCalculator kakaoUrl={KAKAO} />);
    expect(screen.getAllByText(won(SINGLE_BUNDLE_PRICE)).length).toBeGreaterThan(0);
    expect(trackMicroEvent).not.toHaveBeenCalled();
  });

  it('곡 수·펀딩을 고르면 합계가 바뀌고, 처음 만질 때 한 번만 micro 이벤트', () => {
    render(<ReleaseBudgetCalculator kakaoUrl={KAKAO} />);
    fireEvent.change(screen.getByLabelText('몇 곡을 내시나요?'), { target: { value: '4' } });
    fireEvent.click(screen.getByLabelText('크라우드펀딩'));
    expect(screen.getByText(won(EP_BUNDLE_PRICE + FUNDING_DESIGN_PRICE))).toBeInTheDocument();
    expect(screen.getByText('펀딩 목표 예상')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '리워드 원가까지 넣어 계산하기' })).toHaveAttribute('href', `/ko/crowdfunding-design?cost=${EP_BUNDLE_PRICE}&from=release#funding-goal`);
    expect(trackMicroEvent).toHaveBeenCalledTimes(1);
    expect(trackMicroEvent).toHaveBeenCalledWith('micro_release_budget', expect.objectContaining({ component: 'ReleaseBudgetCalculator' }));
  });

  it('편곡 곡 수는 곡 수를 넘지 않는다 — 곡 수를 줄이면 따라 줄어든다', () => {
    render(<ReleaseBudgetCalculator kakaoUrl={KAKAO} />);
    fireEvent.change(screen.getByLabelText('몇 곡을 내시나요?'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('편곡이 필요한 곡'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('몇 곡을 내시나요?'), { target: { value: '2' } });
    expect((screen.getByLabelText('편곡이 필요한 곡') as HTMLSelectElement).value).toBe('2');
  });

  it('직접 준비면 펀딩 목표 줄이 없다', () => {
    render(<ReleaseBudgetCalculator kakaoUrl={KAKAO} />);
    expect(screen.queryByText('펀딩 목표 예상')).toBeNull();
  });

  it('카톡 버튼은 견적 코드와 함께 리드로 잡히고 요약을 복사한다', () => {
    render(<ReleaseBudgetCalculator kakaoUrl={KAKAO} />);
    fireEvent.click(screen.getByRole('link', { name: /이 예산으로 카톡 상담/ }));
    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_kakao', expect.objectContaining({ cta_id: 'release_budget_kakao', quote_service: 'release' }));
    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(copied).toContain('예상 예산');
    expect(copied).not.toMatch(/이름|연락처|이메일|전화/);
  });
});
