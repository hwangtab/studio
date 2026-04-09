import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { LucideIcon, Music, Shield, Star, MapPin, VolumeX, Wind, Zap, Sparkles, HelpCircle, Target, ShieldCheck, ArrowRight, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import ContactCTA from '../../components/common/ContactCTA';
import ReviewSection from '../../components/ui/ReviewSection';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import BaseCard from '../../components/ui/BaseCard';
import FAQSection from '../../components/ui/FAQSection';
import SectionHeading from '../../components/ui/SectionHeading';
import QuickAnswers from '../../components/ui/QuickAnswers';
import { Section } from '../../components/ui/Section';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getReviews } from '../../data/reviews';
import { getSchemaLanguage } from '../../utils/schemaGenerator';
import { createFadeInAnimation, HOVER_SCALE } from '../../utils/animationUtils';
import type { NextPageWithLayout } from '../../types';

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

const PracticeRoom: NextPageWithLayout<PracticeRoomProps> = ({ locale, reviewsData }) => {
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
    {
      question: t('practiceRoom.faq.items.6.q'),
      answer: t('practiceRoom.faq.items.6.a'),
    },
    {
      question: t('practiceRoom.faq.items.7.q'),
      answer: t('practiceRoom.faq.items.7.a'),
    },
  ]), [t]);

  const practiceRoomQuickAnswers = React.useMemo(() => practiceRoomFaqs.slice(0, 3), [practiceRoomFaqs]);
  const schemaLanguage = React.useMemo(() => getSchemaLanguage(locale), [locale]);

  const practiceRoomSchema = React.useMemo(() => ({
    '@type': 'Service',
    name: t('practiceRoom.seo.title'),
    description: t('practiceRoom.seo.description'),
    inLanguage: schemaLanguage,
    serviceType: locale === 'ko' ? '음악연습실' : t('nav.practiceRoom'),
    areaServed: [
      { '@type': 'City', name: locale === 'ko' ? '서울' : 'Seoul' },
      { '@type': 'AdministrativeArea', name: locale === 'ko' ? '은평구' : 'Eunpyeong-gu' },
    ],
    provider: {
      '@type': 'Organization',
      '@id': `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
    },
    url: `${siteConfig.url}/${locale}/practice-room`,
    hoursAvailable: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '00:00',
      closes: '23:59',
    },
    offers: {
      '@type': 'Offer',
      name: locale === 'ko' ? '음악연습실 월정액 입주 프로그램' : 'Monthly Practice Room Residency Program',
      priceCurrency: 'KRW',
      price: 300000,
      availability: 'https://schema.org/InStock',
      url: `${siteConfig.url}/${locale}/practice-room`,
    },
  }), [t, siteConfig, locale, schemaLanguage]);
  const painPointsAnimation = PAIN_POINTS_ANIMATION;
  const audienceSectionAnimation = AUDIENCE_SECTION_ANIMATION;
  const featuresSectionAnimation = FEATURES_SECTION_ANIMATION;

  return (
    <>
      <SEO
        title={t('practiceRoom.seo.title')}
        description={t('practiceRoom.seo.description')}
        keywords={t('practiceRoom.seo.keywords')}
        ogImage="/images/room5.webp"
        ogImageAlt={t('practiceRoom.hero.alt')}
        ogImageWidth={1440}
        ogImageHeight={810}
        includeSchema={true}
        webPageType="ItemPage"
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
        priority
        title={t('practiceRoom.hero.title')}
        subtitle={
          <>
            {t('practiceRoom.hero.subtitleLine1')}
            <br />
            {t('practiceRoom.hero.subtitleLine2')}
          </>
        }
        backgroundImage="/images/room5.webp"
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
        <m.div {...painPointsAnimation}>
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
        <m.div {...audienceSectionAnimation}>
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
                whileHover={HOVER_SCALE}
                transition={{ duration: 0.3 }}
              >
                <ResponsiveImage
                  src={`/images/room${i}.webp`}
                  alt={t(`practiceRoom.gallery.alt_${i}`)}
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
        <m.div {...featuresSectionAnimation}>
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

      <ReviewSection variant="default" locale={locale} />

      {/* 관련 가이드 — Pillar→Cluster 내부 링크 (한국어 SEO) */}
      {locale === 'ko' && (
        <Section variant="default" className="py-10">
          <div className="max-w-5xl mx-auto">
            <SectionHeading
              icon={BookOpen}
              title={t('practiceRoom.relatedGuides.title')}
              className="mb-6"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  'practice-room-guide1',
                  'practice-room-price1',
                  'practice-room-rental1',
                  'practice-room-monthly1',
                  'practice-room-soundproof1',
                  'practice-room-vocal1',
                  'practice-room-startup1',
                  'practice-room-transfer1',
                  'practice-room-piano1',
                  'practice-room-yeonsinnae1',
                  'practice-room-private1',
                  'practice-room-guitar1',
                  'practice-room-drum1',
                  'practice-room-bass1',
                  'practice-room-night1',
                  'practice-room-nodeposit1',
                  'practice-room-music-college1',
                  'practice-room-etiquette1',
                  'practice-room-equipment1',
                  'practice-room-seoul1',
                  'practice-room-vs-home1',
                  'practice-room-pre-recording1',
                  'practice-room-hobby1',
                  'practice-room-audition1',
                  'practice-room-bulgwang1',
                  'practice-room-eunpyeong1',
                  'practice-room-goyang1',
                  'practice-room-lesson1',
                  'practice-room-vs-studio1',
                  'practice-room-contract1',
                  'practice-room-booking1',
                  'practice-room-weekend1',
                  'practice-room-mapo1',
                  'practice-room-sinchon1',
                  'practice-room-vs-karaoke1',
                  'practice-room-keyboard1',
                  'practice-room-gangbuk1',
                  'practice-room-jongno1',
                  'practice-room-entrance1',
                  'practice-room-gangnam1',
                  'practice-room-gangseo1',
                  'practice-room-storage1',
                  'practice-room-recording1',
                  'practice-room-vs-rehearsal1',
                  'practice-room-midi1',
                  'practice-room-cooling1',
                  'practice-room-songpa1',
                  'practice-room-gwanak1',
                  'practice-room-first1',
                  'practice-room-uijeongbu1',
                  'practice-room-unmanned1',
                  'practice-room-bucheon1',
                  'practice-room-seongnam1',
                  'practice-room-suwon1',
                  'practice-room-hongdae1',
                  'practice-room-dongdaemun1',
                  'practice-room-yongsan1',
                  'practice-room-namyangju1',
                  'practice-room-guro1',
                  'practice-room-busking1',
                  'practice-room-nowon1',
                  'practice-room-singer-songwriter1',
                  'practice-room-office-worker1',
                  'practice-room-voice-training1',
                  'practice-room-comeback1',
                  'practice-room-piano-beginner1',
                  'practice-room-guitar-beginner1',
                  'practice-room-kids1',
                  'practice-room-college-student1',
                  'practice-room-anxiety1',
                  'practice-room-classical1',
                  'practice-room-idol1',
                  'practice-room-cover1',
                  'practice-room-composition1',
                  'practice-room-wedding1',
                  'practice-room-church1',
                  'practice-room-drumless1',
                  'practice-room-senior1',
                  'practice-room-jazz1',
                  'practice-room-kpop1',
                  'practice-room-musical1',
                  'practice-room-wind1',
                  'practice-room-rappers1',
                  'practice-room-string1',
                  'practice-room-acoustic-guitar1',
                  'practice-room-band-vocal1',
                  'practice-room-concentration1',
                  'practice-room-electric-guitar1',
                  'practice-room-vocal-beginner1',
                  'practice-room-rehearsal-vocal1',
                  'practice-room-housewife1',
                  'practice-room-stress1',
                  'practice-room-adult-beginner1',
                  'practice-room-healing1',
                  'practice-room-content-creator1',
                  'practice-room-couple1',
                  'practice-room-voice-health1',
                  'practice-room-goal-setting1',
                  'practice-room-competition1',
                  'practice-room-self-study1',
                  'practice-room-theory1',
                  'practice-room-demo1',
                  'practice-room-rhythm1',
                  'practice-room-improvisation1',
                  'practice-room-ensemble-prep1',
                  'practice-room-smart-practice1',
                  'practice-room-ear-training1',
                  'practice-room-mix-voice1',
                  'practice-room-repertoire1',
                  'practice-room-motivation1',
                  'practice-room-pronunciation1',
                  'practice-room-memory1',
                  'practice-room-physical1',
                  'practice-room-session1',
                  'practice-room-certification1',
                  'practice-room-family1',
                  'practice-room-genre-switch1',
                  'practice-room-event1',
                  'practice-room-warm-up1',
                  'practice-room-journal1',
                  'practice-room-recital1',
                  'practice-room-stamina1',
                  'practice-room-online-lesson1',
                  'practice-room-shortterm1',
                  'practice-room-gugak1',
                  'practice-room-trot1',
                  'practice-room-choir1',
                  'practice-room-teacher1',
                  'practice-room-rnb1',
                  'practice-room-instrument-change1',
                  'practice-room-video-audition1',
                  'practice-room-medley1',
                  'practice-room-expression1',
                  'practice-room-speed1',
                  'practice-room-vocal-color1',
                  'practice-room-livestream1',
                  'practice-room-accompanist1',
                  'practice-room-harmony1',
                  'practice-room-burnout1',
                  'practice-room-ukulele1',
                  'practice-room-violin1',
                  'practice-room-cello1',
                  'practice-room-saxophone1',
                  'practice-room-fingerstyle1',
                  'practice-room-jazz-piano1',
                  'practice-room-posture1',
                  'practice-room-habit1',
                  'practice-room-stage-manner1',
                  'practice-room-digital-piano1',
                  'practice-room-mental-training1',
                  'practice-room-breath-control1',
                  'practice-room-sight-reading1',
                  'practice-room-trumpet1',
                  'practice-room-flute1',
                  'practice-room-classical-guitar1',
                  'practice-room-vibrato1',
                  'practice-room-ccm1',
                  'practice-room-latin-music1',
                  'practice-room-blues1',
                  'practice-room-vocal-technique1',
                  'practice-room-opera1',
                  'practice-room-guitar-chord1',
                  'practice-room-cajon1',
                  'practice-room-piano-technique1',
                  'practice-room-bass-technique1',
                  'practice-room-guitar-solo1',
                  'practice-room-indie1',
                  'practice-room-drum-groove1',
                  'practice-room-piano-ballad1',
                  'practice-room-vocal-low1',
                  'practice-room-pop-piano1',
                  'practice-room-arts-high1',
                  'practice-room-piano-wedding1',
                  'practice-room-music-portfolio1',
                  'practice-room-electric-bass1',
                  'practice-room-musical-theater1',
                  'practice-room-fingerpicking1',
                  'practice-room-chord-melody1',
                  'practice-room-drum-rudiment1',
                  'practice-room-vocal-power1',
                  'practice-room-vocal-range1',
                  'practice-room-piano-classical1',
                  'practice-room-guitar-barre1',
                  'practice-room-piano-jazz-chord1',
                  'practice-room-songwriting1',
                  'practice-room-vocal-accent1',
                  'practice-room-jazz-theory1',
                  'practice-room-guitar-picking1',
                  'practice-room-oboe1',
                  'practice-room-vocal-intonation1',
                  'practice-room-piano-pedal1',
                  'practice-room-guitar-sweep1',
                  'practice-room-bass-walking1',
                  'practice-room-percussion1',
                  'practice-room-piano-sight-reading1',
                  'practice-room-vocal-gospel1',
                  'practice-room-rock-band1',
                  'practice-room-vocal-whistle1',
                  'practice-room-guitar-blues-scale1',
                  'practice-room-keyboard-synth1',
                  'practice-room-piano-improv1',
                  'practice-room-vocal-rasp1',
                  'practice-room-drum-electronic1',
                  'practice-room-vocal-technique21',
                  'practice-room-guitar-fingerstyle21',
                  'practice-room-piano-memorization1',
                  'practice-room-bass-groove1',
                  'practice-room-vocal-mix1',
                  'practice-room-guitar-theory1',
                  'practice-room-vocal-sustain1',
                  'practice-room-piano-technique21',
                  'practice-room-drum-fill1',
                  'practice-room-vocal-warm-up1',
                  'practice-room-guitar-chord21',
                  'practice-room-piano-left-hand1',
                  'practice-room-saxophone21',
                  'practice-room-bass-beginner1',
                  'practice-room-pop-vocal1',
                  'practice-room-jazz-vocal1',
                  'practice-room-guitar-capo1',
                  'practice-room-drum-jazz1',
                  'practice-room-piano-pop1',
                  'practice-room-guitar-hybrid1',
                  'practice-room-vocal-cover1',
                  'practice-room-piano-chord-voicing1',
                  'practice-room-vocal-stage1',
                  'practice-room-guitar-pentatonic-modes1',
                  'practice-room-vocal-breath21',
                  'practice-room-piano-rhythm1',
                  'practice-room-guitar-whammy1',
                  'practice-room-vocal-dynamics1',
                  'practice-room-guitar-string1',
                  'practice-room-drum-brush1',
                  'practice-room-piano-sight-play1',
                  'practice-room-bass-chord1',
                  'practice-room-vocal-falsetto1',
                  'practice-room-guitar-tapping1',
                  'practice-room-piano-duet1',
                  'practice-room-drum-polyrhythm1',
                  'practice-room-vocal-agility1',
                  'practice-room-piano-jazz-improv1',
                  'practice-room-guitar-legato1',
                  'practice-room-bass-funk1',
                  'practice-room-vocal-projection1',
                  'practice-room-piano-technique31',
                  'practice-room-guitar-slide1',
                  'practice-room-vocal-style1',
                  'practice-room-guitar-acoustic-fingerpick1',
                  'practice-room-drum-hihat1',
                  'practice-room-piano-trills1',
                  'practice-room-guitar-chord-prog1',
                  'practice-room-vocal-genre1',
                  'practice-room-bass-thumb1',
                  'practice-room-piano-ballad21',
                  'practice-room-guitar-arpeggio1',
                  'practice-room-vocal-recording1',
                  'practice-room-piano-gospel1',
                  'practice-room-guitar-fingerpick-adv1',
                  'practice-room-drum-kick1',
                  'practice-room-vocal-belting1',
                  'practice-room-piano-comping1',
                  'practice-room-guitar-mute1',
                  'practice-room-bass-fingering1',
                  'practice-room-vocal-staccato1',
                  'practice-room-drum-cymbal1',
                  'practice-room-piano-crosshand1',
                  'practice-room-guitar-scale-pos1',
                  'practice-room-vocal-legato1',
                  'practice-room-piano-four-hands1',
                  'practice-room-guitar-left-hand1',
                  'practice-room-vocal-overtone1',
                  'practice-room-drum-snare1',
                  'practice-room-guitar-finger-vibrato1',
                  'practice-room-piano-rubato1',
                  'practice-room-bass-effects1',
                  'practice-room-vocal-crooning1',
                  'practice-room-piano-sonata1',
                  'practice-room-guitar-jazz-chord1',
                  'practice-room-drum-speed1',
                  'practice-room-vocal-middle1',
                  'practice-room-piano-etude1',
                  'practice-room-guitar-open-tuning1',
                  'practice-room-vocal-ensemble1',
                  'practice-room-bass-pick1',
                  'practice-room-drum-count1',
                  'practice-room-piano-chromatic1',
                  'practice-room-guitar-stretch1',
                  'practice-room-vocal-pitch1',
                  'practice-room-bass-slide1',
                  'practice-room-piano-dynamics1',
                  'practice-room-drum-ghost1',
                  'practice-room-guitar-chord-arpeggio1',
                  'practice-room-vocal-solfege1',
                  'practice-room-piano-polyphony1',
                  'practice-room-guitar-riff1',
                  'practice-room-drum-offbeat1',
                  'practice-room-vocal-consonant1',
                  'practice-room-piano-modulation1',
                  'practice-room-guitar-fingerpick-pattern1',
                  'practice-room-bass-muting1',
                  'practice-room-drum-doublekick1',
                  'practice-room-piano-jazz-standard1',
                  'practice-room-vocal-live1',
                  'practice-room-guitar-memory1',
                  'practice-room-piano-leaps1',
                  'practice-room-drum-buildup1',
                  'practice-room-bass-pentatonic1',
                  'practice-room-vocal-emotion1',
                  'practice-room-guitar-hammer-pull1',
                  'practice-room-piano-inner-voice1',
                  'practice-room-drum-rimshot-adv1',
                  'practice-room-vocal-musical-style1',
                  'practice-room-bass-slap-adv1',
                  'practice-room-piano-sight-adv1',
                  'practice-room-drum-timing1',
                  'practice-room-vocal-breath-adv1',
                  'practice-room-guitar-vibrato1',
                  'practice-room-piano-chord-adv1',
                  'practice-room-bass-jazz1',
                  'practice-room-vocal-color-adv1',
                  'practice-room-drum-linear1',
                  'practice-room-piano-technique-adv1',
                  'practice-room-guitar-chord-adv1',
                  'practice-room-vocal-register1',
                  'practice-room-bass-root-adv1',
                  'practice-room-piano-touch1',
                  'practice-room-drum-jazz-adv1',
                  'practice-room-vocal-stage-adv1',
                  'practice-room-guitar-improv1',
                  'practice-room-piano-beginner-adult1',
                  'practice-room-drum-accent1',
                  'practice-room-bass-octave1',
                  'practice-room-piano-interval1',
                  'practice-room-vocal-audition1',
                  'practice-room-guitar-fingerstyle-adv1',
                  'practice-room-drum-brush1',
                  'practice-room-bass-harmonic1',
                  'practice-room-piano-pedal1',
                  'practice-room-guitar-slide1',
                  'practice-room-vocal-pitch1',
                  'practice-room-drum-hihat1',
                  'practice-room-piano-scale-adv1',
                  'practice-room-bass-tapping1',
                  'practice-room-vocal-rhythm1',
                  'practice-room-guitar-jazz-voicing1',
                  'practice-room-drum-cymbal1',
                  'practice-room-piano-jazz1',
                  'practice-room-vocal-harmony1',
                  'practice-room-drum-double-kick1',
                  'practice-room-bass-pick1',
                  'practice-room-guitar-open-tuning1',
                  'practice-room-vocal-mic1',
                  'practice-room-piano-concerto1',
                  'practice-room-drum-fill-adv1',
                  'practice-room-bass-country1',
                  'practice-room-guitar-picking-adv1',
                  'practice-room-vocal-diction1',
                  'practice-room-drum-metronome1',
                  'practice-room-piano-sonata1',
                  'practice-room-bass-ensemble1',
                  'practice-room-guitar-blues1',
                  'practice-room-vocal-indie1',
                  'practice-room-drum-rimshot1',
                  'practice-room-bass-walking1',
                  'practice-room-piano-comping1',
                  'practice-room-guitar-fingerpicking1',
                  'practice-room-vocal-register1',
                  'practice-room-drum-polyrhythm1',
                  'practice-room-piano-leadsheet1',
                  'practice-room-bass-slap1',
                  'practice-room-guitar-chord-change1',
                  'practice-room-drum-snare-tuning1',
                  'practice-room-vocal-breath1',
                  'practice-room-piano-key-signature1',
                  'practice-room-guitar-strumming1',
                  'practice-room-drum-jazz-ride1',
                  'practice-room-bass-root-fifth1',
                  'practice-room-vocal-style1',
                  'practice-room-piano-rhythm1',
                  'practice-room-guitar-fingering1',
                  'practice-room-drum-linear1',
                  'practice-room-bass-sustain1',
                  'practice-room-vocal-emotion1',
                  'practice-room-piano-tremolo1',
                  'practice-room-guitar-scale-position1',
                  'practice-room-drum-tempo1',
                  'practice-room-bass-rock-groove1',
                  'practice-room-piano-left-hand1',
                  'practice-room-vocal-warmup1',
                  'practice-room-guitar-pinch-harmonic1',
                  'practice-room-drum-reggae1',
                  'practice-room-piano-parallel1',
                  'practice-room-bass-funk1',
                  'practice-room-guitar-tapping1',
                  'practice-room-drum-afrobeat1',
                  'practice-room-piano-voicing1',
                  'practice-room-vocal-falsetto1',
                  'practice-room-bass-jazz1',
                  'practice-room-guitar-capo1',
                  'practice-room-drum-funk1',
                  'practice-room-piano-baroque1',
                  'practice-room-vocal-gospel1',
                  'practice-room-guitar-hybrid-picking1',
                  'practice-room-bass-fingerstyle1',
                  'practice-room-drum-brushwork1',
                  'practice-room-piano-improv-blues1',
                  'practice-room-vocal-pop1',
                  'practice-room-bass-detuning1',
                  'practice-room-guitar-chord-melody1',
                  'practice-room-drum-hiphop1',
                  'practice-room-piano-stride1',
                  'practice-room-vocal-rnb1',
                  'practice-room-guitar-sweep-picking1',
                  'practice-room-bass-latin1',
                  'practice-room-drum-country1',
                  'practice-room-piano-impressionism1',
                  'practice-room-vocal-classical1',
                  'practice-room-guitar-economy-picking1',
                  'practice-room-bass-chord1',
                  'practice-room-drum-rock1',
                  'practice-room-piano-romantic1',
                  'practice-room-vocal-musical1',
                  'practice-room-guitar-clean-tone1',
                  'practice-room-drum-latin-jazz1',
                  'practice-room-bass-ghost-notes1',
                  'practice-room-vocal-jazz-scat1',
                  'practice-room-guitar-metal-distortion1',
                  'practice-room-piano-contemporary1',
                  'practice-room-drum-rockabilly1',
                  'practice-room-bass-harmonics1',
                  'practice-room-vocal-rock1',
                  'practice-room-piano-tango1',
                  'practice-room-guitar-fingerpicking-patterns1',
                  'practice-room-drum-jazz-coordination1',
                  'practice-room-bass-slap-pop1',
                  'practice-room-vocal-breath-control1',
                  'practice-room-guitar-blues-licks1',
                  'practice-room-piano-jazz-voicings1',
                  'practice-room-drum-polyrhythm1',
                  'practice-room-bass-walking-bass2',
                  'practice-room-vocal-pitch-training1',
                  'practice-room-guitar-chord-progressions1',
                  'practice-room-piano-rhythm-training1',
                  'practice-room-drum-brushes-advanced1',
                  'practice-room-bass-reggae1',
                  'practice-room-vocal-stage-performance1',
                  'practice-room-guitar-slide1',
                  'practice-room-piano-left-hand-bass1',
                  'practice-room-drum-ghost-notes1',
                  'practice-room-bass-5string1',
                  'practice-room-guitar-open-tuning1',
                  'practice-room-vocal-warmup-routine1',
                  'practice-room-piano-crosshand1',
                  'practice-room-drum-rudiments1',
                  'practice-room-bass-fretless1',
                  'practice-room-guitar-hybrid-picking1',
                  'practice-room-vocal-falsetto1',
                  'practice-room-piano-pedal-technique1',
                  'practice-room-drum-odd-time1',
                  'practice-room-bass-chord-melody1',
                  'practice-room-guitar-tremolo-picking1',
                  'practice-room-vocal-vowel-modification1',
                  'practice-room-piano-sight-reading1',
                  'practice-room-drum-linear-patterns1',
                  'practice-room-bass-tapping1',
                  'practice-room-guitar-economy-picking1',
                  'practice-room-vocal-resonance1',
                  'practice-room-piano-scales-modes1',
                  'practice-room-drum-hihat-patterns1',
                  'practice-room-bass-groove-locks1',
                  'practice-room-guitar-bends1',
                  'practice-room-piano-ear-training1',
                  'practice-room-vocal-diction1',
                  'practice-room-bass-pentatonic1',
                  'practice-room-guitar-arpeggios1',
                  'practice-room-drum-foot-technique1',
                  'practice-room-piano-improvisation1',
                  'practice-room-vocal-microphone-technique1',
                  'practice-room-guitar-capo-techniques1',
                  'practice-room-bass-string-muting1',
                  'practice-room-drum-snare-techniques1',
                  'practice-room-vocal-song-interpretation1',
                  'practice-room-guitar-jazz-chords1',
                  'practice-room-bass-jazz-bass1',
                  'practice-room-drum-brushwork-advanced1',
                  'practice-room-piano-stride1',
                  'practice-room-guitar-fingerstyle-arrangement1',
                  'practice-room-vocal-head-voice1',
                  'practice-room-bass-chords-harmony1',
                  'practice-room-drum-rim-techniques1',
                  'practice-room-guitar-blues-rhythm1',
                  'practice-room-piano-gospel1',
                  'practice-room-vocal-chest-voice1',
                  'practice-room-bass-funk-groove1',
                  'practice-room-drum-cymbal-techniques1',
                  'practice-room-guitar-country1',
                  'practice-room-piano-classical-technique1',
                  'practice-room-vocal-vibrato1',
                  'practice-room-bass-latin1',
                  'practice-room-guitar-modal-playing1',
                  'practice-room-drum-polyrhythm-advanced1',
                  'practice-room-piano-pop-arrangement1',
                  'practice-room-vocal-tongue-twisters1',
                  'practice-room-bass-metal-rock1',
                  'practice-room-guitar-rock-lead1',
                  'practice-room-drum-groove-pocket1',
                  'practice-room-piano-worship1',
                  'practice-room-vocal-agility1',
                  'practice-room-guitar-indie-alternative1',
                  'practice-room-bass-reggae-dub1',
                  'practice-room-drum-double-kick1',
                  'practice-room-piano-latin-rhythms1',
                  'practice-room-vocal-performance-skills1',
                  'practice-room-guitar-jazz-rhythm1',
                  'practice-room-bass-fingerstyle-technique1',
                  'practice-room-drum-tempo-control1',
                  'practice-room-piano-improvisation1',
                  'practice-room-drum-ghost-notes1',
                  'practice-room-vocal-mix-voice1',
                  'practice-room-guitar-tapping1',
                  'practice-room-bass-slap-advanced1',
                  'practice-room-drum-odd-times1',
                  'practice-room-piano-chord-voicings-advanced1',
                  'practice-room-guitar-hybrid-picking1',
                  'practice-room-vocal-breath-control1',
                  'practice-room-bass-two-hand-tapping1',
                  'practice-room-drum-linear-patterns1',
                  'practice-room-guitar-arpeggios-advanced1',
                  'practice-room-piano-ballad-technique1',
                  'practice-room-vocal-registers1',
                  'practice-room-bass-chord-melody1',
                  'practice-room-drum-fills-transitions1',
                  'practice-room-guitar-pentatonic-advanced1',
                  'practice-room-vocal-microphone-technique1',
                  'practice-room-piano-reharmonization1',
                  'practice-room-bass-groove-construction1',
                  'practice-room-drum-afrobeat1',
                  'practice-room-guitar-acoustic-fingerstyle1',
                  'practice-room-vocal-falsetto-technique1',
                  'practice-room-bass-neck-position1',
                  'practice-room-drum-brushwork-jazz-waltz1',
                  'practice-room-guitar-theory-modes1',
                  'practice-room-piano-comping1',
                  'practice-room-vocal-diction1',
                  'practice-room-bass-fretless1',
                  'practice-room-drum-rudiments-advanced1',
                  'practice-room-guitar-whammy-bar1',
                  'practice-room-piano-rhythm-patterns1',
                  'practice-room-drum-speed-training1',
                  'practice-room-vocal-resonance1',
                  'practice-room-bass-theory-harmony1',
                  'practice-room-guitar-slide1',
                  'practice-room-piano-etude1',
                  'practice-room-drum-latin-percussion1',
                  'practice-room-bass-pop-groove1',
                  'practice-room-guitar-funk-rhythm1',
                  'practice-room-vocal-soul1',
                  'practice-room-piano-boogie-woogie1',
                  'practice-room-drum-jazz-brushwork-bossa1',
                  'practice-room-bass-hip-hop1',
                  'practice-room-guitar-palm-muting1',
                  'practice-room-vocal-kpop-technique1',
                  'practice-room-piano-film-score1',
                  'practice-room-bass-soul-groove1',
                  'practice-room-drum-samba1',
                  'practice-room-guitar-double-stop1',
                  'practice-room-vocal-opera-technique1',
                  'practice-room-piano-minimalism1',
                  'practice-room-bass-blues1',
                  'practice-room-drum-shuffle1',
                  'practice-room-guitar-chord-substitution1',
                  'practice-room-vocal-tone-color1',
                  'practice-room-piano-jazz-standard-analysis1',
                  'practice-room-bass-extended-range1',
                  'practice-room-drum-metal-blast-beat1',
                  'practice-room-guitar-ambient-textures1',
                  'practice-room-vocal-harmony-ensemble1',
                  'practice-room-piano-stride-advanced1',
                  'practice-room-vocal-scat-improvisation1',
                  'practice-room-drum-jazz-swing-comping1',
                  'practice-room-guitar-fingerpicking-travis1',
                  'practice-room-bass-rhythm-locking1',
                  'practice-room-piano-pop-accompaniment1',
                  'practice-room-vocal-acappella-group1',
                  'practice-room-guitar-neo-soul1',
                  'practice-room-drum-rock-fills1',
                  'practice-room-piano-gospel-organ1',
                  'practice-room-bass-orchestral1',
                  'practice-room-drum-afro-cuban-clave1',
                  'practice-room-guitar-slide-advanced1',
                  'practice-room-vocal-pop-adlib1',
                  'practice-room-piano-intro-outro1',
                  'practice-room-bass-solo-grooving1',
                  'practice-room-drum-recording-overdub1',
                  'practice-room-guitar-open-chord-sonority1',
                  'practice-room-vocal-range-extension1',
                  'practice-room-piano-cross-hand-technique1',
                  'practice-room-bass-pick-fingerstyle1',
                  'practice-room-drum-post-punk1',
                  'practice-room-guitar-harmonics1',
                  'practice-room-piano-lead-sheet-improvisation1',
                  'practice-room-vocal-stage-fright1',
                  'practice-room-guitar-country-chicken-picking1',
                  'practice-room-drum-groove-construction-advanced1',
                  'practice-room-piano-ragtime1',
                  'practice-room-vocal-riff-melody1',
                  'practice-room-guitar-delta-blues1',
                  'practice-room-bass-jazz-comping1',
                  'practice-room-drum-jazz-bebop1',
                  'practice-room-piano-chord-substitution1',
                  'practice-room-guitar-jazz-bebop1',
                  'practice-room-vocal-resonance-chest1',
                  'practice-room-bass-thumb-technique1',
                  'practice-room-piano-blues-comping1',
                  'practice-room-drum-fills-advanced1',
                  'practice-room-guitar-alternate-tuning1',
                  'practice-room-piano-stride-beginner1',
                  'practice-room-vocal-articulation1',
                  'practice-room-drum-stick-control1',
                  'practice-room-vocal-falsetto-advanced1',
                  'practice-room-bass-left-hand1',
                  'practice-room-piano-modal1',
                  'practice-room-guitar-celtic1',
                  'practice-room-vocal-pop-runs1',
                  'practice-room-piano-quartal1',
                  'practice-room-guitar-flamenco1',
                  'practice-room-guitar-dobro1',
                  'practice-room-drum-paradiddle1',
                  'practice-room-piano-impressionist1',
                  'practice-room-bass-walking-lines1',
                  'practice-room-guitar-archtop1',
                  'practice-room-vocal-scatting1',
                  'practice-room-guitar-bossa1',
                  'practice-room-drum-world1',
                  'practice-room-piano-bebop1',
                  'practice-room-guitar-nylon1',
                  'practice-room-drum-funk-pocket1',
                  'practice-room-vocal-soul-rn1',
                  'practice-room-guitar-slide-electric1',
                  'practice-room-vocal-harmony-close1',
                  'practice-room-piano-funk1',
                  'practice-room-bass-fretless-jazz1',
                  'practice-room-guitar-12string1',
                  'practice-room-piano-comp-jazz1',
                  'practice-room-drum-hand-technique1',
                  'practice-room-guitar-baritone1',
                  'practice-room-piano-new-age1',
                  'practice-room-guitar-blues-rock1',
                  'practice-room-bass-country-bluegrass1',
                  'practice-room-vocal-rnb-phrasing1',
                  'practice-room-guitar-reggae1',
                  'practice-room-bass-neo-soul1',
                  'practice-room-vocal-breathing1',
                  'practice-room-guitar-volume-swell1',
                  'practice-room-drum-bossa-nova1',
                  'practice-room-piano-two-hand-independence1',
                  'practice-room-guitar-jazz-chord-melody1',
                  'practice-room-drum-metal-death1',
                  'practice-room-guitar-math-rock1',
                  'practice-room-bass-jazz-fusion1',
                  'practice-room-piano-church1',
                  'practice-room-drum-jazz-funk1',
                  'practice-room-vocal-pop-belting1',
                  'practice-room-guitar-post-rock1',
                  'practice-room-guitar-indie-pop1',
                  'practice-room-drum-hip-hop-lofi1',
                  'practice-room-guitar-shoegaze1',
                  'practice-room-piano-minimalism-glass1',
                  'practice-room-guitar-gypsy-jazz1',
                  'practice-room-drum-prog-rock1',
                  'practice-room-vocal-korean-ballad1',
                  'practice-room-bass-gospel1',
                ] as const
              ).map((slug, idx) => (
                <Link
                  key={slug}
                  href={`/${locale}/stories/${slug}`}
                  className="inline-flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary dark:hover:text-primary-light transition-colors duration-200"
                >
                  <span>{t(`practiceRoom.relatedGuides.items.${idx}`)}</span>
                  <ArrowRight size={14} className="flex-shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* 관련 서비스 바로가기 */}
      <Section variant="alternate" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/lesson`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/stories`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.stories')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/contact`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.contact')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

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
          imageSrc="/images/room8.webp"
          imageAlt={t('practiceRoom.cta.imageAlt')}
          primaryButtonLabel={t('practiceRoom.cta.inquiry')}
          secondaryButtonLabel={t('practiceRoom.cta.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

PracticeRoom.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const reviewsData = getReviews(locale);
  return buildPageStaticProps(
    locale,
    {
      reviewsData,
    },
    { revalidate: 86400 }
  );
};

export default PracticeRoom;
