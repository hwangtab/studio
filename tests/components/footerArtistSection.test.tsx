import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Footer } from '../../components/layout/Footer';

/**
 * 회귀 방지: ko 푸터의 '아티스트' 블록(제목 + /ko/artists · /ko/funding 링크)이
 * 통째로 두 번 렌더된 사고(헤더 재구성 PR #72/#76 유입 추정, 2026-09-14 적발).
 * 화면 낭독기 사용자가 같은 소제목·링크를 두 번 듣고, 펀딩 허브로 가는 내부링크가
 * 모든 ko 페이지에서 2배로 나갔다. 소제목 텍스트가 '후원·선구매' 섹션과 같은 값을
 * 쓰므로(footer.sections.artist) getAllByText로 '아티스트' 소제목 자체의 등장 횟수를
 * 직접 단언한다.
 */
describe('푸터 아티스트 블록 (ko 전용) 중복 회귀', () => {
  it('ko에서 아티스트 링크가 각각 1개씩만 렌더된다', () => {
    render(<Footer locale="ko" />);
    expect(screen.getAllByRole('link', { name: 'nav.artists' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'nav.funding' })).toHaveLength(1);
  });

  it('ko에서 아티스트 소제목이 1개만 렌더된다', () => {
    render(<Footer locale="ko" />);
    expect(screen.getAllByText('footer.sections.artist')).toHaveLength(1);
  });

  it('비-ko 로케일에는 아티스트 블록 자체가 없다', () => {
    render(<Footer locale="en" />);
    expect(screen.queryByRole('link', { name: 'nav.artists' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nav.funding' })).not.toBeInTheDocument();
  });
});
