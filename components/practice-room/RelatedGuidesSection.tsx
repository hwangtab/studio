import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronDown } from '@/lib/lucide-icons';
import SectionHeading from '../ui/SectionHeading';
import { Section } from '../ui/Section';

interface RelatedGuidesSectionProps {
  title: string;
  guides: Array<{ slug: string; title: string }>;
}

const VISIBLE_GUIDES = 32;
const relatedGuideLinkClassName = 'inline-flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary dark:hover:text-primary-light transition-colors duration-200';

const RelatedGuidesSection = ({ title, guides }: RelatedGuidesSectionProps) => {
  const visibleRelatedGuides = guides.slice(0, VISIBLE_GUIDES);
  const hiddenRelatedGuides = guides.slice(VISIBLE_GUIDES);

  if (visibleRelatedGuides.length === 0) {
    return null;
  }

  return (
    <Section variant="default" className="py-10" defer>
      <div className="max-w-5xl mx-auto">
        <SectionHeading
          icon={BookOpen}
          title={title}
          className="mb-6"
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {visibleRelatedGuides.map((guide, idx) => (
            <Link
              key={`${guide.slug}-visible-${idx}`}
              href={`/ko/stories/${guide.slug}`}
              className={relatedGuideLinkClassName}
            >
              <span>{guide.title}</span>
              <ArrowRight size={14} className="flex-shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>
        {hiddenRelatedGuides.length > 0 && (
          <details className="mt-6 group">
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-primary hover:text-primary-dark dark:text-primary-light transition-colors">
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
