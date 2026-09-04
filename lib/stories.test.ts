/** @jest-environment node */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  extractAutoExpandBlock,
  computeThinContentStatus,
  getRelatedStories,
  getStoryAvailableLocales,
  getStoryDetail,
  getStoryPaths,
  THIN_CONTENT_THRESHOLD,
  SHORTCODE_CHAR_ESTIMATES,
} from './stories';

describe('extractAutoExpandBlock', () => {
  it('returns the source unchanged when no AUTO-EXPAND markers are present', () => {
    const src = '## Heading\n\nNormal body content.';
    const { stripped, block } = extractAutoExpandBlock(src);
    expect(stripped).toBe(src);
    expect(block).toBeNull();
  });

  it('strips a single AUTO-EXPAND block from the body and returns the inner text as block', () => {
    const src = [
      'lead paragraph',
      '<!-- AUTO-EXPAND-V1 -->',
      'common visit info',
      '<!-- /AUTO-EXPAND-V1 -->',
      'closing line',
    ].join('\n\n');

    const { stripped, block } = extractAutoExpandBlock(src);
    expect(stripped).not.toContain('AUTO-EXPAND');
    expect(stripped).toContain('lead paragraph');
    expect(stripped).toContain('closing line');
    expect(block).toBe('common visit info');
  });

  it('joins multiple AUTO-EXPAND blocks into a single block string', () => {
    const src = [
      'A',
      '<!-- AUTO-EXPAND-V1 -->',
      'first',
      '<!-- /AUTO-EXPAND-V1 -->',
      'B',
      '<!-- AUTO-EXPAND-V1 -->',
      'second',
      '<!-- /AUTO-EXPAND-V1 -->',
      'C',
    ].join('\n\n');

    const { stripped, block } = extractAutoExpandBlock(src);
    expect(stripped).not.toContain('AUTO-EXPAND');
    expect(stripped).toContain('A');
    expect(stripped).toContain('B');
    expect(stripped).toContain('C');
    expect(block).toContain('first');
    expect(block).toContain('second');
  });
});

describe('computeThinContentStatus', () => {
  it('flags content shorter than the threshold as thin', () => {
    const shortContent = 'short body'; // < 1500 chars
    const { isThinContent, charCount } = computeThinContentStatus(shortContent, 'some-slug');
    expect(isThinContent).toBe(true);
    expect(charCount).toBeLessThan(THIN_CONTENT_THRESHOLD);
  });

  it('does not flag content above the threshold as thin', () => {
    const longContent = 'a'.repeat(THIN_CONTENT_THRESHOLD + 100);
    const { isThinContent, charCount } = computeThinContentStatus(longContent, 'some-slug');
    expect(isThinContent).toBe(false);
    expect(charCount).toBeGreaterThanOrEqual(THIN_CONTENT_THRESHOLD);
  });

  it('counts non-whitespace characters only', () => {
    const padded = `${' '.repeat(2000)}body${'\n'.repeat(2000)}`;
    const { charCount } = computeThinContentStatus(padded, 'some-slug');
    expect(charCount).toBe('body'.length);
  });

  it('adds the configured bonus for known shortcodes', () => {
    const sessionBonus = SHORTCODE_CHAR_ESTIMATES['session-checklist'];
    const { charCount } = computeThinContentStatus('hi %%session-checklist%%', 'some-slug');
    // 'hi' (2 non-whitespace) + session-checklist literal length (excluding the %% wrapping)
    // is dominated by the bonus, so the total must be at least bonus + literal content count.
    expect(charCount).toBeGreaterThanOrEqual(sessionBonus);
  });

  it('falls back to a default bonus for unknown shortcodes', () => {
    const { charCount: withUnknown } = computeThinContentStatus(
      `${'a'.repeat(100)} %%unknown-shortcode%%`,
      'some-slug',
    );
    const { charCount: withoutShortcode } = computeThinContentStatus(
      'a'.repeat(100),
      'some-slug',
    );
    // The unknown shortcode raises the count above the no-shortcode baseline.
    expect(withUnknown).toBeGreaterThan(withoutShortcode);
  });

  it('exempts region hub slugs from the thin gate even with empty content', () => {
    // seoul1 is one of the documented region hub slugs in lib/regionHubSlugs.
    const { isThinContent } = computeThinContentStatus('', 'seoul1');
    expect(isThinContent).toBe(false);
  });

  it('still flags non-hub slugs with empty content as thin', () => {
    const { isThinContent } = computeThinContentStatus('', 'arbitrary-slug-no-hub');
    expect(isThinContent).toBe(true);
  });
});

describe('getStoryPaths', () => {
  it('does not pre-render default-locale paths for locale-only stories', () => {
    const paths = getStoryPaths();

    expect(paths).toContainEqual({
      params: { locale: 'en', id: 'korean-practice-room-booking-english' },
    });
    expect(paths).not.toContainEqual({
      params: { locale: 'ko', id: 'korean-practice-room-booking-english' },
    });
  });

  // 번역이 없는 로케일은 ko 본문을 noindex 폴백으로 보여줄 뿐이라 사이트맵에도 없다.
  // 그걸 빌드타임에 미리 만들면 색인 대상이 아닌 페이지 수천 장이 매 빌드마다 생긴다.
  // 목록에서 빠진 조합은 fallback: 'blocking'이 첫 요청에 만든다.
  it('only pre-renders locale/slug pairs whose own source file exists', () => {
    const storiesDir = join(process.cwd(), 'content/stories');
    const missing = getStoryPaths().filter(({ params }) => {
      const file = params.locale === 'ko'
        ? `${params.id}.md`
        : `${params.id}.${params.locale}.md`;
      return !existsSync(join(storiesDir, file));
    });

    expect(missing).toEqual([]);
  });

  it('does not return the slug x locale cross product', () => {
    const paths = getStoryPaths();
    const slugCount = new Set(paths.map((entry) => entry.params.id)).size;

    expect(paths.length).toBeLessThan(slugCount * 7);
  });
});

describe('getStoryDetail — native-only 색인 예외 (ko 원본 없는 스토리)', () => {
  it('marks a ko-less native story as isNativeOnly at its native locale (indexable)', async () => {
    const detail = await getStoryDetail('korean-practice-room-booking-english', 'en');
    expect(detail.isNativeOnly).toBe(true);
    expect(detail.isFallbackTranslation).toBe(false);
    expect(detail.isThinContent).toBe(false);
    expect(detail.sourceLocale).toBe('en');
  });

  it('keeps translated stories (ko original exists) isNativeOnly=false — 비-ko는 계속 noindex', async () => {
    const detail = await getStoryDetail('global-release1', 'en');
    expect(detail.isNativeOnly).toBe(false);
  });

  it('still fails the ko route for native-only stories (page returns notFound 404)', async () => {
    await expect(getStoryDetail('korean-practice-room-booking-english', 'ko'))
      .rejects.toThrow('Story file not found');
  });
});

describe('getStoryDetail — dateModified는 frontmatter lastmod에서만 온다', () => {
  // 예전에는 파일 mtime을 썼는데, git이 mtime을 보존하지 않아 Vercel이 배포할 때마다
  // 전 글의 dateModified가 빌드 시각으로 갱신됐다. 아래 두 케이스가 그 회귀를 막는다.
  it('lastmod이 있으면 그 값을 ISO로 정규화해 쓴다', async () => {
    const detail = await getStoryDetail('distribution1', 'ko');
    expect(detail.modifiedDate).toBeDefined();
    expect(detail.modifiedDate).toBe(new Date('2026-07-25').toISOString());
  });

  it('dateModified가 frontmatter lastmod과 정확히 일치한다 (mtime 유출 없음)', async () => {
    // mtime 회귀의 직접 증상은 "dateModified가 빌드 시각으로 찍히는 것"이다. 예전엔
    // 그걸 '오늘 날짜인가'로 검사했는데, 그러면 표본 글을 오늘 정당하게 개정한 날
    // 테스트가 깨진다(2026-08-19 즉답 수술 때 실제 발생). 날짜 값이 아니라 출처를
    // 검사하도록 바꾼다 — mtime이 유출되면 frontmatter 값과 어긋나 전 표본이 걸린다.
    const samples = ['distribution1', 'seoul1', 'mixing-complete-guide', 'recording-price1'];

    for (const slug of samples) {
      const raw = readFileSync(join(process.cwd(), 'content', 'stories', `${slug}.md`), 'utf8');
      const lastmod = raw.match(/^lastmod:\s*(\S+)/m)?.[1];
      const detail = await getStoryDetail(slug, 'ko');
      expect(`${slug}:${detail.modifiedDate?.slice(0, 10)}`).toBe(`${slug}:${lastmod}`);
    }
  });

  it('lastmod은 발행일보다 이르지 않다 (개정일 역전 방지)', async () => {
    const samples = ['distribution1', 'seoul1', 'mixing-complete-guide', 'recording-price1'];

    for (const slug of samples) {
      const detail = await getStoryDetail(slug, 'ko');
      expect(`${slug}:${(detail.modifiedDate ?? '') >= detail.date}`).toBe(`${slug}:true`);
    }
  });
});

describe('getRelatedStories', () => {
  it('does not recommend noindex or runtime-thin stories from an indexable page', () => {
    const related = getRelatedStories('ko', 'seoul1', 6);

    expect(related).toHaveLength(6);
    expect(related.map((story) => story.slug)).not.toEqual(
      expect.arrayContaining(['gwangju1', 'jeju1', 'sejong1', 'ulsan1'])
    );
    expect(
      related.every((story) => getStoryAvailableLocales(story.slug).includes('ko'))
    ).toBe(true);
  });
});

describe('지역 스토리 자동 fallback — 유입 의도와 오퍼 정합', () => {
  it('실상권 연습실 LP는 연습실 브릿지를 받는다 (보컬녹음 가격표가 아니라)', async () => {
    const detail = await getStoryDetail('practice-room-yeonsinnae1', 'ko');

    expect(detail.content).toContain('%%service:practice%%');
    expect(detail.content).not.toContain('%%price:recording-pro%%');
  });

  it('광역 허브는 기존대로 녹음 가격표를 받는다 (원격 믹싱·데이록은 전국 대상)', async () => {
    const detail = await getStoryDetail('seoul1', 'ko');

    expect(detail.content).toContain('%%price:recording-pro%%');
    expect(detail.content).not.toContain('%%service:practice%%');
  });
});
