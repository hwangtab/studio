import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Package, Users, DollarSign, Disc } from 'lucide-react';
import SEO from '../SEO';
import SectionHeading from '../ui/SectionHeading';
import ImageHero from '../common/ImageHero';
import { Section } from '../ui/Section';
import type { Locale } from '../../lib/i18n';
import type { PortfolioItem } from '../../types/data';

const ContactCTA = dynamic(() => import('../common/ContactCTA'));

interface InProgressItem {
  artist: string;
  title: string;
  typeKey: string;
}

interface TierPageProps {
  locale: Locale;
  tier: 'single' | 'ep' | 'album';
  portfolioItems: Pick<PortfolioItem, 'id' | 'title' | 'description' | 'image' | 'artist' | 'featured'>[];
  inProgressItems: InProgressItem[];
}

const ALL_IN_PROGRESS: InProgressItem[] = [
  { artist: '마리코 & 유키에', title: '〈남산타워〉 정규앨범', typeKey: 'fullAlbum' },
  { artist: 'Sabbaha', title: '정규 2집', typeKey: 'fullAlbum' },
  { artist: '남자애', title: '릴레이 싱글', typeKey: 'single' },
  { artist: 'Sickbaby', title: '정규 2집', typeKey: 'fullAlbum' },
  { artist: '더블제이정', title: '미니앨범', typeKey: 'ep' },
];

const TIER_TYPE_KEYS: Record<string, string[]> = {
  single: ['single'],
  ep: ['ep', 'miniAlbum'],
  album: ['fullAlbum'],
};

const TIER_HERO_IMAGE = '/images/studio2.webp';

export const TierPage: React.FC<TierPageProps> = ({ locale, tier, portfolioItems }) => {
  const { t } = useTranslation('common', { lng: locale });
  const getLink = (path: string) => `/${locale}${path}`;
  const k = (key: string) => `releaseProject.tiers.${tier}.detail.${key}`;

  const personaItems = t(k('personaItems'), { returnObjects: true }) as string[];
  const deliverablesItems = t(k('deliverablesItems'), { returnObjects: true }) as string[];

  const tierTypeKeys = TIER_TYPE_KEYS[tier] ?? [];
  const filteredInProgress = ALL_IN_PROGRESS.filter((item) => tierTypeKeys.includes(item.typeKey));

  const inProgressTypeLabels: Record<string, string> = {
    fullAlbum: t('releaseProject.inProgress.types.fullAlbum'),
    single: t('releaseProject.inProgress.types.single'),
    ep: t('releaseProject.inProgress.types.ep'),
    miniAlbum: t('releaseProject.inProgress.types.miniAlbum'),
  };

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={t(`releaseProject.seo.${tier}.title`)}
        description={t(`releaseProject.seo.${tier}.description`)}
        keywords={t(`releaseProject.seo.${tier}.keywords`)}
        canonical={`/${locale}/release-project/${tier}`}
      />

      <ImageHero
        locale={locale}
        priority
        title={
          <>
            <span className="block mb-2 text-gray-100 drop-shadow-lg">{t(k('heroTitlePrefix'))}</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#a8c0ff] to-white drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              {t(k('heroTitleHighlight'))}
            </span>
            <span className="text-gray-100 drop-shadow-lg"> {t(k('heroTitleSuffix'))}</span>
          </>
        }
        subtitle={t(k('heroSubtitle'))}
        backgroundImage={TIER_HERO_IMAGE}
        imageAlt={t('releaseProject.hero.imageAlt')}
        minHeight="min-h-[60svh]"
        ctaButtons={
          <>
            <Link
              href={getLink('/contact')}
              prefetch={false}
              className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-white text-primary-dark font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {t('releaseProject.hero.ctaConsult')}
            </Link>
            <Link
              href={getLink('/release-project')}
              prefetch={false}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-primary border-2 border-primary text-white font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-primary-dark hover:border-primary-dark transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
            >
              <ArrowLeft size={16} />
              {t(k('linkBack'))}
            </Link>
          </>
        }
      />

      {/* 페르소나 — 이런 분께 적합합니다 */}
      <Section variant="default">
        <SectionHeading
          icon={Users}
          title={t(k('personaSectionTitle'))}
          className="mb-10"
        />
        <div className="max-w-2xl mx-auto space-y-3">
          {Array.isArray(personaItems) && personaItems.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <CheckCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">{item}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 호흡·결과물 */}
      <Section variant="alternate">
        <SectionHeading
          icon={Clock}
          title={t(k('deliverablesSectionTitle'))}
          className="mb-10"
        />
        <div className="max-w-2xl mx-auto space-y-3">
          {Array.isArray(deliverablesItems) && deliverablesItems.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <Package size={20} className="text-primary flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 가격 레인지 */}
      <Section variant="default">
        <SectionHeading
          icon={DollarSign}
          title={t(k('priceSectionTitle'))}
          className="mb-10"
        />
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md border border-gray-100 dark:border-gray-700 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t(k('priceRange'))}</p>
            <p className="text-sm text-primary font-medium mb-4">{t(k('priceRationale'))}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t(k('priceNote'))}</p>
          </div>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            {t('releaseProject.tiers.footNotePre')}{' '}
            <strong>{t('releaseProject.tiers.footNoteHighlight')}</strong>{' '}
            {t('releaseProject.tiers.footNoteMid')}{' '}
            <Link href={getLink('/pricing')} className="text-primary underline underline-offset-2 hover:text-primary-dark">
              {t('releaseProject.tiers.footNotePricingLabel')}
            </Link>
            {t('releaseProject.tiers.footNotePost')}
          </p>
        </div>
      </Section>

      {/* 지금 함께 만들고 있는 작업들 */}
      {filteredInProgress.length > 0 && (
        <Section variant="alternate">
          <SectionHeading
            icon={Disc}
            title={t(k('inProgressSectionTitle'))}
            subtitle={t('releaseProject.inProgress.sectionSubtitle')}
            className="mb-10"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {filteredInProgress.map((item) => (
              <div
                key={`${item.artist}-${item.title}`}
                className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <span className="inline-block text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5 mb-3">
                  {inProgressTypeLabels[item.typeKey] ?? item.typeKey}
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">{item.artist}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.title}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-8 max-w-xl mx-auto">
            {t('releaseProject.inProgress.footNote')}
          </p>
        </Section>
      )}

      {/* 디스코그래피 */}
      {portfolioItems.length > 0 && (
        <Section variant="default">
          <SectionHeading
            icon={Disc}
            title={t('releaseProject.discography.sectionTitle')}
            subtitle={t('releaseProject.discography.sectionSubtitle')}
            className="mb-10"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {portfolioItems.map((item) => (
              <Link
                key={item.id}
                href={getLink(`/portfolio/${item.id}`)}
                className="group block bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
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
              {t('releaseProject.discography.viewAll')} <ArrowRight size={16} />
            </Link>
          </div>
        </Section>
      )}

      <ContactCTA
        locale={locale}
        title={
          <>
            {t('releaseProject.cta.titleLine1')}<br />
            <span className="text-primary">{t('releaseProject.cta.titleHighlight')}</span>
          </>
        }
        subtitle={t('releaseProject.cta.subtitle')}
        imageSrc="/images/studio2.webp"
        imageAlt={t('releaseProject.cta.imageAlt')}
        primaryButtonLabel={t('releaseProject.cta.inquiry')}
      />
    </div>
  );
};

TierPage.displayName = 'TierPage';
