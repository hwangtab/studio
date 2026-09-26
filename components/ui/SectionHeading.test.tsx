import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LazyMotion, domAnimation } from 'framer-motion';

import SectionHeading from './SectionHeading';
import { DesignEditionContext } from '../../lib/designEdition';

// v1 경로는 framer의 whileInView를 쓰는데 jsdom에는 IntersectionObserver가 없다.
beforeAll(() => {
  // @ts-expect-error 테스트용 전역 stub
  global.IntersectionObserver ??= function () {
    return { observe: () => {}, unobserve: () => {}, disconnect: () => {} };
  };
});

const renderIn = (edition: 'v1' | 'v2' | null, ui: React.ReactElement) =>
  render(
    <LazyMotion features={domAnimation}>
      {edition ? <DesignEditionContext.Provider value={edition}>{ui}</DesignEditionContext.Provider> : ui}
    </LazyMotion>,
  );

describe('SectionHeading — 디자인 판 분기', () => {
  it('컨텍스트가 없으면 v1 그대로다(그라디언트 제목, eyebrow 무시)', () => {
    const { container } = renderIn(null, <SectionHeading title="제목" eyebrow="서비스" index="04" />);
    const h2 = screen.getByRole('heading', { level: 2, name: '제목' });
    expect(h2.className).toMatch(/bg-clip-text/);
    expect(container.querySelector('.typo-eyebrow')).toBeNull();
    expect(container.textContent).not.toContain('서비스');
  });

  it('v1 컨텍스트와 컨텍스트 없음은 같은 마크업을 낸다', () => {
    const a = renderIn(null, <SectionHeading title="제목" subtitle="부제" />).container.innerHTML;
    const b = renderIn('v1', <SectionHeading title="제목" subtitle="부제" />).container.innerHTML;
    expect(b).toBe(a);
  });

  it('v2는 그라디언트 없이 잉크 제목과 eyebrow를 낸다', () => {
    const { container } = renderIn('v2', <SectionHeading title="제목" eyebrow="서비스" index="04" />);
    const h2 = screen.getByRole('heading', { level: 2, name: '제목' });
    expect(h2.className).toMatch(/typo-display-section/);
    expect(container.innerHTML).not.toMatch(/bg-clip-text|bg-gradient/);
    const eyebrow = container.querySelector('.typo-eyebrow') as HTMLElement;
    // eyebrow는 heading이 아니다 — 제목 구조를 흐리지 않는다
    expect(eyebrow.tagName).toBe('P');
    expect(eyebrow).toHaveTextContent('서비스');
  });

  it('v2의 번호는 스크린리더에서 숨긴다', () => {
    const { container } = renderIn('v2', <SectionHeading title="제목" eyebrow="서비스" index="04" />);
    const num = [...container.querySelectorAll('[aria-hidden="true"]')].find((el) => el.textContent === '04');
    expect(num).toBeDefined();
  });

  it('v2는 원형 아이콘을 그리지 않는다', () => {
    const Icon = () => <svg data-testid="icon" />;
    renderIn('v2', <SectionHeading title="제목" icon={Icon} />);
    expect(screen.queryByTestId('icon')).toBeNull();
  });
});

/**
 * v2 경로의 색 규칙 가드 — 텍스트 그라디언트 0곳, 보라 단일 브랜드색.
 *
 * 디자인 회의 합의: 사이트에서 고채도 색은 카카오 옐로 하나만 남긴다. 핑크(secondary)·
 * 초록(accent)이 v2 파일에 다시 들어오면 "노란 건 카톡" 신호가 흐려지고, bg-clip-text는
 * forced-colors 모드에서 글자가 사라진다. v1 파일은 대상이 아니다(이행 전까지 그대로).
 */
describe('디자인 v2 파일 색 가드', () => {
  const ROOT = path.resolve(__dirname, '../..');
  const V2_FILES = [
    'components/home/HomeServiceTracklist.tsx',
    'components/home/HomeReleaseStrip.tsx',
    'components/home/HomeStudioSpec.tsx',
    'pages/[locale]/index.tsx',
  ];

  it.each(V2_FILES)('%s에 텍스트 그라디언트·secondary·accent가 없다', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(src).not.toMatch(/bg-clip-text/);
    expect(src).not.toMatch(/\b(?:text|bg|border|ring|from|via|to)-(?:secondary|accent)\b/);
    expect(src).not.toMatch(/tone="(?:secondary|accent)"/);
  });
});
