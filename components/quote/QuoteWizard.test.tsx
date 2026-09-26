import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockLead = jest.fn();
const mockMicro = jest.fn();
jest.mock('../../utils/analytics', () => ({
  trackLeadEvent: (...a: unknown[]) => mockLead(...a),
  trackMicroEvent: (...a: unknown[]) => mockMicro(...a),
}));

// eslint-disable-next-line import/first
import QuoteWizard from './QuoteWizard';
// eslint-disable-next-line import/first
import { formatPriceLabel, VOCAL_PACKAGE_PRICE, EP_BUNDLE_PRICE } from '../../data/pricing';

const KAKAO = 'https://open.kakao.com/me/nol';
const pick = (name: RegExp | string) => fireEvent.click(screen.getByRole('radio', { name }));

beforeEach(() => {
  mockLead.mockReset();
  mockMicro.mockReset();
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
});

describe('QuoteWizard', () => {
  it('답을 다 하기 전에는 견적도 카톡 버튼도 없다', () => {
    render(<QuoteWizard kakaoUrl={KAKAO} />);
    pick('보컬·악기 녹음');
    expect(screen.queryByRole('link', { name: /카카오톡으로 보내기/ })).not.toBeInTheDocument();
    expect(mockMicro).toHaveBeenCalledWith('micro_quote_start', expect.objectContaining({ component: 'QuoteWizard' }));
  });

  it('녹음 1곡이면 1프로 가격과 예약 링크가 나오고, 카톡 클릭은 견적 코드와 함께 리드로 잡힌다', () => {
    render(<QuoteWizard kakaoUrl={KAKAO} />);
    pick('보컬·악기 녹음');
    pick('1곡');
    pick('곡·가사가 완성돼 있어요');
    pick('2주 안');
    expect(screen.getByText(formatPriceLabel(VOCAL_PACKAGE_PRICE, 'ko'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '바로 예약·결제하기' })).toHaveAttribute('href', '/ko/booking/recording?product=recording-pro');

    const kakao = screen.getByRole('link', { name: /카카오톡으로 보내기/ });
    expect(kakao).toHaveAttribute('href', KAKAO);
    fireEvent.click(kakao);
    expect(mockLead).toHaveBeenCalledWith(
      'lead_click_kakao',
      expect.objectContaining({ cta_id: 'quote_kakao', quote_service: 'recording', quote_code: expect.stringMatching(/^NOL-/) }),
    );
    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(copied).toContain('서비스: 보컬·악기 녹음 — 1곡');
    expect(copied).toMatch(/NOL-[A-Z2-9]{6}/);
  });

  it('발매는 제작비 문항까지 답해야 하고, 온라인 예약 링크 없이 카톡으로만 간다', () => {
    render(<QuoteWizard kakaoUrl={KAKAO} />);
    pick('음반 발매 (기획부터 홍보까지)');
    pick('EP (3~5곡)');
    pick('데모가 있어요');
    pick('3개월 안');
    expect(screen.queryByRole('link', { name: /카카오톡으로 보내기/ })).not.toBeInTheDocument();
    pick('크라우드펀딩');
    expect(screen.getByText(`${formatPriceLabel(EP_BUNDLE_PRICE, 'ko')}부터`)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '바로 예약·결제하기' })).not.toBeInTheDocument();
  });

  it('서비스를 바꾸면 규모 답이 비워진다 — 다른 서비스의 답으로 견적이 나오지 않게', () => {
    render(<QuoteWizard kakaoUrl={KAKAO} />);
    pick('보컬·악기 녹음');
    pick('1곡');
    pick('곡·가사가 완성돼 있어요');
    pick('2주 안');
    pick('믹싱·마스터링');
    expect(screen.queryByRole('link', { name: /카카오톡으로 보내기/ })).not.toBeInTheDocument();
  });
});
