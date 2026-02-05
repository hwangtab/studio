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
  },
  vi: {
    seo: {
      title: "Sản xuất âm nhạc chuyên nghiệp · Mixing/Mastering & thu âm voiceover/nhạc cưới | Studio NOL",
      description: "Sản xuất âm nhạc chuyên nghiệp hiện thực hóa tầm nhìn của nghệ sĩ. Bảo đảm kết quả tốt nhất với thiết bị cao cấp và kỹ thuật chuyên môn.",
      keywords: "Sản xuất âm nhạc, đĩa đơn số, mixing mastering, phát hành album, sản xuất âm nhạc, phòng thu chuyên nghiệp, thu âm voiceover, thu âm nhạc cưới, Studio NOL"
    },
    heroContent: {
      titlePrefix: "Thổi",
      titleHighlight: "Sự sống",
      titleSuffix: "vào âm nhạc của bạn",
      subtitle: "Hoàn thiện âm thanh riêng của bạn với thiết bị cao cấp và bàn tay của kỹ sư chuyên nghiệp. Trải nghiệm tại Studio NOL.",
      backgroundImage: "/images/studio2.jpg",
      imageAlt: "Studio NOL phòng thu chính",
      cta: {
        reserve: "Đặt lịch",
        portfolio: "Portfolio"
      }
    },
    homeServices: [
      {
        title: 'Kế hoạch album',
        description: 'Biến tầm nhìn âm nhạc của bạn thành hiện thực. Đồng hành từ lên kế hoạch đến sản xuất.',
        link: '/about',
        icon: 'Disc',
      },
      {
        title: 'Thu âm & Mixing',
        description: 'Tạo âm thanh tốt nhất với thiết bị cao cấp và chuyên gia. Thổi sự sống vào âm thanh của bạn.',
        link: '/about',
        icon: 'Mic',
      },
      {
        title: 'PR & Marketing',
        description: 'Quảng bá hiệu quả trên truyền thông và hỗ trợ showcase để lan tỏa sức hút âm nhạc của bạn.',
        link: '/about',
        icon: 'Globe',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "Phòng thu với loa kiểm âm và bàn điều khiển" },
      { src: `/images/studio3.jpg`, alt: "Booth thu vocal với micro chuyên nghiệp và pop filter" },
      { src: `/images/studio4.jpg`, alt: "Trạm làm việc mixing với hệ thống DAW mới nhất" },
      { src: `/images/studio5.jpg`, alt: "Phòng sản xuất đã xử lý âm học" },
      { src: `/images/hardware8.jpg`, alt: "Thiết bị outboard analog và rack preamp" }
    ]
  },
  th: {
    seo: {
      title: "ผลิตเพลงมืออาชีพ · มิกซ์/มาสเตอริ่ง & อัดเสียงพากย์/เพลงงานแต่ง | Studio NOL",
      description: "สตูดิโอผลิตเพลงมืออาชีพที่ทำให้วิสัยทัศน์ของศิลปินเป็นจริง ด้วยอุปกรณ์ไฮเอนด์และวิศวกรรมระดับมืออาชีพ",
      keywords: "การผลิตเพลง, ซิงเกิลดิจิทัล, มิกซ์มาสเตอริ่ง, ออกอัลบั้ม, โปรดิวซ์เพลง, สตูดิโอบันทึกเสียง, อัดเสียงพากย์, อัดเพลงงานแต่ง, Studio NOL"
    },
    heroContent: {
      titlePrefix: "เติม",
      titleHighlight: "ชีวิต",
      titleSuffix: "ให้กับดนตรีของคุณ",
      subtitle: "เติมเต็มซาวด์ของคุณด้วยอุปกรณ์ระดับไฮเอนด์และการดูแลของวิศวกรมืออาชีพ พบกันที่ Studio NOL",
      backgroundImage: "/images/studio2.jpg",
      imageAlt: "สตูดิโอหลักของ Studio NOL",
      cta: {
        reserve: "จองคิว",
        portfolio: "ผลงาน"
      }
    },
    homeServices: [
      {
        title: 'วางแผนอัลบั้ม',
        description: 'ทำให้วิสัยทัศน์ทางดนตรีของคุณเป็นจริง เราดูแลตั้งแต่การวางแผนจนถึงการผลิต',
        link: '/about',
        icon: 'Disc',
      },
      {
        title: 'บันทึกเสียง & มิกซ์',
        description: 'สร้างซาวด์ที่ดีที่สุดด้วยอุปกรณ์ไฮเอนด์และผู้เชี่ยวชาญ เราเติมชีวิตให้เสียงของคุณ',
        link: '/about',
        icon: 'Mic',
      },
      {
        title: 'ประชาสัมพันธ์ & การตลาด',
        description: 'โปรโมตผ่านสื่ออย่างมีประสิทธิภาพและสนับสนุนโชว์เคสเพื่อกระจายเสน่ห์ของเพลงคุณ',
        link: '/about',
        icon: 'Globe',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "ห้องบันทึกเสียงพร้อมลำโพงมอนิเตอร์และโต๊ะคอนโทรล" },
      { src: `/images/studio3.jpg`, alt: "บูธร้องพร้อมไมค์มืออาชีพและป๊อปฟิลเตอร์" },
      { src: `/images/studio4.jpg`, alt: "เวิร์กสเตชันมิกซ์พร้อมระบบ DAW ล่าสุด" },
      { src: `/images/studio5.jpg`, alt: "ห้องโปรดักชันที่ปรับอะคูสติกแล้ว" },
      { src: `/images/hardware8.jpg`, alt: "อุปกรณ์เอาต์บอร์ดอนาล็อกและแร็คพรีแอมป์" }
    ]
  },
  uz: {
    seo: {
      title: "Professional musiqa ishlab chiqarish · Mixing/Mastering & voiceover/to‘y qo‘shiqlari yozuvi | Studio NOL",
      description: "San’atkorning musiqiy tasavvurini hayotga tatbiq etuvchi professional prodakshn. Yuqori darajadagi uskunalar va muhandislik bilan eng yaxshi natija.",
      keywords: "musiqa ishlab chiqarish, raqamli singl, miks mastering, albom chiqishi, musiqa prodakshn, professional studiya, voiceover yozuvi, to‘y qo‘shig‘i yozuvi, Studio NOL"
    },
    heroContent: {
      titlePrefix: "Musiqangizga",
      titleHighlight: "hayot",
      titleSuffix: "bag‘ishlaydigan makon",
      subtitle: "Yuqori darajadagi uskunalar va professional muhandislar bilan o‘ziga xos tovushingizni yarating. Studio NOLda his qiling.",
      backgroundImage: "/images/studio2.jpg",
      imageAlt: "Studio NOL asosiy studiyasi",
      cta: {
        reserve: "Band qilish",
        portfolio: "Portfolio"
      }
    },
    homeServices: [
      {
        title: 'Albom rejalash',
        description: 'Musiqiy tasavvuringizni haqiqatga aylantiramiz. Rejadan ishlab chiqarishgacha birga.',
        link: '/about',
        icon: 'Disc',
      },
      {
        title: 'Yozuv & Miks',
        description: 'Yuqori darajadagi uskunalar va mutaxassislar bilan eng yaxshi tovushni yarating. Tovushingizga hayot bag‘ishlaymiz.',
        link: '/about',
        icon: 'Mic',
      },
      {
        title: 'PR & Marketing',
        description: 'OAV orqali samarali targ‘ibot va showcase qo‘llovi bilan musiqangiz jozibasini keng yoyamiz.',
        link: '/about',
        icon: 'Globe',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "Monitoring karnaylari va boshqaruv stoli bo‘lgan yozuv xonasi" },
      { src: `/images/studio3.jpg`, alt: "Professional mikrofon va pop filtrli vokal yozuv kabinasi" },
      { src: `/images/studio4.jpg`, alt: "Eng so‘nggi DAW tizimli miks ish stansiyasi" },
      { src: `/images/studio5.jpg`, alt: "Akustik ishlov berilgan prodakshn xonasi" },
      { src: `/images/hardware8.jpg`, alt: "Analog outboard uskunalar va preamp rack" }
    ]
  }
};

export const getHomeData = (locale: Locale) => {
  return homeData[locale] || homeData['ko'];
};
