import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../../../components/SEO', () => function MockSEO() { return null; });
jest.mock('../../../../components/MarkdownRenderer', () => function MockMarkdownRenderer() { return null; });
jest.mock('../../../../components/funding/FundingTrustNotice', () => function MockFundingTrustNotice() { return null; });
jest.mock('../../../../components/funding/useFundingStatus', () => ({ useFundingStatus: jest.fn() }));
// 결제 폼은 토스 위젯을 물고 있어 여기서는 대역으로 둔다 — 보는 것은 모달의 열고 닫힘이다.
jest.mock('../../../../components/funding/PledgeWizard', () => function MockWizard() { return <p>결제 폼 대역</p>; });
jest.mock('../../../../utils/analytics', () => ({ trackMicroEvent: jest.fn() }));

// eslint-disable-next-line import/first
import FundingProjectPage from '../../../../pages/[locale]/funding/[slug]/index';
// eslint-disable-next-line import/first
import { useFundingStatus } from '../../../../components/funding/useFundingStatus';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../../lib/funding/projects';

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

beforeEach(() => {
  (useFundingStatus as jest.Mock).mockReturnValue({
    data: { state: 'live', goalAmount: 1000, endAt: '2036-01-01', raisedAmount: 0, backerCount: 0, percent: 0, remaining: { mail: null }, publicBackers: [] },
    error: false, state: 'live',
  });
});

const openFromMobileBar = () => {
  const bar = screen.getAllByRole('link', { name: '펀딩하기' }).find((a) => a.closest('.fixed'))!;
  fireEvent.click(bar);
};

/**
 * 모달이 떠 있을 때 뒤로가기는 모달만 닫아야 한다 — 예전엔 페이지를 통째로 떠나, 카카오톡에서
 * 들어온 사람은 대화방으로 튕겨 나갔다(2026-09-29). 같은 주소로 기록 한 칸을 쌓는다.
 */
describe('모달과 뒤로가기', () => {
  it('열면 같은 주소로 기록 한 칸을 쌓는다 — 주소가 바뀌지 않아 페이지뷰가 늘지 않는다', () => {
    const push = jest.spyOn(window.history, 'pushState');
    const before = window.location.href;
    render(<FundingProjectPage project={project} initialState="live" />);
    openFromMobileBar();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatchObject({ fundingModal: true });
    expect(push.mock.calls[0][2]).toBeUndefined();
    expect(window.location.href).toBe(before);
    push.mockRestore();
  });

  it('뒤로가기(popstate)는 모달만 닫는다', () => {
    render(<FundingProjectPage project={project} initialState="live" />);
    openFromMobileBar();
    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('✕로 닫으면 쌓은 칸을 history.back()으로 걷어 낸다 — 닫은 뒤 뒤로가기가 한 번에 페이지를 떠나게', () => {
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    render(<FundingProjectPage project={project} initialState="live" />);
    openFromMobileBar();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    back.mockRestore();
  });
});
