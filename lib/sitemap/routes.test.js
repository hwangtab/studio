/** @jest-environment node */

const {
  SITE_URL,
  getAlternateRefs,
  getIndexableStoryLocales,
} = require('./routes');
const sitemapConfig = require('../../next-sitemap.config.js');

// native-only 정책: ko 원본(slug.md) 없는 스토리만 native locale에서 색인·사이트맵 등재.
// 번역본(ko 원본 존재)의 비-ko 페이지는 site-wide noindex 정책 유지 → 미등재.
// 픽스처는 실제 콘텐츠 파일: korean-practice-room-booking-english(.en.md만),
// recording-in-seoul-for-chinese-musicians(.zh.md만), global-release1(.md + .en.md).

describe('getIndexableStoryLocales — native-only 예외 정책', () => {
  it('returns only the native locale for ko-less native-only stories', () => {
    expect(getIndexableStoryLocales('korean-practice-room-booking-english')).toEqual(['en']);
    expect(getIndexableStoryLocales('recording-in-seoul-for-chinese-musicians')).toEqual(['zh']);
  });

  it('returns only ko for translated stories even when native translations exist', () => {
    expect(getIndexableStoryLocales('global-release1')).toEqual(['ko']);
  });
});

describe('getAlternateRefs — native-only story hreflang', () => {
  it('emits a single self-referencing native hreflang without x-default (ko 비색인 → dangling 방지)', () => {
    const refs = getAlternateRefs('/en/stories/korean-practice-room-booking-english');
    expect(refs).toEqual([
      {
        href: `${SITE_URL}/en/stories/korean-practice-room-booking-english`,
        hreflang: 'en',
        hrefIsAbsolute: true,
      },
    ]);
  });

  it('keeps translated stories on ko + x-default only (비-ko alternate 없음)', () => {
    const refs = getAlternateRefs('/ko/stories/global-release1');
    const hreflangs = refs.map((ref) => ref.hreflang);
    expect(hreflangs).toEqual(['ko', 'x-default']);
    refs.forEach((ref) => {
      expect(ref.href).toBe(`${SITE_URL}/ko/stories/global-release1`);
    });
  });
});

describe('getAlternateRefs — 상업 3페이지 en 선별 색인 (4-1)', () => {
  it('emits ko + en + x-default for whitelisted commercial pages (both locales)', () => {
    for (const routePath of ['/ko/pricing', '/en/pricing', '/en/release-project']) {
      const refs = getAlternateRefs(routePath);
      const hreflangs = refs.map((ref) => ref.hreflang);
      expect(hreflangs).toEqual(['ko', 'en', 'x-default']);
    }
  });

  it('keeps non-whitelisted pages on ko + x-default only', () => {
    const refs = getAlternateRefs('/en/lesson');
    expect(refs.map((ref) => ref.hreflang)).toEqual(['ko', 'x-default']);
  });
});

describe('additionalPaths — sitemap 등재 ⇔ 색인 가능 불변식', () => {
  let locs;

  beforeAll(async () => {
    const results = await sitemapConfig.additionalPaths();
    locs = new Set(results.map((entry) => entry.loc));
  });

  it('등재: native-only 스토리의 native URL', () => {
    expect(locs.has('/en/stories/korean-practice-room-booking-english')).toBe(true);
    expect(locs.has('/zh/stories/recording-in-seoul-for-chinese-musicians')).toBe(true);
  });

  it('미등재: native-only 스토리의 ko/타 locale URL (해당 페이지는 404/noindex)', () => {
    expect(locs.has('/ko/stories/korean-practice-room-booking-english')).toBe(false);
    expect(locs.has('/es/stories/korean-practice-room-booking-english')).toBe(false);
  });

  it('번역본 스토리는 기존대로 ko만 등재, 비-ko(noindex) URL 미등재', () => {
    expect(locs.has('/ko/stories/global-release1')).toBe(true);
    expect(locs.has('/en/stories/global-release1')).toBe(false);
  });
});

// 페이지 라우트 lastmod은 lib/sitemap/pageLastmod.json(git 이력에서 생성·커밋)에서 온다.
// 이 테스트는 CI에서 git 이력 없이도 도는 구조 검증이다 — 라우트를 추가하고
// scripts/generate-page-lastmod.mjs 재실행을 잊으면 여기서 잡힌다.
describe('페이지 라우트 lastmod 커버리지', () => {
  const { collectSourceFiles } = require('../../scripts/pageLastmodSources');
  const pageLastmod = require('./pageLastmod.json');

  it('모든 라우트 소스 파일에 커밋된 lastmod 항목이 있다', () => {
    const missing = collectSourceFiles().filter((file) => !pageLastmod[file]);
    expect(missing).toEqual([]);
  });

  it('JSON에 저장소에서 사라진 파일의 죽은 항목이 없다', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const stale = Object.keys(pageLastmod).filter(
      (file) => !fs.existsSync(path.join(process.cwd(), file))
    );
    expect(stale).toEqual([]);
  });

  it('lastmod이 빌드 시각이 아니라 실제 커밋 날짜로 분산돼 있다', () => {
    const { getRouteLastmod } = require('./routes');
    const buildTimestamp = 'BUILD_TIMESTAMP';
    const routes = ['/ko/pricing', '/ko/recording', '/ko/mixing-mastering', '/ko/about', '/ko/portfolio'];
    const values = routes.map((r) => getRouteLastmod(r, buildTimestamp));
    // 폴백으로 떨어진 라우트가 없어야 하고, 전부 같은 값이면 가짜 freshness다.
    expect(values).not.toContain(buildTimestamp);
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});
