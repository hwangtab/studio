/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import { PRACTICE_ROOM_RELATED_GUIDES } from './practiceRoomRelatedGuides';

const STORY_ALIAS_SLUGS = new Set([
  // next.config.mjs redirects /:locale/stories/practice-room-drum1 -> /:locale/practice-room.
  'practice-room-drum1',
]);

// 과거 slug 배열 ↔ ko common.json items 배열의 인덱스 결합 구조에서는
// "정렬 밀림" 가드 테스트가 필요했다(687664aa5e 복구 사고). {slug, title} 쌍
// 구조로 병합하면서 그 사고 클래스 자체가 사라졌으므로 정렬 테스트는 없다.
describe('PRACTICE_ROOM_RELATED_GUIDES', () => {
  it('points every related guide slug to an existing story or explicit alias', () => {
    const storiesDir = path.join(process.cwd(), 'content/stories');
    const storySlugs = new Set(
      fs.readdirSync(storiesDir)
        .filter((file) => file.endsWith('.md'))
        .map((file) => file.replace(/\.(en|zh|es|vi|th|uz)\.md$/, '.md').replace(/\.md$/, ''))
    );

    const missingSlugs = PRACTICE_ROOM_RELATED_GUIDES
      .filter(({ slug }) => !storySlugs.has(slug) && !STORY_ALIAS_SLUGS.has(slug))
      .map(({ slug }) => slug);

    expect(missingSlugs).toEqual([]);
  });

  it('has a non-empty anchor title on every entry', () => {
    const emptyTitleEntries = PRACTICE_ROOM_RELATED_GUIDES
      .map(({ slug, title }, index) => ({ index, slug, title }))
      .filter(({ title }) => typeof title !== 'string' || title.trim() === '');

    expect(emptyTitleEntries).toEqual([]);
  });

  it('renders no identical slug + anchor-text pair twice', () => {
    // 같은 slug가 여러 번 등장하는 것은 의도된 설계다(허브에서 서로 다른 앵커
    // 텍스트로 같은 cluster 페이지를 가리킴). 그러나 slug와 앵커 텍스트가 완전히
    // 동일한 중복은 같은 카드가 2번 렌더돼 무의미하므로 금지한다.
    const seen = new Set<string>();
    const identicalPairs = PRACTICE_ROOM_RELATED_GUIDES
      .filter(({ slug, title }) => {
        const key = `${slug} ${title}`;
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      })
      .map(({ slug, title }) => `${slug} :: ${title}`);

    expect(identicalPairs).toEqual([]);
  });

  it('uses the canonical drum double-kick slug in related guides', () => {
    const slugs = PRACTICE_ROOM_RELATED_GUIDES.map(({ slug }) => slug);
    expect(slugs).not.toContain('practice-room-drum-doublekick1');
    expect(slugs).toContain('practice-room-drum-double-kick1');
  });
});
