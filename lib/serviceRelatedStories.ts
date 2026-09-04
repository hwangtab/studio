import { getStoryListing } from './stories';
import { defaultLocale, type Locale } from './i18n-config';
import { serviceRelatedStorySlugs, type ServiceKey } from '../data/serviceRelatedStories';
import type { StoryCardData } from '../types/story';

/**
 * 서비스 LP용 큐레이션된 관련 스토리를 StoryCard용 경량 형식으로 반환.
 *
 * stories/[id].tsx의 RelatedStoryItem과 동일한 슬림 변환을 사용해
 * __NEXT_DATA__ 페이로드를 최소화한다.
 *
 * 해당 로케일에서 읽을 수 없는 글은 뺀다. 큐레이션 목록은 한국어 기준으로 짜여 있어,
 * 게이트가 없으면 /es/recording 하단에 한국어 제목 카드가 뜨고 누르면 한국어 본문 +
 * noindex 폴백으로 떨어진다. 전부 걸러져 빈 배열이 되면 RelatedStoriesSection이
 * 스스로 렌더하지 않는다.
 *
 * 판정은 getStoryListing의 미리 계산된 browsable을 쓴다 — getRelatedStories가 이미
 * 같은 경로다. getAllStories로 1,000편을 파싱하던 것을 빌드타임 매니페스트로 바꾼다.
 */
export const getServiceRelatedStories = (
  service: ServiceKey,
  locale: string = defaultLocale
): StoryCardData[] => {
  const targetLocale = (locale as Locale) || defaultLocale;
  const slugs = serviceRelatedStorySlugs[service];
  if (!slugs || slugs.length === 0) return [];

  const bySlug = new Map(getStoryListing(targetLocale).map((s) => [s.slug, s]));

  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .filter((s) => s.browsable)
    .map((s) => ({
      slug: s.slug,
      title: s.title,
      date: s.date,
      categoryKey: s.categoryKey,
      thumbnail: s.thumbnail,
      summary: s.summary,
    }));
};
