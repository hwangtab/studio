import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PortfolioItem, PortfolioCategory } from '../../types/data';
import type { Locale } from '../../lib/i18n';
import { getCategoryInfo } from '../../utils/portfolioDataUtils';
import PortfolioDetailSummary from './PortfolioDetailSummary';
import PortfolioDetailBody from './PortfolioDetailBody';
import CoverPlayButton from '../audio/CoverPlayButton';
import { getExcerptForPortfolio, toGlobalTrack } from '../../data/audioExcerpts';

interface PortfolioDetailContentProps {
  item: PortfolioItem;
  categories: readonly PortfolioCategory[];
  locale: Locale;
  /**
   * Summary 영역 titleTag. 페이지에서는 'h1', 모달에서는 'h2'.
   */
  titleTag?: 'h1' | 'h2';
  /**
   * Summary 영역 액션 버튼 (예: 공유). 모달/페이지에서 다르게 주입.
   */
  summaryActions?: React.ReactNode;
  /**
   * Summary 영역 컨테이너 className. 모달은 모달 카드 내부, 페이지는 별도 카드.
   */
  summaryWrapperClassName?: string;
  /**
   * Summary 영역 이미지 섹션 className 오버라이드.
   */
  imageSectionClassName?: string;
  imageWrapperClassName?: string;
  contentSectionClassName?: string;
  titleClassName?: string;
  artistClassName?: string;
  servicesHeadingClassName?: string;
  primaryActionClassName?: string;
}

/**
 * Portfolio 상세 콘텐츠 (요약 + 본문)을 하나로 묶은 통합 컴포넌트.
 * 모달과 자체 페이지 둘 다 이 컴포넌트를 사용해 디자인·정보 일관성 확보.
 */
const PortfolioDetailContent = ({
  item,
  categories,
  locale,
  titleTag = 'h2',
  summaryActions,
  imageSectionClassName,
  imageWrapperClassName,
  contentSectionClassName,
  titleClassName,
  artistClassName,
  servicesHeadingClassName,
  primaryActionClassName,
}: PortfolioDetailContentProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const categoryInfo = getCategoryInfo(item.category, categories);
  // 30초 발췌가 있는 작품은 커버에 재생 버튼(그리드와 같은 버튼·같은 글로벌 플레이어). 페이지(h1)·모달(h2)을 계측에서 가른다.
  const excerpt = getExcerptForPortfolio(item.id);
  const coverTrack = excerpt
    ? toGlobalTrack(excerpt, locale, titleTag === 'h1' ? 'PortfolioDetail' : 'PortfolioModal', `/${locale}/portfolio/${item.id}`)
    : null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Summary 흰 카드 */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <PortfolioDetailSummary
          item={item}
          categoryName={categoryInfo.name}
          categoryColor={categoryInfo.color}
          artistLabel={t('portfolio.detail.artistLabel')}
          servicesTitle={t('portfolio.detail.servicesProvided')}
          listenNowLabel={t('portfolio.detail.listenNow')}
          listenUrl={item.link}
          titleTag={titleTag}
          actions={summaryActions}
          {...(coverTrack && { coverOverlay: <CoverPlayButton track={coverTrack} className="absolute bottom-3 right-3" /> })}
          {...(imageSectionClassName && { imageSectionClassName })}
          {...(imageWrapperClassName && { imageWrapperClassName })}
          {...(contentSectionClassName && { contentSectionClassName })}
          {...(titleClassName && { titleClassName })}
          {...(artistClassName && { artistClassName })}
          {...(servicesHeadingClassName && { servicesHeadingClassName })}
          {...(primaryActionClassName && { primaryActionClassName })}
        />
      </div>
      {/* Body는 자체 mt-10 흰 카드들 */}
      <PortfolioDetailBody
        item={item}
        locale={locale}
        labels={{
          productionNotesTitle: t('portfolio.detail.productionNotes', '프로덕션 노트'),
          creditsTitle: t('portfolio.detail.credits', '크레딧'),
          creditsEngineer: t('portfolio.detail.creditsEngineer', '엔지니어'),
          creditsMusicians: t('portfolio.detail.creditsMusicians', '연주자'),
          creditsGear: t('portfolio.detail.creditsGear', '사용 장비'),
          trackListTitle: t('portfolio.detail.trackList', '트랙 리스트'),
          releaseDateLabel: t('portfolio.detail.releaseDate', '발매일'),
          labelLabel: t('portfolio.detail.label', '레이블'),
        }}
      />
    </div>
  );
};

export default PortfolioDetailContent;
