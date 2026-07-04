/** @jest-environment node */

import fs from 'fs';
import path from 'path';

import { topicLinks } from '../data/internalLinks';
import { buyerIntentHubSlugs } from '../data/buyerIntentHubs';
import { autoLinkKeywords } from '../components/markdown/autoLinks';

const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];
const explicitStoryAliases = new Set([
  'practice-room-drum1',
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

const readStorySlugs = (): Set<string> => {
  const storiesDir = path.join(process.cwd(), 'content/stories');
  const files = fs.readdirSync(storiesDir).filter((file) => file.endsWith('.md'));
  return new Set(files.map(getBaseSlug));
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

// storyLinks.test.ts는 원래 .md 본문의 /stories/ 링크만 검사해 topicLinks 레지스트리
// 자체의 깨진 참조(예: buyerIntentHub slug를 story로 오라우팅)를 못 잡았다. 아래 테스트가
// 그 구멍을 닫는다.
describe('topicLinks / autoLinkKeywords registry targets', () => {
  const storySlugs = readStorySlugs();
  const hubSlugs = new Set<string>(buyerIntentHubSlugs);

  it('points every topicLinks slug at an existing story .md or a buyerIntentHub', () => {
    const broken: string[] = [];
    for (const [keyword, { slug }] of Object.entries(topicLinks)) {
      if (!storySlugs.has(slug) && !hubSlugs.has(slug) && !explicitStoryAliases.has(slug)) {
        broken.push(`${keyword} -> ${slug}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('auto-links each keyword to the route matching its target type (hub -> /guides/, story -> /stories/)', () => {
    const mismatched: string[] = [];
    for (const [keyword, { slug }] of Object.entries(topicLinks)) {
      const expectedPath = hubSlugs.has(slug) ? `/guides/${slug}` : `/stories/${slug}`;
      const output = autoLinkKeywords(keyword, undefined, 'ko');
      if (!output.includes(`](${expectedPath})`)) {
        mismatched.push(`${keyword} -> expected ](${expectedPath}) in: ${output}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('never inserts ko-only /guides/ hub links when rendering a non-ko locale', () => {
    const leaked: string[] = [];
    for (const [keyword, { slug }] of Object.entries(topicLinks)) {
      if (!hubSlugs.has(slug)) continue;
      const output = autoLinkKeywords(keyword, undefined, 'en');
      if (output.includes('/guides/')) {
        leaked.push(`${keyword} -> ${output}`);
      }
    }
    expect(leaked).toEqual([]);
  });
});
