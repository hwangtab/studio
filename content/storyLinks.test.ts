/** @jest-environment node */

import fs from 'fs';
import path from 'path';

const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];
const explicitStoryAliases = new Set([
  'practice-room-drum1',
  'song-structure1',
]);

const getBaseSlug = (fileName: string): string => {
  let slug = fileName.replace(/\.md$/, '');
  for (const locale of locales) {
    if (slug.endsWith(`.${locale}`)) {
      slug = slug.slice(0, -(`.${locale}`).length);
    }
  }
  return slug;
};

describe('story internal links', () => {
  it('points /stories links at existing story slugs or explicit aliases', () => {
    const storiesDir = path.join(process.cwd(), 'content/stories');
    const files = fs.readdirSync(storiesDir).filter((file) => file.endsWith('.md'));
    const storySlugs = new Set(files.map(getBaseSlug));
    const brokenLinks: string[] = [];
    const storyLinkPattern = /\]\(\/(?:[a-z]{2}\/)?stories\/([^)#?]+)(?:[#?][^)]*)?\)/g;

    for (const file of files) {
      const content = fs.readFileSync(path.join(storiesDir, file), 'utf8');
      for (const match of content.matchAll(storyLinkPattern)) {
        const slug = decodeURIComponent(match[1]).replace(/\/$/, '');
        if (!storySlugs.has(slug) && !explicitStoryAliases.has(slug)) {
          const line = content.slice(0, match.index).split(/\r?\n/).length;
          brokenLinks.push(`${file}:${line} -> ${slug}`);
        }
      }
    }

    expect(brokenLinks).toEqual([]);
  });
});
