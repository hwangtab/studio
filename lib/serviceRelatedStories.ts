import { getAllStories } from './stories';
import { defaultLocale, type Locale } from './i18n-config';
import { serviceRelatedStorySlugs, type ServiceKey } from '../data/serviceRelatedStories';
import type { StoryCardData } from '../types/story';

/**
 * 서비스 LP용 큐레이션된 관련 스토리를 StoryCard용 경량 형식으로 반환.
 *
 * stories/[id].tsx의 RelatedStoryItem과 동일한 슬림 변환을 사용해
 * __NEXT_DATA__ 페이로드를 최소화한다.
 */
export const getServiceRelatedStories = (
  service: ServiceKey,
  locale: string = defaultLocale
): StoryCardData[] => {
  const targetLocale = (locale as Locale) || defaultLocale;
  const slugs = serviceRelatedStorySlugs[service];
  if (!slugs || slugs.length === 0) return [];

  const all = getAllStories(targetLocale);
  const bySlug = new Map(all.map((s) => [s.slug, s]));

  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({
      slug: s.slug,
      title: s.title,
      date: s.date,
      categoryKey: s.categoryKey,
      thumbnail: s.thumbnail,
      summary: s.summary,
    }));
};
