import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mic, SlidersHorizontal, Headphones, Guitar, Piano, Music, Laptop, MessageCircle, Sparkles, Building, Mic2 } from 'lucide-react';
import ResponsiveImage from '../components/ResponsiveImage';
import SEO from '../components/SEO';
import ImageHero from '../components/common/ImageHero';
import SectionHeading from '../components/ui/SectionHeading';
import { equipment, studioImages } from '../data/equipment';
import EquipmentSection from '../components/studio/EquipmentSection';
import ContactCTA from '../components/common/ContactCTA';
import { NextPageWithLayout } from '../types';
import { Section } from '../components/ui/Section';

const Studio: NextPageWithLayout = () => {

  return (
    <>
      <SEO
        title="하이엔드 녹음 장비 · Neumann/SSL 보유 | 스튜디오 놀"
        description="최상의 사운드를 위한 과감한 투자. Neumann U87AI, Vintech X73i, SSL Fusion 등 프로들이 신뢰하는 하이엔드 장비와 룸 어쿠스틱을 확인하세요."
        keywords="하이엔드 녹음 장비, Neumann U87AI, SSL Fusion, 연신내 녹음실 장비, 프로 오디오 장비, Vintech 프리앰프, 스튜디오 장비 리스트"
        canonical="https://studionol.co.kr/studio-info"
        breadcrumbs={[
          { name: '홈', path: '/' },
          { name: '장비 소개', path: '/studio-info' },
        ]}
      />
      <ImageHero
        title="장비 소개"
        subtitle="최고의 시설과 장비, 전문 엔지니어의 노하우로 여러분의 음악적 비전을 현실로 만듭니다."
        backgroundImage="/images/hardware1.jpg"
        imageAlt="스튜디오 놀 장비"
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
                alt="스튜디오 놀 메인 컨트롤 룸"
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
                title="Creative Space for Musicians"
                subtitle="스튜디오 놀은 음악인들의 자유로운 상상과 창작 활동을 지원하기 위해 탄생한 공간입니다."
                align="left"
                className="mb-8"
                as="h2"
                titleClassName="mb-2"
              />
              <div className="space-y-6">
                <p className="typo-section-lead text-gray-900 dark:text-white border-l-4 border-primary pl-4 font-bold">
                  &quot;단순히 음악을 녹음하는 공간을 넘어, 아티스트와 엔지니어가 함께 호흡하며 창의적인 협업을 이뤄낼 수 있는 공간.&quot;
                </p>
                <p className="typo-card-body leading-loose">
                  우리는 최고의 시설과 장비, 그리고 전문 엔지니어의 노하우를 바탕으로 여러분의 음악적 비전을 현실로 만드는 일에 전념하고 있습니다.
                  <br className="mb-2" />
                  스튜디오 놀이 추구하는 가치는 기술적인 완성을 넘어, <strong>음악 그 자체의 본질</strong>에 집중하는 것입니다.
                </p>
                <p className="typo-card-body leading-loose">
                  녹음, 믹싱, 마스터링뿐만 아니라 앨범 발매와 홍보까지. 음악인들이 자신의 목소리를 세상에 전할 수 있도록 든든한 파트너가 되어드리겠습니다.
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
            title="장비 목록"
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
            <EquipmentSection title="마이크" items={equipment.microphones} icon={Mic} />
            <EquipmentSection title="프리앰프 & 이퀄라이저" items={[...equipment.preamps, ...equipment.equalizers]} icon={SlidersHorizontal} />
            <EquipmentSection title="컴프레서 & 프로세서" items={[...equipment.compressors, ...equipment.processors]} icon={SlidersHorizontal} />
            <EquipmentSection title="스피커 & 헤드폰" items={[...equipment.speakers, ...equipment.headphones]} icon={Headphones} />
            <EquipmentSection title="악기 & 앰프" items={equipment.instruments} icon={Guitar} />
            <EquipmentSection title="신디사이저 & 샘플러" items={equipment.synthesizers} icon={Piano} />
            <EquipmentSection title="플러그인" items={equipment.plugins} icon={Music} />
            <EquipmentSection title="인터페이스 & 콘솔" items={[...equipment.interfaces, ...equipment.consoles]} icon={Laptop} />
          </div>
        </motion.div >
      </Section>

      {/* Improved CTA Section (Consistency with other pages) */}
      <Section variant="default">
        <ContactCTA className="mt-0" />
      </Section>
    </>
  );
};

// Use the hasHero property typed in NextPageWithLayout
Studio.hasHero = true;

export default Studio;

export const getStaticProps = () => ({
  props: {},
});
