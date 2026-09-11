import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// SEO 컴포넌트가 useRouter를 쓴다 — 이 테스트가 보는 것은 <dl> 본문이지 라우팅이 아니다.
jest.mock('next/router', () => ({ useRouter: () => ({ asPath: '/ko/funding/terms', query: {}, push: jest.fn() }) }));

import FundingTermsPage, { FUNDING_PRIVACY_SECTION_REFERENCE, FUNDING_TERMS_SECTIONS } from '../../../pages/[locale]/funding/terms';
import { hostingProvider } from '../../../data/siteConfig';
import { POLICY_COPY_BY_LOCALE } from '../../../data/privacyPolicy';

it('스펙 §9의 16개 조항이 모두 있고 핵심 문구를 담는다', () => {
  expect(FUNDING_TERMS_SECTIONS).toHaveLength(16);
  const all = FUNDING_TERMS_SECTIONS.map((s) => `${s.heading}\n${s.body.join('\n')}`).join('\n');
  for (const must of ['통신판매', '기부가 아닙니다', '기부금영수증', 'Keep-it-All', '청약철회', '7일', '3개월', '30일', '3영업일', '리워드 전달 완료 후 1년']) {
    expect(all).toContain(must);
  }
});

// 제13조가 처리방침의 **없는** 절 제목("펀딩(리워드 선주문) 개인정보 처리")을 문자열로
// 복제해 가리키고 있었다. 지금은 정본에서 제목을 끌어오므로, 처리방침에서 항을
// 추가·개명해도 약관 문장이 함께 따라온다. 그 연결이 끊기는 것을 여기서 잡는다.
describe('제13조가 가리키는 처리방침 항', () => {
  const clause13 = FUNDING_TERMS_SECTIONS.find((s) => s.heading.startsWith('제13조'))!.body.join('\n');
  const fundingHeadings = POLICY_COPY_BY_LOCALE.ko.sections
    .map((s) => s.heading)
    .filter((h) => /^\d+\. 펀딩/.test(h));

  it('처리방침에 실제로 존재하는 항 제목만 가리킨다', () => {
    expect(fundingHeadings.length).toBeGreaterThanOrEqual(2);
    expect(clause13).toContain(FUNDING_PRIVACY_SECTION_REFERENCE);
    expect(FUNDING_PRIVACY_SECTION_REFERENCE).toContain(fundingHeadings[0]);
    expect(FUNDING_PRIVACY_SECTION_REFERENCE).toContain(fundingHeadings[fundingHeadings.length - 1]);
  });

  it('없는 절 제목을 다시 박아 넣지 않는다', () => {
    expect(clause13).not.toContain('펀딩(리워드 선주문) 개인정보 처리" 절');
  });
});

// 제4조가 "사업자 정보는 이 페이지 하단과 사이트 푸터에 표시합니다"라고 말하므로, 푸터에만
// 있고 이 <dl>에 없으면 통신판매 페이지의 약관이 스스로 틀린 말을 한다(전자상거래법 제10조).
describe('펀딩 약관 페이지의 사업자 정보 블록', () => {
  it('호스팅서비스 제공자를 표시한다', () => {
    render(<FundingTermsPage locale="ko" />);
    expect(screen.getByText('호스팅서비스 제공자')).toBeInTheDocument();
    expect(screen.getByText(hostingProvider.name)).toBeInTheDocument();
  });

  it('제4조가 약속한 항목이 모두 이 블록에 있다', () => {
    render(<FundingTermsPage locale="ko" />);
    for (const label of ['상호', '대표자', '주소', '연락처', '사업자등록번호', '통신판매업신고']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
