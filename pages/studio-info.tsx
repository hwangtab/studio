// @ts-nocheck
import type { NextPage } from 'next'; import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mic, SlidersHorizontal, Headphones, Guitar, Piano, Music, Laptop, Info, MapPin, Calendar, MessageCircle, CalendarCheck } from 'lucide-react';
import { PAGE_TITLE_ANIMATION } from '../utils/animationUtils';
// @ts-ignore - Component is JS
import ResponsiveImage from '../components/ResponsiveImage';
// @ts-ignore - Component is JS
import SEO from '../components/SEO';
// @ts-ignore - Component is JS
import ImageHero from '../components/common/ImageHero';

const EquipmentSection = ({ title, items, icon: Icon }) => (
  <motion.div
    className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-6 hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    whileHover={{ y: -5 }}
  >
    <h3 className="typo-card-title mb-4 flex items-center text-gray-600 dark:text-gray-200">
      <Icon className="mr-2 text-primary dark:text-primary-light" size={20} />
      {title}
    </h3>
    <ul className="grid gap-2">
      {items.map((item, index) => (
        <li key={index} className="flex items-center typo-card-body">
          <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mr-2"></span>
          {item}
        </li>
      ))}
    </ul>
  </motion.div>
);

const Studio: NextPage = () => {
  const equipment = {
    microphones: [
      "Neumann U87AI", "AKG C414 XLS", "Studio Project C1",
      "Beyerdynamic TG-X81", "Shure SM58", "Shure SM57"
    ],
    preamps: ["Vintech X73i Preamp", "Focusrite Saffire Octopre"],
    equalizers: [
      "SPL Optimizer Parametric Equalizer"],
    compressors: ["Tegeler Vari Tube Compressor", "Alctron Cp540v2"],
    interfaces: ["Prism Sound Lyra 2", "Arturia X8 OUT"],
    processors: ["Solid State Logic Fusion", "Lexicon MX300"],
    speakers: ["Proac Tablett 50", "EVE Audio SC207", "ADAM Audio A5"],
    headphones: ["Sennheiser HD600", "Sony MDR-7506", "Calyx H", "SHURE SRH 440"],
    instruments: ["Vox AC30 Guitar Amp", "Yamaha U3 Piano", "Yamaha U1 Piano", "Gibson J-15", "G&L Tribute ASAT"],
    consoles: ["Softube Colsole 1", "Softube Colsole 1 Fader", "Presonus Faderport V2"],
    synthesizers: [
      "Spectrasonics", "Spitfire Audio", "Native Instruments", "u-he", "Arturia", "UJAM", "Moog"],
    plugins: [
      "UAD", "Acustica Audio", "Softube", "Soundtoys",
      "Izotope", "Sonnox 등 다수"]
  };

  return (
    <>
      <SEO
        title="하이엔드 녹음 장비 · Neumann/SSL 보유 | 스튜디오 놀"
        description="최상의 사운드를 위한 과감한 투자. Neumann U87AI, Vintech X73i, SSL Fusion 등 프로들이 신뢰하는 하이엔드 장비와 룸 어쿠스틱을 확인하세요."
        keywords="하이엔드 녹음 장비, Neumann U87AI, SSL Fusion, 연신내 녹음실 장비, 프로 오디오 장비, Vintech 프리앰프, 스튜디오 장비 리스트"
        canonical="https://studionol.co.kr/studio-info"
        breadcrumbs={[
          { name: '홈', path: '/' },
          { name: '스튜디오 소개', path: '/studio-info' },
        ]}
      />
      <ImageHero
        title="스튜디오 소개"
        subtitle="최고의 시설과 장비, 전문 엔지니어의 노하우로 여러분의 음악적 비전을 현실로 만듭니다."
        backgroundImage="/images/hardware1.jpg"
        imageAlt="스튜디오 놀 장비"
        minHeight="min-h-[60vh]"
      />
      <div className="container mx-auto px-4 py-16">
        {/* 스튜디오 소개 섹션 */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center mb-6">
                <Info className="text-primary dark:text-primary-light mr-3" size={24} />
                <h2 className="typo-card-title text-gray-600 dark:text-gray-200">스튜디오 놀</h2>
              </div>
              <div className="space-y-4">
                <p className="typo-section-lead mb-4">
                  스튜디오 놀은 음악인들의 자유로운 상상과 창작 활동을 지원하기 위해 탄생한 공간입니다. 우리는 최고의 시설과 장비, 그리고 전문 엔지니어의 노하우를 바탕으로 여러분의 음악적 비전을 현실로 만드는 일에 전념하고 있습니다.
                </p>
                <p className="typo-section-lead mb-4">
                  단순히 음악을 녹음하는 공간을 넘어, 아티스트와 엔지니어가 함께 호흡하며 이야기를 나누고, 아이디어를 실험하며, 창의적인 협업을 이뤄낼 수 있는 공간. 그것이 바로 &lsquo;스튜디오 놀&rsquo;이 추구하는 가치입니다.
                </p>
                <p className="typo-section-lead mb-4">
                  스튜디오 놀은 음악인들이 자신의 음악을 녹음하고, 믹싱하고, 마스터링할 수 있는 공간과 서비스를 제공합니다. 또한, 음악인들이 자신의 음악을 홍보하고, 판매할 수 있도록 도움을 주는 데에도 노력하고 있습니다.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* 장비 목록 섹션 */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <motion.h1
            className="text-heading-1 font-title mb-12 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            장비 목록
          </motion.h1>

          {/* 장비 이미지 갤러리 추가 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <motion.div
              className="rounded-lg overflow-hidden shadow-md h-48"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveImage
                src={`/images/hardware2.jpg`}
                alt="Neumann U87AI 콘덴서 마이크와 Vintech 프리앰프"
                className="w-full h-full object-cover"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                fill
              />
            </motion.div>
            <motion.div
              className="rounded-lg overflow-hidden shadow-md h-48"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveImage
                src={`/images/hardware3.jpg`}
                alt="API 550B EQ와 SSL Fusion 컴프레서"
                className="w-full h-full object-cover"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                fill
              />
            </motion.div>
            <motion.div
              className="rounded-lg overflow-hidden shadow-md h-48"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveImage
                src={`/images/hardware4.jpg`}
                alt="Universal Audio Apollo x8p 오디오 인터페이스"
                className="w-full h-full object-cover"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                fill
              />
            </motion.div>
            <motion.div
              className="rounded-lg overflow-hidden shadow-md h-48"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveImage
                src={`/images/hardware5.jpg`}
                alt="Adam Audio A7X 모니터 스피커와 믹싱 데스크"
                className="w-full h-full object-cover"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                fill
              />
            </motion.div>
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
        </motion.div>

        {/* Improved CTA Section (Consistency with other pages) */}
        <motion.div
          className="mt-16 overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
            <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 md:p-12 flex flex-col justify-center">
              <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white leading-tight">
                당신의 소중한 음악,<br />
                <span className="text-primary">최상의 사운드로</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg leading-relaxed">
                검증된 장비와 전문 엔지니어링으로 최선의 결과물을 약속합니다.<br className="hidden md:block" />
                지금 바로 방문 상담을 예약하고 스튜디오를 둘러보세요.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-600"
                >
                  오시는 길
                </Link>
                <a
                  href="https://open.kakao.com/me/nol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all duration-300"
                >
                  <MessageCircle className="mr-2" size={20} />
                  카카오톡 문의하기
                </a>
              </div>
            </div>

            <a
              href="https://open.kakao.com/me/nol"
              target="_blank"
              rel="noopener noreferrer"
              className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer"
            >
              <ResponsiveImage
                src="/images/studio2.jpg"
                alt="스튜디오 놀 메인 컨트롤 룸"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 768px) 50vw, 100vw"
                fill
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
            </a>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Studio;

(Studio as any).hasHero = true;

export const getStaticProps = () => ({
  props: {},
});
