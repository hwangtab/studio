import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ArtistCard from './ArtistCard';

const artist = {
  slug: 'sample-band', name: '샘플 밴드', tagline: '연신내의 기타 팝',
  image: '/images/artists/sample-band.jpg',
};

describe('ArtistCard', () => {
  it('이름·태그라인을 보여주고 아티스트 페이지로 링크한다', () => {
    render(<ArtistCard artist={artist} locale="ko" viewProfileLabel="소개 보기" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ko/artists/sample-band');
    expect(screen.getByText('샘플 밴드')).toBeInTheDocument();
    expect(screen.getByText('연신내의 기타 팝')).toBeInTheDocument();
  });
});
