import type { Locale } from '../lib/i18n';

// Helper for translations
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

// Helper for array translations
const tArray = (locale: Locale, dict: { ko: string[]; en: string[]; zh?: string[]; es?: string[] }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getPricingData = (locale: Locale) => {
  const vatNotice = t(locale, {
    ko: '모든 가격은 VAT(부가가치세) 별도입니다.',
    en: 'All prices exclude VAT.',
    zh: '所有价格均不含增值税 (VAT)。',
    es: 'Todos los precios excluyen el IVA.',
  });

  const recordingOffers = [
    {
      id: 'recording-hourly',
      title: t(locale, { ko: '시간당 레코딩', en: 'Hourly Recording', zh: '小时录音', es: 'Grabación por Hora' }),
      priceDisplay: t(locale, { ko: '100,000원', en: '₩100,000', zh: '₩100,000', es: '₩100,000' }),
      priceValue: 100000,
      unit: t(locale, { ko: '/ 시간', en: '/ hour', zh: '/ 小时', es: '/ hora' }),
      description: t(locale, { 
        ko: '짧은 녹음이나 성우 녹음, 간단한 악기 녹음에 적합합니다.', 
        en: 'Suitable for short sessions, voiceovers, or simple instrument recording.',
        zh: '适合短时间录音、配音或简单乐器录音。',
        es: 'Adecuado para sesiones cortas, locuciones o grabaciones de instrumentos simples.'
      }),
      features: tArray(locale, {
        ko: ['전문 엔지니어링 포함', '최소 2시간부터 예약 가능', '보컬 디렉팅 지원', '실시간 모니터링 및 피드백'],
        en: ['Professional engineering included', 'Minimum 2-hour booking', 'Vocal directing support', 'Real-time monitoring & feedback']
      }),
    },
    {
      id: 'recording-daylock',
      title: t(locale, { ko: '6시간 패키지 (Day Lock)', en: '6-Hour Package (Day Lock)', zh: '6小时套餐 (Day Lock)', es: 'Paquete de 6 Horas' }),
      priceDisplay: t(locale, { ko: '500,000원', en: '₩500,000', zh: '₩500,000', es: '₩500,000' }),
      priceValue: 500000,
      unit: t(locale, { ko: '/ 일', en: '/ day', zh: '/ 天', es: '/ día' }),
      description: t(locale, {
        ko: '앨범 작업 등 장시간 녹음이 필요할 때 합리적인 선택입니다.',
        en: 'Rational choice for album projects or long recording sessions.',
        zh: '专辑制作等需要长时间录音时的合理选择。',
        es: 'Elección racional para proyectos de álbumes o sesiones largas.'
      }),
      recommended: true,
      features: tArray(locale, {
        ko: ['6시간 패키지 (약 17% 할인)', '충분한 휴식과 여유로운 작업', '식사 시간 포함', '장시간 집중이 필요한 프로젝트에 최적'],
        en: ['6-hour package (~17% discount)', 'Relaxed work pace', 'Meal break included', 'Optimized for focus-heavy projects']
      }),
    },
  ];

  const mixingOffers = [
    {
      id: 'mixing-level1',
      title: 'Level 1',
      priceDisplay: t(locale, { ko: '200,000원', en: '₩200,000' }),
      priceValue: 200000,
      unit: t(locale, { ko: '/ 곡', en: '/ song', zh: '/ 首', es: '/ canción' }),
      description: t(locale, {
        ko: '심플한 구성의 곡에 적합합니다.',
        en: 'Perfect for songs with simple arrangements.',
        zh: '适合结构简单的歌曲。',
        es: 'Perfecto para canciones con arreglos simples.'
      }),
      features: tArray(locale, {
        ko: ['10 트랙 이하', '보컬 + MR 또는 소편성 악기', '기본 2회 수정 포함', '밸런스 및 톤 보정'],
        en: ['Under 10 tracks', 'Vocal + MR or small ensemble', '2 revisions included', 'Balance & tone correction']
      }),
    },
    {
      id: 'mixing-level2',
      title: 'Level 2',
      priceDisplay: t(locale, { ko: '350,000원', en: '₩350,000' }),
      priceValue: 350000,
      unit: t(locale, { ko: '/ 곡', en: '/ song', zh: '/ 首', es: '/ canción' }),
      description: t(locale, {
        ko: '일반적인 밴드 구성이나 팝 음악에 적합합니다.',
        en: 'Suitable for standard band arrangements or pop music.',
        zh: '适合一般乐队编制或流行音乐。',
        es: 'Adecuado para arreglos de banda estándar o música pop.'
      }),
      recommended: true,
      features: tArray(locale, {
        ko: ['11 ~ 30 트랙', '풀 밴드 구성 또는 팝 편곡', '기본 2회 수정 포함', '디테일한 이펙팅 및 공간감 형성'],
        en: ['11 ~ 30 tracks', 'Full band or pop arrangement', '2 revisions included', 'Detailed effects & spatial design']
      }),
    },
    {
      id: 'mixing-level3',
      title: 'Level 3',
      priceDisplay: t(locale, { ko: '500,000원', en: '₩500,000' }),
      priceValue: 500000,
      unit: t(locale, { ko: '/ 곡', en: '/ song', zh: '/ 首', es: '/ canción' }),
      description: t(locale, {
        ko: '대편성 오케스트라나 복잡한 레이어의 곡에 적합합니다.',
        en: 'Suitable for large orchestras or complex layers.',
        zh: '适合大型管弦乐团或复杂层次的歌曲。',
        es: 'Adecuado para grandes orquestas o capas complejas.'
      }),
      features: tArray(locale, {
        ko: ['31 트랙 이상', '대편성 또는 복잡한 일렉트로닉', '기본 2회 수정 포함', '최고 수준의 디테일 작업'],
        en: ['31+ tracks', 'Large ensemble or complex electronic', '2 revisions included', 'Highest level of detail']
      }),
    },
  ];

  const masteringOffers = [
    {
      id: 'mastering-single',
      title: t(locale, { ko: '싱글 마스터링', en: 'Single Mastering', zh: '单曲母带处理', es: 'Masterización de Sencillo' }),
      priceDisplay: t(locale, { ko: '100,000원', en: '₩100,000' }),
      priceValue: 100000,
      unit: t(locale, { ko: '/ 곡', en: '/ song', zh: '/ 首', es: '/ canción' }),
      description: t(locale, {
        ko: '디지털 싱글 발매를 위한 최적의 마스터링입니다.',
        en: 'Optimized mastering for digital single release.',
        zh: '针对数字单曲发行的最佳母带处理。',
        es: 'Masterización optimizada para lanzamiento de sencillo digital.'
      }),
      features: tArray(locale, {
        ko: ['스트리밍 플랫폼 규격 준수', '기본 1회 수정 포함', '고해상도 음원 제공', '장르별 최적화된 라우드니스 설정'],
        en: ['Streaming platform standards', '1 revision included', 'High-res audio files', 'Genre-optimized loudness']
      }),
    },
    {
      id: 'mastering-album',
      title: t(locale, { ko: 'EP / 앨범 패키지', en: 'EP / Album Package', zh: 'EP / 专辑套餐', es: 'Paquete EP / Álbum' }),
      priceDisplay: t(locale, { ko: '80,000원', en: '₩80,000' }),
      priceValue: 80000,
      unit: t(locale, { ko: '/ 곡', en: '/ song', zh: '/ 首', es: '/ canción' }),
      description: t(locale, {
        ko: '4곡 이상의 앨범 작업 시 적용되는 할인 가격입니다.',
        en: 'Discounted rate for projects with 4+ songs.',
        zh: '4首以上专辑制作时的优惠价格。',
        es: 'Tarifa con descuento para proyectos con 4+ canciones.'
      }),
      recommended: true,
      features: tArray(locale, {
        ko: ['4곡 이상 진행 시 적용', '앨범 전체의 톤 앤 매너 통일', '곡 간 레벨 밸런싱', '기본 1회 수정 포함'],
        en: ['Applies to 4+ songs', 'Consistent tone & manner', 'Level balancing across songs', '1 revision included']
      }),
    },
  ];

  const additionalServices = [
    {
      id: 'service-consulting',
      title: t(locale, { ko: '기획/컨설팅', en: 'Consulting', zh: '策划/咨询', es: 'Consultoría' }),
      priceDisplay: t(locale, { ko: '50,000원', en: '₩50,000' }),
      priceValue: 50000,
      unit: t(locale, { ko: '/ 시간', en: '/ hour', zh: '/ 小时', es: '/ hora' }),
      description: t(locale, {
        ko: '프로젝트 기획, 일정 관리, 예산 수립 등 전반적인 앨범 제작 컨설팅',
        en: 'Album production consulting including planning, scheduling, and budgeting.',
        zh: '项目策划、日程管理、预算制定等整体专辑制作咨询',
        es: 'Consultoría de producción de álbumes, incluyendo planificación, programación y presupuesto.'
      }),
    },
    {
      id: 'service-funding',
      title: t(locale, { ko: '펀딩 설계 대행', en: 'Crowdfunding Design', zh: '众筹设计代理', es: 'Diseño de Crowdfunding' }),
      priceDisplay: t(locale, { ko: '400,000원', en: '₩400,000' }),
      priceValue: 400000,
      description: t(locale, {
        ko: '텀블벅 등 크라우드 펀딩 페이지 기획, 스토리텔링, 리워드 설계',
        en: 'Planning and storytelling for crowdfunding projects (Tumblbug, etc.).',
        zh: 'Tumblbug等众筹页面策划、故事讲述、回报设计',
        es: 'Planificación y narración para proyectos de crowdfunding.'
      }),
      note: t(locale, { ko: '+ 성공 수수료 10% (후불)', en: '+ 10% success fee', zh: '+ 10% 成功手续费', es: '+ 10% tarifa de éxito' }),
    },
    {
      id: 'service-promo',
      title: t(locale, { ko: '기본 홍보 패키지', en: 'Basic Promotion', zh: '基础宣传套餐', es: 'Promoción Básica' }),
      priceDisplay: t(locale, { ko: '300,000원', en: '₩300,000' }),
      priceValue: 300000,
      description: t(locale, {
        ko: '전문 보도자료 작성 및 언론 배포, 주요 음악 사이트 앨범 소개 등록 대행',
        en: 'Press release writing, media distribution, and music site registration.',
        zh: '撰写专业新闻稿并分发给媒体，代为登记主要音乐网站专辑介绍',
        es: 'Redacción de comunicados de prensa, distribución en medios y registro en sitios de música.'
      }),
    },
    {
      id: 'service-epk',
      title: t(locale, { ko: 'EPK 웹사이트', en: 'EPK Website', zh: 'EPK 网站', es: 'Sitio Web EPK' }),
      priceDisplay: t(locale, { ko: '500,000원', en: '₩500,000' }),
      priceValue: 500000,
      description: t(locale, {
        ko: '아티스트/앨범 소개를 위한 반응형 웹사이트 제작 (Electronic Press Kit)',
        en: 'Responsive website for artist/album introduction (Electronic Press Kit).',
        zh: '制作艺术家/专辑介绍的响应式网站 (电子新闻资料包)',
        es: 'Sitio web adaptable para presentación de artista/álbum (Kit de Prensa Electrónico).'
      }),
    },
  ];

  const specialPackages = [
    {
      id: 'package-wedding',
      title: t(locale, { ko: '셀프 축가/이벤트 녹음', en: 'Event & Wedding Recording', zh: '婚礼/活动录音', es: 'Grabación de Bodas y Eventos' }),
      priceDisplay: t(locale, { ko: '350,000원', en: '₩350,000' }),
      priceValue: 350000,
      unit: t(locale, { ko: '/ 1곡', en: '/ song', zh: '/ 首', es: '/ canción' }),
      description: t(locale, {
        ko: '결혼식 축가, 프로포즈, 기념일 음원 제작을 위한 올인원 패키지입니다.',
        en: 'All-in-one package for wedding songs, proposals, or anniversaries.',
        zh: '用于婚礼祝歌、求婚、纪念日音源制作的一站式套餐。',
        es: 'Paquete todo en uno para canciones de boda, propuestas o aniversarios.'
      }),
      recommended: true,
      features: tArray(locale, {
        ko: ['녹음 2시간 (스튜디오 사용료 포함)', '정밀 보컬 튠 및 박자 보정', '전문 믹싱 & 마스터링', '당일 보정본 수령 가능 (사전 협의 시)'],
        en: ['2h recording (studio fee included)', 'Vocal tuning & timing correction', 'Professional mixing & mastering', 'Same-day delivery available']
      }),
    },
    {
      id: 'package-voiceover',
      title: t(locale, { ko: '성우/나레이션 녹음', en: 'Voiceover & Narration', zh: '配音/旁白录音', es: 'Locución y Narración' }),
      priceDisplay: t(locale, { ko: '100,000원', en: '₩100,000' }),
      priceValue: 100000,
      unit: t(locale, { ko: '/ 시간', en: '/ hour', zh: '/ 小时', es: '/ hora' }),
      description: t(locale, {
        ko: '유튜브 나레이션, 오디오북, 광고 녹음 등 깨끗한 목소리 수음에 최적화되어 있습니다.',
        en: 'Optimized for YouTube narration, audiobooks, and commercials.',
        zh: '针对YouTube旁白、有声读物、广告录音等清晰人声收音进行了优化。',
        es: 'Optimizado para narración en YouTube, audiolibros y comerciales.'
      }),
      features: tArray(locale, {
        ko: ['Neumann U87AI 등 하이엔드 마이크 사용', '노이즈 제어 및 톤 보정', '실시간 편집 지원', '성우 대기실 제공'],
        en: ['High-end mics (U87AI, etc.)', 'Noise control & tone correction', 'Real-time editing support', 'Voice actor waiting room']
      }),
    },
    {
      id: 'package-rental',
      title: t(locale, { ko: '유튜브/방송 촬영 대관', en: 'Studio Rental for Filming', zh: 'YouTube/广播拍摄租赁', es: 'Alquiler de Estudio para Filmación' }),
      priceDisplay: t(locale, { ko: '100,000원', en: '₩100,000' }),
      priceValue: 100000,
      unit: t(locale, { ko: '/ 시간', en: '/ hour', zh: '/ 小时', es: '/ hora' }),
      description: t(locale, {
        ko: '뮤직비디오, 인터뷰, 라이브 영상 촬영을 위한 스튜디오 공간 대여입니다.',
        en: 'Studio rental for music videos, interviews, or live streaming.',
        zh: '用于MV、采访、直播视频拍摄的工作室空间租赁。',
        es: 'Alquiler de estudio para videos musicales, entrevistas o transmisión en vivo.'
      }),
      features: tArray(locale, {
        ko: ['메인 부스 및 컨트롤 룸 전체 사용', '촬영용 조명(지속광) 무료 대여', '오디오 인터페이스 직접 연결 지원', '대기실 및 탈의실 사용'],
        en: ['Full access to booth & control room', 'Free lighting rental', 'Audio interface connection', 'Waiting & changing rooms']
      }),
    },
  ];

  return {
    VAT_NOTICE: vatNotice,
    recordingOffers,
    mixingOffers,
    masteringOffers,
    additionalServices,
    specialPackages
  };
};
