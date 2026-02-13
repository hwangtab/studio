import type { NextPage, GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import { m } from 'framer-motion';
import { LucideIcon, Music, Shield, Star, MapPin, VolumeX, Wind, Zap, Sparkles, HelpCircle, Target, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import ContactCTA from '../../components/common/ContactCTA';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import BaseCard from '../../components/ui/BaseCard';
import FAQSection from '../../components/ui/FAQSection';
import SectionHeading from '../../components/ui/SectionHeading';
import QuickAnswers from '../../components/ui/QuickAnswers';
import { Section } from '../../components/ui/Section';
import { getCommonStaticPaths, getI18nStaticProps } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getReviews } from '../../data/reviews';
import { getSchemaLanguage } from '../../utils/schemaGenerator';
import { createFadeInAnimation } from '../../utils/animationUtils';

const FeatureCard = ({ icon: Icon, title, description, delay = 0 }: { icon: LucideIcon, title: string, description: string, delay?: number }) => (
  <BaseCard variant="default" delay={delay} className="p-6 h-full">
    <div className="flex items-center mb-4">
      <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
        <Icon className="text-primary dark:text-primary-light" size={24} aria-hidden="true" />
      </div>
      <h3 className="typo-card-title">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </BaseCard>
);

const PainPoint = ({ icon: Icon, text, delay = 0, locale = 'ko' }: { icon: LucideIcon, text: string, delay?: number, locale?: Locale }) => (
  <BaseCard variant="default" delay={delay} className="p-5 h-full">
    <div className="flex items-start">
      <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-full mr-4 text-white flex-shrink-0">
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <p className={`typo-card-body whitespace-normal ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>{text}</p>
      </div>
    </div>
  </BaseCard>
);

const TargetAudience = ({ title, description, icon: Icon, delay = 0 }: { title: string, description: string, icon: LucideIcon, delay?: number }) => (
  <BaseCard variant="default" delay={delay} className="p-6 mb-4">
    <div className="flex items-center mb-2">
      <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
        <Icon className="text-primary dark:text-primary-light" size={24} aria-hidden="true" />
      </div>
      <h3 className="typo-card-subtitle">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </BaseCard>
);

interface PracticeRoomProps {
  locale: Locale;
  reviewsData: ReturnType<typeof getReviews>;
}

const PAIN_POINTS_ANIMATION = createFadeInAnimation();
const AUDIENCE_SECTION_ANIMATION = createFadeInAnimation({ delay: 0.6 });
const FEATURES_SECTION_ANIMATION = createFadeInAnimation({ delay: 0.8 });

const PracticeRoom: NextPage<PracticeRoomProps> = ({ locale, reviewsData }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  const practiceRoomFaqs = React.useMemo(() => ([
    {
      question: t('practiceRoom.faq.items.0.q'),
      answer: t('practiceRoom.faq.items.0.a'),
    },
    {
      question: t('practiceRoom.faq.items.1.q'),
      answer: t('practiceRoom.faq.items.1.a'),
    },
    {
      question: t('practiceRoom.faq.items.2.q'),
      answer: t('practiceRoom.faq.items.2.a'),
    },
    {
      question: t('practiceRoom.faq.items.3.q'),
      answer: t('practiceRoom.faq.items.3.a'),
    },
    {
      question: t('practiceRoom.faq.items.4.q'),
      answer: t('practiceRoom.faq.items.4.a'),
    },
    {
      question: t('practiceRoom.faq.items.5.q'),
      answer: t('practiceRoom.faq.items.5.a'),
    },
  ]), [t]);

  const practiceRoomQuickAnswers = React.useMemo(() => practiceRoomFaqs.slice(0, 3), [practiceRoomFaqs]);
  const schemaLanguage = React.useMemo(() => getSchemaLanguage(locale), [locale]);

  const practiceRoomSchema = React.useMemo(() => ({
    '@type': 'Service',
    name: t('practiceRoom.seo.title'),
    description: t('practiceRoom.seo.description'),
    inLanguage: schemaLanguage,
    serviceType: t('nav.practiceRoom'),
    areaServed: siteConfig.contact.address,
    provider: {
      '@type': 'Organization',
      '@id': `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
    },
    url: `${siteConfig.url}/${locale}/practice-room`,
  }), [t, siteConfig, locale, schemaLanguage]);

  return (
    <>
      <SEO
        title={t('practiceRoom.seo.title')}
        description={t('practiceRoom.seo.description')}
        keywords={t('practiceRoom.seo.keywords')}
        includeSchema={true}
        faqItems={practiceRoomFaqs}
        schema={practiceRoomSchema}
        reviewItems={reviewsData.filter((r) => (r as { categoryKey?: string }).categoryKey === 'practice')}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.practiceRoom'), path: `/${locale}/practice-room` },
        ]}
      />
      <ImageHero
        locale={locale}
        title={t('practiceRoom.hero.title')}
        subtitle={
          <>
            {t('practiceRoom.hero.subtitleLine1')}
            <br />
            {t('practiceRoom.hero.subtitleLine2')}
          </>
        }
        backgroundImage="/images/room5.jpg"
        imageAlt={t('practiceRoom.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
      />

      <QuickAnswers
        title={t('practiceRoom.faq.title')}
        subtitle={t('practiceRoom.faq.subtitle')}
        items={practiceRoomQuickAnswers}
        variant="default"
      />

      {/* 고민 섹션 */}
      <Section variant="default">
        <m.div {...PAIN_POINTS_ANIMATION}>
          <SectionHeading
            icon={HelpCircle}
            title={t('practiceRoom.painPoints.title')}
            className="mb-8"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <PainPoint icon={Wind} text={t('practiceRoom.painPoints.items.0')} delay={0.1} locale={locale} />
            <PainPoint icon={VolumeX} text={t('practiceRoom.painPoints.items.1')} delay={0.2} locale={locale} />
            <PainPoint icon={Wind} text={t('practiceRoom.painPoints.items.2')} delay={0.3} locale={locale} />
            <PainPoint icon={Zap} text={t('practiceRoom.painPoints.items.3')} delay={0.4} locale={locale} />
            <PainPoint icon={Sparkles} text={t('practiceRoom.painPoints.items.4')} delay={0.5} locale={locale} />
          </div>
        </m.div>
      </Section>

      {/* 타겟 오디언스 섹션 */}
      <Section variant="alternate">
        <m.div {...AUDIENCE_SECTION_ANIMATION}>
          <SectionHeading
            icon={Target}
            title={t('practiceRoom.audience.title')}
            className="mb-6"
            titleClassName="text-primary"
          />

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <TargetAudience
              title={t('practiceRoom.audience.items.0.title')}
              description={t('practiceRoom.audience.items.0.description')}
              icon={MapPin}
              delay={0.1}
            />
            <TargetAudience
              title={t('practiceRoom.audience.items.1.title')}
              description={t('practiceRoom.audience.items.1.description')}
              icon={Star}
              delay={0.2}
            />
            <TargetAudience
              title={t('practiceRoom.audience.items.2.title')}
              description={t('practiceRoom.audience.items.2.description')}
              icon={Music}
              delay={0.3}
            />
          </div>

          {/* 이미지 갤러리 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[2, 3, 4, 5].map((i) => (
              <m.div
                key={i}
                className="rounded-lg overflow-hidden shadow-md h-48"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <ResponsiveImage
                  src={`/images/room${i}.jpg`}
                  alt={t('practiceRoom.gallery.alt', { index: i })}
                  className="w-full h-full object-cover"
                  pictureClassName="block h-full"
                  loading="lazy"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  fill
                />
              </m.div>
            ))}
          </div>
        </m.div>
      </Section>

      <Section variant="default">
        <m.div {...FEATURES_SECTION_ANIMATION}>
          <SectionHeading
            icon={ShieldCheck}
            title={t('practiceRoom.features.title')}
            titleClassName="text-heading-2 font-title font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
            className="mb-12"
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <FeatureCard
              icon={Music}
              title={t('practiceRoom.features.items.0.title')}
              description={t('practiceRoom.features.items.0.description')}
              delay={0.1}
            />

            <FeatureCard
              icon={Shield}
              title={t('practiceRoom.features.items.1.title')}
              description={t('practiceRoom.features.items.1.description')}
              delay={0.2}
            />

            <FeatureCard
              icon={Star}
              title={t('practiceRoom.features.items.2.title')}
              description={t('practiceRoom.features.items.2.description')}
              delay={0.3}
            />

            <FeatureCard
              icon={MapPin}
              title={t('practiceRoom.features.items.3.title')}
              description={t('practiceRoom.features.items.3.description')}
              delay={0.4}
            />
          </div>
        </m.div>
      </Section>

      <FAQSection
        items={practiceRoomFaqs}
        title={t('practiceRoom.faq.title')}
        subtitle={t('practiceRoom.faq.subtitle')}
        variant="alternate"
      />

      <Section variant="default" className="py-16">
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('practiceRoom.cta.titleLine1')}<br />
              <span className="text-primary">{t('practiceRoom.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('practiceRoom.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('practiceRoom.cta.subtitleLine2')}
            </>
          }
          imageSrc="/images/room8.jpg"
          imageAlt={t('practiceRoom.cta.imageAlt')}
          primaryButtonLabel={t('practiceRoom.cta.inquiry')}
          secondaryButtonLabel={t('practiceRoom.cta.location')}
        />
      </Section>
    </>
  );
};

(PracticeRoom as NextPage & { hasHero?: boolean }).hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = (params?.locale as Locale) || 'ko';
  const reviewsData = getReviews(locale);
  return {
    props: {
      ...getI18nStaticProps(locale),
      reviewsData,
    },
    revalidate: 86400,
  };
};

export default PracticeRoom;
