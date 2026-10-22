/**
 * 사이트맵 thin 판정(lib/sitemap/thinContent.js isStoryThin)과 실제 페이지의 noindex 판정
 * (lib/stories.ts getStoryDetail → isThinContent)이 원문이 있는 모든 (슬러그, 로케일)에서 같은가.
 *
 * 두 경로가 숏코드 글자 수 표를 따로 들고 있다가 갈라져(session-checklist 420 vs 160, 5종 누락)
 * 런타임 noindex 38편이 사이트맵에 실렸다(2026-10-22). 표는 이제 lib/storyShortcodeEstimates.json
 * 하나지만, 입력 본문 손질(썸네일 제거·fact token 등)이 갈라져도 같은 사고가 나므로 결과를 직접 대조한다.
 */
import { getStoryDetail, getStoryPaths } from '../stories';
import type { Locale } from '../i18n-config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isStoryThin } = require('./thinContent') as {
  isStoryThin: (slug: string, locale: string) => boolean;
};

describe('사이트맵 thin 판정 ↔ 페이지 noindex 판정', () => {
  it('원문이 있는 모든 조합에서 두 판정이 같다', async () => {
    const paths = getStoryPaths();
    expect(paths.length).toBeGreaterThan(500);

    const mismatches: string[] = [];
    for (const { params } of paths) {
      const { id: slug, locale } = params as { id: string; locale: Locale };
      const detail = await getStoryDetail(slug, locale);
      // robots: noindex 명시 글은 사이트맵이 thin=true로 빼고 페이지는 robots로 내린다 — 둘 다 비색인.
      const pageNoindex = detail.isThinContent || (typeof detail.robots === 'string' && /noindex/i.test(detail.robots));
      const sitemapExcluded = isStoryThin(slug, locale);
      if (pageNoindex !== sitemapExcluded) {
        mismatches.push(`${locale}/${slug}: 페이지 ${pageNoindex ? 'noindex' : '색인'} · 사이트맵 ${sitemapExcluded ? '제외' : '등재'}`);
      }
    }
    expect(mismatches).toEqual([]);
  }, 300_000);
});
