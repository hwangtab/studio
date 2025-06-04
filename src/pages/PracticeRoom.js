import React from 'react';
import { motion } from 'framer-motion';
import { FaMusic, FaShieldAlt, FaStar, FaMapMarkerAlt, FaFan, FaVolumeMute, FaWind, FaBolt, FaBroom, FaComments } from 'react-icons/fa';
import { Link } from 'react-router-dom';

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
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
    </div>
    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{description}</p>
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
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium whitespace-normal" style={{ wordBreak: 'keep-all' }}>{text}</p>
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
      <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
    </div>
    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{description}</p>
  </motion.div>
);

const PracticeRoom = () => {
  return (
    <div className="container mx-auto px-4 py-16">
      {/* 히어로 섹션 */}
      <motion.div
        className="mb-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.h1 
          className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          은평구 프리미엄 방음 연습실
        </motion.h1>
        
        <motion.p
          className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          최적의 환경에서 여러분의 음악을 연습하세요.
          <br />
          다양한 장비와 시설을 갖춘 프리미엄 연습실에서 음악을 즐기세요.
        </motion.p>
        
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <motion.div 
            className="relative rounded-xl overflow-hidden shadow-xl h-[400px]"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <img 
              src={`${process.env.PUBLIC_URL}/images/room6.jpg`} 
              alt="프리미엄 방음 연습실" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end">
              <div className="p-6">
                <p className="text-white text-xl font-bold">프로페셔널한 연습 환경</p>
                <p className="text-white/80">당신의 음악을 위한 최적의 공간</p>
              </div>
            </div>
          </motion.div>
          
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">이런 고민이 있으신가요?</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <PainPoint icon={FaWind} text="에어컨에서 떨어지는 물방울 때문에 장비가 망가질까 불안해요..." />
              <PainPoint icon={FaVolumeMute} text="옆방 소리가 다 들려서 집중이 안 돼요..." />
              <PainPoint icon={FaWind} text="공기가 잘 통하지 않아 답답해요..." />
              <PainPoint icon={FaBolt} text="전기 노이즈 때문에 녹음을 다시 해야 해요..." />
              <PainPoint icon={FaBroom} text="작업환경이 불쾌하고 지저분해요..." />
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
          className="text-2xl font-bold mb-6 text-center text-primary dark:text-primary-light"
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
            <img src={`${process.env.PUBLIC_URL}/images/room2.jpg`} alt="연습실 내부" className="w-full h-full object-cover" />
          </motion.div>
          <motion.div 
            className="rounded-lg overflow-hidden shadow-md h-48" 
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          >
            <img src={`${process.env.PUBLIC_URL}/images/room3.jpg`} alt="연습실 내부" className="w-full h-full object-cover" />
          </motion.div>
          <motion.div 
            className="rounded-lg overflow-hidden shadow-md h-48" 
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          >
            <img src={`${process.env.PUBLIC_URL}/images/room4.jpg`} alt="연습실 내부" className="w-full h-full object-cover" />
          </motion.div>
          <motion.div 
            className="rounded-lg overflow-hidden shadow-md h-48" 
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          >
            <img src={`${process.env.PUBLIC_URL}/images/room5.jpg`} alt="연습실 내부" className="w-full h-full object-cover" />
          </motion.div>
        </div>
      </motion.div>
      
      {/* 특징 섹션 */}
      <motion.div
        className="mb-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <motion.h2 
          className="text-3xl font-title mb-12 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
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
            <img src={`${process.env.PUBLIC_URL}/images/room6.jpg`} alt="연습실 내부" className="w-full h-full object-cover" />
          </motion.div>
          <motion.div 
            className="rounded-lg overflow-hidden shadow-md h-64 md:col-span-2" 
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.3 }}
          >
            <img src={`${process.env.PUBLIC_URL}/images/room7.jpg`} alt="연습실 내부" className="w-full h-full object-cover" />
          </motion.div>
        </div>
      </motion.div>
      
      {/* CTA 섹션 */}
      <motion.div
        className="mb-16 overflow-hidden rounded-xl shadow-xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
      >
        <div className="grid md:grid-cols-2 items-stretch">
          <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 flex flex-col justify-center">
            <motion.h2 
              className="text-3xl font-bold mb-4 text-gray-800 dark:text-white"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              연습실 문의하기
            </motion.h2>
            <motion.p 
              className="text-gray-700 dark:text-gray-300 mb-8 text-lg"
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
                href="https://open.kakao.com/o/sAWXdN5g" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-full transition duration-300 shadow-lg"
              >
                <FaComments className="mr-2 text-xl" />
                카카오톡으로 문의하기
              </a>
            </motion.div>
          </div>
          
          <div className="h-full">
            <img 
              src={`${process.env.PUBLIC_URL}/images/room8.jpg`} 
              alt="연습실 전경" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PracticeRoom;
