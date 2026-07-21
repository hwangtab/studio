import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageHero from './ImageHero';
import { markNavigated, resetNavigatedForTests } from '../../lib/navigationState';

describe('ImageHero 전환 번쩍임 방지', () => {
  afterEach(() => {
    resetNavigatedForTests();
  });

  it('이미지 로드 전에도 섹션이 어두운 배경을 가진다', () => {
    const { container } = render(
      <ImageHero title="제목" backgroundImage="/images/test.webp" />
    );
    expect(container.querySelector('section')).toHaveClass('bg-gray-900');
  });

  it('첫 로드(SSR)에서는 이미지가 즉시 보인다 — LCP 보호', () => {
    const { container } = render(
      <ImageHero title="제목" backgroundImage="/images/test.webp" />
    );
    const img = container.querySelector('img');
    expect(img).toHaveClass('opacity-100');
    expect(img).not.toHaveClass('opacity-0');
  });

  it('클라이언트 내비게이션 후 mount된 히어로는 로드 완료 시 페이드인한다', async () => {
    markNavigated();
    const { container } = render(
      <ImageHero title="제목" backgroundImage="/images/test.webp" />
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toHaveClass('opacity-0');
    // next/image는 onLoad를 img.decode() 프로미스 뒤에 호출하므로 비동기 대기 필요
    fireEvent.load(img);
    await waitFor(() => expect(img).toHaveClass('opacity-100'));
  });
});
