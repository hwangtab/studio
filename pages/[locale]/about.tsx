import React from 'react';
import type { NextPage, GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Phone, Mail, MessageCircle, MapPin, Music, Activity, Award, Headphones, Lightbulb, Banknote, Palette, Globe, Megaphone, Calendar, Users, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
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

const ICON_MAP: Record<string, any> = {
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

  const getLink = (path: string) => `/${locale}${path}`;

  return (
    <div className="overflow-visible">
      <SEO
        title={t('about.title')}
        description={t('about.description')}
        keywords={t('about.seo.keywords')}
        canonical={`https://studionol.co.kr/${locale}/about`}
        breadcrumbs={[
          { name: t('nav.about'), path: `/${locale}/about` },
        ]}
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
          backgroundImage: "/images/recording15.png",
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
            onClick={() => window.open(`tel:${siteConfig.contact.phone}`, '_blank')}
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
            onClick={() => window.open(`mailto:${siteConfig.contact.email}`, '_blank')}
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
            onClick={() => window.open(siteConfig.contact.kakaoUrl, '_blank')}
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
            onClick={() => window.open(siteConfig.contact.naverMapUrl, '_blank')}
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
        <motion.div
          className="overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
            <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 md:p-12 flex flex-col justify-center">
              <SectionHeading
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
                align="left"
                className="mb-8"
              />
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={getLink("/contact")}
                  className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[44px] bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-colors transition-shadow duration-300 border border-gray-100 dark:border-gray-600 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                >
                  {t('actions.location')}
                </Link>
                <a
                  href={siteConfig.contact.kakaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[44px] bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-colors transition-shadow duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
                >
                  <MessageCircle className="mr-2 flex-shrink-0" size={20} aria-hidden="true" />
                  <span className="min-w-0">{t('actions.kakao')}</span>
                </a>
              </div>
            </div>
            <a
              href={siteConfig.contact.kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer"
            >
              <ResponsiveImage
                src="/images/hardware3.jpg"
                alt={t('about.cta.imageAlt')}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 768px) 50vw, 100vw"
                width={800}
                height={600}
                fill
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
            </a>
          </div>
        </motion.div>
      </Section>
    </div>
  );
};

(About as any).hasHero = true;

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
