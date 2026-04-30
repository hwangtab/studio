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
  artistLabel,
  servicesTitle,
  listenNowLabel,
  listenUrl,
  actions,
  titleTag = 'h2',
  imageSectionClassName = 'px-6 pt-6',
  imageWrapperClassName = 'relative aspect-square max-w-xs mx-auto rounded-card overflow-hidden shadow-card border border-hairline dark:border-white/10',
  contentSectionClassName = 'p-6',
  titleClassName = 'text-title-lg text-ink dark:text-on-dark mb-2',
  artistClassName = 'text-body text-ink-muted-60 dark:text-on-dark-soft mb-4',
  servicesHeadingClassName = 'text-caption-upper uppercase text-ink-muted-60 dark:text-on-dark-soft mb-2',
  actionRowClassName = 'flex flex-col sm:flex-row gap-4',
  primaryActionClassName = 'w-full inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-ink text-white hover:bg-canvas-deep rounded-pill transition-all font-medium active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 dark:bg-white dark:text-ink dark:hover:bg-on-dark-soft',
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
          <span className="inline-block px-3 py-1 text-[13px] bg-canvas-warm text-ink-muted-80 dark:text-on-dark-soft rounded-pill border border-hairline dark:border-white/10">
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
                className="px-3 py-1 bg-canvas-warm text-ink-muted-80 dark:text-on-dark-soft rounded-pill text-[13px] border border-hairline dark:border-white/10"
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
