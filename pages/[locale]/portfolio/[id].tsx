import React from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { m } from 'framer-motion';
import { ArrowLeft, Share2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../../components/SEO';
import ResponsiveImage from '../../../components/ResponsiveImage';
import { getPortfolioItems, getCategories } from '../../../data/portfolio';
import type { PortfolioItem, PortfolioCategory } from '../../../types/data';
import { shareContent } from '../../../utils/shareUtils';
import { getCategoryInfo } from '../../../utils/portfolioDataUtils';
import { generateMusicRecordingSchema } from '../../../utils/schemaGenerator';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Section } from '../../../components/ui/Section';
import { getI18nStaticProps } from '../../../lib/getStatic';
import { defaultLocale, type Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { createEnterAnimation } from '../../../utils/animationUtils';
import { useDisableMotionEffects } from '../../../utils/deviceUtils';

interface PortfolioDetailPageProps {
  locale: Locale;
  item: PortfolioItem;
  categories: PortfolioCategory[];
}

const DETAIL_CONTENT_ANIMATION = createEnterAnimation();

const PortfolioDetailPage: NextPage<PortfolioDetailPageProps> = ({ locale, item, categories }) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });
  const disableMotionEffects = useDisableMotionEffects();
  const siteConfig = getSiteConfig(locale);

  const getLink = (path: string) => `/${locale}${path}`;
  const metaDescription = t('portfolio.detail.metaDescription', {
    artist: item.artist,
    title: item.title,
    description: item.description,
  });

  const categoryInfo = getCategoryInfo(item.category, categories);
  const schemaImage = item.image.startsWith('http') ? item.image : `${siteConfig.url}${item.image}`;
  const portfolioSchema = generateMusicRecordingSchema(
    {
      title: item.title,
      artist: item.artist,
      image: schemaImage,
      url: `${siteConfig.url}/${locale}/portfolio/${item.id}`,
      genre: categoryInfo.name,
    },
    siteConfig.url,
    locale
  );
  const detailContentAnimation = disableMotionEffects
    ? { initial: false, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
    : DETAIL_CONTENT_ANIMATION;

  if (router.isFallback) {
    return <LoadingSpinner locale={locale} />;
  }

  const sharePortfolio = async () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr';
    const shareUrl = `${siteUrl}/${locale}/portfolio/${item.id}`;
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
        title={`${item.title} - ${t('portfolio.detail.titleSuffix')}`}
        description={metaDescription}
        ogImage={item.image}
        ogType="music.album"
        includeSchema
        schema={portfolioSchema}
        keywords={`${item.artist}, ${item.title}, ${item.services.join(', ')}, ${siteConfig.name}`}
      />
      <Section variant="default" className="pt-8 pb-12">
        <div className="mb-8">
          <Link
            href={getLink("/portfolio")}
            className="inline-flex items-center typo-card-cta hover:underline mb-6 min-h-[44px] touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
          >
            <ArrowLeft className="mr-2" size={16} aria-hidden="true" />
            {t('portfolio.detail.backToList')}
          </Link>
        </div>

        <div className="max-w-4xl mx-auto">
          <m.div
            {...detailContentAnimation}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="relative aspect-square max-w-md mx-auto mt-8">
              <ResponsiveImage
                src={item.image}
                alt={item.title}
                className="object-cover rounded-lg"
                pictureClassName="block w-full h-full"
                sizes="(min-width: 768px) 400px, 100vw"
                fill
              />
            </div>

            <div className="p-8">
              <div className="mb-4">
                <span
                  className="inline-block px-3 py-1 text-sm font-medium text-white rounded-full"
                  style={{ backgroundColor: categoryInfo.color }}
                >
                  {categoryInfo.name}
                </span>
              </div>

              <h1 className="text-heading-2 font-title mb-2">
                {item.title}
              </h1>

              <p className="typo-card-body mb-6">
                {t('portfolio.detail.artistLabel')}: {item.artist}
              </p>

              <div className="mb-8">
                <h2 className="typo-card-title mb-3">
                  {t('portfolio.detail.servicesProvided')}
                </h2>
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

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
                >
                  <ExternalLink size={16} aria-hidden="true" />
                  {t('portfolio.detail.listenNow')}
                </a>
                <button
                  type="button"
                  onClick={sharePortfolio}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-lg transition-colors font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                >
                  <Share2 size={16} aria-hidden="true" />
                  {t('portfolio.detail.share')}
                </button>
              </div>
            </div>
          </m.div>
        </div>
      </Section>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: { params: { locale: string; id: string } }[] = [];
  const items = getPortfolioItems(defaultLocale);
  items
    .filter((item) => item.featured)
    .forEach((item) => {
      paths.push({ params: { locale: defaultLocale, id: item.id } });
    });

  return { paths, fallback: 'blocking' };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = (params?.locale as Locale) || 'ko';
  const portfolioItems = getPortfolioItems(locale);
  const item = portfolioItems.find((p) => p.id === params!.id);
  const categories = getCategories(locale);

  if (!item) {
    return { notFound: true };
  }

  return {
    props: {
      ...getI18nStaticProps(locale),
      item,
      categories
    },
    revalidate: 3600,
  };
};

export default PortfolioDetailPage;
