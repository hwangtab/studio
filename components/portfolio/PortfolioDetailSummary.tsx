import React from 'react';
import { ExternalLink } from 'lucide-react';
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
  imageSectionClassName = 'px-6 pt-6',
  imageWrapperClassName = 'relative aspect-square max-w-xs mx-auto rounded-xl overflow-hidden shadow-lg',
  contentSectionClassName = 'p-6',
  titleClassName = 'typo-card-title text-gray-900 dark:text-white mb-2',
  artistClassName = 'typo-card-body text-gray-600 dark:text-gray-300 mb-4',
  servicesHeadingClassName = 'typo-card-meta font-medium text-gray-400 dark:text-gray-500 mb-2',
  actionRowClassName = 'flex flex-col sm:flex-row gap-4',
  primaryActionClassName = 'w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium',
}: PortfolioDetailSummaryProps) => {
  const TitleTag = titleTag;

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
