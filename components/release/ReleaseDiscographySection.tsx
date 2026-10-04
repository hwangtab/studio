import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Disc } from '@/lib/lucide-icons';
import BaseCard, { CARD_PADDING } from '../ui/BaseCard';
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
  /** 목록 아래에 붙는 하위 블록(예: 믹싱 전·후 30초 발췌). 절을 새로 끼우면 아래 절들의 배경 번갈음이 뒤집힌다. */
  footer?: React.ReactNode;
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
  footer,
}) => {
  const visibleItems = items.slice(0, maxItems);
  if (visibleItems.length === 0) return null;

  const getLink = (path: string) => `/${locale}${path}`;

  const handleCardClick = (
    event: React.MouseEvent<HTMLElement>,
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
          // 리프트·press·포커스 링은 BaseCard가 소유한다(§4) — CSS translate 복제를 걷고 BaseCard로 바꿨다.
          // 모달로 여는 경우의 aria-haspopup은 BaseCard가 받지 않아 함께 걷었다 — 링크 자체는 상세 페이지로
          // 가는 실제 href라 보조기술에는 링크로 읽히는 것이 맞다(모달은 진행 향상이다).
          <BaseCard
            key={item.id}
            href={getLink(`/portfolio/${item.id}`)}
            onClick={(event) => handleCardClick(event, item.id)}
            className="group block text-left"
          >
            {item.image && (
              <div className="aspect-square overflow-hidden relative">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
            )}
            <div className={CARD_PADDING.compact}>
              <p className="text-xs text-primary dark:text-primary-lighter font-medium mb-1">{item.artist}</p>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary-lighter transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
            </div>
          </BaseCard>
        ))}
      </div>
      <div className="text-center mt-10">
        <Link
          href={getLink('/portfolio')}
          className="inline-flex items-center gap-2 text-primary dark:text-primary-lighter font-semibold hover:underline underline-offset-2"
        >
          {viewAllLabel} <ArrowRight size={16} />
        </Link>
      </div>
      {footer}
    </Section>
  );
};

export default ReleaseDiscographySection;
