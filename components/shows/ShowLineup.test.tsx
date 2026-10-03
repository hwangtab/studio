import { render, screen } from '@testing-library/react';

import ShowLineup from './ShowLineup';

describe('ShowLineup', () => {
  const performers = [
    { name: '자이(Jai)', bio: '싱어송라이터' },
    { name: '모르는 사람', bio: null },
  ];

  it('등록된 출연자는 사진과 소개를, 이름이 안 맞는 출연자는 사진 없이 이름만 보여 준다', () => {
    const { container } = render(<ShowLineup slug="bakkeoji-anneun-maeumdeul" performers={performers} />);
    expect(screen.getByAltText('자이(Jai) 프로필 사진')).toBeTruthy();
    expect(screen.getByText('싱어송라이터')).toBeTruthy();
    expect(screen.getByText('모르는 사람')).toBeTruthy();
    // 사진 칸은 등록된 한 사람에게만 있다.
    expect(container.querySelectorAll('img').length).toBe(1);
  });

  it('사진 등록이 없는 공연도 깨지지 않고 글만 그린다', () => {
    const { container } = render(<ShowLineup slug="no-such-show" performers={performers} />);
    expect(container.querySelectorAll('img').length).toBe(0);
    expect(screen.getByText('자이(Jai)')).toBeTruthy();
  });

  it('출연자가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<ShowLineup slug="bakkeoji-anneun-maeumdeul" performers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
