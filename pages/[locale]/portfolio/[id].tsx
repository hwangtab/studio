import React from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { m } from 'framer-motion';
import { ArrowLeft, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../../components/SEO';
import PortfolioDetailSummary from '../../../components/portfolio/PortfolioDetailSummary';
import PortfolioDetailBody from '../../../components/portfolio/PortfolioDetailBody';
import { getPortfolioItems, getCategories } from '../../../data/portfolio';
import type { PortfolioItem, PortfolioCategory } from '../../../types/data';
import { shareContent } from '../../../utils/shareUtils';
import { getCategoryInfo } from '../../../utils/portfolioDataUtils';
import { generateMusicRecordingSchema } from '../../../utils/schemaGenerator';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Section from '../../../components/ui/Section';
import BaseCard from '../../../components/ui/BaseCard';
import { buildPageStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import { defaultLocale, locales, type Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { createEnterAnimation } from '../../../utils/animationUtils';
import Breadcrumb from '../../../components/ui/Breadcrumb';


interface PortfolioDetailPageProps {
  locale: Locale;
  item: PortfolioItem;
  categories: PortfolioCategory[];
}

const DETAIL_CONTENT_ANIMATION = createEnterAnimation();

function getImageDimensions(imageUrl: string): { width: number; height: number } {
  // bugsm.co.kr: /images/SIZE/ in path
  const bugsmMatch = imageUrl.match(/\/images\/(\d+)\//);
  if (bugsmMatch) {
    const size = parseInt(bugsmMatch[1], 10);
    return { width: size, height: size };
  }
  // mzstatic.com / similar CDNs: WIDTHxHEIGHT in filename
  const dimMatch = imageUrl.match(/\/(\d+)x(\d+)[a-z]+-?[\d]*\.\w+$/);
  if (dimMatch) {
    return { width: parseInt(dimMatch[1], 10), height: parseInt(dimMatch[2], 10) };
  }
  // default: square album art
  return { width: 1000, height: 1000 };
}

const PortfolioDetailPage: NextPage<PortfolioDetailPageProps> = ({ locale, item, categories }) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });

  const siteConfig = getSiteConfig(locale);

  const getLink = (path: string) => `/${locale}${path}`;

  if (router.isFallback) {
    return <LoadingSpinner locale={locale} />;
  }

  const metaDescription = t('portfolio.detail.metaDescription', {
    artist: item.artist,
    title: item.title,
    description: item.description,
  });

  // Locale availability + fallback chain.
  // availableLocales: only locales with native productionNotes get hreflang pointers.
  // notesForLocale: show English/Korean content when this locale lacks native copy,
  //   but flag the page so we can apply noindex — same pattern as stories fallback.
  const availableLocales = (Object.keys(item.productionNotes ?? {}) as Locale[])
    .filter((l) => locales.includes(l));
  const hasNativeNotes = Boolean(item.productionNotes?.[locale]);
  const notesForLocale =
    item.productionNotes?.[locale]
    ?? item.productionNotes?.en
    ?? item.productionNotes?.ko;
  const isFallbackTranslation = Boolean(notesForLocale) && !hasNativeNotes;
  const isThinPortfolio = !notesForLocale;
  const shouldNoindex = isThinPortfolio || isFallbackTranslation;

  // Build a locale-resolved item so PortfolioDetailBody and MusicRecording schema
  // render fallback content without mutating the original data object.
  const resolvedItem: PortfolioItem = notesForLocale && !hasNativeNotes
    ? { ...item, productionNotes: { ...item.productionNotes, [locale]: notesForLocale } }
    : item;

  const ogImageDimensions = getImageDimensions(item.image);

  const categoryInfo = getCategoryInfo(item.category, categories);
  const schemaImage = item.image.startsWith('http') ? item.image : `${siteConfig.url}${item.image}`;
  const portfolioSchema = generateMusicRecordingSchema(
    {
      title: resolvedItem.title,
      artist: resolvedItem.artist,
      image: schemaImage,
      url: `${siteConfig.url}/${locale}/portfolio/${resolvedItem.id}`,
      genre: categoryInfo.name,
      // Pass production metadata for richer schema (only when available)
      ...(resolvedItem.productionNotes && { productionNotes: resolvedItem.productionNotes }),
      ...(resolvedItem.credits && { credits: resolvedItem.credits }),
      ...(resolvedItem.releaseDate && { datePublished: resolvedItem.releaseDate }),
      ...(resolvedItem.label && { label: resolvedItem.label }),
      ...(resolvedItem.trackList && { trackList: resolvedItem.trackList }),
    },
    siteConfig.url,
    locale
  );
  const detailContentAnimation = DETAIL_CONTENT_ANIMATION;

  const sharePortfolio = async () => {
    const shareUrl = `${siteConfig.url}/${locale}/portfolio/${item.id}`;
    await shareContent({
      title: `${item.title} - ${t('portfolio.detail.titleSuffix')}`,
      text: metaDescription,
      url: shareUrl,
      messages: {
        copied: t('actions.shareCopied'),
        unsupported: t('actions.shareUnsupported'),
      },
    });
  };

  return (
    <>
      <SEO
        locale={locale}
        title={`${item.title} - ${t('portfolio.detail.titleSuffix')}`}
        description={metaDescription}
        canonical={isFallbackTranslation ? undefined : `/${locale}/portfolio/${item.id}`}
        disableCanonicalAndAlternates={isFallbackTranslation}
        availableLocales={availableLocales.length > 0 ? availableLocales : undefined}
        ogImage={item.image}
        ogImageAlt={`${item.title} - ${item.artist}`}
        ogImageWidth={ogImageDimensions.width}
        ogImageHeight={ogImageDimensions.height}
        ogType="music.album"
        includeSchema
        schema={portfolioSchema}
        keywords={`${item.artist}, ${item.title}, ${item.services.join(', ')}, ${siteConfig.name}`}
        {...(shouldNoindex && { robots: 'noindex, follow' })}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.portfolio'), path: `/${locale}/portfolio` },
          { name: item.title, path: `/${locale}/portfolio/${item.id}` },
        ]}
      />
      <Breadcrumb
        items={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.portfolio'), path: `/${locale}/portfolio` },
          { name: item.title, path: `/${locale}/portfolio/${item.id}` },
        ]}
        className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-12 py-3 border-b border-hairline dark:border-white/10"
      />

      <Section tone="canvas" className="pt-8 pb-12">
        <div className="mb-8">
          <Link
            href={getLink("/portfolio")}
            className="inline-flex items-center text-body text-ink-muted-60 hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark hover:underline underline-offset-4 mb-6 min-h-[44px] touch-manipulation rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 transition-colors"
          >
            <ArrowLeft className="mr-2" size={16} aria-hidden="true" />
            {t('portfolio.detail.backToList')}
          </Link>
        </div>

        <div className="max-w-4xl mx-auto">
          <m.div {...detailContentAnimation}>
            <BaseCard variant="featured" className="overflow-hidden">
              <PortfolioDetailSummary
                item={item}
                categoryName={categoryInfo.name}
                categoryColor={categoryInfo.color}
                artistLabel={t('portfolio.detail.artistLabel')}
                servicesTitle={t('portfolio.detail.servicesProvided')}
                listenNowLabel={t('portfolio.detail.listenNow')}
                listenUrl={item.link}
                titleTag="h1"
                imageSectionClassName="mb-6"
                imageWrapperClassName="relative aspect-square max-w-md mx-auto rounded-card overflow-hidden shadow-card border border-hairline dark:border-white/10"
                contentSectionClassName=""
                titleClassName="text-display-xl font-display font-light text-ink dark:text-on-dark mb-2"
                artistClassName="text-body text-ink-muted-60 dark:text-on-dark-soft mb-6"
                servicesHeadingClassName="text-caption-upper uppercase text-ink-muted-60 dark:text-on-dark-soft mb-3"
                actionRowClassName="flex flex-col sm:flex-row gap-4"
                primaryActionClassName="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-ink text-white hover:bg-canvas-deep rounded-pill transition-all font-medium active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 dark:bg-white dark:text-ink dark:hover:bg-on-dark-soft"
                actions={
                  <button
                    type="button"
                    onClick={sharePortfolio}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] border border-hairline-strong text-ink hover:bg-ink/[0.04] rounded-pill transition-all font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 dark:text-on-dark dark:border-white/20 dark:hover:bg-white/[0.06]"
                  >
                    <Share2 size={16} aria-hidden="true" />
                    {t('portfolio.detail.share')}
                  </button>
                }
              />
            </BaseCard>
          </m.div>

          <PortfolioDetailBody
            item={resolvedItem}
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
      </Section>

      <Section tone="warm" className="py-12">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lead text-ink-muted-80 dark:text-on-dark-soft mb-6">
            {t('portfolio.detail.ctaPrompt', '당신의 음악도 완성해 드립니다.')}
          </p>
          {/* prefetch={false}: 본문 fold 내 button CTA들의 무거운 SSG JSON
              자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={getLink('/pricing')}
              prefetch={false}
              className="inline-flex items-center px-6 py-3 min-h-[44px] bg-ink text-white hover:bg-canvas-deep rounded-pill font-medium transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 dark:bg-white dark:text-ink dark:hover:bg-on-dark-soft"
            >
              {t('nav.pricing')}
            </Link>
            <Link
              href={getLink('/contact')}
              prefetch={false}
              className="inline-flex items-center px-6 py-3 min-h-[44px] border border-hairline-strong text-ink hover:bg-ink/[0.04] rounded-pill font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 dark:text-on-dark dark:border-white/20 dark:hover:bg-white/[0.06]"
            >
              {t('nav.contact')}
            </Link>
            <Link
              href={getLink('/studio-info')}
              prefetch={false}
              className="inline-flex items-center px-6 py-3 min-h-[44px] border border-hairline text-ink-muted-60 hover:border-hairline-strong hover:text-ink rounded-pill font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 dark:text-on-dark-soft dark:border-white/10 dark:hover:border-white/20 dark:hover:text-on-dark"
            >
              {t('nav.equipment')}
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: { params: { locale: string; id: string } }[] = [];
  const items = getPortfolioItems(defaultLocale);
  items.forEach((item) => {
    locales.forEach((locale) => {
      paths.push({ params: { locale, id: item.id } });
    });
  });

  return { paths, fallback: 'blocking' };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const portfolioItems = getPortfolioItems(locale);
  const item = portfolioItems.find((p) => p.id === params!.id);
  const categories = getCategories(locale);

  if (!item) {
    return { notFound: true };
  }

  return buildPageStaticProps(
    locale,
    {
      item,
      categories,
    },
    { revalidate: 3600, i18nSections: ['portfolio'] }
  );
};

export default PortfolioDetailPage;
