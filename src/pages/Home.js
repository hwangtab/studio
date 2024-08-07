import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { FaMicrophone, FaCompactDisc, FaGlobeAmericas } from 'react-icons/fa';

const AnimatedCard = ({ title, description, link, icon: Icon }) => (
  <motion.div
    className="bg-white p-6 rounded-lg shadow-lg overflow-hidden"
    whileHover={{ y: -5, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
    transition={{ duration: 0.3 }}
  >
    <div className="flex items-center mb-4">
      <div className="bg-gradient-to-r from-primary to-secondary p-3 rounded-full mr-4">
        <Icon className="text-2xl text-white" />
      </div>
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    </div>
    <p className="mb-4 text-gray-600">{description}</p>
    <Link to={link} className="inline-block bg-gradient-to-r from-primary to-secondary text-white font-bold py-2 px-4 rounded-full hover:from-primary-dark hover:to-secondary-dark transition duration-300">
      자세히 보기
    </Link>
  </motion.div>
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
    `${process.env.PUBLIC_URL}/images/studio1.jpg`,
    `${process.env.PUBLIC_URL}/images/studio2.jpg`,
    `${process.env.PUBLIC_URL}/images/studio3.jpg`,
    `${process.env.PUBLIC_URL}/images/studio4.jpg`,
    `${process.env.PUBLIC_URL}/images/studio5.jpg`,
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
      

      <div className="container mx-auto px-4 py-12">
        <motion.h2 
          className="text-5xl pt-2 font-title mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          당신을 위한 녹음 공간과 장비
        </motion.h2>
        <StudioGallery />

        <motion.h2 
          className="text-5xl pt-6 font-title mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          우리의 서비스
        </motion.h2>
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <AnimatedCard 
            title="음반 기획" 
            description="당신의 음악적 비전을 현실로 만들어드립니다." 
            link="/services"
            icon={FaCompactDisc}
          />
          <AnimatedCard 
            title="녹음 & 믹싱" 
            description="고급 장비와 전문가와 함께 최상의 사운드를 만들어보세요." 
            link="/services"
            icon={FaMicrophone}
          />
          <AnimatedCard 
            title="음원 유통" 
            description="당신의 음악을 리스너들에게 선보일 수 있도록 도와드립니다." 
            link="/services"
            icon={FaGlobeAmericas}
          />
        </motion.div>

        <motion.div
          className="text-center bg-gray-100 py-12 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <h2 className="text-2xl font-bold mb-4 text-gray-800">당신의 음악 여정을 시작하세요</h2>
          <p className="text-xl mb-8 text-gray-600">최고의 환경에서 음악을 완성하세요.</p>
          <Link to="/booking" className="inline-block bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 px-8 rounded-full text-lg hover:from-primary-dark hover:to-secondary-dark transition duration-300">
            스튜디오 예약하기
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;