import { resolveSeoUrlState } from './metadataUrls';

describe('resolveSeoUrlState', () => {
  it('builds canonical and alternate paths from a localized canonical URL with query params', () => {
    const result = resolveSeoUrlState({
      asPath: '/ko/stories?page=2',
      canonical: '/ko/stories?page=2',
      siteUrl: 'https://studionol.co.kr',
      locale: 'ko',
    });

    expect(result.currentLocale).toBe('ko');
    expect(result.normalizedCanonical).toBe('https://studionol.co.kr/ko/stories?page=2');
    expect(result.alternatePath).toBe('/stories?page=2');
    expect(result.indexableAlternateLocales).toEqual(['ko']);
    expect(result.alternateHrefFor('ko')).toBe('https://studionol.co.kr/ko/stories?page=2');
    expect(result.xDefaultHref).toBe('https://studionol.co.kr/ko/stories?page=2');
  });

  it('keeps canonical while suppressing alternates when no indexable locale is available', () => {
    const result = resolveSeoUrlState({
      asPath: '/en/stories/en-only',
      canonical: '/en/stories/en-only',
      siteUrl: 'https://studionol.co.kr',
      locale: 'en',
      availableLocales: ['en'],
    });

    expect(result.currentLocale).toBe('en');
    expect(result.effectiveRobots('index, follow')).toBe('noindex, follow');
    expect(result.normalizedCanonical).toBe('https://studionol.co.kr/en/stories/en-only');
    expect(result.indexableAlternateLocales).toEqual([]);
    expect(result.alternateHrefFor('ko')).toBeNull();
    expect(result.xDefaultHref).toBeNull();
  });

  it('allows indexing with a self-referencing hreflang for native-only pages (allowNonDefaultLocaleIndexing)', () => {
    // ko 원본 없는 native-only 스토리의 native locale 페이지 — site-wide 비-ko noindex의 예외.
    const result = resolveSeoUrlState({
      asPath: '/en/stories/korean-practice-room-booking-english',
      canonical: '/en/stories/korean-practice-room-booking-english',
      siteUrl: 'https://studionol.co.kr',
      locale: 'en',
      availableLocales: ['en'],
      allowNonDefaultLocaleIndexing: true,
    });

    expect(result.effectiveRobots('index, follow')).toBe('index, follow');
    expect(result.indexableAlternateLocales).toEqual(['en']);
    expect(result.alternateHrefFor('en')).toBe(
      'https://studionol.co.kr/en/stories/korean-practice-room-booking-english'
    );
    // ko가 비가용이므로 x-default 없음 — dangling alternate 방지.
    expect(result.xDefaultHref).toBeNull();
  });

  it('keeps translated non-ko pages noindex when the native-only flag is off (default)', () => {
    // 번역본(ko 원본 존재) 스토리의 비-ko 페이지 — 예외 비대상, 기존 정책 유지.
    const result = resolveSeoUrlState({
      asPath: '/en/stories/global-release1',
      canonical: '/en/stories/global-release1',
      siteUrl: 'https://studionol.co.kr',
      locale: 'en',
      availableLocales: ['ko', 'en'],
    });

    expect(result.effectiveRobots('index, follow')).toBe('noindex, follow');
    expect(result.indexableAlternateLocales).toEqual(['ko']);
  });

  it('prefers explicit locale over the router path when SSR path data is stale', () => {
    const result = resolveSeoUrlState({
      asPath: '/ko/voice-acting',
      canonical: '/en/voice-acting/',
      siteUrl: 'https://studionol.co.kr',
      locale: 'en',
    });

    expect(result.currentLocale).toBe('en');
    expect(result.pathWithoutLocale).toBe('/voice-acting');
    expect(result.normalizedCanonical).toBe('https://studionol.co.kr/en/voice-acting');
    expect(result.alternatePath).toBe('/voice-acting');
  });

  // 4-1: 상업 3페이지(/pricing·/contact·/release-project)의 en 선별 색인 개방 + reciprocal hreflang.
  it('opens en indexing for whitelisted commercial pages with ko+en reciprocal hreflang', () => {
    const en = resolveSeoUrlState({
      asPath: '/en/pricing',
      canonical: '/en/pricing',
      siteUrl: 'https://studionol.co.kr',
      locale: 'en',
    });
    expect(en.effectiveRobots('index, follow')).toBe('index, follow');
    expect(en.indexableAlternateLocales).toEqual(['ko', 'en']);
    expect(en.xDefaultHref).toBe('https://studionol.co.kr/ko/pricing');

    // ko 렌더도 en alternate를 되받아야 reciprocal이 성립.
    const ko = resolveSeoUrlState({
      asPath: '/ko/pricing',
      canonical: '/ko/pricing',
      siteUrl: 'https://studionol.co.kr',
      locale: 'ko',
    });
    expect(ko.effectiveRobots('index, follow')).toBe('index, follow');
    expect(ko.indexableAlternateLocales).toEqual(['ko', 'en']);
    expect(ko.alternateHrefFor('en')).toBe('https://studionol.co.kr/en/pricing');
  });

  it('resolves the commercial whitelist from canonical, not asPath (SSG asPath fallback safe)', () => {
    // SSG 중 asPath가 ''/'/ko'로 폴백돼도 canonical이 신뢰 가능하면 색인 결정이 유지돼야 한다.
    for (const asPath of ['', '/ko', '/en/pricing']) {
      const result = resolveSeoUrlState({
        asPath,
        canonical: '/en/pricing',
        siteUrl: 'https://studionol.co.kr',
        locale: 'en',
      });
      expect(result.effectiveRobots('index, follow')).toBe('index, follow');
      expect(result.indexableAlternateLocales).toEqual(['ko', 'en']);
    }
  });

  it('keeps non-whitelisted en pages noindex with ko-only hreflang', () => {
    const result = resolveSeoUrlState({
      asPath: '/en/lesson',
      canonical: '/en/lesson',
      siteUrl: 'https://studionol.co.kr',
      locale: 'en',
    });
    expect(result.effectiveRobots('index, follow')).toBe('noindex, follow');
    expect(result.indexableAlternateLocales).toEqual(['ko']);
  });
});
