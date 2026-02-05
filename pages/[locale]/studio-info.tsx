import Link from 'next/link';
import type { NextPage, GetStaticPaths, GetStaticProps } from 'next';
import { motion } from 'framer-motion';
import { Mic, SlidersHorizontal, Headphones, Guitar, Piano, Music, Laptop, MessageCircle, Sparkles, Building, Mic2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import SectionHeading from '../../components/ui/SectionHeading';
import { getEquipmentData } from '../../data/equipment';
import EquipmentSection from '../../components/studio/EquipmentSection';
import ContactCTA from '../../components/common/ContactCTA';
import { Section } from '../../components/ui/Section';
import { getCommonStaticPaths, getCommonStaticProps } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';

interface StudioInfoProps {
  locale: Locale;
  equipmentData: ReturnType<typeof getEquipmentData>;
}

const Studio: NextPage<StudioInfoProps> = ({ locale, equipmentData }) => {
  const { categories, equipment, studioImages } = equipmentData;
  const { t } = useTranslation('common', { lng: locale });
  const getLink = (path: string) => `/${locale}${path}`;

  return (
    <>
      <SEO
        title={t('studioInfo.seo.title')}
        description={t('studioInfo.seo.description')}
        keywords={t('studioInfo.seo.keywords')}
        canonical={`https://studionol.co.kr/${locale}/studio-info`}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.equipment'), path: `/${locale}/studio-info` },
        ]}
      />
      <ImageHero
        title={t('studioInfo.hero.title')}
        subtitle={t('studioInfo.hero.subtitle')}
        backgroundImage="/images/hardware1.jpg"
        imageAlt={t('studioInfo.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
      />

      {/* 스튜디오 소개 섹션 */}
      <Section variant="default">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative h-[400px] lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl group"
            >
              <ResponsiveImage
                src="/images/hardware2.jpg"
                alt={t('studioInfo.intro.imageAlt')}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                pictureClassName="block h-full"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60"></div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <SectionHeading
                icon={Building}
                title={t('studioInfo.intro.title')}
                subtitle={t('studioInfo.intro.subtitle')}
                align="left"
                className="mb-8"
                as="h2"
                titleClassName="mb-2"
              />
              <div className="space-y-6">
                <p className="typo-section-lead text-gray-900 dark:text-white border-l-4 border-primary pl-4 font-bold">
                  {t('studioInfo.intro.quote')}
                </p>
                <p className="typo-card-body leading-loose">
                  {t('studioInfo.intro.paragraphs.0')}
                  <br className="mb-2" />
                  {t('studioInfo.intro.paragraphs.1')}
                </p>
                <p className="typo-card-body leading-loose">
                  {t('studioInfo.intro.paragraphs.2')}
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </Section>

      {/* 장비 목록 섹션 */}
      <Section variant="alternate">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <SectionHeading
            icon={Mic2}
            title={t('studioInfo.equipment.title')}
            titleClassName="text-heading-1 font-title bg-clip-text text-transparent bg-gradient-to-r from-primary-dark via-secondary to-accent"
            className="mb-12 py-4"
          />

          {/* 장비 이미지 갤러리 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {studioImages.map((image, index) => (
              <motion.div
                key={index}
                className="rounded-lg overflow-hidden shadow-md h-48"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <ResponsiveImage
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                  pictureClassName="block h-full"
                  loading="lazy"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  fill
                />
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EquipmentSection title={categories.microphones} items={equipment.microphones} icon={Mic} />
            <EquipmentSection title={t('studioInfo.equipment.preampsEq')} items={[...equipment.preamps, ...equipment.equalizers]} icon={SlidersHorizontal} />
            <EquipmentSection title={t('studioInfo.equipment.compressorsProcessors')} items={[...equipment.compressors, ...equipment.processors]} icon={SlidersHorizontal} />
            <EquipmentSection title={categories.speakers + " & " + categories.headphones} items={[...equipment.speakers, ...equipment.headphones]} icon={Headphones} />
            <EquipmentSection title={categories.instruments} items={equipment.instruments} icon={Guitar} />
            <EquipmentSection title={categories.synthesizers} items={equipment.synthesizers} icon={Piano} />
            <EquipmentSection title={categories.plugins} items={equipment.plugins} icon={Music} />
            <EquipmentSection title={t('studioInfo.equipment.interfacesConsoles')} items={[...equipment.interfaces, ...equipment.consoles]} icon={Laptop} />
          </div>
        </motion.div >
      </Section>

      <Section variant="default">
        <ContactCTA className="mt-0" locale={locale} />
      </Section>
    </>
  );
};

(Studio as any).hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = params?.locale || 'ko';
  const equipmentData = getEquipmentData(locale as any);
  return {
    props: {
      locale,
      equipmentData,
    },
  };
};

export default Studio;
