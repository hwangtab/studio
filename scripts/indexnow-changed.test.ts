/** @jest-environment node */

import { mapChangedFilesToUrls, parseNameStatus } from './indexnow-changed.mjs';

/**
 * indexnow-changed.mjs의 매핑 규칙 단위 테스트.
 *
 * 전량 반복 제출은 스팸성이라 금지(scripts/indexnow-submit.mjs 헤더 참고)라서, 이 스크립트는
 * git diff로 실제 바뀐 파일만 URL로 좁힌다. 매핑 규칙이 넓어지면(예: common.json 같은 공유
 * 파일이 실수로 매핑되면) 그 좁힘이 무너져 전량 제출과 다를 바 없어진다 — 그래서 "무엇을
 * 제외하는가"가 "무엇을 포함하는가"만큼 중요하다.
 */
describe('parseNameStatus', () => {
  it('parses added/modified/deleted lines', () => {
    const raw = [
      'A\tcontent/stories/new-story1.md',
      'M\tpages/[locale]/pricing.tsx',
      'D\tcontent/stories/removed1.md',
    ].join('\n');
    expect(parseNameStatus(raw)).toEqual([
      { status: 'A', path: 'content/stories/new-story1.md' },
      { status: 'M', path: 'pages/[locale]/pricing.tsx' },
      { status: 'D', path: 'content/stories/removed1.md' },
    ]);
  });

  it('takes the new path for renames/copies (status\\told\\tnew)', () => {
    const raw = 'R100\tcontent/stories/old-slug1.md\tcontent/stories/new-slug1.md';
    expect(parseNameStatus(raw)).toEqual([
      { status: 'R', path: 'content/stories/new-slug1.md' },
    ]);
  });

  it('ignores blank lines and trims whitespace', () => {
    const raw = '\n\nA\tcontent/stories/a1.md\n\n';
    expect(parseNameStatus(raw)).toEqual([{ status: 'A', path: 'content/stories/a1.md' }]);
  });

  it('returns an empty array for empty diff output', () => {
    expect(parseNameStatus('')).toEqual([]);
    expect(parseNameStatus('\n')).toEqual([]);
  });
});

describe('mapChangedFilesToUrls', () => {
  it('maps a story file to its ko URL', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'M', path: 'content/stories/mixing19.md' },
    ]);
    expect(urls).toEqual(['https://studionol.co.kr/ko/stories/mixing19']);
  });

  it('excludes deleted story files', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'D', path: 'content/stories/removed1.md' },
    ]);
    expect(urls).toEqual([]);
  });

  it('excludes non-ko locale story originals (<slug>.en.md 등)', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'A', path: 'content/stories/foreign-guide1.en.md' },
      { status: 'A', path: 'content/stories/foreign-guide2.zh.md' },
      { status: 'A', path: 'content/stories/foreign-guide3.uz.md' },
    ]);
    expect(urls).toEqual([]);
  });

  it('maps a static top-level route to its ko URL', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'M', path: 'pages/[locale]/wedding-song.tsx' },
    ]);
    expect(urls).toEqual(['https://studionol.co.kr/ko/wedding-song']);
  });

  it('maps pages/[locale]/index.tsx to the bare /ko URL (no trailing /index)', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'M', path: 'pages/[locale]/index.tsx' },
    ]);
    expect(urls).toEqual(['https://studionol.co.kr/ko']);
  });

  it('also submits the /en URL for routes whitelisted in lib/enIndexablePaths.json', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'M', path: 'pages/[locale]/recording.tsx' },
    ]);
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://studionol.co.kr/ko/recording',
        'https://studionol.co.kr/en/recording',
      ])
    );
    expect(urls).toHaveLength(2);
  });

  it('does not add an /en URL for routes not in the whitelist', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'M', path: 'pages/[locale]/lesson.tsx' },
    ]);
    expect(urls).toEqual(['https://studionol.co.kr/ko/lesson']);
  });

  it('excludes dynamic/nested routes under pages/[locale]/ (booking, contracts, portfolio, stories, guides, release-project)', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'M', path: 'pages/[locale]/booking/index.tsx' },
      { status: 'M', path: 'pages/[locale]/contracts/[id].tsx' },
      { status: 'M', path: 'pages/[locale]/portfolio/[id].tsx' },
      { status: 'M', path: 'pages/[locale]/stories/[slug].tsx' },
      { status: 'M', path: 'pages/[locale]/guides/[slug].tsx' },
      { status: 'M', path: 'pages/[locale]/release-project/single.tsx' },
    ]);
    expect(urls).toEqual([]);
  });

  it('does not map public/locales/ko/common.json (shared across every page)', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'M', path: 'public/locales/ko/common.json' },
    ]);
    expect(urls).toEqual([]);
  });

  it('ignores files outside the known mapping rules', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'M', path: 'lib/pricing.ts' },
      { status: 'A', path: 'README.md' },
      { status: 'M', path: 'components/ui/BaseCard.tsx' },
    ]);
    expect(urls).toEqual([]);
  });

  it('deduplicates URLs', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'M', path: 'pages/[locale]/wedding-song.tsx' },
      { status: 'M', path: 'pages/[locale]/wedding-song.tsx' },
    ]);
    expect(urls).toEqual(['https://studionol.co.kr/ko/wedding-song']);
  });

  // 회귀 방지(2026-09-14 적발): privacy-policy·terms는 SEO noindex라 next-sitemap
  // exclude에서도 빠져 있는데, IndexNow는 조건 없이 제출하고 있었다. 사이트맵에서 뺀
  // 라우트를 검색엔진에 색인 요청으로 미는 것은 신호가 모순이다.
  it('excludes noindex static routes (privacy-policy, terms) — 사이트맵과 동일 정책', () => {
    const urls = mapChangedFilesToUrls([
      { status: 'M', path: 'pages/[locale]/privacy-policy.tsx' },
      { status: 'M', path: 'pages/[locale]/terms.tsx' },
    ]);
    expect(urls).toEqual([]);
  });
});

// lib/sitemap/noindexStaticRoutes.json이 이 스크립트와 next-sitemap.config.js의
// exclude 목록 양쪽에서 같은 값을 보게 하는 단일 소스다. 값 자체가 두 정책을 가르는
// 기준이므로, 파일 내용이 예상과 다르면(오타·삭제) 조용히 통과시키지 않는다.
describe('lib/sitemap/noindexStaticRoutes.json', () => {
  it('privacy-policy·terms를 담고 있다', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const noindexStaticRoutes = require('../lib/sitemap/noindexStaticRoutes.json');
    expect(noindexStaticRoutes.sort()).toEqual(['privacy-policy', 'terms']);
  });
});
