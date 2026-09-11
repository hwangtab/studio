import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../../lib/funding/confirm', () => ({ confirmFundingPledge: jest.fn() }));
jest.mock('../../../lib/funding/service', () => ({ findFundingOrderByOrderNo: jest.fn() }));
jest.mock('../../../utils/analytics', () => ({ trackMicroEvent: jest.fn() }));

// eslint-disable-next-line import/first
import FundingSuccessPage from '../../../pages/[locale]/funding/success';
// eslint-disable-next-line import/first
import { trackMicroEvent } from '../../../utils/analytics';

const confirmed = {
  outcome: 'confirmed' as const,
  orderNo: 'FND-20261015-ABCD1234',
  manageUrl: '/ko/funding/manage/FND-20261015-ABCD1234?token=tok',
  projectSlug: 'demo',
  emailSent: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
});

/**
 * 이 페이지는 확정 뒤 `?o=`로 리다이렉트된 자리라 **측정 대상**이다
 * (lib/analytics/privatePaths.ts의 예외). 전환 이벤트가 여기서 실제로 발화해야
 * 퍼널이 진입 100%·결제 0%로 보이던 문제가 풀린다.
 */
it('확정 화면에서 전환 이벤트가 발화한다', () => {
  render(<FundingSuccessPage {...confirmed} />);
  expect(trackMicroEvent).toHaveBeenCalledWith('funding_pledge_paid', { component: 'funding_success', landing_slug: 'demo' });
  expect(screen.getByRole('link', { name: /후원 확인·취소 페이지 열기/ })).toHaveAttribute('href', confirmed.manageUrl);
});

// 쿠키가 살아 있는 30분 동안 몇 번이고 열릴 수 있다 — 새로고침마다 세면 결제 수가 부풀려진다.
it('같은 주문을 다시 열면 이벤트를 또 보내지 않는다', () => {
  const { unmount } = render(<FundingSuccessPage {...confirmed} />);
  unmount();
  render(<FundingSuccessPage {...confirmed} />);
  expect(trackMicroEvent).toHaveBeenCalledTimes(1);
});

/**
 * 쿠키가 막히거나 30분이 지나면 관리 링크를 만들 근거가 없다. 그래도 결제한 사람이 빈손으로
 * 나가면 안 된다 — 주문번호와 문의처, 그리고 "관리 링크는 메일에 있다"까지는 남겨야 한다.
 */
it('확정을 되살릴 수 없는 화면(unknown)에는 주문번호·문의처가 남고 이벤트는 안 보낸다', () => {
  render(<FundingSuccessPage outcome="unknown" orderNo="FND-20261015-ABCD1234" />);
  expect(trackMicroEvent).not.toHaveBeenCalled();
  expect(screen.getByText(/FND-20261015-ABCD1234/)).toBeInTheDocument();
  expect(screen.getByText(/후원 확인 메일에/)).toBeInTheDocument();
  expect(screen.getByText(/010-4255-7893/)).toBeInTheDocument();
  expect(screen.getByText(/hello@studionol.co.kr/)).toBeInTheDocument();
});

it('오류 화면에서도 이벤트를 보내지 않는다', () => {
  render(<FundingSuccessPage outcome="error" message="이미 처리되었거나 만료된 후원입니다." />);
  expect(trackMicroEvent).not.toHaveBeenCalled();
  expect(screen.getByText('이미 처리되었거나 만료된 후원입니다.')).toBeInTheDocument();
});

it('확인 메일이 실패했으면 링크를 저장하라고 안내한다', () => {
  render(<FundingSuccessPage {...confirmed} emailSent={false} />);
  expect(screen.getByText(/확인 메일을 보내지 못했습니다/)).toBeInTheDocument();
});
