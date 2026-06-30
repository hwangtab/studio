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
});
