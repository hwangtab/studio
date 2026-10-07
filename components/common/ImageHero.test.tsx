import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageHero, { HERO_SCRIM } from './ImageHero';
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

describe('ImageHero 레이아웃 (라이너 노트 §3-3)', () => {
  afterEach(() => {
    resetNavigatedForTests();
  });

  it('split: 잉크 면(제목)이 사진보다 먼저 오고, 사진은 절반 폭 sizes로 요청한다', () => {
    const { container } = render(
      <ImageHero layout="split" title="제목" subtitle="부제" backgroundImage="/images/test.webp" />
    );
    const section = container.querySelector('section')!;
    expect(section).toHaveClass('bg-primary-dark');
    const h1 = section.querySelector('h1')!;
    const img = section.querySelector('img')!;
    // DOM 순서 = 모바일 스택 순서: 글자 → 사진. LCP 후보가 글자부터 그려진다.
    expect(h1.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(img.getAttribute('sizes')).toContain('50vw');
    // 글자가 사진 위에 앉지 않으므로 drop-shadow가 없다.
    expect(h1.className).not.toMatch(/drop-shadow/);
  });

  it('board: 사진 없이 잉크 면만 그리고, boardContent가 있으면 h1이 작아진다', () => {
    const { container } = render(
      <ImageHero layout="board" title="녹음 시간당 10만원" boardContent={<dl data-testid="board" />} />
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-testid="board"]')).not.toBeNull();
    const h1 = container.querySelector('h1')!;
    expect(h1.className).toMatch(/text-xl/);
    expect(h1.className).not.toMatch(/text-6xl/);
  });

  it('sleeve: 전면 사진 + 왼쪽 정렬 제목, 균일 스크림·drop-shadow 없음', () => {
    const { container } = render(
      <ImageHero layout="sleeve" title="제목" backgroundImage="/images/test.webp" overlayGradient={HERO_SCRIM} />
    );
    const section = container.querySelector('section')!;
    expect(section).toHaveClass('bg-gray-900');
    expect(section.querySelector('img')).not.toBeNull();
    const h1 = section.querySelector('h1')!;
    expect(h1.className).not.toMatch(/drop-shadow/);
    expect(h1.closest('.text-left')).not.toBeNull();
    // overlay 전용 균일 스크림(HERO_SCRIM)은 sleeve에서 쓰이지 않는다.
    expect(section.innerHTML).not.toContain('from-black/45');
  });

  it('어느 레이아웃에도 hero-zoom 장식이 없다', () => {
    for (const layout of ['overlay', 'split', 'sleeve'] as const) {
      const { container, unmount } = render(
        <ImageHero layout={layout} title="제목" backgroundImage="/images/test.webp" />
      );
      expect(container.innerHTML).not.toContain('hero-zoom');
      unmount();
    }
  });
});
