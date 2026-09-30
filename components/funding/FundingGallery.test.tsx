import { fireEvent, render, screen } from '@testing-library/react';

import FundingGallery from './FundingGallery';

describe('FundingGallery', () => {
  it('사진 14장을 격자로 내고, 모르는 id는 아무것도 그리지 않는다', () => {
    const { container, rerender } = render(<FundingGallery id="keep-singing-for-palestine" />);
    expect(screen.getAllByRole('button')).toHaveLength(14);
    rerender(<FundingGallery id="nope" />);
    expect(container.firstChild).toBeNull();
  });

  it('사진을 누르면 라이트박스가 열리고 좌우·Esc로 넘기고 닫는다', () => {
    render(<FundingGallery id="keep-singing-for-palestine" />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('1 / 14')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 14')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByText('14 / 14')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
