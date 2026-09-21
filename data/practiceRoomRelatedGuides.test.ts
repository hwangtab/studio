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
  const losers = new Set(Object.keys(redirectMap).map((k) => k.replace('/stories/', '')));

  it('308 리다이렉트 대상을 가리키지 않는다', () => {
    const bad = PRACTICE_ROOM_RELATED_GUIDES
      .filter((g) => losers.has(g.slug))
      .map((g) => `${g.slug} → ${redirectMap[g.slug] ?? redirectMap[`/stories/${g.slug}`]}`);
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
   * 2026-09-21에 실제로 났다 — drum1(27개 링크의 목적지)·seoul1(19개)이 빠졌다.
   * 연습실 클러스터의 축은 악기별 가이드이므로 그 넷은 반드시 남는다.
   */
  it('연습실 클러스터의 핵심 악기별 가이드가 목록에 있다', () => {
    const slugs = new Set(PRACTICE_ROOM_RELATED_GUIDES.map((g) => g.slug));
    for (const core of ['practice-room-vocal1', 'practice-room-drum1', 'practice-room-bass1']) {
      expect(slugs.has(core)).toBe(true);
    }
  });

  it('목록이 비어 있지 않다 (스캔 자체가 살아 있는지)', () => {
    expect(PRACTICE_ROOM_RELATED_GUIDES.length).toBeGreaterThan(100);
  });
});
