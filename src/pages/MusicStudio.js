import React from 'react';
import { motion } from 'framer-motion';
import { FaMusic, FaMicrophone, FaUserFriends, FaChalkboardTeacher, FaShieldAlt, FaCog, FaMapMarkerAlt, FaComments } from 'react-icons/fa';

const SectionTitle = ({ children, icon: Icon }) => (
  <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800 flex items-center">
    {Icon && <Icon className="mr-3 text-primary" />}
    {children}
  </h2>
);

const MusicStudio = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-4 py-8"
    ><motion.h1 
    className="word-break-keep-all text-5xl font-title text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent px-4 pt-8 pb-8"
    initial={{ opacity: 0, y: -50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    은평구 프리미엄 음악연습실
  </motion.h1>
  
  <div className="grid md:grid-cols-2 gap-8 mb-12">
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white p-6 rounded-lg shadow-lg"
    >
      <h2 className="text-xl font-bold mb-4 flex items-center text-gray-800">
        <FaMicrophone className="mr-2 text-primary" />
        이런 고민이 있으신가요?
      </h2>
      <ul className="space-y-3 text-gray-600">
        <li className="flex items-center">💦 "에어컨에서 떨어지는 물방울 때문에 장비가 망가질까 불안해요..."</li>
        <li className="flex items-center">🔊 "옆방 소리가 다 들려서 집중이 안 돼요..."</li>
        <li className="flex items-center">😷 "환気が 안 되서 답답해요..."</li>
        <li className="flex items-center">⚡ "전기 노이즈 때문에 녹음을 다시 해야 해요..."</li>
        <li className="flex items-center">⚡ "작업환경이 불쾌하고 지저분해요..."</li>
      </ul>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white p-6 rounded-lg shadow-lg"
    >
      <h2 className="text-xl font-bold mb-4 flex items-center text-gray-800">
        <FaUserFriends className="mr-2 text-primary" />
        이런 분들을 위한 공간
      </h2>
      <div className="space-y-4 text-gray-600">
        <div>
          <h3 className="font-bold text-gray-700 flex items-center">
            <FaMusic className="mr-2 text-primary" /> 음악 작업자
          </h3>
          <p>프로듀서/작곡가를 위한 미디작업실, 보컬/래퍼를 위한 녹음 공간</p>
        </div>
        <div>
          <h3 className="font-bold text-gray-700 flex items-center">
            <FaMicrophone className="mr-2 text-primary" /> 콘텐츠 크리에이터
          </h3>
          <p>유튜버, 팟캐스터, 스트리머를 위한 녹음 스튜디오</p>
        </div>
        <div>
          <h3 className="font-bold text-gray-700 flex items-center">
            <FaChalkboardTeacher className="mr-2 text-primary" /> 음악 교육
          </h3>
          <p>프라이빗 레슨, 소규모 마스터클래스, 학원 분원용 연습실</p>
        </div>
      </div>
    </motion.div>
  </div>

  <div className="space-y-12">
    <section>
      <SectionTitle icon={FaCog}>뮤지션을 위한 완벽한 시스템</SectionTitle>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300"
        >
          <h3 className="text-lg font-bold mb-3 text-gray-800">진정한 프로의 작업 환경 🎼</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>국제표준 STC 방음 시스템</li>
            <li>이중 벽체 설계로 완벽한 소리 차단</li>
            <li>전문 방진 시공으로 진동 차단</li>
            <li>DAW 작업에 최적화된 조명 설계</li>
          </ul>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300"
        >
          <h3 className="text-lg font-bold mb-3 text-gray-800">장비 보호 시스템 🛡️</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>특수 설계 시스템 냉난방기</li>
            <li>결로 현상 완벽 차단</li>
            <li>장비 손상 위험 ZERO</li>
            <li>최적 습도 자동 유지</li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300"
        >
          <h3 className="text-lg font-bold mb-3 text-gray-800">프로덕션 최적화 시설 💫</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>기가비트 급 초고속 인터넷</li>
            <li>전문가급 음향 설비 완비</li>
            <li>업라이트 피아노 설치 가능</li>
            <li>노이즈리스 전기 시설</li>
          </ul>
        </motion.div>
      </div>
    </section>

    <section>
      <SectionTitle>실제 작업 후기</SectionTitle>
      <div className="grid md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="bg-white p-6 rounded-lg shadow-lg"
        >
          <p className="italic mb-4 text-gray-600">"다른 작업실과는 차원이 다른 환경이에요! 이런 곳을 찾고 있었어요 ㅠㅠ"</p>
          <p className="font-bold text-gray-800">- 프로듀서 K님</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="bg-white p-6 rounded-lg shadow-lg"
        >
          <p className="italic mb-4 text-gray-600">"딱 맞는 작업실이 필요했는데, 이제는 음악에만 집중할 수 있어요! 👍"</p>
          <p className="font-bold text-gray-800">- 작곡가 L님</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="bg-white p-6 rounded-lg shadow-lg"
        >
          <p className="italic mb-4 text-gray-600">"운영자님의 오랜 경험이 곳곳에 녹아있어요. 완벽 그 자체입니다! ✨"</p>
          <p className="font-bold text-gray-800">- 싱어송라이터 P님</p>
        </motion.div>
      </div>
    </section>

    <section>
      <SectionTitle icon={FaMapMarkerAlt}>위치 및 접근성</SectionTitle>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.0 }}
        className="bg-white p-6 rounded-lg shadow-lg"
      >
        <ul className="space-y-3 text-gray-600">
          <li className="flex items-center">🚶 불광역/연신내역 도보 5분</li>
          <li className="flex items-center">🔒 24시간 보안 시스템</li>
          <li className="flex items-center">🤫 조용한 작업 환경</li>
        </ul>
      </motion.div>
    </section>
  </div>

  <div className="text-center pt-16 pb-12">
    <motion.a
      href="https://open.kakao.com/o/sAWXdN5g"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-300"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="flex items-center">
        <FaComments className="w-5 h-5 mr-2" />
        연습실 문의하기
      </div>
    </motion.a>
  </div>
</motion.div>
  );
};

export default MusicStudio;
