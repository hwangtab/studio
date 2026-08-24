/** @jest-environment node */

/**
 * story listing 빌드 산출물 무결성 가드.
 *
 * lib/storyListing/*.json(scripts/generate-story-listing.js)은 pages/api/stories/catalog.ts와
 * lib/stories.ts:getRelatedStories가 요청 경로에서 content/stories/*.md 1,000+편을
 * fs.readFileSync + gray-matter로 재파싱하지 않도록 만든 빌드타임 산출물이다.
 * 콘텐츠(.md)를 추가·수정했는데 재생성 commit을 빠뜨리면 목록·관련글이 조용히
 * 낡은 상태로 서빙된다(빌드는 성공하므로 회귀가 눈에 안 띈다).
 *
 * --check 모드는 파일을 쓰지 않고 현재 content/stories/*.md로부터 다시 계산한 결과와
 * 커밋된 lib/storyListing/*.json을 대조한다. 실패 시:
 *   node scripts/generate-story-listing.js
 * 로 재생성 후 lib/storyListing/*.json을 함께 commit할 것.
 */

import { execFileSync } from 'child_process';

describe('story listing manifest', () => {
  it('커밋된 lib/storyListing/*.json이 content/stories/*.md와 일치한다', () => {
    const output = execFileSync(
      process.execPath,
      ['scripts/generate-story-listing.js', '--check'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(output).toContain('story-listing OK');
  });
});
