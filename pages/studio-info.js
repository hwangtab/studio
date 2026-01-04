import React from 'react';
import { motion } from 'framer-motion';
import { Mic, SlidersHorizontal, Headphones, Guitar, Piano, Music, Laptop, Info, MapPin, Calendar } from 'lucide-react';
import { PAGE_TITLE_ANIMATION } from '../utils/animationUtils';
import ResponsiveImage from '../components/ResponsiveImage';
import SEO from '../components/SEO';
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

const Studio = () => {
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
        title="연신내 프로 녹음실 장비 소개 | 스튜디오 놀 스튜디오 정보"
        description="Neumann 마이크, Prism Sound 인터페이스, SSL/UA 아웃보드 등 프로 레벨 장비를 갖춘 스튜디오 놀의 레코딩·믹싱 환경을 확인하세요."
        keywords="연신내 녹음실 장비, 스튜디오 놀 장비, 은평구 녹음 스튜디오, 프로 녹음실"
        canonical="https://studionol.co.kr/studio-info"
      />
      <ImageHero
        title="스튜디오 소개"
        subtitle="최고의 시설과 장비, 전문 엔지니어의 노하우로 여러분의 음악적 비전을 현실로 만듭니다."
        backgroundImage="/images/hardware1.jpg"
        imageAlt="스튜디오 놀 장비"
        minHeight="min-h-[55vh]"
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

        {/* 스튜디오 이용 안내 섹션 */}
        <motion.div
          className="bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 p-8 rounded-xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <h2 className="typo-section-title mb-4 text-center text-gray-600 dark:text-gray-200">스튜디오 이용 안내</h2>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="typo-card-subtitle mb-2 text-gray-700 dark:text-gray-200">상담 가능 시간</h3>
              <p className="typo-card-body">
                월-금: 10:00 AM - 6:00 PM<br />토요일: 12:00 PM - 6:00 PM<br />일요일: 상담 업무 미제공
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
              <h3 className="typo-card-subtitle mb-2 text-gray-700 dark:text-gray-200">상담 방법</h3>
              <a
                href="https://open.kakao.com/me/nol"
                target="_blank"
                rel="noopener noreferrer"
                className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors duration-300 flex flex-col items-center"
              >
                <Calendar className="mb-2 text-primary dark:text-primary-light" size={24} />
                <span className="typo-card-body">카카오톡으로 문의하기</span>
              </a>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
              <h3 className="typo-card-subtitle mb-2 text-gray-700 dark:text-gray-200">위치 안내</h3>
              <a
                href="https://naver.me/5gFZhS3X"
                target="_blank"
                rel="noopener noreferrer"
                className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors duration-300 flex flex-col items-center"
              >
                <MapPin className="mb-2 text-primary dark:text-primary-light" size={24} />
                <span className="typo-card-body">서울특별시 은평구 대조동 84-3 3층</span>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Studio;

export const getStaticProps = () => ({
  props: {},
});
