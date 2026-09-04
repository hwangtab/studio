/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { normalizeStoryCategoryKey } from '../lib/storyCategories';
import { resolveStoryCTAType } from '../lib/storyCtaPolicy';

/**
 * 사업 규칙: 스튜디오는 보컬·악기 레슨을 하지 않는다(프로듀싱 레슨만). 그런데 보컬 글에
 * 프로듀싱 레슨 오퍼가 붙으면 독자는 보컬 레슨으로 읽는다 — 없는 서비스를 광고하는 셈.
 * 2026-09-03 전수 확인에서 frontmatter `inlineFallback.price: lesson-monthly`가 보컬 글
 * 76편에 일괄 주입돼 본문에 레슨 가격 카드를 띄우고 있었고, storyCtaPolicy의 슬러그 패턴은
 * 하단 CTA까지 레슨으로 보냈다. 코드 가드(lib/storyCtaPolicy·lib/stories)가 렌더를 막지만,
 * 틀린 값이 조용히 무시되는 상태를 남기지 않도록 frontmatter 자체를 여기서 잡는다.
 */
const STORIES_DIR = path.join(process.cwd(), 'content/stories');
const KO_STORY = /^(?!.*\.(en|zh|es|vi|th|uz)\.md$).*\.md$/;

describe('vocal-category stories never advertise lessons', () => {
  const vocalStories = fs
    .readdirSync(STORIES_DIR)
    .filter((f) => KO_STORY.test(f))
    .map((f) => {
      const { data } = matter(fs.readFileSync(path.join(STORIES_DIR, f), 'utf8'));
      return { file: f, slug: f.replace(/\.md$/, ''), data: data as Record<string, unknown> };
    })
    .filter(({ data }) => normalizeStoryCategoryKey(String(data.category ?? '')) === 'vocal');

  it('has a non-trivial vocal corpus to check', () => {
    expect(vocalStories.length).toBeGreaterThan(50);
  });

  it('does not set inlineFallback.price to the lesson package', () => {
    const offenders = vocalStories
      .filter(({ data }) => (data.inlineFallback as { price?: string } | undefined)?.price === 'lesson-monthly')
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('does not set frontmatter cta to lesson', () => {
    const offenders = vocalStories.filter(({ data }) => data.cta === 'lesson').map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('never resolves to the lesson CTA through the policy', () => {
    const offenders = vocalStories
      .filter(({ slug, data }) =>
        resolveStoryCTAType({ slug, categoryKey: 'vocal', override: data.cta as never }) === 'lesson')
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
