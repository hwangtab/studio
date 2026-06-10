const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { isStoryThin } = require('./thinContent');
const regionHubSlugs = require('../regionHubSlugs.json');

const STORIES_DIR = path.join(__dirname, '../../content/stories');

const readRobots = (slug) => {
  try {
    return String(matter(fs.readFileSync(path.join(STORIES_DIR, `${slug}.md`), 'utf8')).data.robots || '');
  } catch {
    return '';
  }
};

describe('isStoryThin — noindex 우선순위 (sitemap ↔ 색인정책 정합)', () => {
  // 광역 허브이면서 robots:noindex인 슬러그(예: busan1). 허브 예외가 noindex를
  // 가로채면 sitemap에 남아 GSC "Submitted URL marked noindex" 충돌이 난다.
  const noindexHubs = regionHubSlugs.filter((slug) => /noindex/i.test(readRobots(slug)));

  it('테스트 전제: noindex이면서 허브인 슬러그가 실제로 존재한다', () => {
    expect(noindexHubs.length).toBeGreaterThan(0);
  });

  it('noindex 허브는 허브 예외에도 불구하고 thin=true (sitemap 제외)', () => {
    for (const slug of noindexHubs) {
      expect(isStoryThin(slug, 'ko')).toBe(true);
    }
  });

  it('noindex가 아닌 허브는 thin=false (sitemap 포함 유지)', () => {
    const indexableHubs = regionHubSlugs
      .filter((slug) => !/noindex/i.test(readRobots(slug)))
      .slice(0, 5);
    expect(indexableHubs.length).toBeGreaterThan(0);
    for (const slug of indexableHubs) {
      expect(isStoryThin(slug, 'ko')).toBe(false);
    }
  });

  it('파일이 없는 슬러그는 thin=true (제외)', () => {
    expect(isStoryThin('__definitely-not-a-real-slug__', 'ko')).toBe(true);
  });
});
