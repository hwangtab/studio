import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReleaseProducerIntro from './ReleaseProducerIntro';

describe('ReleaseProducerIntro', () => {
  it('renders producer copy and stats in the shared release section', () => {
    render(
      <ReleaseProducerIntro
        sectionTitle="프로듀서 소개"
        tagline="15년차 프로듀서"
        bodyParagraphs={['첫 번째 설명', '두 번째 설명']}
        stats={[
          { value: '70+', label: '발매 프로젝트' },
          { value: '15y', label: '경력' },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: '프로듀서 소개' })).toBeInTheDocument();
    expect(screen.getByText('15년차 프로듀서')).toBeInTheDocument();
    expect(screen.getByText('첫 번째 설명')).toBeInTheDocument();
    expect(screen.getByText('70+')).toBeInTheDocument();
    expect(screen.getByText('발매 프로젝트')).toBeInTheDocument();
  });
});
