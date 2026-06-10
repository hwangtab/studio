import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import StoryCard from '../StoryCard';
import SectionHeading from './SectionHeading';
import { Section } from './Section';
import { STORY_CATEGORY_KEYS } from '../../lib/storyCategories';
import type { Locale } from '../../lib/i18n';
import type { StoryCardData } from '../../types/story';

interface RelatedStoriesSectionProps {
  stories: StoryCardData[];
  locale: Locale;
  /** 섹션 헤딩 (이미 번역된 문자열) */
  title: string;
  /** 부제 (이미 번역된 문자열, optional) */
  subtitle?: string;
  /** "전체 보기" 링크 안커. 기본값: /stories */
  viewAllHref?: string;
}

/**
 * 서비스 LP 하단에 surface하는 관련 스토리 그리드.
 *
 * SEO 동선: 스토리는 long-tail 키워드로 유입되고, 서비스 LP는 transactional 의도다.
 * 그동안 Service → Story 한 방향이 비어 있어 LP 방문자가 가이드 콘텐츠로 못 들어가는
 * 경로 누수가 있었다. 이 섹션이 빈 동선을 채운다.
 */
const RelatedStoriesSection: React.FC<RelatedStoriesSectionProps> = ({
  stories,
  locale,
  title,
  subtitle,
  viewAllHref,
}) => {
  const { t } = useTranslation('common', { lng: locale });

  const labels = React.useMemo(
    () => ({
      defaultCategory: t('stories.list.defaultCategory'),
      noDate: t('stories.list.noDate'),
      noTitle: t('stories.list.noTitle'),
      noContent: t('stories.list.noContent'),
      categoryByKey: Object.fromEntries(
        STORY_CATEGORY_KEYS.map((key) => [key, t(`stories.categories.${key}`)])
      ),
    }),
    [t]
  );

  if (!stories || stories.length === 0) return null;

  const allHref = viewAllHref ?? `/${locale}/stories`;

  return (
    <Section variant="default">
      <SectionHeading icon={BookOpen} title={title} subtitle={subtitle} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stories.map((story) => (
          <StoryCard
            key={story.slug}
            story={story}
            locale={locale}
            labels={labels}
          />
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          href={allHref}
          className="inline-flex items-center gap-2 typo-card-cta text-primary hover:underline min-h-[44px] touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        >
          {t('stories.detail.viewAll', { defaultValue: t('nav.stories') })}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </Section>
  );
};

export default RelatedStoriesSection;
