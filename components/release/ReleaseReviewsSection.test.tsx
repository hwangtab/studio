import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReleaseReviewsSection from './ReleaseReviewsSection';

describe('ReleaseReviewsSection', () => {
  it('renders release proof reviews with rating labels', () => {
    render(
      <ReleaseReviewsSection
        title="아티스트 후기"
        subtitle="함께 만든 사람들의 말"
        reviews={[
          {
            id: 'review-1',
            author: '아티스트 A',
            category: '녹음',
            content: '끝까지 같이 봐줬어요.',
            rating: 5,
          },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: '아티스트 후기' })).toBeInTheDocument();
    expect(screen.getByText(/끝까지 같이 봐줬어요/)).toBeInTheDocument();
    expect(screen.getByLabelText('5 / 5')).toBeInTheDocument();
  });

  it('renders nothing when there are no reviews', () => {
    const { container } = render(
      <ReleaseReviewsSection title="아티스트 후기" subtitle="없음" reviews={[]} />
    );

    expect(container.firstChild).toBeNull();
  });
});
