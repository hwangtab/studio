import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ServiceLinkPill, { serviceLinkPillClass, type ServiceLinkTone } from './ServiceLinkPill';

/**
 * 이 pill은 접근성 회귀 두 번의 진원지였다(정본 §1 3라운드·§5). 세 규칙을 렌더 결과
 * className으로 고정한다 — 컴포넌트 안에서 토큰을 "정리"하다 조용히 깨지는 것을 막는다.
 */
const TONES: { tone: ServiceLinkTone; darkText: string; ring: string; darkRing: string }[] = [
  {
    tone: 'primary',
    darkText: 'dark:text-primary-lighter',
    ring: 'focus-visible:ring-primary/70',
    darkRing: 'dark:focus-visible:ring-primary-lighter/70',
  },
  {
    tone: 'secondary',
    darkText: 'dark:text-secondary-light',
    ring: 'focus-visible:ring-secondary/70',
    darkRing: 'dark:focus-visible:ring-secondary-light/70',
  },
  {
    tone: 'accent',
    darkText: 'dark:text-accent-light',
    ring: 'focus-visible:ring-accent/70',
    darkRing: 'dark:focus-visible:ring-accent-light/70',
  },
];

const classesOf = (tone: ServiceLinkTone, className?: string): string[] => {
  render(
    <ServiceLinkPill href="/ko/pricing" tone={tone} className={className}>
      라벨
    </ServiceLinkPill>,
  );
  return (screen.getByRole('link').getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
};

describe.each(TONES)('ServiceLinkPill — $tone', ({ tone, darkText, ring, darkRing }) => {
  it('focus-visible 포커스 링을 준다 (정본 §5 — 45곳 전부 빠져 있던 결함)', () => {
    const classes = classesOf(tone);
    for (const required of [
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-offset-2',
      'focus-visible:ring-offset-white',
      'dark:focus-visible:ring-offset-gray-900',
      ring,
      darkRing,
    ]) {
      expect(classes).toContain(required);
    }
  });

  it('dark:hover:text-white을 함께 둔다 (없으면 다크 hover 대비가 1.7~2.6:1로 무너진다)', () => {
    const classes = classesOf(tone);
    expect(classes).toContain('hover:text-white');
    expect(classes).toContain('dark:hover:text-white');
  });

  it('다크 텍스트 토큰은 -lighter/-light다 (DEFAULT·-light 승격 전 값은 AA 미달)', () => {
    const classes = classesOf(tone);
    expect(classes).toContain(darkText);
    // 실패했던 값들이 되돌아오지 않는지 직접 본다.
    for (const forbidden of [
      `dark:text-${tone}`,
      'dark:text-primary-light',
      'dark:text-accent',
    ]) {
      if (forbidden === darkText) continue;
      expect(classes).not.toContain(forbidden);
    }
  });

  it('44px 터치 타깃을 보장한다', () => {
    expect(classesOf(tone)).toContain('min-h-[44px]');
  });
});

describe('ServiceLinkPill — 동작', () => {
  it('기본으로 화살표를 렌더하고 showArrow={false}면 뺀다', () => {
    const { container } = render(
      <ServiceLinkPill href="/ko/pricing">라벨</ServiceLinkPill>,
    );
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();

    const bare = render(
      <ServiceLinkPill href="/ko/contact" showArrow={false}>라벨</ServiceLinkPill>,
    );
    expect(bare.container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('className은 twMerge로 합쳐져 충돌 유틸리티가 뒤에서 이긴다', () => {
    const merged = serviceLinkPillClass('primary', 'px-5 py-2.5 touch-manipulation');
    expect(merged).toContain('px-5');
    expect(merged).toContain('py-2.5');
    expect(merged).not.toContain('px-6');
    expect(merged).not.toContain('py-3');
    // 덮어써도 색 3규칙과 포커스 링은 남는다.
    expect(merged).toContain('dark:hover:text-white');
    expect(merged).toContain('focus-visible:ring-primary/70');
    expect(merged).toContain('dark:focus-visible:ring-primary-lighter/70');
    expect(merged).toContain('min-h-[44px]');
  });
});
