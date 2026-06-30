import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Disc } from '@/lib/lucide-icons';
import SectionHeading from '../ui/SectionHeading';
import { Section } from '../ui/Section';
import type { Locale } from '../../lib/i18n';
import type { PortfolioItem } from '../../types/data';

type ReleaseDiscographyItem = Pick<
  PortfolioItem,
  'id' | 'title' | 'description' | 'image' | 'artist' | 'featured'
>;

interface ReleaseDiscographySectionProps {
  locale: Locale;
  title: string;
  subtitle: string;
  viewAllLabel: string;
  items: ReleaseDiscographyItem[];
  variant?: 'default' | 'alternate';
  maxItems?: number;
  onSelectItem?: (id: string) => void;
}

const ReleaseDiscographySection: React.FC<ReleaseDiscographySectionProps> = ({
  locale,
  title,
  subtitle,
  viewAllLabel,
  items,
  variant = 'default',
  maxItems = 12,
  onSelectItem,
}) => {
  const visibleItems = items.slice(0, maxItems);
  if (visibleItems.length === 0) return null;

  const getLink = (path: string) => `/${locale}${path}`;

  const handleCardClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    itemId: string
  ) => {
    if (!onSelectItem) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1) return;

    event.preventDefault();
    onSelectItem(itemId);
  };

  return (
    <Section variant={variant}>
      <SectionHeading
        icon={Disc}
        title={title}
        subtitle={subtitle}
        className="mb-12"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {visibleItems.map((item) => (
          <Link
            key={item.id}
            href={getLink(`/portfolio/${item.id}`)}
            onClick={(event) => handleCardClick(event, item.id)}
            className="group block bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            aria-haspopup={onSelectItem ? 'dialog' : undefined}
          >
            {item.image && (
              <div className="aspect-square overflow-hidden relative">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            )}
            <div className="p-5">
              <p className="text-xs text-primary font-medium mb-1">{item.artist}</p>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
      <div className="text-center mt-10">
        <Link
          href={getLink('/portfolio')}
          className="inline-flex items-center gap-2 text-primary font-semibold hover:underline underline-offset-2"
        >
          {viewAllLabel} <ArrowRight size={16} />
        </Link>
      </div>
    </Section>
  );
};

export default ReleaseDiscographySection;
