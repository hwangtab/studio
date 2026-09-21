import fs from 'fs';
import path from 'path';

import { PRACTICE_ROOM_RELATED_GUIDES } from './practiceRoomRelatedGuides';

/**
 * 연습실 허브의 관련 가이드 목록 가드.
 *
 * 2026-09-08에 "스토리 링크 632개 중 112개가 308"이라고 커밋 메시지에만 적히고
 * 아무 데도 등재되지 않아 한 달 넘게 남아 있었다(2026-09-21 실측 126개). 허브는
 * 7주에 한 번 크롤되는데 그때마다 308 링크를 따라간다 — 크롤 예산과 사용자 경험
 * 양쪽에 손해다. 목록에 308 대상이 다시 들어오면 CI에서 잡는다.
 */
describe('practiceRoomRelatedGuides', () => {
  const redirectMap: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'lib/regionRedirectMap.json'), 'utf8')
  );
  // 리다이렉트 원천은 셋이다. regionRedirectMap만 보면 next.config.mjs·middleware.ts가
  // 상위 페이지로 접는 슬러그(practice-room-drum1 → /practice-room)를 놓친다 —
  // 2026-09-21에 실제로 그 슬러그를 "승자"로 오인해 되살렸다가 되돌렸다.
  const readSlugs = (file: string, re: RegExp) =>
    [...fs.readFileSync(path.join(process.cwd(), file), 'utf8').matchAll(re)].map((m) => m[1]);
  const pageRedirectSlugs = [
    ...readSlugs('next.config.mjs', /source:\s*'\/:locale\([^)]*\)\/stories\/([a-z0-9-]+)'/g),
    ...readSlugs('middleware.ts', /^\s*'([a-z0-9-]+)':\s*'[a-z0-9-]+',\s*$/gm),
  ];
  const losers = new Map<string, string>();
  for (const [k, v] of Object.entries(redirectMap)) losers.set(k.replace('/stories/', ''), `/stories/${v}`);
  for (const slug of pageRedirectSlugs) losers.set(slug, '(page redirect: next.config.mjs / middleware.ts)');

  it('리다이렉트 원천 셋을 다 읽었다 (파싱이 살아 있는지)', () => {
    expect(Object.keys(redirectMap).length).toBeGreaterThan(100);
    expect(pageRedirectSlugs).toContain('practice-room-drum1');
  });

  it('308 리다이렉트 대상을 가리키지 않는다 (regionRedirectMap · next.config · middleware)', () => {
    const bad = PRACTICE_ROOM_RELATED_GUIDES
      .filter((g) => losers.has(g.slug))
      .map((g) => `${g.slug} → ${losers.get(g.slug)}`);
    expect(bad).toEqual([]);
  });

  it('모든 slug에 해당하는 스토리 파일이 있다', () => {
    const dir = path.join(process.cwd(), 'content/stories');
    const missing = PRACTICE_ROOM_RELATED_GUIDES
      .filter((g) => !fs.existsSync(path.join(dir, `${g.slug}.md`)))
      .map((g) => g.slug);
    expect(missing).toEqual([]);
  });

  /**
   * 308을 걷어낼 때 승자가 목록에서 함께 사라지면 그 글로 가는 경로가 끊긴다.
   * 연습실 클러스터의 축은 악기별 가이드다. drum1은 여기 없다 — 글 자체가
   * /practice-room으로 접힌 슬러그라 위 테스트가 금지한다.
   */
  it('연습실 클러스터의 핵심 악기별 가이드가 목록에 있다', () => {
    const slugs = new Set(PRACTICE_ROOM_RELATED_GUIDES.map((g) => g.slug));
    for (const core of ['practice-room-vocal1', 'practice-room-bass1', 'practice-room-guitar1', 'practice-room-piano1']) {
      expect(slugs.has(core)).toBe(true);
    }
  });

  it('목록이 비어 있지 않다 (스캔 자체가 살아 있는지)', () => {
    expect(PRACTICE_ROOM_RELATED_GUIDES.length).toBeGreaterThan(100);
  });
});
