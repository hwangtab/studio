import { render, screen } from '@testing-library/react';
import FundingLineupPerson from './FundingLineupPerson';

describe('FundingLineupPerson', () => {
  it('이름과 소개를 함께 보여준다', () => {
    render(<FundingLineupPerson id="mok-jareugi-yangchaae" />);
    expect(screen.getByText('양차애')).toBeTruthy();
    expect(screen.getByText(/사랑노래를 짓고 부릅니다/)).toBeTruthy();
    expect(screen.getByAltText('양차애 프로필 사진')).toBeTruthy();
  });

  it('사진이 둘인 듀오는 사진 두 장을 모두 보여준다', () => {
    // 보조 사진(alt="")은 pine-nut과 같은 이유로 접근성 트리에서 빠진다 — 이름이 이미
    // 두 사람을 함께 말하므로, DOM에 img 태그 두 개가 있는지로 확인한다.
    const { container } = render(<FundingLineupPerson id="mok-jareugi-dj-duo" />);
    expect(screen.getByText('DJ스탑원 x DJ괄')).toBeTruthy();
    expect(container.querySelectorAll('img').length).toBe(2);
  });

  it('모르는 id는 아무것도 렌더하지 않는다', () => {
    const { container } = render(<FundingLineupPerson id="not-a-real-id" />);
    expect(container).toBeEmptyDOMElement();
  });
});
