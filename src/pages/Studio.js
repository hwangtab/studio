import React from 'react';
import { motion } from 'framer-motion';
import { FaMicrophone, FaSlidersH, FaHeadphones, FaGuitar, FaKeyboard, FaMusic, FaCompactDisc, FaLaptop, FaComments } from 'react-icons/fa';

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
    compressors: ["Tegeler Vari Tube Compressor", "Drawmer DL251", "Alctron Cp540v2"],
    interfaces: ["Prism Sound Lyra 2"],
    processors: ["Solid State Logic Fusion"],
    speakers: ["Proac Tablett 50", "EVE Audio SC207", "Adam Audio A5"],
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
      
      <motion.div 
        className="bg-white p-6 rounded-lg shadow-lg mb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
         <p className="italic mb-4 text-gray-600">
          안녕하세요, 음악으로 꿈을 그리는 여러분! 스튜디오 놀은 아날로그와, 디지털의 조화를 추구하는 프리미엄 레코딩 스튜디오입니다. 
        </p>
        <p className="italic mb-4 text-gray-600">
          '스튜디오 놀'은 음악인들의 자유로운 상상과 창작 활동을 지원하기 위해 탄생한 공간입니다. 우리는 최고의 시설과 장비, 그리고 전문 엔지니어의 노하우를 바탕으로 여러분의 음악적 비전을 현실로 만드는 일에 전념하고 있습니다. 
        </p>
        <p className="italic mb-4 text-gray-600">
        디지털 시대에서 점점 잃어가는 아날로그 사운드의 진정한 가치를 전달하기 위해 노력하고 있습니다. 트랜스포머를 통과할 때 자연스럽게 발생하는 부드러운 왜곡, 진공관이 선사하는 따뜻한 배음의 향연, 아날로그 회로가 만들어내는 특유의 음악적 하모닉스까지. 이런 요소들은 단순한 '소리'를 넘어 감동적인 '음악적 순간'으로 승화됩니다. 
        </p>
        <p className="italic mb-4 text-gray-600">
          '스튜디오 놀'은 여러분의 음악적 비전을 실현하는 창의적인 파트너가 되고자 합니다. 보컬과 악기 레코딩은 물론, 아날로그-디지털 하이브리드 믹싱과 마스터링까지 모든 과정에서 최고의 퀄리티를 추구합니다. 더불어 앨범 기획, 펀딩, 디자인, 홍보, 언론배포까지 음반 활동에 필요한 모든 인프라를 제공하여 아티스트분들이 음악 제작에만 온전히 집중하실 수 있도록 돕고 있습니다. 
        </p>
      </motion.div>
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

      <div className="text-center pt-16 pb-12">
        <motion.a
          href="https://open.kakao.com/o/sgTfRiah"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex items-center">
            <FaMicrophone className="w-5 h-5 mr-2" />
            작업 문의하기
          </div>
        </motion.a>
      </div>
    </div>
  );
};

export default Studio;