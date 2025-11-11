import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaMusic, FaUsers, FaRegLightbulb, FaRegClock, FaHeadphones, FaPalette, FaGlobeAsia, FaBullhorn, FaRegMoneyBillAlt, FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaCommentDots, FaCalendarAlt } from 'react-icons/fa';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../utils/animationUtils';
import ResponsiveImage from '../components/ResponsiveImage';

const StandardCard = ({ icon: Icon, title, description, delay, size = 'base' }) => {
  const isLarge = size === 'lg';

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg p-6 border border-gray-100 dark:border-gray-700 transition-all duration-300 h-full flex flex-col"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -5, shadow: 'lg' }}
    >
      <div className="flex items-center mb-4">
        <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
          <Icon className="text-2xl text-primary dark:text-primary-light" />
        </div>
        <h3 className={`${isLarge ? 'typo-card-title' : 'typo-card-subtitle'} text-gray-600 dark:text-gray-200`}>{title}</h3>
      </div>
      <p className={`typo-card-body mt-2 flex-grow`}>
        {description}
      </p>
    </motion.div>
  );
};

const About = () => {
  const productionProcess = [
    {
      title: "기획 단계",
      description: "앨범 콘셉트 설정, 제작 일정 및 예산 계획을 함께 수립합니다.",
      icon: FaRegLightbulb
    },
    {
      title: "펀딩 지원",
      description: "크라우드 펀딩을 통한 예산 마련 컨설팅을 제공합니다.",
      icon: FaRegMoneyBillAlt
    },
    {
      title: "레코딩",
      description: "프리미엄 아날로그 장비를 활용한 고품질 녹음 서비스를 제공합니다.",
      icon: FaHeadphones
    },
    {
      title: "믹싱/마스터링",
      description: "따뜻하고 입체적인 사운드를 구현하여 음악에 생명을 불어넣습니다.",
      icon: FaMusic
    },
    {
      title: "디자인",
      description: "앨범 아트워크, 자켓, 프로모션 이미지 제작을 지원합니다.",
      icon: FaPalette
    },
    {
      title: "유통",
      description: "온라인/오프라인 음원 및 음반 유통 서비스를 제공합니다.",
      icon: FaGlobeAsia
    },
    {
      title: "홍보/마케팅",
      description: "SNS 활용, 언론 배포, 온오프라인 홍보 지원으로 음악을 알립니다.",
      icon: FaBullhorn
    },
    {
      title: "공연 기획",
      description: "라이브 공연 기획 및 운영 지원으로 아티스트의 무대를 완성합니다.",
      icon: FaCalendarAlt
    }
  ];

  const advantages = [
    {
      title: "소통 오류 최소화",
      description: "각 단계별 소통 오류를 최소화하여 원활한 제작 과정을 보장합니다.",
      icon: FaUsers
    },
    {
      title: "일관된 콘셉트 유지",
      description: "처음부터 끝까지 일관된 앨범 콘셉트를 유지하여 작품의 완성도를 높입니다.",
      icon: FaRegLightbulb
    },
    {
      title: "시간과 비용 효율성",
      description: "통합 프로세스를 통해 시간과 비용의 효율성을 극대화합니다.",
      icon: FaRegClock
    },
    {
      title: "창작 집중 환경",
      description: "뮤지션은 창작에만 집중할 수 있는 환경을 제공합니다.",
      icon: FaMusic
    }
  ];

  return (
    <div className="overflow-visible">
      {/* 헤더 섹션 */}
      <section className="bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent pt-16 pb-12">
        <div className="container mx-auto px-4">
          <motion.h1 
            className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
            {...PAGE_TITLE_ANIMATION}
          >
            스튜디오 놀
          </motion.h1>
          
          <motion.div
            className="max-w-3xl mx-auto text-center mb-10"
            {...PAGE_SUBTITLE_ANIMATION}
          >
            <h2 className="typo-card-title text-gray-600 dark:text-gray-200 mb-6">
              기획부터 유통, 홍보까지 함께하는{" "}
              <span className="whitespace-nowrap">올인원 프로덕션</span>
            </h2>
            <p className="typo-section-lead mb-6">
              스튜디오 놀은 단순한 녹음 스튜디오가 아닌 뮤지션의 음악적 여정 전체를 함께하는 파트너입니다.
              <br />
              음악 작업에 집중하고 싶은 뮤지션들에게 최적의{" "}
              <span className="whitespace-nowrap">올인원 프로덕션</span> 서비스를 제공합니다.
            </p>
          </motion.div>

          {/* 메인 이미지 */}
          <motion.div 
            className="relative rounded-xl overflow-hidden shadow-2xl max-w-4xl mx-auto h-[400px] mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <ResponsiveImage 
              src={`${process.env.PUBLIC_URL}/images/studio2.jpg`} 
              alt="스튜디오 놀 메인" 
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              loading="eager"
              sizes="(min-width: 1024px) 60vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex flex-col justify-end p-8">
              <h3 className="text-heading-3 font-title font-bold text-white mb-2">
                <span className="whitespace-nowrap">올인원 음악</span> 프로덕션 서비스
              </h3>
              <p className="text-body-1-extra-light text-white/90 max-w-2xl">앨범 기획부터 유통, 홍보까지 모든 과정을 한 곳에서 제공하는 토털 솔루션</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 올인원 프로덕션 서비스 */}
      <section className="pt-16 pb-12 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="typo-section-title mb-4 text-gray-600 dark:text-gray-200">
              <span className="whitespace-nowrap">올인원 음악</span> 프로덕션 서비스
            </h2>
            <p className="typo-section-lead max-w-3xl mx-auto">
              앨범 기획부터 유통, 홍보까지 모든 과정을 한 곳에서 제공하여 뮤지션의 비전을 실현하는 토털 솔루션을 제공합니다.
              개별 과정마다 전문가 연계로 최상의 결과물을 보장합니다.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <StandardCard
              title="앨범 기획부터 유통까지"
              description="모든 음악 제작 과정을 한 곳에서 처리하여 효율성을 극대화합니다."
              icon={FaMusic}
              delay={0.1}
              size="lg"
            />
            <StandardCard
              title="뮤지션의 비전 실현"
              description="뮤지션의 음악적 비전을 최우선으로 존중하는 프로덕션 철학을 가지고 있습니다."
              icon={FaRegLightbulb}
              delay={0.2}
              size="lg"
            />
            <StandardCard
              title="전문가 연계 시스템"
              description="각 분야 최고의 전문가들과 협업하여 최상의 결과물을 보장합니다."
              icon={FaUsers}
              delay={0.3}
              size="lg"
            />
          </div>
        </div>
      </section>

      {/* 종합 음반 제작 프로세스 */}
      <section className="pt-16 pb-12">
        <div className="container mx-auto px-4">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="typo-section-title mb-4 text-gray-600 dark:text-gray-200">종합 음반 제작 프로세스</h2>
            <p className="typo-section-lead max-w-3xl mx-auto">
              스튜디오 놀은 음반 제작의 모든 단계를 체계적으로 관리하여 최고 품질의 결과물을 만들어냅니다.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {productionProcess.map((step, index) => (
              <StandardCard
                key={index}
                title={step.title}
                description={step.description}
                icon={step.icon}
                delay={0.1 * (index + 1)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 스튜디오 놀의 차별점 */}
      <section className="pt-16 pb-12 bg-gradient-to-r from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10">
        <div className="container mx-auto px-4">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="typo-section-title mb-4 text-gray-600 dark:text-gray-200">스튜디오 놀의 차별점</h2>
            <p className="typo-section-lead max-w-3xl mx-auto">
              연신내에 위치한 원스톱 프로덕션 시스템으로 아날로그 장비를 통한 따뜻하고 감칠맛 있는 사운드를 구현합니다.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-100 dark:border-gray-700"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="typo-card-title text-gray-600 dark:text-gray-200 mb-4">비용 효율적인 패키지 옵션</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                  <p className="typo-card-body">개별 서비스 이용보다 통합 패키지로 비용 절감</p>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                  <p className="typo-card-body">뮤지션 상황에 맞춘 맞춤형 서비스 구성</p>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                  <p className="typo-card-body">독립 뮤지션을 위한 맞춤형 인프라 제공</p>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                  <p className="typo-card-body">아날로그 장비를 통한 따뜻하고 감칠맛 있는 사운드 구현</p>
                </li>
              </ul>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 gap-4"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {advantages.map((advantage, index) => (
                <div 
                  key={index} 
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="flex items-center mb-2">
                    <advantage.icon className="text-primary dark:text-primary-light mr-2" />
                    <h4 className="typo-card-subtitle text-gray-600 dark:text-gray-200">{advantage.title}</h4>
                  </div>
                  <p className="typo-card-body">{advantage.description}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* 연락 및 상담 */}
      <section className="pt-16 pb-12 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="typo-section-title mb-4 text-gray-600 dark:text-gray-200">연락 및 상담</h2>
            <p className="typo-section-lead max-w-3xl mx-auto">
              무료 프로덕션 상담을 제공해 드립니다. 언제든지 아래 연락처로 문의해 주세요.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 text-center cursor-pointer"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              whileHover={{ y: -5 }}
              onClick={() => window.open('tel:02-764-3114', '_blank')}
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <FaPhoneAlt className="text-xl text-primary dark:text-primary-light" />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-gray-600 dark:text-gray-200">전화</h3>
              <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">02-764-3114</p>
            </motion.div>

            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 text-center cursor-pointer"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              whileHover={{ y: -5 }}
              onClick={() => window.open('mailto:contact@kosmart.org', '_blank')}
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <FaEnvelope className="text-xl text-primary dark:text-primary-light" />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-gray-600 dark:text-gray-200">이메일</h3>
              <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">contact@kosmart.org</p>
            </motion.div>

            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 text-center cursor-pointer"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              whileHover={{ y: -5 }}
              onClick={() => window.open('https://open.kakao.com/me/nol', '_blank')}
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <FaCommentDots className="text-xl text-primary dark:text-primary-light" />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-gray-600 dark:text-gray-200">카카오톡</h3>
              <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">오픈채팅 바로가기</p>
            </motion.div>

            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 text-center cursor-pointer"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              whileHover={{ y: -5 }}
              onClick={() => window.open('https://naver.me/5gFZhS3X', '_blank')}
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <FaMapMarkerAlt className="text-xl text-primary dark:text-primary-light" />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-gray-600 dark:text-gray-200">위치</h3>
              <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">서울특별시 은평구 대조동 84-3 3층</p>
            </motion.div>
          </div>

          <Link to="/contact">
            <motion.div
              className="mt-12 bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-lg shadow-lg p-8 border border-primary/20 dark:border-secondary/20 text-center max-w-2xl mx-auto cursor-pointer group"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              whileHover={{ scale: 1.02 }}
            >
              <p className="typo-card-title font-medium text-primary dark:text-primary-light mb-3 group-hover:text-primary-dark dark:group-hover:text-primary-light/90 transition-colors">
                스튜디오 놀과 함께하세요!
              </p>
              <p className="typo-section-lead mb-4">
                지금 바로 상담 예약이 가능합니다.<br />
                프로젝트의 규모와 상관없이 언제든 편하게 문의주세요.<br />
                첫 상담부터 최종 마스터링까지 함께합니다.
              </p>
              <div className="inline-block bg-gradient-to-r from-primary to-secondary text-white text-body-1 py-2 px-6 rounded-full hover:from-primary-dark hover:to-secondary-dark transition-all duration-300 shadow-sm">
                연락하기
              </div>
            </motion.div>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default About;
