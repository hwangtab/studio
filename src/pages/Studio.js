import React from 'react';
import { motion } from 'framer-motion';
import { FaMicrophone, FaSlidersH, FaHeadphones, FaGuitar, FaKeyboard, FaMusic, FaCompactDisc, FaLaptop } from 'react-icons/fa';

const EquipmentSection = ({ title, items, icon: Icon }) => (
  <motion.div
    className="bg-white p-6 rounded-lg shadow-lg mb-6"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <h3 className="text-xl font-bold mb-4 flex items-center">
      <Icon className="mr-2 text-primary" />
      {title}
    </h3>
    <ul className="list-disc pl-5 text-gray-700">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  </motion.div>
);

const Studio = () => {
  const equipment = {
    microphones: [
      "Neumann U87AI", "AKG C414 XLS", "Warm Audio WA47jr",
      "Beyerdynamic TG-X81", "Shure SM58", "Shure SM57"
    ],
    preamps: ["Vintech X73i Preamp", "Focusrite Saffire Octopre"],
    equalizers: [
      "SPL Optimizer Parametric Equalizer",
      "TL Audio 2012 Parametric Equalizer"
    ],
    compressors: ["Toft Audio DC-2", "Drawmer DL251", "Alctron Cp540v2"],
    interfaces: ["Prism Sound Lyra 2"],
    processors: ["Solid State Logic Fusion"],
    speakers: ["Proac Tablett 50", "EVE Audio SC207", "KRK VXT4"],
    headphones: ["Sennheiser HD600", "Sony MDR-7506", "Calyx H", "SHURE SRH 440"],
    instruments: [
      "Vox AC30 Guitar Amp", "Fender Princeton", "Fender Rumble 100",
      "Yamaha U3 Piano"
    ],
    consoles: ["Softube Colsole 1", "Softube Colsole 1 Fader"],
    synthesizers: [
      "Spectrasonics", "Spitfire Audio", "Native Instruments", "U-he", "Arturia"
    ],
    plugins: [
      "UAD", "Acustica Audio", "Softube", "Ik Multimea", "Soundtoys",
      "Izotope", "Arturia FX Collection", "Sonnox", "Liquidsonics", "Oeksound"
    ]
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.h1 
        className="text-5xl pt-2 font-title mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        스튜디오 소개
      </motion.h1>
      
      <motion.div 
        className="bg-white p-6 rounded-lg shadow-lg mb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
         <p className="text-lg text-gray-700 mb-4">
          안녕하세요, 음악으로 꿈을 그리는 여러분! 🎶 한국스마트협동조합이 운영하는 레코딩 스튜디오, '스튜디오 놀'에 오신 것을 환영합니다! 😊
        </p>
        <p className="text-lg text-gray-700 mb-4">
          '스튜디오 놀'은 음악인들의 자유로운 상상과 창작 활동을 지원하기 위해 탄생한 공간입니다. 🎨🎤 우리는 최고의 시설과 장비, 그리고 전문 엔지니어의 노하우를 바탕으로 여러분의 음악적 비전을 현실로 만드는 일에 전념하고 있습니다. 🎧💡
        </p>
        <p className="text-lg text-gray-700 mb-4">
          단순히 음악을 녹음하는 공간을 넘어, 아티스트와 엔지니어가 함께 호흡하며 이야기를 나누고, 아이디어를 실험하며, 창의적인 협업을 이뤄낼 수 있는 공간. 그것이 바로 '스튜디오 놀'이 추구하는 가치입니다. 🤝🎛️
        </p>
        <p className="text-lg text-gray-700">
          '스튜디오 놀'은 언제나 음악인 여러분과 함께 걸어가겠습니다. 더 나은 음악, 더 따뜻한 세상을 향한 여정에 우리와 동행해 주세요. 🎤🌏
        </p>
      </motion.div>

      <h2 className="text-5xl pt-6 font-title mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent">장비 목록</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <EquipmentSection title="마이크" items={equipment.microphones} icon={FaMicrophone} />
        <EquipmentSection title="프리앰프 & 이퀄라이저" items={[...equipment.preamps, ...equipment.equalizers]} icon={FaSlidersH} />
<EquipmentSection title="컴프레서 & 프로세서" items={[...equipment.compressors, ...equipment.processors]} icon={FaSlidersH} />
        <EquipmentSection title="스피커 & 헤드폰" items={[...equipment.speakers, ...equipment.headphones]} icon={FaHeadphones} />
        <EquipmentSection title="악기 & 앰프" items={equipment.instruments} icon={FaGuitar} />
        <EquipmentSection title="신디사이저 & 샘플러" items={equipment.synthesizers} icon={FaKeyboard} />
        <EquipmentSection title="플러그인" items={equipment.plugins} icon={FaMusic} />
        <EquipmentSection title="인터페이스 & 콘솔" items={[...equipment.interfaces, ...equipment.consoles]} icon={FaLaptop} />
      </div>
    </div>
  );
};

export default Studio;