import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaMusic, FaShieldAlt, FaStar, FaMapMarkerAlt, FaVolumeMute, FaWind, FaBolt, FaBroom, FaComments, FaCheckCircle } from 'react-icons/fa';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../utils/animationUtils';
import ResponsiveImage from '../components/ResponsiveImage';
import SEO from '../components/SEO';

const FeatureCard = ({ icon: Icon, title, description, className }) => (
  <motion.div
    className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg ${className}`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    whileHover={{ y: -5 }}
  >
    <div className="flex items-center mb-4">
      <Icon className="text-2xl text-primary dark:text-primary-light mr-3" />
      <h3 className="typo-card-title text-gray-600 dark:text-gray-200">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </motion.div>
);

const PainPoint = ({ icon: Icon, text }) => (
  <motion.div 
    className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow duration-300"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    whileHover={{ y: -5, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
  >
    <div className="flex items-start">
      <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-full mr-4 text-white">
        <Icon className="text-xl" />
      </div>
      <div>
        <p className="typo-card-body whitespace-normal" style={{ wordBreak: 'keep-all' }}>{text}</p>
      </div>
    </div>
  </motion.div>
);

const TargetAudience = ({ title, description, icon: Icon }) => (
  <motion.div
    className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-4"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5 }}
    whileHover={{ y: -5 }}
  >
    <div className="flex items-center mb-2">
      <Icon className="text-2xl text-primary dark:text-primary-light mr-3" />
      <h3 className="typo-card-subtitle text-gray-600 dark:text-gray-200">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </motion.div>
);

const packages = [
  {
    title: '데이라이트 패스',
    time: '오전 10시 - 오후 5시',
    price: '₩25,000 / 시간',
    desc: '작곡, 편곡, 미디 작업을 위한 집중 시간대',
  },
  {
    title: '나이트 프로 패스',
    time: '오후 5시 - 자정',
    price: '₩30,000 / 시간',
    desc: '보컬 녹음 · 밴드 합주 · 라이브 리허설에 최적화',
  },
  {
    title: '올나잇 락커 패스',
    time: '자정 - 오전 8시',
    price: '₩150,000 / 8시간',
    desc: '심야 크리에이티브 세션과 집중 믹싱 세션용',
  },
];

const faqEntries = [
  {
    question: '예약은 어떻게 진행되나요?',
    answer: '카카오톡 오픈채팅 또는 전화(02-764-3114)로 희망 날짜·시간을 알려주시면 실시간 스케줄을 확인 후 확정 드립니다. 정기 대관도 가능합니다.',
  },
  {
    question: '어떤 장비를 제공하나요?',
    answer: 'Neumann 마이크, Apollo 인터페이스, Ableton/Pro Tools, Yamaha 모니터 스피커, Roland 전자드럼, 기타/베이스 앰프, 미디 컨트롤러 등 대부분의 장비를 기본 제공하며, 개인 장비도 자유롭게 연결할 수 있습니다.',
  },
  {
    question: '방음과 공조 시스템은 어떻게 되어 있나요?',
    answer: '벽체와 천장 전체가 이중 방음 구조이며, 초미세먼지 필터가 포함된 독립 공조 시스템으로 장시간 작업해도 쾌적한 온·습도를 유지합니다.',
  },
  {
    question: '녹음 엔지니어 지원이 가능한가요?',
    answer: '네. 사전 요청 시 실무 경력 10년 이상의 엔지니어가 배정되어 보컬 녹음, 튠 보정, 믹싱, 마스터링까지 원스톱으로 지원합니다.',
  },
];

const PracticeRoom = () => {
  return (
    <>
      <SEO
        title="연신내 녹음실 · 은평구 연습실 대관 | 스튜디오 놀"
        description="연신내역 도보 5분, 방음·공조·프로 장비를 갖춘 스튜디오 놀 연습실. 보컬 녹음, 밴드 합주, 콘텐츠 촬영까지 가능한 프리미엄 음악 작업 공간을 예약하세요."
        canonical="https://studionol.co.kr/practice-room"
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqEntries.map((faq) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
              },
            })),
          },
        ]}
      />
      <div className="container mx-auto px-4 pt-16 pb-12">
      {/* 히어로 섹션 */}
      <motion.div
        className="mb-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.h1 
          className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
          {...PAGE_TITLE_ANIMATION}
        >
          은평구 프리미엄 방음 연습실
        </motion.h1>
        
        <motion.p
          className="typo-section-lead text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-12 text-center"
          {...PAGE_SUBTITLE_ANIMATION}
        >
          은평구·고양·파주 뮤지션이 가장 많이 찾는 연습실/녹음실. 방음, 온습도, 장비, 주차, 접근성까지 세심하게 설계된
          원스톱 공간에서 앨범 제작과 콘텐츠 촬영을 한 번에 진행해 보세요.
        </motion.p>
        
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <motion.div 
            className="relative rounded-xl overflow-hidden shadow-xl h-[400px]"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <ResponsiveImage 
              src={`/images/room6.jpg`} 
              alt="프리미엄 방음 연습실" 
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              loading="eager"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end">
            <div className="p-6">
                <p className="text-heading-3 font-title font-bold text-white">프로페셔널한 연습 환경</p>
                <p className="text-body-1-extra-light text-white/80">당신의 음악을 위한 최적의 공간</p>
              </div>
            </div>
          </motion.div>
          
          <div>
            <h2 className="typo-card-title mb-6 text-gray-600 dark:text-gray-200">이런 고민이 있으신가요?</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <PainPoint icon={FaWind} text="에어컨에서 떨어지는 물방울 때문에 장비가 망가질까 불안해요..." />
              <PainPoint icon={FaVolumeMute} text="옆방 소리가 다 들려서 집중이 안 돼요..." />
              <PainPoint icon={FaWind} text="공기가 잘 통하지 않아 답답해요..." />
              <PainPoint icon={FaBolt} text="전기 노이즈 때문에 녹음을 다시 해야 해요..." />
              <PainPoint icon={FaBroom} text="작업환경이 불쾌하고 지저분해요..." />
              <PainPoint icon={FaComments} text="엔지니어가 상주하지 않아 녹음/튜닝이 걱정돼요..." />
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* 타겟 오디언스 섹션 */}
      <motion.div
        className="mb-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <motion.h2 
          className="typo-section-title mb-6 text-center text-primary dark:text-primary-light"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          이런 분들을 위한 공간
        </motion.h2>
        
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <TargetAudience 
            title="음악 작업자" 
            description="프로듀서/작곡가를 위한 미디작업실, 보컬/래퍼를 위한 녹음 공간" 
            icon={FaMusic} 
          />
          <TargetAudience 
            title="콘텐츠 크리에이터" 
            description="유튜버, 팟캐스터, 스트리머를 위한 녹음 스튜디오" 
            icon={FaStar} 
          />
          <TargetAudience 
            title="음악 교육" 
            description="프라이빗 레슨, 소규모 마스터클래스, 학원 분원용 연습실" 
            icon={FaMusic} 
          />
        </div>
        
        {/* 이미지 갤러리 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <motion.div 
            className="rounded-lg overflow-hidden shadow-md h-48" 
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          >
            <ResponsiveImage
              src={`/images/room2.jpg`}
              alt="드럼과 앰프가 갖춰진 밴드 합주실 전경"
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              loading="lazy"
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            />
          </motion.div>
          <motion.div 
            className="rounded-lg overflow-hidden shadow-md h-48" 
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          >
            <ResponsiveImage
              src={`/images/room3.jpg`}
              alt="흡음 패널이 설치된 방음 연습실 내부"
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              loading="lazy"
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            />
          </motion.div>
          <motion.div 
            className="rounded-lg overflow-hidden shadow-md h-48" 
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          >
            <ResponsiveImage
              src={`/images/room4.jpg`}
              alt="기타 앰프와 이펙터가 준비된 개인 연습실"
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              loading="lazy"
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            />
          </motion.div>
          <motion.div 
            className="rounded-lg overflow-hidden shadow-md h-48" 
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          >
            <ResponsiveImage
              src={`/images/room5.jpg`}
              alt="쾌적한 환경의 보컬 녹음 부스 내부"
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              loading="lazy"
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            />
          </motion.div>
        </div>
      </motion.div>
      
      <section className="mb-20">
        <h2 className="text-heading-2 font-title text-center text-gray-800 dark:text-white mb-6">연습실 · 녹음실 특장점</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: '독립형 공조/환기',
              description: '초미세먼지 필터와 습도 조절 시스템으로 4계절 내내 쾌적한 공기 유지',
              icon: FaWind,
            },
            {
              title: '프리미엄 어쿠스틱',
              description: '다중 방음과 벽면 디퓨저, 흡음 패널로 자연스러운 룸 사운드 확보',
              icon: FaShieldAlt,
            },
            {
              title: '통합 하드웨어',
              description: 'Neumann, Universal Audio, Yamaha, Roland 등 검증된 장비 풀 세팅',
              icon: FaMusic,
            },
          ].map(({ title, description, icon: Icon }) => (
            <div key={title} className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
              <div className="flex items-center mb-4">
                <Icon className="text-primary text-2xl mr-3" />
                <h3 className="typo-card-title text-gray-700 dark:text-gray-200">{title}</h3>
              </div>
              <p className="typo-card-body">{description}</p>
            </div>
          ))}
        </div>
      </section>
      
      <section className="mb-20">
        <h2 className="text-heading-2 font-title text-center text-gray-800 dark:text-white mb-6">대관 요금 & 패키지</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {packages.map((item) => (
            <div key={item.title} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
              <p className="typo-card-meta text-primary">{item.title}</p>
              <h3 className="text-heading-3 mt-2 mb-2">{item.price}</h3>
              <p className="text-body-1 text-gray-600 dark:text-gray-300 mb-4">{item.time}</p>
              <p className="typo-card-body">{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          VAT 포함. 장기 대관, 영상 촬영, 엔지니어 옵션은 문의 시 맞춤 견적을 드립니다.
        </p>
      </section>
      
      <section className="mb-20 bg-gradient-to-r from-primary-dark via-primary to-accent text-white rounded-3xl p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8">
          <div className="flex-1">
            <p className="uppercase tracking-widest text-white/80 text-sm mb-2">How to Book</p>
            <h2 className="text-heading-2 font-title mb-3">예약 & 상담 방법</h2>
            <p className="text-body-1 mb-4 text-white/90">
              카카오톡 오픈채팅(@nol) 또는 전화(02-764-3114)로 원하는 시간과 목적(녹음, 합주, 촬영 등)을 알려주세요.
              5분 안에 담당자가 답변 드립니다. 공간 투어도 사전 예약 후 상시 가능해요.
            </p>
            <ul className="space-y-2 text-white/90">
              <li className="flex items-center">
                <FaCheckCircle className="mr-2" /> 당일 예약 가능 (공간 상황에 따라)
              </li>
              <li className="flex items-center">
                <FaCheckCircle className="mr-2" /> 주차 1대 무료, 인근 공영주차장 연계
              </li>
              <li className="flex items-center">
                <FaCheckCircle className="mr-2" /> 장비 세팅/엔지니어 옵션 선택 가능
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <a
              href="https://open.kakao.com/me/nol"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white text-primary-dark font-medium hover:bg-gray-100 transition"
            >
              카카오톡으로 빠른 상담
            </a>
            <a
              href="tel:02-764-3114"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white text-white font-medium hover:bg-white/10 transition"
            >
              02-764-3114 전화 연결
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white text-white font-medium hover:bg-white/10 transition"
            >
              문의 폼 작성
            </Link>
          </div>
        </div>
      </section>
      
      <section className="mb-20">
        <h2 className="text-heading-2 font-title text-center text-gray-800 dark:text-white mb-8">자주 묻는 질문</h2>
        <div className="space-y-4">
          {faqEntries.map((faq) => (
            <div key={faq.question} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="typo-card-title text-gray-800 dark:text-white mb-2">{faq.question}</h3>
              <p className="typo-card-body text-gray-600 dark:text-gray-300">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
      
      {/* 특징 섹션 */}
      <motion.div
        className="mb-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <motion.h2 
          className="text-heading-2 font-title font-bold mb-12 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          뮤지션을 위한 완벽한 시스템
        </motion.h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <FeatureCard 
            icon={FaMusic} 
            title="진정한 프로의 작업 환경" 
            description="국제표준 STC 방음 시스템, 이중 벽체 설계로 완벽한 소리 차단, 전문 방진 시공으로 진동 차단, DAW 작업에 최적화된 조명 설계" 
          />
          
          <FeatureCard 
            icon={FaShieldAlt} 
            title="장비 보호 시스템" 
            description="특수 설계 시스템 냉난방기, 결로 현상 완벽 차단, 장비 손상 위험 ZERO, 최적 습도 자동 유지" 
          />
          
          <FeatureCard 
            icon={FaStar} 
            title="프로덕션 최적화 시설" 
            description="기가비트 급 초고속 인터넷, 전문가급 음향 설비 완비, 업라이트 피아노 설치 가능, 노이즈리스 전기 시설" 
          />
          
          <FeatureCard 
            icon={FaMapMarkerAlt} 
            title="위치 및 접근성" 
            description="불광역/연신내역 도보 5분, 24시간 보안 시스템, 조용한 작업 환경" 
          />
        </div>
        
        {/* 추가 이미지 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div 
            className="rounded-lg overflow-hidden shadow-md h-64" 
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.3 }}
          >
            <ResponsiveImage
              src={`/images/room6.jpg`}
              alt="연습실 내부"
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              loading="lazy"
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            />
          </motion.div>
          <motion.div 
            className="rounded-lg overflow-hidden shadow-md h-64 md:col-span-2" 
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.3 }}
          >
            <ResponsiveImage
              src={`/images/room7.jpg`}
              alt="연습실 내부"
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              loading="lazy"
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            />
          </motion.div>
        </div>
      </motion.div>
      
      {/* CTA 섹션 */}
      <motion.div
        className="mt-16 overflow-hidden rounded-xl shadow-xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
      >
        <div className="grid md:grid-cols-2 items-stretch">
          <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 flex flex-col justify-center items-center text-center">
            <motion.h2 
              className="typo-section-title mb-4 text-gray-600 dark:text-gray-200"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              연습실 문의하기
            </motion.h2>
            <motion.p 
              className="typo-section-lead mb-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              궁금한 점이 있으시면 언제든지 문의해주세요.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <a
                href="https://open.kakao.com/me/nol"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-primary hover:bg-primary-dark text-white text-body-1 py-3 px-8 rounded-full transition duration-300 shadow-lg mx-auto"
              >
                <FaComments className="mr-2 text-xl" />
                카카오톡으로 문의하기
              </a>
            </motion.div>
          </div>
          
          <div className="h-full">
            <ResponsiveImage 
              src={`/images/room8.jpg`} 
              alt="연습실 전경" 
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              loading="lazy"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </div>
        </div>
      </motion.div>
      </div>
    </>
  );
};

export default PracticeRoom;
