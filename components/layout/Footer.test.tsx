/**
 * 푸터 링크 중복 가드.
 *
 * 2026-09-11 헤더 IA 재정렬에서 아티스트 블록(후원·펀딩)이 ko 푸터에 **두 벌**
 * 렌더됐다. main을 브랜치에 병합하며 충돌을 푸는 과정에서 같은 블록이 한 번 더
 * 붙었고, 타입체크·기존 테스트·빌드가 전부 통과해 ko 전 페이지에 그대로 나갔다.
 * 사람 눈으로만 보이는 결함이라 자동 검사가 없으면 다음에도 같은 식으로 샌다.
 *
 * 링크 목록을 고정하지 않고 "중복이 없다"만 본다 — 푸터에 항목을 더하는 것은
 * 일상적인 변경이라 목록을 박아 두면 테스트가 방해가 된다.
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { Footer } from './Footer';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

jest.mock('next/link', () => {
  const Link = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = 'Link';
  return { __esModule: true, default: Link };
});

const hrefsIn = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('a[href]'))
    .map((a) => a.getAttribute('href') ?? '')
    .filter((href) => href.startsWith('/'));

describe('Footer', () => {
  afterEach(cleanup);

  it.each(['ko', 'en'] as const)('%s 푸터에 같은 내부 링크가 두 번 나오지 않는다', (locale) => {
    render(<Footer locale={locale} />);
    const hrefs = hrefsIn(screen.getByRole('contentinfo'));
    const seen = new Map<string, number>();
    for (const href of hrefs) seen.set(href, (seen.get(href) ?? 0) + 1);
    const duplicated = [...seen].filter(([, n]) => n > 1).map(([href, n]) => `${href} ×${n}`);
    expect(duplicated).toEqual([]);
  });

  it('결제 퍼널(후원·펀딩)은 ko에만 나온다', () => {
    render(<Footer locale="ko" />);
    const ko = hrefsIn(screen.getByRole('contentinfo'));
    expect(ko).toContain('/ko/artists');
    expect(ko).toContain('/ko/funding');
    cleanup();

    render(<Footer locale="en" />);
    const en = hrefsIn(screen.getByRole('contentinfo'));
    expect(en.some((h) => h.endsWith('/artists') || h.endsWith('/funding'))).toBe(false);
  });

  it('발매 티어는 전 로케일에 나온다 (2026-09-11에 ko 게이트를 풀었다)', () => {
    for (const locale of ['ko', 'en'] as const) {
      render(<Footer locale={locale} />);
      const hrefs = hrefsIn(screen.getByRole('contentinfo'));
      for (const tier of ['', '/single', '/ep', '/album']) {
        expect(hrefs).toContain(`/${locale}/release-project${tier}`);
      }
      cleanup();
    }
  });
});
