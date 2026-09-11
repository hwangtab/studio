import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Footer } from '../../components/layout/Footer';
import { getSiteConfig, hostingProvider, studioOperator } from '../../data/siteConfig';

/**
 * 전자상거래 등에서의 소비자보호에 관한 법률 제10조 제1항의 표시사항 회귀 방지.
 *
 * 상호·대표자·사업자등록번호·통신판매업 신고번호는 이미 푸터에 있었는데 **호스팅서비스
 * 제공자**만 빠져 있었다(2026-09-11 펀딩 감사). 펀딩은 통신판매라 표시 누락이 시정 대상이다.
 * 값의 근거는 추정이 아니라 저장소에 있다 — vercel.json, @vercel/* 런타임 의존, CLAUDE.md.
 */
describe('푸터 사업자 정보 (전자상거래법 제10조)', () => {
  it('호스팅서비스 제공자를 표시한다', () => {
    render(<Footer locale="ko" />);
    expect(screen.getByText(/호스팅서비스 제공자: Vercel Inc\./)).toBeInTheDocument();
  });

  it('대표자·사업자등록번호·통신판매업 신고번호가 함께 표시된다', () => {
    render(<Footer locale="ko" />);
    const config = getSiteConfig('ko');
    const info = screen.getByText(/사업자등록번호/);
    expect(info).toHaveTextContent(studioOperator.name);
    expect(info).toHaveTextContent(config.businessRegistrationNumber);
    expect(info).toHaveTextContent(config.mailOrderSalesNumber!);
    expect(info).toHaveTextContent(hostingProvider.name);
  });

  it('비-ko 로케일에도 같은 표시사항이 나간다 — 의무는 로케일과 무관하다', () => {
    render(<Footer locale="en" />);
    expect(screen.getByText(/호스팅서비스 제공자: Vercel Inc\./)).toBeInTheDocument();
  });
});
