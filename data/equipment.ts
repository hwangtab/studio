import type { Locale } from '../lib/i18n';

// Translation helper
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getEquipmentData = (locale: Locale) => {
  const categories = {
    microphones: t(locale, { ko: '마이크', en: 'Microphones', zh: '麦克风', es: 'Micrófonos' }),
    preamps: t(locale, { ko: '프리앰프', en: 'Preamps', zh: '前置放大器', es: 'Preamplificadores' }),
    equalizers: t(locale, { ko: '이퀄라이저', en: 'Equalizers', zh: '均衡器', es: 'Ecualizadores' }),
    compressors: t(locale, { ko: '컴프레서', en: 'Compressors', zh: '压缩器', es: 'Compresores' }),
    interfaces: t(locale, { ko: '인터페이스', en: 'Interfaces', zh: '音频接口', es: 'Interfaces' }),
    processors: t(locale, { ko: '프로세서', en: 'Processors', zh: '处理器', es: 'Procesadores' }),
    speakers: t(locale, { ko: '스피커', en: 'Speakers', zh: '扬声器', es: 'Altavoces' }),
    headphones: t(locale, { ko: '헤드폰', en: 'Headphones', zh: '耳机', es: 'Auriculares' }),
    instruments: t(locale, { ko: '악기', en: 'Instruments', zh: '乐器', es: 'Instrumentos' }),
    consoles: t(locale, { ko: '콘솔', en: 'Consoles', zh: '调音台', es: 'Consolas' }),
    synthesizers: t(locale, { ko: '신디사이저/가상악기', en: 'Synthesizers/VST', zh: '合成器/虚拟乐器', es: 'Sintetizadores/VST' }),
    plugins: t(locale, { ko: '플러그인', en: 'Plugins', zh: '插件', es: 'Plugins' }),
  };

  const equipment = {
    microphones: [
      "Neumann U87AI",
      "AKG C414 XLS",
      "Studio Project C1",
      "Beyerdynamic TG-X81",
      "Shure SM58",
      "Shure SM57",
    ],
    preamps: ["Vintech X73i Preamp", "Focusrite Saffire Octopre"],
    equalizers: ["SPL Optimizer Parametric Equalizer"],
    compressors: ["Tegeler Vari Tube Compressor", "Alctron Cp540v2"],
    interfaces: ["Prism Sound Lyra 2", "Arturia X8 OUT"],
    processors: ["Solid State Logic Fusion", "Lexicon MX300"],
    speakers: ["Proac Tablett 50", "EVE Audio SC207", "ADAM Audio A5"],
    headphones: [
      "Sennheiser HD600",
      "Sony MDR-7506",
      "Calyx H",
      "SHURE SRH 440",
    ],
    instruments: [
      "Vox AC30 Guitar Amp",
      "Yamaha U3 Piano",
      "Yamaha U1 Piano",
      "Gibson J-15",
      "G&L Tribute ASAT",
    ],
    consoles: [
      "Softube Console 1",
      "Softube Console 1 Fader",
      "Presonus Faderport V2",
    ],
    synthesizers: [
      "Spectrasonics",
      "Spitfire Audio",
      "Native Instruments",
      "u-he",
      "Arturia",
      "UJAM",
      "Moog",
    ],
    plugins: [
      "UAD",
      "Acustica Audio",
      "Softube",
      "Soundtoys",
      "Izotope",
      t(locale, { ko: "Sonnox 등 다수", en: "Sonnox and many more", zh: "Sonnox 等更多", es: "Sonnox y muchos más" }),
    ],
  };

  const studioImages = [
    { 
      src: "/images/hardware2.jpg", 
      alt: t(locale, { ko: "스튜디오 놀 메인 컨트롤 룸", en: "Studio NOL Main Control Room", zh: "Studio NOL 主控制室", es: "Sala de Control Principal Studio NOL" }) 
    },
    { 
      src: "/images/hardware3.jpg", 
      alt: t(locale, { ko: "Neumann U87AI 콘덴서 마이크와 Vintech 프리앰프", en: "Neumann U87AI & Vintech Preamp", zh: "Neumann U87AI 电容麦克风 & Vintech 前置放大器", es: "Micrófono Condensador Neumann U87AI & Preamplificador Vintech" }) 
    },
    { 
      src: "/images/hardware4.jpg", 
      alt: t(locale, { ko: "Universal Audio Apollo x8p 오디오 인터페이스", en: "Universal Audio Apollo x8p", zh: "Universal Audio Apollo x8p 音频接口", es: "Interfaz de Audio Universal Audio Apollo x8p" }) 
    },
    { 
      src: "/images/hardware5.jpg", 
      alt: t(locale, { ko: "Adam Audio A7X 모니터 스피커와 믹싱 데스크", en: "Adam Audio A7X & Mixing Desk", zh: "Adam Audio A7X 监听扬声器 & 混音台", es: "Monitores Adam Audio A7X & Mesa de Mezclas" }) 
    },
  ];

  return { categories, equipment, studioImages };
};
