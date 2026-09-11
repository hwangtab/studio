import React from 'react';
import { ExternalLink } from '@/lib/lucide-icons';
import ResponsiveImage from '../ResponsiveImage';
import type { PortfolioItem } from '../../types/data';

interface PortfolioDetailSummaryProps {
  item: PortfolioItem;
  categoryName: string;
  categoryColor: string;
  artistLabel: string;
  servicesTitle: string;
  listenNowLabel: string;
  listenUrl: string;
  actions?: React.ReactNode;
  titleTag?: 'h1' | 'h2';
  /**
   * 상세 이미지의 next/image priority. 페이지(/[locale]/portfolio/[id], above-fold LCP
   * 후보)에서는 true, 모달(클라이언트 인터랙션 후 열림)에서는 미지정 권장.
   * 명시하지 않으면 titleTag(호출부가 이미 page='h1'/modal='h2'로 구분해 넘김)로 유추한다.
   */
  imagePriority?: boolean;
  imageSectionClassName?: string;
  imageWrapperClassName?: string;
  contentSectionClassName?: string;
  titleClassName?: string;
  artistClassName?: string;
  servicesHeadingClassName?: string;
  actionRowClassName?: string;
  primaryActionClassName?: string;
}

const PortfolioDetailSummary = ({
  item,
  categoryName,
  categoryColor,
  artistLabel,
  servicesTitle,
  listenNowLabel,
  listenUrl,
  actions,
  titleTag = 'h2',
  imagePriority,
  imageSectionClassName = 'px-6 pt-6',
  imageWrapperClassName = 'relative aspect-square max-w-xs mx-auto rounded-xl overflow-hidden shadow-lg',
  contentSectionClassName = 'p-6',
  titleClassName = 'typo-card-title text-gray-900 dark:text-white mb-2',
  artistClassName = 'typo-card-body text-gray-600 dark:text-gray-300 mb-4',
  servicesHeadingClassName = 'typo-card-meta font-medium text-gray-400 dark:text-gray-400 mb-2',
  actionRowClassName = 'flex flex-col sm:flex-row gap-4',
  primaryActionClassName = 'w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium',
}: PortfolioDetailSummaryProps) => {
  const TitleTag = titleTag;
  // titleTag='h1'은 페이지 사용처(above-fold LCP)만 넘기므로 priority 유추 신호로 재사용.
  const resolvedImagePriority = imagePriority ?? titleTag === 'h1';

  return (
    <>
      <div className={imageSectionClassName}>
        <div className={imageWrapperClassName}>
          <ResponsiveImage
            src={item.image}
            alt={`${item.title} — ${item.artist}`}
            className="object-cover"
            pictureClassName="block w-full h-full"
            sizes="(min-width: 768px) 400px, 100vw"
            priority={resolvedImagePriority}
            fill
          />
        </div>
      </div>

      <div className={contentSectionClassName}>
        <div className="mb-3">
          <span
            className="inline-block px-3 py-1 text-sm font-medium text-white rounded-full"
            style={{ backgroundColor: categoryColor }}
          >
            {categoryName}
          </span>
        </div>

        <TitleTag className={titleClassName}>
          {item.title}
        </TitleTag>

        <p className={artistClassName}>
          {artistLabel}: {item.artist}
        </p>

        <div className="mb-6">
          <h3 className={servicesHeadingClassName}>
            {servicesTitle}
          </h3>
          <div className="flex flex-wrap gap-2">
            {item.services.map((service) => (
              <span
                key={service}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
              >
                {service}
              </span>
            ))}
          </div>
        </div>

        <div className={actionRowClassName}>
          <a
            href={listenUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={primaryActionClassName}
          >
            <ExternalLink size={16} aria-hidden="true" />
            {listenNowLabel}
          </a>
          {actions}
        </div>
      </div>
    </>
  );
};

export default PortfolioDetailSummary;
