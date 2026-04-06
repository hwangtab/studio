import type { Locale } from '../lib/i18n';

const homeData = {
    ko: {
    seo: {
      title: "전문 음원 제작 · 믹싱&마스터링 & 성우/축가/오디오북 녹음 | 스튜디오 놀",
      description: "아티스트의 음악적 비전을 소리로 실현하는 프로페셔널 뮤직 프로덕션. 하이엔드 장비와 전문 엔지니어링으로 최고의 결과물을 보장합니다.",
      keywords: "음원 제작, 디지털 싱글, 믹싱 마스터링, 앨범 발매, 음악 프로듀싱, 전문 녹음실, 성우 녹음, 축가 녹음, 오디오북 녹음, 일반인 녹음실, 스튜디오 놀"
    },
    heroContent: {
      titlePrefix: "당신의 음악에",
      titleHighlight: "생명",
      titleSuffix: "을 불어넣는 공간",
      subtitle: "최고급 장비와 전문 엔지니어의 터치로 완성되는 당신만의 사운드. 스튜디오 놀에서 경험하세요.",
      backgroundImage: "/images/studio2.jpg",
      imageAlt: "연신내 녹음실 스튜디오 놀 - 은평구 전문 음악 스튜디오 메인룸",
      cta: {
        reserve: "예약하기",
        portfolio: "포트폴리오"
      },
      ctaImageAlt: "연신내 녹음실 스튜디오 놀 - 전문 녹음 장비와 하드웨어"
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
        link: '/studio-info',
        icon: 'Mic',
      },
      {
        title: '홍보 & 마케팅',
        description: '언론에 효과적으로 홍보하고, 쇼케이스를 풍부하게 지원함으로써 당신 음악의 매력을 더욱 널리 알립니다.',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: '프리미엄 연습실',
        description: '24시간 완벽 방음 연습실. 드럼·기타·건반 완비, 월 40만원대 입주 프로그램으로 나만의 창작 공간을 경험하세요.',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      {
        src: `/images/studio2.jpg`,
        alt: "연신내 녹음실 스튜디오 놀 - 모니터링 스피커와 컨트롤 데스크가 있는 레코딩 룸"
      },
      {
        src: `/images/studio3.jpg`,
        alt: "스튜디오 놀 라운지 - 소파와 음향 패널이 있는 휴게 공간"
      },
      {
        src: `/images/studio4.jpg`,
        alt: "스튜디오 놀 녹음 부스 - 콘트라베이스 녹음 세션"
      },
      {
        src: `/images/studio5.jpg`,
        alt: "스튜디오 놀 아웃보드 장비 - Vintech X73i 프리앰프와 Tegeler Vari Tube Compressor"
      },
      {
        src: `/images/hardware8.jpg`,
        alt: "스튜디오 놀 컨트롤 데스크 - Softube Console 1 Fader와 Proac 모니터링 스피커"
      }
    ]
  },
  en: {
    seo: {
      title: "Professional Music Production & Mixing/Mastering | Studio NOL",
      description: "Professional music production realizing artist's musical vision. We guarantee the best results with high-end equipment and professional engineering.",
      keywords: "Music Production, Digital Single, Mixing Mastering, Album Release, Music Producing, Recording Studio, Voice Over, Studio NOL, Seoul recording studio, K-pop vocal recording, voice over recording Seoul, audiobook recording studio Korea, wedding song recording"
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
      },
      ctaImageAlt: "Studio NOL Seoul - Professional Recording Equipment and Hardware"
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
        link: '/studio-info',
        icon: 'Mic',
      },
      {
        title: 'PR & Marketing',
        description: 'We promote your music effectively to the media and support showcases to spread your charm.',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: 'Premium Practice Room',
        description: '24/7 fully soundproof practice room. Drums, guitar & keyboard ready. Monthly residency from 400,000 KRW — your own creative space.',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "Recording room with monitoring speakers" },
      { src: `/images/studio3.jpg`, alt: "Studio NOL lounge area with sofa and acoustic wall panels" },
      { src: `/images/studio4.jpg`, alt: "Upright bass recording session in studio booth" },
      { src: `/images/studio5.jpg`, alt: "Vintech X73i preamp and Tegeler Vari Tube Compressor rack" },
      { src: `/images/hardware8.jpg`, alt: "Control desk with Softube Console 1 Fader and Proac monitoring speakers" }
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
      },
      ctaImageAlt: "Studio NOL 首尔 - 专业录音设备和硬件"
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
        link: '/studio-info',
        icon: 'Mic',
      },
      {
        title: '宣传 & 营销',
        description: '通过媒体有效宣传，并丰富支持展示会，更广泛地传播您音乐的魅力。',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: '高端练习室',
        description: '24小时全隔音练习室，配备架子鼓、吉他、键盘。月租约40万韩元起，打造专属练习空间。',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "录音室" },
      { src: `/images/studio3.jpg`, alt: "Studio NOL 休息区 - 配有沙发和吸音墙板的休息空间" },
      { src: `/images/studio4.jpg`, alt: "低音提琴演奏者在录音棚进行录音" },
      { src: `/images/studio5.jpg`, alt: "Vintech X73i 前置放大器和 Tegeler Vari Tube Compressor 机架" },
      { src: `/images/hardware8.jpg`, alt: "控制台配备 Softube Console 1 Fader 和 Proac 监听音箱" }
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
      },
      ctaImageAlt: "Studio NOL Seúl - Equipo de grabación profesional"
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
        link: '/studio-info',
        icon: 'Mic',
      },
      {
        title: 'RP y Marketing',
        description: 'Promocionamos tu música eficazmente en los medios y apoyamos showcases para difundir tu encanto.',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: 'Sala de práctica premium',
        description: 'Sala de práctica 24/7 completamente insonorizada. Batería, guitarra y teclado incluidos. Residencia mensual desde 400.000 KRW.',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "Sala de grabación" },
      { src: `/images/studio3.jpg`, alt: "Sala de descanso de Studio NOL con sofá y paneles acústicos" },
      { src: `/images/studio4.jpg`, alt: "Sesión de grabación de contrabajo en la cabina de estudio" },
      { src: `/images/studio5.jpg`, alt: "Rack con preamplificador Vintech X73i y Tegeler Vari Tube Compressor" },
      { src: `/images/hardware8.jpg`, alt: "Mesa de control con Softube Console 1 Fader y monitores Proac" }
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
      },
      ctaImageAlt: "Studio NOL Seoul - Thiết bị thu âm chuyên nghiệp"
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
        link: '/studio-info',
        icon: 'Mic',
      },
      {
        title: 'PR & Marketing',
        description: 'Quảng bá hiệu quả trên truyền thông và hỗ trợ showcase để lan tỏa sức hút âm nhạc của bạn.',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: 'Phòng tập cao cấp',
        description: 'Phòng tập cách âm hoàn toàn 24/7. Trống, guitar, keyboard đầy đủ. Gói cư trú hàng tháng từ 400.000 KRW — không gian sáng tạo của riêng bạn.',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "Phòng thu với loa kiểm âm và bàn điều khiển" },
      { src: `/images/studio3.jpg`, alt: "Khu vực lounge Studio NOL với sofa và tấm hấp âm" },
      { src: `/images/studio4.jpg`, alt: "Phiên thu âm đàn bass đứng trong booth thu" },
      { src: `/images/studio5.jpg`, alt: "Rack thiết bị Vintech X73i preamp và Tegeler Vari Tube Compressor" },
      { src: `/images/hardware8.jpg`, alt: "Bàn điều khiển với Softube Console 1 Fader và loa monitor Proac" }
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
      },
      ctaImageAlt: "Studio NOL โซล - อุปกรณ์บันทึกเสียงมืออาชีพ"
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
        link: '/studio-info',
        icon: 'Mic',
      },
      {
        title: 'ประชาสัมพันธ์ & การตลาด',
        description: 'โปรโมตผ่านสื่ออย่างมีประสิทธิภาพและสนับสนุนโชว์เคสเพื่อกระจายเสน่ห์ของเพลงคุณ',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: 'ห้องซ้อมพรีเมียม',
        description: 'ห้องซ้อมกันเสียง 24 ชั่วโมง พร้อมกลอง กีตาร์ คีย์บอร์ด ราคาเช่ารายเดือน 400,000 วอน — พื้นที่สร้างสรรค์ส่วนตัวของคุณ',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "ห้องบันทึกเสียงพร้อมลำโพงมอนิเตอร์และโต๊ะคอนโทรล" },
      { src: `/images/studio3.jpg`, alt: "พื้นที่พักผ่อนของ Studio NOL พร้อมโซฟาและแผงดูดซับเสียง" },
      { src: `/images/studio4.jpg`, alt: "การบันทึกเสียงดับเบิลเบสในห้องบูธอัด" },
      { src: `/images/studio5.jpg`, alt: "แร็คพรีแอมป์ Vintech X73i และ Tegeler Vari Tube Compressor" },
      { src: `/images/hardware8.jpg`, alt: "โต๊ะควบคุมพร้อม Softube Console 1 Fader และลำโพงมอนิเตอร์ Proac" }
    ]
  },
  uz: {
    seo: {
      title: "Professional musiqa ishlab chiqarish · Mixing/Mastering & voiceover/to'y qo'shiqlari yozuvi | Studio NOL",
      description: "San'atkorning musiqiy tasavvurini hayotga tatbiq etuvchi professional prodakshn. Yuqori darajadagi uskunalar va muhandislik bilan eng yaxshi natija.",
      keywords: "musiqa ishlab chiqarish, raqamli singl, miks mastering, albom chiqishi, musiqa prodakshn, professional studiya, voiceover yozuvi, to'y qo'shig'i yozuvi, Studio NOL"
    },
    heroContent: {
      titlePrefix: "Musiqangizga",
      titleHighlight: "hayot",
      titleSuffix: "bag'ishlaydigan makon",
      subtitle: "Yuqori darajadagi uskunalar va professional muhandislar bilan o'ziga xos tovushingizni yarating. Studio NOLda his qiling.",
      backgroundImage: "/images/studio2.jpg",
      imageAlt: "Studio NOL asosiy studiyasi",
      cta: {
        reserve: "Band qilish",
        portfolio: "Portfel"
      },
      ctaImageAlt: "Studio NOL Seul - Professional yozuv uskunalari"
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
        description: "Yuqori darajadagi uskunalar va mutaxassislar bilan eng yaxshi tovushni yarating. Tovushingizga hayot bag'ishlaymiz.",
        link: '/studio-info',
        icon: 'Mic',
      },
      {
        title: 'PR & Marketing',
        description: "OAV orqali samarali targ'ibot va showcase qo'llovi bilan musiqangiz jozibasini keng yoyamiz.",
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: "Premium mashg'ulot xonasi",
        description: "24/7 to'liq ovoz izolyatsiyali mashg'ulot xonasi. Baraban, gitara, klaviatura mavjud. Oylik to'lov 400,000 KRW dan — o'z ijodiy makoningiz.",
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.jpg`, alt: "Monitoring karnaylari va boshqaruv stoli bo'lgan yozuv xonasi" },
      { src: `/images/studio3.jpg`, alt: "Studio NOL dam olish zonasi - divan va akustik panellar" },
      { src: `/images/studio4.jpg`, alt: "Kontrabas yozuv seanssi studiya kabinasida" },
      { src: `/images/studio5.jpg`, alt: "Vintech X73i preamp va Tegeler Vari Tube Compressor rack" },
      { src: `/images/hardware8.jpg`, alt: "Nazorat pulti Softube Console 1 Fader va Proac monitoring karnaylari bilan" }
    ]
  }
};

export const getHomeData = (locale: Locale) => {
  return homeData[locale] || homeData['ko'];
};
