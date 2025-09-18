import React from 'react';
import { motion } from 'framer-motion';
import { FaMicrophone, FaGuitar, FaCompactDisc, FaMusic, FaGlobe, FaCalendarAlt, FaArrowRight } from 'react-icons/fa';

const ServiceCard = ({ title, description, icon: Icon, link, index, id }) => (
  <motion.div
    id={id}
    className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
    whileHover={{ y: -5 }}
  >
    {/* 상단 바 요소 */}
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
    
    <div className="p-6">
      <div className="flex items-center mb-6">
        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 group-hover:from-primary/20 group-hover:to-secondary/20 dark:group-hover:from-primary/30 dark:group-hover:to-secondary/30 transition-colors duration-300">
          <Icon className="text-2xl text-primary dark:text-primary-light" />
        </div>
        <h3 className="typo-card-title ml-4 text-gray-600 dark:text-gray-200">{title}</h3>
      </div>

      <p className="typo-card-body mb-6">{description}</p>
      
      <div className="mt-auto">
        <a 
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center typo-card-cta hover:text-primary-dark dark:hover:text-primary-light/80 transition-colors duration-300"
        >
          자세히 보기
          <motion.span
            className="ml-1"
            initial={{ x: 0 }}
            whileHover={{ x: 5 }}
            transition={{ duration: 0.3 }}
          >
            <FaArrowRight size={14} />
          </motion.span>
        </a>
      </div>
    </div>
  </motion.div>
);

const ServiceFeature = ({ title, description, icon: Icon, index }) => (
  <motion.div
    className="flex flex-col items-center text-center p-6"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
  >
    <div className="bg-gradient-to-r from-primary to-secondary p-4 rounded-full mb-4 text-white">
      <Icon className="text-2xl" />
    </div>
    <h3 className="typo-card-subtitle mb-2 text-gray-600 dark:text-gray-200">{title}</h3>
    <p className="typo-card-body text-center">{description}</p>
  </motion.div>
);

const Services = () => {
  const services = [
    { 
      id: "album-planning",
      title: "음반 기획", 
      description: "아티스트의 비전을 실현하는 맞춤형 음반 기획 서비스를 제공합니다. 컨셉 설정부터 제작까지 전 과정을 함께합니다.", 
      icon: FaCompactDisc,
      link: "https://tumblbug.com/brothers"
    },
    { 
      id: "performance-planning",
      title: "공연 기획", 
      description: "소규모 공연부터 대형 콘서트까지, 다양한 규모의 공연을 기획합니다. 아티스트의 음악적 색깔을 살린 공연을 만듭니다.", 
      icon: FaGuitar,
      link: "https://www.youtube.com/watch?v=Um9OrdTp4MQ&list=PLlm8-iwS-7gO2d6di6o3BWmMz-Mrb7t_B"
    },
    { 
      id: "recording-mixing",
      title: "녹음", 
      description: "양질의 장비와 편안한 환경에서 최고의 녹음을 경험하세요. 전문 엔지니어가 최상의 사운드를 만들어드립니다.", 
      icon: FaMicrophone,
      link: "https://www.youtube.com/watch?v=6vgPysZOQ9c"
    },
    { 
      id: "mixing",
      title: "믹싱", 
      description: "경험 많은 엔지니어가 여러분의 음악에 생명을 불어넣습니다. 각 트랙의 특성을 살려 조화로운 사운드를 만듭니다.", 
      icon: FaMusic,
      link: "https://www.youtube.com/watch?v=j5PuwQVzRe8"
    },
    { 
      id: "mastering",
      title: "마스터링", 
      description: "완벽한 마무리로 여러분의 음악을 빛나게 만들어드립니다. 상업적 수준의 음질을 보장합니다.", 
      icon: FaCompactDisc,
      link: "https://www.youtube.com/watch?v=plUtM5st6rg"
    },
    { 
      id: "music-distribution",
      title: "음원 유통", 
      description: "국내외 다양한 플랫폼을 통해 여러분의 음악을 세상에 선보입니다. 스포티파이, 애플뮤직, 멜론 등 주요 스트리밍 서비스에 배포합니다.", 
      icon: FaGlobe,
      link: "https://www.genie.co.kr/detail/albumInfo?axnm=83992507"
    }
  ];

  const features = [
    {
      title: "전문 장비",
      description: "최고급 마이크, 프리앰프, 컨버터 등 프로페셔널한 장비를 갖추고 있습니다.",
      icon: FaMicrophone
    },
    {
      title: "전문 인력",
      description: "다양한 장르의 음악 제작 경험을 가진 전문 엔지니어가 함께합니다.",
      icon: FaMusic
    },
    {
      title: "맞춤형 서비스",
      description: "아티스트의 개성과 음악적 방향성을 존중하는 맞춤형 서비스를 제공합니다.",
      icon: FaCompactDisc
    }
  ];

  return (
    <div className="overflow-visible">
      {/* 서비스 소개 섹션 */}
      <div className="bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent py-16">
        <div className="container mx-auto px-4">
          <motion.h1 
            className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            우리의 서비스
          </motion.h1>
          
          <motion.p
            className="typo-section-lead text-center max-w-3xl mx-auto mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            스튜디오 놀은 음반 기획부터 녹음, 믹싱, 마스터링, 음원 유통까지 음악 제작의 모든 과정을 지원합니다.
            아티스트의 음악적 비전을 실현하기 위한 최고의 파트너가 되겠습니다.
          </motion.p>
          
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {features.map((feature, index) => (
              <ServiceFeature key={index} {...feature} index={index} />
            ))}
          </div>
        </div>
      </div>
      
      {/* 서비스 카드 섹션 */}
      <div className="container mx-auto px-4 py-16">
        <motion.h2 
          className="typo-section-title mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          제공 서비스
        </motion.h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {services.map((service, index) => (
            <ServiceCard key={index} {...service} index={index} />
          ))}
        </div>
        
        <div className="text-center">
          <motion.a
            href="https://open.kakao.com/me/nol"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center bg-gradient-to-r from-primary to-secondary text-white text-body-1 py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            whileTap={{ scale: 0.95 }}
          >
            <FaCalendarAlt className="mr-2" />
            상담 신청하기
          </motion.a>
        </div>
      </div>
    </div>
  );
};

export default Services;
