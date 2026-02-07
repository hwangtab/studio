import React from 'react';
import type { NextPage, GetStaticPaths, GetStaticProps } from 'next';
import { motion } from 'framer-motion';
import { LucideIcon, Phone, Mail, MapPin, Music, Activity, Award, Headphones, Lightbulb, Banknote, Palette, Globe, Megaphone, Calendar, Users, Clock, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ContactCTA from '../../components/common/ContactCTA';
import SEO from '../../components/SEO';
import FeatureCard from '../../components/ui/FeatureCard';
import BaseCard from '../../components/ui/BaseCard';
import ImageHero from '../../components/common/ImageHero';
import { getServicesData } from '../../data/services';
import { Section } from '../../components/ui/Section';
import SectionHeading from '../../components/ui/SectionHeading';
import { getCommonStaticPaths } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getReviews } from '../../data/reviews';
import { generateHowToSchema } from '../../utils/schemaGenerator';

const ICON_MAP: Record<string, LucideIcon> = {
  Lightbulb,
  Banknote,
  Headphones,
  Music,
  Palette,
  Globe,
  Megaphone,
  Calendar,
  Users,
  Clock,
  Activity,
  Award,
};

interface AboutProps {
  locale: Locale;
  servicesData: ReturnType<typeof getServicesData>;
}

const About: NextPage<AboutProps> = ({ locale, servicesData }) => {
  const { t } = useTranslation('common', { lng: locale });
  const { coreServices, productionProcess, advantages } = servicesData;
  const siteConfig = getSiteConfig(locale);
  const reviewsData = React.useMemo(() => getReviews(locale), [locale]);

  const howToSchema = React.useMemo(() => generateHowToSchema(
    t('about.howToTitle'),
    t('about.howToDescription'),
    productionProcess.map((step) => ({
      name: step.title,
      text: step.description,
    })),
    'P2D',
    locale
  ), [productionProcess, locale, t]);

  return (
    <div className="overflow-visible">
      <SEO
        title={t('about.title')}
        description={t('about.description')}
        keywords={t('about.seo.keywords')}
        canonical={`https://studionol.co.kr/${locale}/about`}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.about'), path: `/${locale}/about` },
        ]}
        includeSchema={true}
        reviewItems={reviewsData.filter(r =>
          r.category.includes('프로덕션') ||
          r.category.includes('Production') ||
          r.category.includes('믹싱') ||
          r.category.includes('Mixing')
        )}
        schema={howToSchema}
      />
      <ImageHero
        {...{
          locale,
          title: siteConfig.name,
          subtitle: (
            <>
              {t('about.subtitle')}
              <br />
              {t('about.description')}
            </>
          ),
          backgroundImage: "/images/recording15.webp",
          imageAlt: t('about.heroAlt'),
          minHeight: "min-h-[60vh]",
          overlayGradient: "from-black/40 via-transparent to-black/20",
        }}
      />

      <Section variant="alternate">
        <SectionHeading
          icon={Music}
          title={t('about.serviceTitle')}
          subtitle={t('about.serviceSubtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {coreServices.map((service, index) => (
            <FeatureCard
              key={service.title}
              title={service.title}
              description={service.description}
              icon={ICON_MAP[service.icon as string]}
              delay={0.1 * (index + 1)}
              size="lg"
            />
          ))}
        </div>
      </Section>

      <Section variant="default">
        <SectionHeading
          icon={Activity}
          title={t('about.processTitle')}
          subtitle={t('about.processSubtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {productionProcess.map((step, index) => (
            <FeatureCard
              key={step.title}
              title={step.title}
              description={step.description}
              icon={ICON_MAP[step.icon as string]}
              delay={0.1 * (index + 1)}
            />
          ))}
        </div>
      </Section>

      <Section variant="alternate">
        <SectionHeading
          icon={Award}
          title={t('about.differenceTitle')}
          subtitle={t('about.differenceSubtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <BaseCard
            variant="default"
            className="p-6"
          >
            <h3 className="typo-card-title mb-4">{t('about.package.title')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body">{t('about.package.items.0')}</p>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body">{t('about.package.items.1')}</p>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body">{t('about.package.items.2')}</p>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body">{t('about.package.items.3')}</p>
              </li>
            </ul>
          </BaseCard>

          <motion.div
            className="grid grid-cols-2 gap-4"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {advantages.map((advantage, index) => {
              const Icon = ICON_MAP[advantage.icon as string] || Users;
              return (
                <BaseCard
                  key={index}
                  variant="default"
                  delay={0.2 + 0.1 * index}
                  className="p-4"
                >
                  <div className="flex items-center mb-2">
                    <Icon className="text-primary dark:text-primary-light mr-2" aria-hidden="true" />
                    <h4 className="typo-card-subtitle">{advantage.title}</h4>
                  </div>
                  <p className="typo-card-body">{advantage.description}</p>
                </BaseCard>
              );
            })}
          </motion.div>
        </div>
      </Section>

      <Section variant="default">
        <SectionHeading
          icon={Headphones}
          title={t('contact.title')}
          subtitle={t('contact.subtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <BaseCard
            delay={0.1}
            className="p-6 text-center cursor-pointer"
            href={`tel:${siteConfig.contact.phone}`}
          >
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                <Phone className="text-primary dark:text-primary-light" size={20} aria-hidden="true" />
              </div>
            </div>
            <h3 className="typo-card-subtitle mb-2">{t('actions.call')}</h3>
            <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">{siteConfig.contact.phone}</p>
          </BaseCard>

          <BaseCard
            delay={0.2}
            className="p-6 text-center cursor-pointer"
            href={`mailto:${siteConfig.contact.email}`}
          >
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                <Mail className="text-primary dark:text-primary-light" size={20} aria-hidden="true" />
              </div>
            </div>
            <h3 className="typo-card-subtitle mb-2">{t('actions.email')}</h3>
            <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">{siteConfig.contact.email}</p>
          </BaseCard>

          <BaseCard
            delay={0.3}
            className="p-6 text-center cursor-pointer"
            href={siteConfig.contact.kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                <MessageCircle className="text-primary dark:text-primary-light" size={20} aria-hidden="true" />
              </div>
            </div>
            <h3 className="typo-card-subtitle mb-2">{t('actions.kakao')}</h3>
            <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">{t('contact.info.kakao')}</p>
          </BaseCard>

          <BaseCard
            delay={0.4}
            className="p-6 text-center cursor-pointer"
            href={siteConfig.contact.naverMapUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                <MapPin className="text-primary dark:text-primary-light" size={20} aria-hidden="true" />
              </div>
            </div>
            <h3 className="typo-card-subtitle mb-2">{t('actions.location')}</h3>
            <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">{siteConfig.contact.address}</p>
          </BaseCard>
        </div>
      </Section>

      <Section variant="alternate" className="py-16">
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('about.cta.titleLine1')}<br />
              <span className="text-primary">{t('about.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('about.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('about.cta.subtitleLine2')}
            </>
          }
          imageSrc="/images/hardware3.jpg"
          imageAlt={t('about.cta.imageAlt')}
        />
      </Section>
    </div>
  );
};

(About as NextPage & { hasHero?: boolean }).hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = (params?.locale as Locale) || 'ko';
  const servicesData = getServicesData(locale);
  return {
    props: {
      locale,
      servicesData,
    },
  };
};

export default About;
