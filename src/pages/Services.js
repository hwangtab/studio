import React from 'react';
import { motion } from 'framer-motion';
import { FaMicrophone, FaGuitar, FaCompactDisc, FaMusic, FaGlobe, FaCalendarAlt } from 'react-icons/fa';

const ServiceCard = ({ title, description, icon: Icon, link, index, id }) => (
  <motion.a
    id={id}
    href={link}
    target="_blank"
    rel="noopener noreferrer"
    className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 block"
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
  >
    <div className="flex items-center mb-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-primary to-secondary text-white">
        <Icon className="text-2xl" />
      </div>
      <h3 className="text-xl font-bold ml-4">{title}</h3>
    </div>
    <p className="text-gray-600 mb-4">{description}</p>
  </motion.a>
);

const Services = () => {
  const services = [
    { 
      id: "album-planning",
      title: "음반 기획", 
      description: "아티스트의 비전을 실현하는 맞춤형 음반 기획 서비스를 제공합니다.", 
      icon: FaCompactDisc,
      link: "https://tumblbug.com/brothers"
    },
    { 
      id: "performance-planning",
      title: "공연 기획", 
      description: "소규모 공연부터 대형 콘서트까지, 다양한 규모의 공연을 기획합니다.", 
      icon: FaGuitar,
      link: "https://www.youtube.com/watch?v=Um9OrdTp4MQ&list=PLlm8-iwS-7gO2d6di6o3BWmMz-Mrb7t_B"
    },
    { 
      id: "mastering",
      id: "recording-mixing",
      title: "녹음", 
      description: "양질의 장비와 편안한 환경에서 최고의 녹음을 경험하세요.", 
      icon: FaMicrophone,
      link: "https://www.youtube.com/watch?v=6vgPysZOQ9c"
    },
    { 
      title: "믹싱", 
      description: "경험 많은 엔지니어가 여러분의 음악에 생명을 불어넣습니다.", 
      icon: FaMusic,
      link: "https://www.youtube.com/watch?v=j5PuwQVzRe8"
    },
    { 
      id: "mastering",
      title: "마스터링", 
      description: "완벽한 마무리로 여러분의 음악을 빛나게 만들어드립니다.", 
      icon: FaCompactDisc,
      link: "https://www.youtube.com/watch?v=plUtM5st6rg"
    },
    { 
      id: "music-distribution",
      title: "음원 유통", 
      description: "국내외 다양한 플랫폼을 통해 여러분의 음악을 세상에 선보입니다.", 
      icon: FaGlobe,
      link: "https://www.genie.co.kr/detail/albumInfo?axnm=83992507"
    }
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.h1 
        className="text-5xl pt-2 font-title mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        우리의 서비스
      </motion.h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {services.map((service, index) => (
          <ServiceCard key={index} {...service} index={index} />
        ))}
      </div>
      <div className="text-center">
        <motion.a
          href="https://open.kakao.com/o/swjEfude"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex items-center">
            <FaCalendarAlt className="mr-2" />
            상담 신청하기
          </div>
        </motion.a>
      </div>
    </div>
  );
};

export default Services;