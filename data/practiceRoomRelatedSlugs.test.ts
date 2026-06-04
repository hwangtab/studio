/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import { PRACTICE_ROOM_RELATED_SLUGS } from './practiceRoomRelatedSlugs';

const STORY_ALIAS_SLUGS = new Set([
  // next.config.mjs redirects /:locale/stories/practice-room-drum1 -> /:locale/practice-room.
  'practice-room-drum1',
]);

const getKoreanRelatedGuideTitles = () => {
  const commonPath = path.join(process.cwd(), 'public/locales/ko/common.json');
  const common = JSON.parse(fs.readFileSync(commonPath, 'utf8'));

  return common.practiceRoom.relatedGuides.items;
};

describe('PRACTICE_ROOM_RELATED_SLUGS', () => {
  it('points every related guide slug to an existing story or explicit alias', () => {
    const storiesDir = path.join(process.cwd(), 'content/stories');
    const storySlugs = new Set(
      fs.readdirSync(storiesDir)
        .filter((file) => file.endsWith('.md'))
        .map((file) => file.replace(/\.(en|zh|es|vi|th|uz)\.md$/, '.md').replace(/\.md$/, ''))
    );

    const missingSlugs = PRACTICE_ROOM_RELATED_SLUGS.filter(
      (slug) => !storySlugs.has(slug) && !STORY_ALIAS_SLUGS.has(slug)
    );

    expect(missingSlugs).toEqual([]);
  });

  it('stays index-aligned with the related guide titles', () => {
    const titles = getKoreanRelatedGuideTitles();
    const emptyTitleEntries = PRACTICE_ROOM_RELATED_SLUGS
      .map((slug, index) => ({ index, slug, title: titles[index] }))
      .filter(({ title }) => typeof title !== 'string' || title.trim() === '');

    expect(PRACTICE_ROOM_RELATED_SLUGS).toHaveLength(titles.length);
    expect(emptyTitleEntries).toEqual([]);
  });

  it('uses the canonical drum double-kick slug in related guides', () => {
    expect(PRACTICE_ROOM_RELATED_SLUGS).not.toContain('practice-room-drum-doublekick1');
    expect(PRACTICE_ROOM_RELATED_SLUGS).toContain('practice-room-drum-double-kick1');
  });
});
