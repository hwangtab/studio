import type { Locale } from '../lib/i18n';

const homeData = {
    ko: {
    seo: {
      title: "연신내 녹음실 · 음악연습실 · 믹싱 마스터링 | 스튜디오 놀",
      description: "연신내역 도보 5분, 전문 엔지니어 상주 녹음실·믹싱·마스터링·24시간 음악연습실. 시간당 10만원~, 무료 견적 카카오톡 상담.",
      keywords: "음원 제작, 디지털 싱글, 믹싱 마스터링, 앨범 발매, 음악 프로듀싱, 전문 녹음실, 성우 녹음, 축가 녹음, 오디오북 녹음, 일반인 녹음실, 스튜디오 놀, 음악연습실, 24시간 음악연습실"
    },
    heroContent: {
      titlePrefix: "당신의 음악에",
      titleHighlight: "생명",
      titleSuffix: "을 불어넣는 공간",
      subtitle: "최고급 장비와 전문 엔지니어의 터치로\n완성되는 당신만의 사운드.\n스튜디오 놀에서 경험하세요.",
      backgroundImage: "/images/studio2.webp",
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
        title: '음원 발매 & 유통',
        description: '멜론·스포티파이·애플뮤직 등 국내외 주요 스트리밍 플랫폼에 발매. 기획부터 발매·등록까지 한 번에 지원합니다.',
        link: '/pricing',
        icon: 'Upload',
      },
      {
        title: '홍보 & 마케팅',
        description: '언론에 효과적으로 홍보하고, 쇼케이스를 풍부하게 지원함으로써 당신 음악의 매력을 더욱 널리 알립니다.',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: '1:1 음악 레슨',
        description: '현직 프로듀서의 1:1 실전 레슨. MIDI 작곡·믹싱·발매 컨설팅까지 — 음원 발매를 목표로 하는 분께 최적화된 커리큘럼.',
        link: '/lesson',
        icon: 'GraduationCap',
      },
      {
        title: '음악연습실',
        description: '24시간 완벽 방음·숙식 가능 음악연습실. 보컬·피아노·건반 완비, 은평구 최저가 월 36만원 입주로 나만의 창작 공간을 확보하세요.',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      {
        src: `/images/studio2.webp`,
        alt: "연신내 녹음실 스튜디오 놀 - 모니터링 스피커와 컨트롤 데스크가 있는 레코딩 룸"
      },
      {
        src: `/images/studio3.webp`,
        alt: "스튜디오 놀 라운지 - 소파와 음향 패널이 있는 휴게 공간"
      },
      {
        src: `/images/studio4.webp`,
        alt: "스튜디오 놀 녹음 부스 - 콘트라베이스 녹음 세션"
      },
      {
        src: `/images/studio5.webp`,
        alt: "스튜디오 놀 아웃보드 장비 - Vintech X73i 프리앰프와 Tegeler Vari Tube Compressor"
      },
      {
        src: `/images/hardware8.webp`,
        alt: "스튜디오 놀 컨트롤 데스크 - Softube Console 1 Fader와 Proac 모니터링 스피커"
      }
    ]
  },
  en: {
    seo: {
      title: "Seoul Recording Studio · Mixing & Mastering | Studio NOL",
      description: "Seoul recording studio 5 min from Yeonsinnae Station. Wedding songs, voiceovers, mixing & mastering. Professional engineer on-site. From ₩100K/hr.",
      keywords: "Seoul recording studio, Yeonsinnae recording studio, mixing mastering Seoul, K-pop vocal recording, voice over recording Seoul, wedding song recording, audiobook recording Korea, Studio NOL, Eunpyeong-gu studio"
    },
    heroContent: {
      titlePrefix: "Breathing",
      titleHighlight: "Life",
      titleSuffix: "into Your Music",
      subtitle: "Complete your unique sound with high-end equipment and professional engineering.\nExperience it at Studio NOL.",
      backgroundImage: "/images/studio2.webp",
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
        title: 'Release & Distribution',
        description: 'Release on Spotify, Apple Music, Melon, Genie and more — we handle planning, distribution, and registration in one place.',
        link: '/pricing',
        icon: 'Upload',
      },
      {
        title: 'PR & Marketing',
        description: 'We promote your music effectively to the media and support showcases to spread your charm.',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: '1:1 Music Lessons',
        description: '1:1 lessons with working producers — MIDI composition, mixing, and release consulting. A practical curriculum optimized for artists aiming to release music.',
        link: '/lesson',
        icon: 'GraduationCap',
      },
      {
        title: 'Premium Practice Room',
        description: '24/7 fully soundproof practice room — overnight stays welcome. Vocal, piano & keyboard ready. Monthly residency from ₩360K — the most affordable in Eunpyeong-gu.',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "Recording room with monitoring speakers" },
      { src: `/images/studio3.webp`, alt: "Studio NOL lounge area with sofa and acoustic wall panels" },
      { src: `/images/studio4.webp`, alt: "Upright bass recording session in studio booth" },
      { src: `/images/studio5.webp`, alt: "Vintech X73i preamp and Tegeler Vari Tube Compressor rack" },
      { src: `/images/hardware8.webp`, alt: "Control desk with Softube Console 1 Fader and Proac monitoring speakers" }
    ],
    featuredLinks: [
      { title: 'Dystopia 2025 — Samgeuk Jeonpasa', href: '/portfolio/dystopia-2025', description: 'Full album recorded and mixed at Studio NOL', type: 'portfolio' },
      { title: 'Jai — Golden Hour', href: '/portfolio/jai-golden-hour', description: 'Album production with a focus on vocal textures', type: 'portfolio' },
      { title: 'EQ Fundamentals Guide', href: '/stories/eq1', description: 'Equalization basics for clear mixes', type: 'story' },
      { title: 'K-pop Vocal Techniques', href: '/stories/idol-vocal1', description: 'How to achieve the Korean K-pop vocal sound', type: 'story' },
      { title: 'Studio Info', href: '/studio-info', description: 'Equipment, rooms, and technical specifications', type: 'page' },
    ],
    // Locale-specific USP block for English-speaking foreign musicians living in Korea
    localeUsps: {
      title: "For Foreign Musicians Living in Korea",
      items: [
        {
          heading: "English-speaking engineers & transparent workflow",
          body: "Our engineers communicate in English and walk you through the recording, mixing, and mastering process step by step. Whether you are an exchange student, K-pop trainee, or expat artist, you will never be lost in translation. Transparent pricing, no hidden fees — quotes confirmed before the session begins."
        },
        {
          heading: "K-pop trainees · C-4 artist visa · KOMCA support",
          body: "We understand the specific needs of foreign artists preparing for the Korean music market. From vocal direction tuned for K-pop phrasing to guidance on registering your work with Korean Music Copyright Association (KOMCA) and navigating the C-4 artist visa, we help you get studio-ready and release-ready."
        },
        {
          heading: "Release on Melon · Genie · Bugs · Spotify Korea",
          body: "After the mix and master, we help you distribute to Korea's major streaming platforms alongside Spotify and Apple Music. Your first release in Korea starts here — with a studio that knows the local market and can keep the process in English from first contact to final delivery."
        }
      ]
    }
  },
  zh: {
    seo: {
      title: "首尔录音室·延新内站步行5分钟 | 混音母带一站式 | Studio NOL",
      description: "首尔恩平区专业录音室，延新内站步行5分钟。婚礼歌曲、配音、混音母带一站式服务，专业工程师常驻，每小时10万韩元起，欢迎咨询预约。",
      keywords: "首尔录音室, 延新内录音室, 专业录音, 混音母带, 婚礼歌曲录音, 配音录音, Studio NOL, 恩平区音乐制作"
    },
    heroContent: {
      titlePrefix: "为您的音乐注入",
      titleHighlight: "生命",
      titleSuffix: "的空间",
      subtitle: "通过高端设备和专业工程师的触感，完成您独有的声音。\n请在 Studio NOL 体验。",
      backgroundImage: "/images/studio2.webp",
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
        title: '音源发行 & 分发',
        description: '发行至 Spotify、Apple Music、Melon、Genie 等主要流媒体平台。从策划到发行与登记一站式支持。',
        link: '/pricing',
        icon: 'Upload',
      },
      {
        title: '宣传 & 营销',
        description: '通过媒体有效宣传，并丰富支持展示会，更广泛地传播您音乐的魅力。',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: '1对1音乐课程',
        description: '现役制作人提供1对1实战课程。从 MIDI 作曲、混音到发行咨询 — 为以音源发行为目标的音乐人量身定制的课程。',
        link: '/lesson',
        icon: 'GraduationCap',
      },
      {
        title: '高端练习室',
        description: '24小时全隔音练习室，可过夜住宿。配备声乐、钢琴、键盘。月租36万韩元起，恩平区最划算的价格，打造专属创作空间。',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "录音室" },
      { src: `/images/studio3.webp`, alt: "Studio NOL 休息区 - 配有沙发和吸音墙板的休息空间" },
      { src: `/images/studio4.webp`, alt: "低音提琴演奏者在录音棚进行录音" },
      { src: `/images/studio5.webp`, alt: "Vintech X73i 前置放大器和 Tegeler Vari Tube Compressor 机架" },
      { src: `/images/hardware8.webp`, alt: "控制台配备 Softube Console 1 Fader 和 Proac 监听音箱" }
    ],
    featuredLinks: [
      { title: 'Dystopia 2025 — Samgeuk Jeonpasa', href: '/portfolio/dystopia-2025', description: '在 Studio NOL 录制和混音的完整专辑', type: 'portfolio' },
      { title: 'Jai — Golden Hour', href: '/portfolio/jai-golden-hour', description: '以人声质感为核心的专辑制作', type: 'portfolio' },
      { title: 'EQ 基础指南', href: '/stories/eq1', description: '清晰混音的均衡器基础知识', type: 'story' },
      { title: 'K-pop 人声技巧', href: '/stories/idol-vocal1', description: '如何打造韩国 K-pop 人声风格', type: 'story' },
      { title: '工作室信息', href: '/studio-info', description: '设备、录音室与技术规格', type: 'page' },
    ],
    // Locale-specific USP block for Chinese-speaking audience
    localeUsps: {
      title: "专为中国音乐人打造的 Studio NOL",
      items: [
        {
          heading: "微信支付 · 中文沟通支持",
          body: "支持中国本地微信支付方式，常驻可用中文沟通的工作人员。熟悉韩国音乐市场的工程师将全程指导您的项目进行。"
        },
        {
          heading: "在韩音乐人专属服务方案",
          body: "根据签证期限灵活安排短期或长期录音日程。从机场接送、工作室往返到当地餐饮推荐,我们为您在韩国的音乐活动提供全方位支持。"
        },
        {
          heading: "中国音乐平台发行支持",
          body: "我们协助将您的专辑发行至网易云音乐、QQ 音乐、酷狗音乐等中国主要音乐平台。在 Studio NOL 迈出您在中国音乐事业的第一步。"
        }
      ]
    }
  },
  es: {
    seo: {
      title: "Estudio de Grabación Seúl · Mezcla & Masterización | Studio NOL",
      description: "Estudio en Seúl, a 5 min de Yeonsinnae. Canción de boda, locución, mezcla y masterización. Ingeniero profesional. Desde ₩100K/hora.",
      keywords: "estudio de grabación Seúl, Yeonsinnae estudio, mezcla masterización, canción boda, locución Seúl, producción musical, Studio NOL"
    },
    heroContent: {
      titlePrefix: "Dando",
      titleHighlight: "Vida",
      titleSuffix: "a Tu Música",
      subtitle: "Completa tu sonido único con equipos de alta gama e ingeniería profesional.\nVívelo en Studio NOL.",
      backgroundImage: "/images/studio2.webp",
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
        title: 'Lanzamiento y Distribución',
        description: 'Distribuimos en Spotify, Apple Music, Melon, Genie y más — gestionamos la planificación, la distribución y el registro en un solo lugar.',
        link: '/pricing',
        icon: 'Upload',
      },
      {
        title: 'RP y Marketing',
        description: 'Promocionamos tu música eficazmente en los medios y apoyamos showcases para difundir tu encanto.',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: 'Clases de Música 1:1',
        description: 'Clases 1:1 con productores en activo — composición MIDI, mezcla y consultoría de lanzamiento. Currículo práctico optimizado para artistas que buscan publicar música.',
        link: '/lesson',
        icon: 'GraduationCap',
      },
      {
        title: 'Sala de práctica premium',
        description: 'Sala de práctica 24/7 completamente insonorizada — pernocta permitida. Voz, piano y teclado incluidos. Residencia mensual desde 360.000 KRW — la más accesible de Eunpyeong-gu.',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "Sala de grabación" },
      { src: `/images/studio3.webp`, alt: "Sala de descanso de Studio NOL con sofá y paneles acústicos" },
      { src: `/images/studio4.webp`, alt: "Sesión de grabación de contrabajo en la cabina de estudio" },
      { src: `/images/studio5.webp`, alt: "Rack con preamplificador Vintech X73i y Tegeler Vari Tube Compressor" },
      { src: `/images/hardware8.webp`, alt: "Mesa de control con Softube Console 1 Fader y monitores Proac" }
    ],
    featuredLinks: [
      { title: 'Dystopia 2025 — Samgeuk Jeonpasa', href: '/portfolio/dystopia-2025', description: 'Álbum completo grabado y mezclado en Studio NOL', type: 'portfolio' },
      { title: 'Jai — Golden Hour', href: '/portfolio/jai-golden-hour', description: 'Producción de álbum con enfoque en texturas vocales', type: 'portfolio' },
      { title: 'Guía de EQ para principiantes', href: '/stories/eq1', description: 'Fundamentos de ecualización para mezclas claras', type: 'story' },
      { title: 'Técnicas vocales para K-pop', href: '/stories/idol-vocal1', description: 'Cómo lograr el sonido vocal del K-pop coreano', type: 'story' },
      { title: 'Información del estudio', href: '/studio-info', description: 'Equipos, salas, y especificaciones técnicas', type: 'page' },
    ],
    // Locale-specific USP block for Spanish-speaking audience (Latin America)
    localeUsps: {
      title: "Para Artistas Latinoamericanos en Corea",
      items: [
        {
          heading: "FAQ para artistas latinos en Seúl",
          body: "¿Cómo obtener visa de artista? ¿Dónde encontrar músicos coreanos para colaborar? Nuestro equipo te guía en todo el proceso: desde la visa C-4 hasta el registro en Korean Music Copyright Association (KOMCA)."
        },
        {
          heading: "Producción musical para K-pop y Latin Pop",
          body: "Combinamos experiencias en producción de K-pop y Latin Pop. Si buscas fusionar ritmos latinos con sonido coreano, nuestro equipo puede ayudarte a crear un sonido único que conecte ambos mercados."
        },
        {
          heading: "Testimonios de artistas hispanohablantes",
          body: "Múltiples artistas de México, Colombia y Argentina han grabado álbumes completos en Studio NOL. Lee sus experiencias y descubre por qué Studio NOL es la elección número uno para artistas hispanohablantes en Corea."
        }
      ]
    }
  },
  vi: {
    seo: {
      title: "Phòng thu Yeonsinnae · Mix & Mastering Seoul | Studio NOL",
      description: "Phòng thu Seoul cách ga Yeonsinnae 5 phút. Thu âm nhạc cưới, lồng tiếng, mixing mastering. Kỹ sư chuyên nghiệp. Từ ₩100K/giờ.",
      keywords: "phòng thu Seoul, Yeonsinnae phòng thu, mixing mastering, thu âm nhạc cưới, thu âm lồng tiếng, sản xuất âm nhạc, Studio NOL"
    },
    heroContent: {
      titlePrefix: "Thổi",
      titleHighlight: "Sự sống",
      titleSuffix: "vào âm nhạc của bạn",
      subtitle: "Hoàn thiện âm thanh với thiết bị cao cấp và kỹ sư chuyên nghiệp tại Yeonsinnae, Seoul.\nTrải nghiệm tại Studio NOL.",
      backgroundImage: "/images/studio2.webp",
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
        title: 'Phát hành & Phân phối',
        description: 'Phát hành lên Spotify, Apple Music, Melon, Genie và nhiều nền tảng khác — hỗ trợ trọn gói từ lên kế hoạch, phân phối đến đăng ký.',
        link: '/pricing',
        icon: 'Upload',
      },
      {
        title: 'PR & Marketing',
        description: 'Quảng bá hiệu quả trên truyền thông và hỗ trợ showcase để lan tỏa sức hút âm nhạc của bạn.',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: 'Lớp học âm nhạc 1:1',
        description: 'Lớp học 1:1 với nhà sản xuất chuyên nghiệp — soạn MIDI, mixing và tư vấn phát hành. Chương trình tối ưu cho nghệ sĩ muốn phát hành nhạc.',
        link: '/lesson',
        icon: 'GraduationCap',
      },
      {
        title: 'Phòng tập cao cấp',
        description: 'Phòng tập cách âm hoàn toàn 24/7 — ở qua đêm được. Thanh nhạc, piano, keyboard đầy đủ. Thuê tháng từ 360.000 KRW — giá hợp lý nhất Eunpyeong-gu.',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "Phòng thu với loa kiểm âm và bàn điều khiển" },
      { src: `/images/studio3.webp`, alt: "Khu vực lounge Studio NOL với sofa và tấm hấp âm" },
      { src: `/images/studio4.webp`, alt: "Phiên thu âm đàn bass đứng trong booth thu" },
      { src: `/images/studio5.webp`, alt: "Rack thiết bị Vintech X73i preamp và Tegeler Vari Tube Compressor" },
      { src: `/images/hardware8.webp`, alt: "Bàn điều khiển với Softube Console 1 Fader và loa monitor Proac" }
    ],
    featuredLinks: [
      { title: 'Dystopia 2025 — Samgeuk Jeonpasa', href: '/portfolio/dystopia-2025', description: 'Album đầy đủ thu âm và mixing tại Studio NOL', type: 'portfolio' },
      { title: 'Jai — Golden Hour', href: '/portfolio/jai-golden-hour', description: 'Sản xuất album tập trung vào chất lượng giọng hát', type: 'portfolio' },
      { title: 'Hướng dẫn EQ cơ bản', href: '/stories/eq1', description: 'Kiến thức cơ bản về cân bằng âm thanh', type: 'story' },
      { title: 'Kỹ thuật thanh nhạc K-pop', href: '/stories/idol-vocal1', description: 'Cách đạt được âm thanh giọng hát K-pop', type: 'story' },
      { title: 'Thông tin phòng thu', href: '/studio-info', description: 'Thiết bị, phòng thu, và thông số kỹ thuật', type: 'page' },
    ],
    // Locale-specific USP block for Vietnamese/K-pop trainee audience
    localeUsps: {
      title: "Cho Nghệ Sĩ Việt Nam Tại Hàn Quốc",
      items: [
        {
          heading: "Hướng dẫn visa nghệ sĩ & KOMCA",
          body: "Làm thế nào để xin visa C-4 (nghệ sĩ)? Đăng ký quyền tác giả âm nhạc tại Korean Music Copyright Association (KOMCA) ra sao? Chúng tôi đồng hành bạn từ khâu xin visa đến khi hoàn tất đăng ký quyền tác giả."
        },
        {
          heading: "Đào tạo thanh nhạc phong cách K-pop",
          body: "Khác với phòng thu thông thường, Studio NOL hiểu rõ yêu cầu đặc biệt của thị trường K-pop. Từ kỹ thuật thanh nhạc, biểu cảm đến phong cách trình diễn — chúng tôi giúp bạn chuẩn bị hồ sơ âm nhạc hoàn hảo cho thị trường Hàn Quốc."
        },
        {
          heading: "Phân phối âm nhạc tại Hàn Quốc",
          body: "Chúng tôi hỗ trợ phân phối album lên Melon, Genie, Bugs, Naver Music và các nền tảng âm nhạc hàng đầu Hàn Quốc. Bắt đầu sự nghiệp âm nhạc tại Hàn Quốc với Studio NOL."
        }
      ]
    }
  },
  th: {
    seo: {
      title: "สตูดิโอ Yeonsinnae · อัดเสียง มิกซ์ | Studio NOL",
      description: "สตูดิโอบันทึกเสียงโซล เดิน 5 นาทีจากสถานี Yeonsinnae อัดเพลงงานแต่ง พากย์เสียง มิกซ์และมาสเตอริ่ง วิศวกรมืออาชีพ เริ่มต้น ₩100K/ชั่วโมง",
      keywords: "สตูดิโอบันทึกเสียงโซล, Yeonsinnae สตูดิโอ, มิกซ์มาสเตอริ่ง, อัดเพลงงานแต่ง, อัดเสียงพากย์, ผลิตเพลง, Studio NOL"
    },
    heroContent: {
      titlePrefix: "เติม",
      titleHighlight: "ชีวิต",
      titleSuffix: "ให้กับดนตรีของคุณ",
      subtitle: "เติมเต็มซาวด์ด้วยอุปกรณ์ไฮเอนด์และวิศวกรมืออาชีพ\nใน Yeonsinnae, Seoul · Studio NOL",
      backgroundImage: "/images/studio2.webp",
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
        title: 'ปล่อยเพลง & จัดจำหน่าย',
        description: 'ปล่อยเพลงบน Spotify, Apple Music, Melon, Genie และอีกมาก ครอบคลุมตั้งแต่วางแผน จัดจำหน่าย ไปจนถึงการขึ้นทะเบียน ครบจบในที่เดียว',
        link: '/pricing',
        icon: 'Upload',
      },
      {
        title: 'ประชาสัมพันธ์ & การตลาด',
        description: 'โปรโมตผ่านสื่ออย่างมีประสิทธิภาพและสนับสนุนโชว์เคสเพื่อกระจายเสน่ห์ของเพลงคุณ',
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: 'คอร์สเรียนดนตรี 1:1',
        description: 'คอร์สเรียน 1:1 กับโปรดิวเซอร์มืออาชีพ — แต่งเพลงด้วย MIDI, มิกซ์เสียง และคำปรึกษาด้านการปล่อยเพลง หลักสูตรเหมาะสำหรับศิลปินที่ตั้งเป้าปล่อยเพลง',
        link: '/lesson',
        icon: 'GraduationCap',
      },
      {
        title: 'ห้องซ้อมพรีเมียม',
        description: 'ห้องซ้อมกันเสียง 24 ชั่วโมง พักค้างคืนได้ พร้อมร้อง เปียโน คีย์บอร์ด เช่ารายเดือน 360,000 วอน ราคาคุ้มที่สุดใน Eunpyeong-gu',
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "ห้องบันทึกเสียงพร้อมลำโพงมอนิเตอร์และโต๊ะคอนโทรล" },
      { src: `/images/studio3.webp`, alt: "พื้นที่พักผ่อนของ Studio NOL พร้อมโซฟาและแผงดูดซับเสียง" },
      { src: `/images/studio4.webp`, alt: "การบันทึกเสียงดับเบิลเบสในห้องบูธอัด" },
      { src: `/images/studio5.webp`, alt: "แร็คพรีแอมป์ Vintech X73i และ Tegeler Vari Tube Compressor" },
      { src: `/images/hardware8.webp`, alt: "โต๊ะควบคุมพร้อม Softube Console 1 Fader และลำโพงมอนิเตอร์ Proac" }
    ],
    featuredLinks: [
      { title: 'Dystopia 2025 — Samgeuk Jeonpasa', href: '/portfolio/dystopia-2025', description: 'อัลบั้มเต็มบันทึกเสียงและมิกซ์ที่ Studio NOL', type: 'portfolio' },
      { title: 'Jai — Golden Hour', href: '/portfolio/jai-golden-hour', description: 'การผลิตอัลบั้มเน้นที่เนื้อเสียงร้อง', type: 'portfolio' },
      { title: 'คู่มือ EQ พื้นฐาน', href: '/stories/eq1', description: 'พื้นฐานการปรับสมดุลเสียงสำหรับมิกซ์ที่ชัดเจน', type: 'story' },
      { title: 'เทคนิคการร้องเพลง K-pop', href: '/stories/idol-vocal1', description: 'วิธีสร้างเสียงร้องสไตล์ K-pop ของเกาหลี', type: 'story' },
      { title: 'ข้อมูลสตูดิโอ', href: '/studio-info', description: 'อุปกรณ์ ห้องบันทึกเสียง และข้อมูลจำเพาะทางเทคนิค', type: 'page' },
    ],
    // Locale-specific USP block for Thai audience
    localeUsps: {
      title: "สำหรับศิลปินไทยในเกาหลี",
      items: [
        {
          heading: "คำแนะนำวีซ่าศิลปิน & KOMCA",
          body: "วิธีขอวีซ่า C-4 (ศิลปิน) ทำอย่างไร? ลงทะเบียนลิขสิทธิ์เพลงที่ Korean Music Copyright Association (KOMCA) อย่างไร? ทีมงานของเราพร้อมช่วยเหลือคุณตั้งแต่ขั้นตอนขอวีซ่าจนถึงการจดทะเบียนลิขสิทธิ์เสร็จสมบูรณ์"
        },
        {
          heading: "การผลิตเพลงสไตล์ K-pop",
          body: "ต่างจากสตูดิโอทั่วไป Studio NOL เข้าใจความต้องการพิเศษของตลาด K-pop ตั้งแต่เทคนิคการร้อง การแสดง ไปจนถึงสไตล์การนำเสนอ — เราช่วยคุณเตรียมผลงานเพลงที่สมบูรณ์แบบสำหรับตลาดเกาหลี"
        },
        {
          heading: "รีวิวจากศิลปินไทย",
          body: "ศิลปินไทยหลายท่านได้บันทึกอัลบั้มเต็มที่ Studio NOL อ่านประสบการณ์ของพวกเขาและค้นพบว่าทำไม Studio NOL จึงเป็นตัวเลือกอันดับหนึ่งสำหรับศิลปินไทยในเกาหลี"
        }
      ]
    }
  },
  uz: {
    seo: {
      title: "Yeonsinnae musiqa studiyasi · Yozuv, Miks, Mastering | Studio NOL",
      description: "Seul yozuv studiyasi, Yeonsinnae bekatidan 5 daqiqa. To'y qo'shiqlari, ovoz aktyorligi, miks va mastering. Professional muhandis. ₩100K/soatdan.",
      keywords: "Seul yozuv studiyasi, Yeonsinnae studiya, miks mastering, to'y qo'shig'i yozuvi, ovoz aktyorligi, musiqa prodakshn, Studio NOL"
    },
    heroContent: {
      titlePrefix: "Musiqangizga",
      titleHighlight: "hayot",
      titleSuffix: "bag'ishlaydigan makon",
      subtitle: "Yeonsinnae, Seul shahrida professional muhandislar va yuqori sifatli uskunalar bilan\no'z tovushingizni yarating.",
      backgroundImage: "/images/studio2.webp",
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
        title: 'Chiqarish & Tarqatish',
        description: "Spotify, Apple Music, Melon, Genie kabi yetakchi platformalarda chiqaramiz — rejalashdan tarqatish va ro'yxatdan o'tkazishgacha bir joyda qo'llab-quvvatlaymiz.",
        link: '/pricing',
        icon: 'Upload',
      },
      {
        title: 'PR & Marketing',
        description: "OAV orqali samarali targ'ibot va showcase qo'llovi bilan musiqangiz jozibasini keng yoyamiz.",
        link: '/portfolio',
        icon: 'Globe',
      },
      {
        title: '1:1 musiqa darslari',
        description: "Faol prodyuserlar bilan 1:1 amaliy darslar — MIDI bastalash, miks va chiqarish bo'yicha maslahatgacha. Musiqa chiqarmoqchi bo'lganlar uchun moslashtirilgan dastur.",
        link: '/lesson',
        icon: 'GraduationCap',
      },
      {
        title: "Premium mashg'ulot xonasi",
        description: "24/7 to'liq ovoz izolyatsiyali mashg'ulot xonasi — tunab qolish mumkin. Vokal, pianino, klaviatura mavjud. Oylik ijara 360,000 KRW'dan — Eunpyeong-gu'dagi eng qulay narx.",
        link: '/practice-room',
        icon: 'Music',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "Monitoring karnaylari va boshqaruv stoli bo'lgan yozuv xonasi" },
      { src: `/images/studio3.webp`, alt: "Studio NOL dam olish zonasi - divan va akustik panellar" },
      { src: `/images/studio4.webp`, alt: "Kontrabas yozuv seanssi studiya kabinasida" },
      { src: `/images/studio5.webp`, alt: "Vintech X73i preamp va Tegeler Vari Tube Compressor rack" },
      { src: `/images/hardware8.webp`, alt: "Nazorat pulti Softube Console 1 Fader va Proac monitoring karnaylari bilan" }
    ],
    featuredLinks: [
      { title: 'Dystopia 2025 — Samgeuk Jeonpasa', href: '/portfolio/dystopia-2025', description: 'Studio NOL da yozilgan va mikslangan toʻliq albom', type: 'portfolio' },
      { title: 'Jai — Golden Hour', href: '/portfolio/jai-golden-hour', description: 'Vokal teksturalarga eʼtibor qaratgan albom prodakshn', type: 'portfolio' },
      { title: 'EQ asoslari qoʻllanma', href: '/stories/eq1', description: 'Aniq mikslar uchun ekvalayzer asoslari', type: 'story' },
      { title: 'K-pop vokal texnikalari', href: '/stories/idol-vocal1', description: 'Koreya K-pop vokal ovoziga erishish', type: 'story' },
      { title: 'Studiya maʼlumotlari', href: '/studio-info', description: 'Uskunalar, xonalar, va texnik spetsifikatsiyalar', type: 'page' },
    ],
    // Locale-specific USP block for Uzbek speakers living in Korea (K-pop trainees, expat artists)
    localeUsps: {
      title: "Koreyada Yashayotgan Oʻzbek Sanʼatkorlari Uchun",
      items: [
        {
          heading: "Oʻzbek va ingliz tillarida muloqot",
          body: "Studiomizda oʻzbek va ingliz tillarida muloqot qilish mumkin. Koreya musiqa bozori bilan tanish muhandislarimiz loyihaning har bir bosqichida sizni yoʻnaltiradi — yozuvdan miks va masteringgacha tilga bogʻliq tushunmovchiliklarsiz."
        },
        {
          heading: "K-pop treningi va C-4 sanʼatkor vizasi yoʻnalishi",
          body: "K-pop trainee va xorijda tayyorgarlik koʻrayotgan sanʼatkorlar uchun Koreya bozori talablariga mos vokal yoʻnalishi va repertoire tayyorlashga yordam beramiz. Shuningdek, Korean Music Copyright Association (KOMCA) da roʻyxatdan oʻtish va C-4 sanʼatkor vizasi jarayonlari haqida amaliy maslahat beramiz."
        },
        {
          heading: "Koreya streaming platformalarida chiqarish",
          body: "Tugallangan treklaringizni Melon, Genie, Bugs Music va Spotify Korea kabi Koreyaning asosiy musiqa platformalarida chiqarishga yordam beramiz. Koreya musiqa faoliyatingizning birinchi qadamini Studio NOL da — mahalliy bozorni biladigan va siz bilan oʻzbek tilida muloqot qila oladigan studiya bilan boshlang."
        }
      ]
    }
  }
};

export const getHomeData = (locale: Locale) => {
  return homeData[locale] || homeData['ko'];
};

/** Type for locale-specific USP block rendered on home pages */
export interface LocaleUspsBlock {
  title: string;
  items: { heading: string; body: string }[];
}

/** Type for the full home data object */
export interface HomeData {
  seo: { title: string; description: string; keywords: string };
  heroContent: {
    titlePrefix: string;
    titleHighlight: string;
    titleSuffix: string;
    subtitle: string;
    backgroundImage: string;
    imageAlt: string;
    cta: { reserve: string; portfolio: string };
    ctaImageAlt: string;
  };
  homeServices: { title: string; description: string; link: string; icon: string }[];
  studioImages: { src: string; alt: string }[];
  localeUsps?: LocaleUspsBlock;
  featuredLinks?: FeaturedLink[];
}

/** Type for curated internal links displayed on home pages */
export interface FeaturedLink {
  title: string;
  href: string;
  description: string;
  type: 'story' | 'portfolio' | 'page';
}
