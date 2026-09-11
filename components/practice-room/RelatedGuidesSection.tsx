import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronDown } from '@/lib/lucide-icons';
import SectionHeading from '../ui/SectionHeading';
import { Section } from '../ui/Section';
import { PRACTICE_ROOM_RELATED_GUIDES } from '../../data/practiceRoomRelatedGuides';
import type { Locale } from '../../lib/i18n';

interface RelatedGuidesSectionProps {
  title: string;
  locale: Locale;
}

const VISIBLE_GUIDES = 32;
const relatedGuideLinkClassName = 'inline-flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary dark:hover:text-primary-lighter transition-colors duration-200';

const RelatedGuidesSection = ({ title, locale }: RelatedGuidesSectionProps) => {
  // 앵커 타이틀이 한국어 전용이므로 ko 허브에서만 렌더 (기존 동작 유지).
  // data/practiceRoomRelatedGuides는 정적 TS 상수라 컴포넌트가 직접 import한다 —
  // 페이지 props로 왕복시키면 같은 데이터가 __NEXT_DATA__에 중복 직렬화된다.
  const guides = locale === 'ko' ? PRACTICE_ROOM_RELATED_GUIDES : [];
  const visibleRelatedGuides = guides.slice(0, VISIBLE_GUIDES);
  const hiddenRelatedGuides = guides.slice(VISIBLE_GUIDES);

  if (visibleRelatedGuides.length === 0) {
    return null;
  }

  return (
    <Section variant="default" spacing="tight" defer>
      <div className="max-w-5xl mx-auto">
        <SectionHeading
          icon={BookOpen}
          title={title}
          className="mb-6"
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {visibleRelatedGuides.map((guide, idx) => (
            // content-visibility:auto 섹션이라 스크롤 시 다수 링크가 거의 동시에
            // 뷰포트에 들어온다 — 기본 prefetch면 링크 수만큼 /_next/data/*.json을
            // 한꺼번에 받는다. RegionLinksSection·StoryCard와 같은 판단.
            <Link
              key={`${guide.slug}-visible-${idx}`}
              href={`/ko/stories/${guide.slug}`}
              prefetch={false}
              className={relatedGuideLinkClassName}
            >
              <span>{guide.title}</span>
              <ArrowRight size={14} className="flex-shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>
        {hiddenRelatedGuides.length > 0 && (
          <details className="mt-6 group">
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-primary hover:text-primary-dark dark:text-primary-lighter transition-colors">
              <span className="group-open:hidden">
                가이드 +{hiddenRelatedGuides.length}개 더 보기
              </span>
              <span className="hidden group-open:inline">접기</span>
              <ChevronDown
                size={16}
                className="transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {hiddenRelatedGuides.map((guide, idx) => (
                <Link
                  key={`${guide.slug}-hidden-${idx}`}
                  href={`/ko/stories/${guide.slug}`}
                  prefetch={false}
                  className={relatedGuideLinkClassName}
                >
                  <span>{guide.title}</span>
                  <ArrowRight size={14} className="flex-shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>
    </Section>
  );
};

export default RelatedGuidesSection;
