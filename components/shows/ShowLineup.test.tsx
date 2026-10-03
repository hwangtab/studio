import { render, screen } from '@testing-library/react';

import ShowLineup from './ShowLineup';

describe('ShowLineup', () => {
  const performers = [
    { name: '자이(Jai)', bio: '싱어송라이터', photo: '/images/shows/bakkeoji-jai-20261003.webp' },
    { name: '게스트', bio: null },
  ];

  it('사진이 있는 출연자는 사진과 소개를, 없는 출연자는 이름만 보여 준다', () => {
    const { container } = render(<ShowLineup performers={performers} />);
    expect(screen.getByAltText('자이(Jai) 프로필 사진')).toBeTruthy();
    expect(screen.getByText('싱어송라이터')).toBeTruthy();
    expect(screen.getByText('게스트')).toBeTruthy();
    expect(container.querySelectorAll('img').length).toBe(1);
  });

  it('SNS가 있으면 카드 전체가 새 탭 링크다', () => {
    render(<ShowLineup performers={[{ name: '호와호', sns: 'https://www.instagram.com/howaho/' }]} />);
    const link = screen.getByRole('link', { name: /호와호/ });
    expect(link.getAttribute('href')).toBe('https://www.instagram.com/howaho/');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('출연자가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<ShowLineup performers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
