import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReleaseHeroCtas from './ReleaseHeroCtas';

describe('ReleaseHeroCtas', () => {
  it('uses KakaoTalk as the Korean consultation path', () => {
    render(
      <ReleaseHeroCtas
        locale="ko"
        kakaoUrl="https://open.kakao.com/me/nol"
        consultLabel="상담하기"
        secondaryHref="/ko/portfolio"
        secondaryLabel="포트폴리오"
      />
    );

    expect(screen.getByRole('link', { name: '상담하기' })).toHaveAttribute(
      'href',
      'https://open.kakao.com/me/nol'
    );
    expect(screen.getByRole('link', { name: '포트폴리오' })).toHaveAttribute('href', '/ko/portfolio');
  });

  it('uses localized contact page as the non-Korean consultation path', () => {
    render(
      <ReleaseHeroCtas
        locale="en"
        kakaoUrl="https://open.kakao.com/me/nol"
        consultLabel="Consult"
        secondaryHref="/en/release-project"
        secondaryLabel="Back to hub"
      />
    );

    expect(screen.getByRole('link', { name: 'Consult' })).toHaveAttribute('href', '/en/contact');
  });
});
