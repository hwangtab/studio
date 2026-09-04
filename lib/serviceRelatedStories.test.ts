/** @jest-environment node */

import { getServiceRelatedStories } from './serviceRelatedStories';
import { serviceRelatedStorySlugs, type ServiceKey } from '../data/serviceRelatedStories';
import { getStoryListing } from './stories';

/**
 * 서비스 LP 하단 "관련 스토리"가 해당 언어로 읽을 수 없는 글을 노출하지 않는다.
 *
 * 큐레이션 목록은 한국어 기준으로 짜여 있다. 게이트가 없던 동안 /es/recording 하단에
 * 한국어 제목 카드 6장이 떴고, 누르면 한국어 본문 + noindex 폴백으로 떨어졌다 —
 * 목록·카테고리 허브·getRelatedStories는 이미 같은 판정(browsable)을 쓰고 있었다.
 *
 * 로케일을 전수로 돌지 않는 이유: getStoryListing은 프로덕션에서만 캐시되므로
 * (lib/stories.ts enableCache) 호출마다 1,100행 매니페스트를 다시 읽어 로케일당
 * 14초가 든다. 필터는 서비스와 무관한 한 줄이라 대표 서비스 하나로 같은 것을 증명한다.
 */

const SERVICES = Object.keys(serviceRelatedStorySlugs) as ServiceKey[];
/** 큐레이션이 가장 많은 서비스 — 걸러질 후보가 있어야 게이트가 의미를 갖는다. */
const SAMPLE: ServiceKey = SERVICES[0];

describe('서비스 LP 관련 스토리 — 로케일 게이트', () => {
  it('ko에서는 큐레이션한 글이 그대로 나온다', () => {
    const cards = getServiceRelatedStories(SAMPLE, 'ko');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(serviceRelatedStorySlugs[SAMPLE].length);
  });

  it('en에서는 그 언어로 읽을 수 있는 글만 남는다', () => {
    const bySlug = new Map(getStoryListing('en').map((s) => [s.slug, s]));
    for (const card of getServiceRelatedStories(SAMPLE, 'en')) {
      expect(bySlug.get(card.slug)?.browsable).toBe(true);
    }
  });

  it('번역이 없는 로케일에서는 빈 배열이 된다 (섹션이 스스로 사라진다)', () => {
    // RelatedStoriesSection은 stories.length === 0이면 null을 반환한다.
    expect(getServiceRelatedStories(SAMPLE, 'es')).toEqual([]);
  });

  it('모르는 서비스 키에는 아무것도 돌려주지 않는다', () => {
    expect(getServiceRelatedStories('nope' as ServiceKey, 'ko')).toEqual([]);
  });

  it('큐레이션한 슬러그가 전부 실재한다 (오타·삭제된 글 방지)', () => {
    const known = new Set(getStoryListing('ko').map((s) => s.slug));
    const missing = SERVICES.flatMap((service) =>
      serviceRelatedStorySlugs[service].filter((slug) => !known.has(slug)).map((slug) => `${service}: ${slug}`),
    );
    expect(missing).toEqual([]);
  });
});
