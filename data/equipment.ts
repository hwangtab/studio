import type { Locale } from '../lib/i18n';

// Translation helper
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getEquipmentData = (locale: Locale) => {
  const categories = {
    microphones: t(locale, { ko: '마이크', en: 'Microphones', zh: '麦克风', es: 'Micrófonos', vi: 'Micro', th: 'ไมโครโฟน', uz: 'Mikrofonlar' }),
    preamps: t(locale, { ko: '프리앰프', en: 'Preamps', zh: '前置放大器', es: 'Preamplificadores', vi: 'Preamp', th: 'พรีแอมป์', uz: 'Preamp' }),
    equalizers: t(locale, { ko: '이퀄라이저', en: 'Equalizers', zh: '均衡器', es: 'Ecualizadores', vi: 'EQ', th: 'อีควอไลเซอร์', uz: 'Ekvalayzerlar' }),
    compressors: t(locale, { ko: '컴프레서', en: 'Compressors', zh: '压缩器', es: 'Compresores', vi: 'Compressor', th: 'คอมเพรสเซอร์', uz: 'Kompressorlar' }),
    interfaces: t(locale, { ko: '인터페이스', en: 'Interfaces', zh: '音频接口', es: 'Interfaces', vi: 'Giao diện âm thanh', th: 'อินเทอร์เฟซ', uz: 'Interfeyslar' }),
    processors: t(locale, { ko: '프로세서', en: 'Processors', zh: '处理器', es: 'Procesadores', vi: 'Bộ xử lý', th: 'โปรเซสเซอร์', uz: 'Protsessorlar' }),
    speakers: t(locale, { ko: '스피커', en: 'Speakers', zh: '扬声器', es: 'Altavoces', vi: 'Loa', th: 'ลำโพง', uz: 'Karnaylar' }),
    headphones: t(locale, { ko: '헤드폰', en: 'Headphones', zh: '耳机', es: 'Auriculares', vi: 'Tai nghe', th: 'หูฟัง', uz: 'Quloqchinlar' }),
    instruments: t(locale, { ko: '악기', en: 'Instruments', zh: '乐器', es: 'Instrumentos', vi: 'Nhạc cụ', th: 'เครื่องดนตรี', uz: 'Cholg‘ular' }),
    consoles: t(locale, { ko: '콘솔', en: 'Consoles', zh: '调音台', es: 'Consolas', vi: 'Console', th: 'คอนโซล', uz: 'Konsollar' }),
    synthesizers: t(locale, { ko: '신디사이저/가상악기', en: 'Synthesizers/VST', zh: '合成器/虚拟乐器', es: 'Sintetizadores/VST', vi: 'Synth/VST', th: 'ซินธิไซเซอร์/VST', uz: 'Sintezator/VST' }),
    plugins: t(locale, { ko: '플러그인', en: 'Plugins', zh: '插件', es: 'Plugins', vi: 'Plugin', th: 'ปลั๊กอิน', uz: 'Plaginlar' }),
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
      t(locale, {
        ko: "Sonnox 등 다수",
        en: "Sonnox and many more",
        zh: "Sonnox 等更多",
        es: "Sonnox y muchos más",
        vi: "Sonnox và nhiều hãng khác",
        th: "Sonnox และอีกมากมาย",
        uz: "Sonnox va boshqalar",
      }),
    ],
  };

  const studioImages = [
    {
      src: "/images/hardware2.jpg",
      alt: t(locale, {
        ko: "스튜디오 놀 메인 컨트롤 룸",
        en: "Studio NOL Main Control Room",
        zh: "Studio NOL 主控制室",
        es: "Sala de Control Principal Studio NOL",
        vi: "Phòng điều khiển chính Studio NOL",
        th: "ห้องควบคุมหลักของ Studio NOL",
        uz: "Studio NOL asosiy nazorat xonasi",
      })
    },
    {
      src: "/images/hardware3.jpg",
      alt: t(locale, {
        ko: "쇼크마운트에 장착된 Neumann U87AI 콘덴서 마이크",
        en: "Neumann U87AI condenser microphone in shock mount",
        zh: "安装在防震架上的 Neumann U87AI 电容麦克风",
        es: "Micrófono de condensador Neumann U87AI en soporte antivibraciones",
        vi: "Micro condenser Neumann U87AI trên giá chống rung",
        th: "ไมโครโฟนคอนเดนเซอร์ Neumann U87AI บนช็อกเมาท์",
        uz: "Shock mount'da Neumann U87AI kondensator mikrofoni",
      })
    },
    {
      src: "/images/hardware4.jpg",
      alt: t(locale, {
        ko: "VOX AC30 기타 앰프",
        en: "VOX AC30 guitar amplifier",
        zh: "VOX AC30 吉他音箱",
        es: "Amplificador de guitarra VOX AC30",
        vi: "Ampli guitar VOX AC30",
        th: "แอมป์กีตาร์ VOX AC30",
        uz: "VOX AC30 gitara amplifikatori",
      })
    },
    {
      src: "/images/hardware5.webp",
      alt: t(locale, {
        ko: "스탠드 위의 어쿠스틱 기타와 일렉트릭 기타",
        en: "Acoustic guitar and electric guitar on stand",
        zh: "架子上的原声吉他和电吉他",
        es: "Guitarra acústica y eléctrica en soporte",
        vi: "Đàn guitar acoustic và guitar điện trên giá đỡ",
        th: "กีตาร์อคูสติกและกีตาร์ไฟฟ้าบนสแตนด์",
        uz: "Stendda akustik gitara va elektr gitara",
      })
    },
  ];

  return { categories, equipment, studioImages };
};
