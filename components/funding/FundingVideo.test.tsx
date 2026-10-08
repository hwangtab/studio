import { fireEvent, render, screen } from '@testing-library/react';

import FundingVideo from './FundingVideo';

describe('FundingVideo', () => {
  it('누르기 전에는 유튜브 iframe을 열지 않고 썸네일 버튼만 그린다', () => {
    const { container } = render(<FundingVideo id="sabbaha-debt-shroud-live" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: /Debt Shroud.*영상 재생/ })).toBeInTheDocument();
  });

  it('누르면 youtube-nocookie iframe을 연다', () => {
    const { container } = render(<FundingVideo id="sabbaha-debt-shroud-live" />);
    fireEvent.click(screen.getByRole('button'));
    const frame = container.querySelector('iframe');
    expect(frame?.getAttribute('src')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/F8JH5d9pOt8\?/);
  });

  it('목록에 없는 id는 아무것도 그리지 않는다', () => {
    const { container } = render(<FundingVideo id="anything" />);
    expect(container.firstChild).toBeNull();
  });
});
