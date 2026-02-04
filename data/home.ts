import type { Locale } from '../lib/i18n';

const homeData = {
  ko: {
    seo: {
      title: "전문 음원 제작 · 믹싱&마스터링 & 성우/축가 녹음 | 스튜디오 놀",
      description: "아티스트의 음악적 비전을 소리로 실현하는 프로페셔널 뮤직 프로덕션. 하이엔드 장비와 전문 엔지니어링으로 최고의 결과물을 보장합니다.",
      keywords: "음원 제작, 디지털 싱글, 믹싱 마스터링, 앨범 발매, 음악 프로듀싱, 전문 녹음실, 성우 녹음, 축가 녹음, 스튜디오 놀"
    },
    heroContent: {
      titlePrefix: "당신의 음악에",
      titleHighlight: "생명",
      titleSuffix: "을 불어넣는 공간",
      subtitle: "최고급 장비와 전문 엔지니어의 터치로 완성되는 당신만의 사운드. 스튜디오 놀에서 경험하세요.",
      backgroundImage: "/images/studio2.jpg",
      imageAlt: "스튜디오 놀 메인 스튜디오",
      cta: {
        reserve: "예약하기",
        portfolio: "포트폴리오"
      }
    },
    homeServices: [
      {
        title: '음반 기획',
        description: '당신의 음악적 비전을 현실로 만들어드립니다. 기획부터 제작까지 전 과정을 함께합니다.',
        link: '/about',
        icon: 'Disc',
      },
      {
        title: '녹음 & 믹싱',
        description: '고급 장비와 전문가와 함께 최상의 사운드를 만들어보세요. 당신의 소리에 생명을 불어넣습니다.',
        link: '/about',
        icon: 'Mic',
      },
      {
        title: '홍보 & 마케팅',
        description: '언론에 효과적으로 홍보하고, 쇼케이스를 풍부하게 지원함으로써 당신 음악의 매력을 더욱 널리 알립니다.',
        link: '/about',
        icon: 'Globe',
      },
    ],
    studioImages: [
      {
        src: `/images/studio2.jpg`,
        alt: "모니터링 스피커와 컨트롤 데스크가 있는 레코딩 룸"
      },
      {
        src: `/images/studio3.jpg`,
        alt: "프로페셔널 마이크와 팝 필터가 설치된 보컬 녹음 부스"
      },
      {
        src: `/images/studio4.jpg`,
        alt: "최신 DAW 시스템과 모니터를 갖춘 믹싱 워크스테이션"
      },
      {
        src: `/images/studio5.jpg`,
        alt: "음향 처리가 완료된 프로덕션 룸 전경"
      },
      {
        src: `/images/hardware8.jpg`,
        alt: "아날로그 아웃보드 장비와 프리앰프 랙"
      }
    ]
  },
  en: {
    seo: {
      title: "Professional Music Production & Mixing/Mastering | Studio NOL",
      description: "Professional music production realizing artist's musical vision. We guarantee the best results with high-end equipment and professional engineering.",
      keywords: "Music Production, Digital Single, Mixing Mastering, Album Release, Music Producing, Recording Studio, Voice Over, Studio NOL"
    },
    heroContent: {
      titlePrefix: "Breathing",
      titleHighlight: "Life",
      titleSuffix: "into Your Music",
      subtitle: "Complete your unique sound with high-end equipment and professional engineering. Experience it at Studio NOL.",
      backgroundImage: "/images/studio2.jpg",
      imageAlt: "Studio NOL Main Studio",
      cta: {
        reserve: "Book Now",
        portfolio: "Portfolio"
      }
    },
    homeServices: [
      {
        title: 'Production',
        description: 'We turn your musical vision into reality. We are with you from planning to production.',
        link: '/about',
        icon: 'Disc',
      },
      {
        title: 'Recording & Mixing',
        description: 'Create the best sound with high-end equipment and experts. We breathe life into your sound.',
        link: '/about',
        icon: 'Mic',
      },
      {
        title: 'PR & Marketing',
        description: 'We promote your music effectively to the media and support showcases to spread your charm.',
        link: '/about',
        icon: 'Globe',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "Recording room with monitoring speakers" },
      { src: `/images/studio3.jpg`, alt: "Vocal booth with professional mic" },
      { src: `/images/studio4.jpg`, alt: "Mixing workstation with latest DAW" },
      { src: `/images/studio5.jpg`, alt: "Acoustically treated production room" },
      { src: `/images/hardware8.jpg`, alt: "Analog outboard gear and preamps" }
    ]
  },
  zh: {
    seo: {
      title: "专业音乐制作 · 混音 & 母带处理 | Studio NOL",
      description: "实现艺术家音乐愿景的专业音乐制作。我们用高端设备和专业工程保证最佳结果。",
      keywords: "音乐制作, 数字单曲, 混音母带, 专辑发行, 音乐制作, 录音室, 配音, Studio NOL"
    },
    heroContent: {
      titlePrefix: "为您的音乐注入",
      titleHighlight: "生命",
      titleSuffix: "的空间",
      subtitle: "通过高端设备和专业工程师的触感，完成您独有的声音。请在 Studio NOL 体验。",
      backgroundImage: "/images/studio2.jpg",
      imageAlt: "Studio NOL 主录音室",
      cta: {
        reserve: "立即预订",
        portfolio: "作品集"
      }
    },
    homeServices: [
      {
        title: '专辑策划',
        description: '我们将您的音乐愿景变为现实。从策划到制作，全程陪伴。',
        link: '/about',
        icon: 'Disc',
      },
      {
        title: '录音 & 混音',
        description: '与专家一起使用高级设备创造最佳声音。为您的声音注入生命。',
        link: '/about',
        icon: 'Mic',
      },
      {
        title: '宣传 & 营销',
        description: '通过媒体有效宣传，并丰富支持展示会，更广泛地传播您音乐的魅力。',
        link: '/about',
        icon: 'Globe',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "录音室" },
      { src: `/images/studio3.jpg`, alt: "人声录音棚" },
      { src: `/images/studio4.jpg`, alt: "混音工作站" },
      { src: `/images/studio5.jpg`, alt: "制作室" },
      { src: `/images/hardware8.jpg`, alt: "模拟设备" }
    ]
  },
  es: {
    seo: {
      title: "Producción Musical Profesional y Mezcla/Masterización | Studio NOL",
      description: "Producción musical profesional que hace realidad la visión musical del artista. Garantizamos los mejores resultados con equipos de alta gama.",
      keywords: "Producción Musical, Sencillo Digital, Mezcla Masterización, Lanzamiento de Álbum, Producción Musical, Estudio de Grabación, Studio NOL"
    },
    heroContent: {
      titlePrefix: "Dando",
      titleHighlight: "Vida",
      titleSuffix: "a Tu Música",
      subtitle: "Completa tu sonido único con equipos de alta gama e ingeniería profesional. Vívelo en Studio NOL.",
      backgroundImage: "/images/studio2.jpg",
      imageAlt: "Estudio Principal Studio NOL",
      cta: {
        reserve: "Reservar",
        portfolio: "Portafolio"
      }
    },
    homeServices: [
      {
        title: 'Producción',
        description: 'Convertimos tu visión musical en realidad. Estamos contigo desde la planificación hasta la producción.',
        link: '/about',
        icon: 'Disc',
      },
      {
        title: 'Grabación y Mezcla',
        description: 'Crea el mejor sonido con equipos de alta gama y expertos. Damos vida a tu sonido.',
        link: '/about',
        icon: 'Mic',
      },
      {
        title: 'RP y Marketing',
        description: 'Promocionamos tu música eficazmente en los medios y apoyamos showcases para difundir tu encanto.',
        link: '/about',
        icon: 'Globe',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "Sala de grabación" },
      { src: `/images/studio3.jpg`, alt: "Cabina vocal" },
      { src: `/images/studio4.jpg`, alt: "Estación de mezcla" },
      { src: `/images/studio5.jpg`, alt: "Sala de producción" },
      { src: `/images/hardware8.jpg`, alt: "Equipo analógico" }
    ]
  }
};

export const getHomeData = (locale: Locale) => {
  return homeData[locale] || homeData['ko'];
};