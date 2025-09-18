import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { FaMicrophone, FaCompactDisc, FaGlobeAmericas, FaCalendarCheck, FaArrowRight } from 'react-icons/fa';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';

// 히어로 섹션 컴포넌트
const HeroSection = () => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-primary-dark via-primary to-secondary min-h-[90vh] flex items-center px-4 sm:px-0">
      {/* 배경 패턴 */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      {/* 음파 애니메이션 */}
      <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20">
        <motion.div
          className="w-full h-full"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          <svg viewBox="0 0 1440 320" className="w-full h-full">
            <path
              fill="none"
              stroke="white"
              strokeWidth="2"
              d="M0,160 C320,300,420,240,640,160 C880,80,960,120,1120,160 C1280,200,1360,120,1440,80 L1440,320 L0,320 Z"
            />
          </svg>
        </motion.div>
      </div>
      
      <div className="container mx-auto px-4 z-10 py-8 sm:py-16">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <motion.h1
              className="text-heading-1 sm:text-display-2 md:text-display-1 font-title text-white mb-6 break-keep"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="whitespace-nowrap">당신의 음악에</span>{' '}
              <span className="text-accent-light">생명</span>을 불어넣는 공간
            </motion.h1>
            
            <motion.p
              className="text-body-1-light text-white/80 mb-8 max-w-lg leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              최고급 장비와 전문 엔지니어가 함께하는 스튜디오 놀에서 당신만의 사운드를 완성하세요.
            </motion.p>
            
            <motion.div
              className="flex flex-wrap gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Link
                to="/contact"
                className="inline-flex items-center justify-center bg-white text-primary-dark text-body-1 leading-none py-3 px-8 rounded-full hover:bg-white/90 transition duration-300 shadow-lg"
              >
                예약하기
              </Link>
              <Link
                to="/portfolio"
                className="inline-flex items-center justify-center bg-transparent border-2 border-white text-white text-body-1 leading-none py-3 px-8 rounded-full hover:bg-white/10 transition duration-300"
              >
                포트폴리오 보기
              </Link>
            </motion.div>
          </div>
          
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl">
              <img
                src={`${process.env.PUBLIC_URL}/images/studio1.jpg`}
                alt="스튜디오 놀 메인 스튜디오"
                className="w-full h-auto"
              />
              
              {/* 오버레이 그라데이션 */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary-dark/30 to-transparent" />
            </div>
            
            {/* 장식 요소 */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-accent rounded-full opacity-80 blur-sm z-0" />
            <div className="absolute -top-6 -left-6 w-16 h-16 bg-secondary rounded-full opacity-60 blur-sm z-0" />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// 개선된 서비스 카드 컴포넌트
const ServiceCard = ({ title, description, link, icon: Icon }) => (
  <Link to={link} className="block h-full">
    <motion.div
      className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 h-full"
      whileHover={{ y: -5 }}
    >
      {/* 배경 그라데이션 */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" />
      
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 p-3 rounded-full mr-4 group-hover:from-primary/20 group-hover:to-secondary/20 dark:group-hover:from-primary/30 dark:group-hover:to-secondary/30 transition-colors duration-300">
            <Icon className="text-2xl text-primary dark:text-primary-light" />
          </div>
          <h3 className="typo-card-title text-gray-600 dark:text-gray-200">{title}</h3>
        </div>
        
        <p className="mb-6 typo-card-body flex-grow">{description}</p>
        
        <div className="mt-auto">
          <div className="inline-flex items-center typo-card-cta hover:text-primary-dark dark:hover:text-primary-light/80 transition-colors duration-300">
            자세히 보기
            <motion.span
              className="ml-1"
              initial={{ x: 0 }}
              whileHover={{ x: 5 }}
              transition={{ duration: 0.3 }}
            >
              <FaArrowRight size={14} />
            </motion.span>
          </div>
        </div>
      </div>
    </motion.div>
  </Link>
);

const StudioGallery = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        }
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1
        }
      }
    ]
  };

  const studioImages = [
    `${process.env.PUBLIC_URL}/images/studio2.jpg`,
    `${process.env.PUBLIC_URL}/images/studio3.jpg`,
    `${process.env.PUBLIC_URL}/images/studio4.jpg`,
    `${process.env.PUBLIC_URL}/images/studio5.jpg`,
    `${process.env.PUBLIC_URL}/images/hardware8.jpg`,
  ];

  return (
    <div className="mb-12">
      <Slider {...settings}>
        {studioImages.map((image, index) => (
          <div key={index} className="px-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              <img src={image} alt={`Studio ${index + 1}`} className="w-full h-64 object-cover rounded-lg shadow-md" />
            </motion.div>
          </div>
        ))}
      </Slider>
    </div>
  );
};

const Home = () => {
  return (
    <div className="overflow-visible">
      {/* 히어로 섹션 */}
      <HeroSection />

      <div className="container mx-auto px-4 py-16">
        <motion.h2 
          className="word-break-keep-all text-heading-2 font-title font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
          {...PAGE_TITLE_ANIMATION}
        >
          당신을 위한 녹음 공간과 장비
        </motion.h2>
        <StudioGallery />

        <motion.h2 
          className="word-break-keep-all text-heading-2 font-title font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
          {...PAGE_SUBTITLE_ANIMATION}
        >
          우리의 서비스
        </motion.h2>
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16"
          {...PAGE_CONTENT_ANIMATION}
        >
         <ServiceCard
         title="음반 기획"
         description="당신의 음악적 비전을 현실로 만들어드립니다. 기획부터 제작까지 전 과정을 함께합니다."
         link="/about"
         icon={FaCompactDisc}
       />
       <ServiceCard
         title="녹음 & 믹싱"
         description="고급 장비와 전문가와 함께 최상의 사운드를 만들어보세요. 당신의 소리에 생명을 불어넣습니다."
         link="/about"
         icon={FaMicrophone}
       />
       <ServiceCard
       title="홍보 & 마케팅"
       description="언론에 효과적으로 홍보하고, 쇼케이스를 풍부하게 지원함으로써 당신 음악의 매력을 더욱 널리 알립니다."
       link="/about"
       icon={FaGlobeAmericas}
     />
      </motion.div>

        <motion.div
          className="text-center bg-gray-50 dark:bg-gray-800 py-16 px-4 rounded-2xl shadow-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
        >
          <h2 className="typo-card-title mb-4 text-gray-600 dark:text-gray-200">당신의 음악 여정을 시작하세요</h2>
          <p className="typo-section-lead mb-8 max-w-2xl mx-auto text-center">
            최고의 환경에서 음악을 완성하세요.<br />
            스튜디오 놀이 당신의 음악적 여정을 함께합니다.
          </p>
          <Link to="/contact" className="inline-flex items-center justify-center bg-gradient-to-r from-primary to-secondary text-white text-body-1 py-3 px-8 rounded-full hover:from-primary-dark hover:to-secondary-dark transition duration-300 shadow-md">
            <FaCalendarCheck className="mr-2" />
            스튜디오 예약하기
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
