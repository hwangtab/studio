import type { Locale } from '../lib/i18n';

const homeData = {
    ko: {
    seo: {
      title: "연신내 노래 녹음 스튜디오 · 녹음실 · 음악연습실 | 스튜디오 놀",
      description: "연신내역 도보 5분 노래 녹음 스튜디오. 보컬 녹음·믹싱·마스터링과 24시간 전용 음악연습실까지. 전문 엔지니어 직접 진행, 시간당 10만원~, 무료 카카오톡 견적.",
      keywords: "노래 녹음 스튜디오, 보컬 녹음, 연신내 녹음실, 음원 제작, 디지털 싱글, 믹싱 마스터링, 앨범 발매, 음악 프로듀싱, 전문 녹음실, 성우 녹음, 축가 녹음, 오디오북 녹음, 일반인 녹음실, 스튜디오 놀, 음악연습실, 24시간 음악연습실"
    },
    heroContent: {
      titlePrefix: "곡은 다 썼는데,",
      titleHighlight: "그 다음",
      titleSuffix: "이 어려운 당신에게",
      subtitle: "그 다음은 함께 만듭니다.\n기획·녹음·세션·믹싱·유통,\n그리고 매체·평론에 닿는 일까지.\n연신내 녹음실 스튜디오 놀에서 시작하세요.",
      backgroundImage: "/images/studio2.webp",
      imageAlt: "연신내 녹음실 스튜디오 놀 - 은평구 전문 음악 스튜디오 메인룸",
      cta: {
        reserve: "카톡으로 무료 상담",
        // 히어로 헤드라인("곡은 다 썼는데, 그 다음")이 부르는 발매 의도 방문자를
        // 스크롤 없이 플래그십으로 보낸다. 포트폴리오는 발매 페이지 안에서
        // 디스코그래피 증거로 다시 연결된다. (2026-08-04 매출 감사: 발매 허브
        // 90일 방문 37명 — 홈 히어로에 진입로가 없던 것이 원인 중 하나)
        secondary: "발매 프로젝트 보기",
        secondaryLink: "/release-project"
      },
      ctaImageAlt: "연신내 녹음실 스튜디오 놀 - 전문 녹음 장비와 하드웨어"
    },
    homeServices: [
      {
        title: '발매 프로젝트',
        description: '기획·녹음·세션·믹싱·유통·홍보까지 — 프로듀서가 끝까지 책임지는 인디 발매 프로듀싱. 무료 상담 후 맞춤 견적.',
        link: '/release-project',
        icon: 'Disc',
      },
      {
        title: '보컬·악기 녹음',
        description: '전담 엔지니어의 디렉팅과 하이엔드 장비로, 데모부터 발매용 음원까지 제대로 녹음하세요.',
        link: '/recording',
        icon: 'Mic',
      },
      {
        title: '믹싱·마스터링 의뢰',
        description: '파일만 보내면 전국·해외 어디서든 — 트랙 수 기준 투명한 가격으로 3~7영업일 안에 완성합니다.',
        link: '/mixing-mastering',
        icon: 'SlidersHorizontal',
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
      {
        title: '커버 영상 촬영',
        description: '촬영 + 음원 녹음 + 믹싱 + 편집까지 올인원. 4K 영상과 WAV·MP3를 한 세션에 완성하세요.',
        link: '/cover-video',
        icon: 'Video',
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
    ],
    localeUsps: {
      title: "처음이어도 안심하고 맡기는 이유",
      items: [
        {
          heading: "전문 엔지니어가 처음부터 끝까지 직접",
          body: "Neumann U87Ai 등 하이엔드 장비로 1:1 디렉팅. 첫 녹음이어도 발성·마이크 포지션·보컬 톤까지 현장에서 잡아드려, 부담 없이 좋은 결과물을 가져가실 수 있습니다."
        },
        {
          heading: "세션 전에 확정되는 투명한 가격",
          body: "보컬 녹음 1곡 25만원, 시간당 10만원, 싱글 마스터링 10만원. 숨은 비용 없이 카카오톡으로 무료 견적을 먼저 확인하고 시작합니다."
        },
        {
          heading: "녹음·연습실·발매까지 한 곳에서",
          body: "연신내역 도보 5분. 녹음 → 믹싱·마스터링 → 음원 발매·유통, 그리고 24시간 음악연습실까지 한 건물에서 원스톱으로 해결합니다."
        }
      ]
    },
    producerCredibility: {
      eyebrow: "이 스튜디오를 이끄는 사람",
      name: "프로듀서 황경하",
      tagline: "15년차 음반 기획자·프로듀서 · 2017 한국대중음악상 선정위원 특별상 수상",
      stats: [
        { value: "70+", label: "함께한 발매작" },
        { value: "15년", label: "음반 작업 경력" },
        { value: "2017", label: "한국대중음악상 수상" }
      ]
    }
  },
  en: {
    seo: {
      title: "Seoul Recording Studio · Yeonsinnae | Studio NOL",
      description: "Seoul recording studio 5 min from Yeonsinnae, with English booking & support. Recording, mixing & mastering for international musicians in Korea. From ₩100K/hr.",
      keywords: "Seoul recording studio, international musicians Korea, Yeonsinnae recording studio, English booking Seoul studio, mixing mastering Seoul, K-pop vocal recording, voice over recording Seoul, wedding song recording, Studio NOL, Eunpyeong-gu studio"
    },
    heroContent: {
      titlePrefix: "Your voice, at its best.",
      titleHighlight: "Seoul Vocal Recording Studio",
      titleSuffix: "",
      subtitle: "From vocal recording to mixing and mastering — handled directly by a professional engineer. 5 minutes from Yeonsinnae Station. Your first session, made easy.",
      backgroundImage: "/images/studio2.webp",
      imageAlt: "Studio NOL Main Studio",
      cta: {
        reserve: "Free Release Consultation",
        secondary: "Portfolio",
        secondaryLink: "/portfolio"
      },
      ctaImageAlt: "Studio NOL Seoul - Professional Recording Equipment and Hardware"
    },
    homeServices: [
      {
        title: 'Release Project',
        description: 'From planning to recording, sessions, mixing, and distribution — a release project led by Producer Hwang Gyeongha. Free consultation, custom quote.',
        link: '/release-project',
        icon: 'Disc',
      },
      {
        title: 'Vocal & Instrument Recording',
        description: 'Dedicated engineer and high-end gear — from demos to release-ready tracks.',
        link: '/recording',
        icon: 'Mic',
      },
      {
        title: 'Mixing & Mastering',
        description: 'Send your files from anywhere — transparent per-track pricing, delivered in 3–7 business days.',
        link: '/mixing-mastering',
        icon: 'SlidersHorizontal',
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
      {
        title: 'Cover Video Filming',
        description: 'Filming + recording + mixing + editing all in one. Get your 4K video and WAV/MP3 in a single 3-hour session.',
        link: '/cover-video',
        icon: 'Video',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "Recording room with monitoring speakers" },
      { src: `/images/studio3.webp`, alt: "Studio NOL lounge area with sofa and acoustic wall panels" },
      { src: `/images/studio4.webp`, alt: "Upright bass recording session in studio booth" },
      { src: `/images/studio5.webp`, alt: "Vintech X73i preamp and Tegeler Vari Tube Compressor rack" },
      { src: `/images/hardware8.webp`, alt: "Control desk with Softube Console 1 Fader and Proac monitoring speakers" }
    ],
    // Locale-specific USP block for English-speaking foreign musicians living in Korea
    localeUsps: {
      title: "For Foreign Musicians Living in Korea",
      items: [
        {
          heading: "English booking & transparent workflow",
          body: "Booking, quotes, mix notes, and revisions are all handled in English, and our remote mixing & mastering runs entirely in English — send your tracks from anywhere. Whether you are an exchange student, K-pop trainee, or expat artist, the process stays clear from first message to final delivery. Transparent pricing, no hidden fees — quotes confirmed before the session begins."
        },
        {
          heading: "Recording for Artists Aiming at the Korean Market",
          body: "Vocal direction is part of every recording session, and it adapts to the phrasing a K-pop or Korean-market release calls for. Sessions run in English, and mixing and mastering can be commissioned remotely if you cannot come to Seoul."
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
      titlePrefix: "用最好的声音呈现你的歌声",
      titleHighlight: "延新内人声录音室",
      titleSuffix: "",
      subtitle: "从人声录音到混音、母带，专业工程师亲自操作。延新内站步行5分钟，第一次录音也能轻松开始。",
      backgroundImage: "/images/studio2.webp",
      imageAlt: "Studio NOL 主录音室",
      cta: {
        reserve: "免费发行咨询",
        secondary: "作品集",
        secondaryLink: "/portfolio"
      },
      ctaImageAlt: "Studio NOL 首尔 - 专业录音设备和硬件"
    },
    homeServices: [
      {
        title: '发行项目',
        description: '从企划、录音、乐手联络、混音到发行——由制作人황경하主导，全程陪伴你的音乐发行之旅。免费咨询，定制报价。',
        link: '/release-project',
        icon: 'Disc',
      },
      {
        title: '人声·乐器录音',
        description: '专属工程师全程指导，高端设备加持 — 从Demo到发行级音源。',
        link: '/recording',
        icon: 'Mic',
      },
      {
        title: '混音·母带',
        description: '只需发送文件，海外亦可 — 按轨道数透明定价，3–7个工作日交付。',
        link: '/mixing-mastering',
        icon: 'SlidersHorizontal',
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
      {
        title: '翻唱视频拍摄',
        description: '拍摄+录音+混音+剪辑一站式。一次3小时完成4K视频与WAV·MP3。',
        link: '/cover-video',
        icon: 'Video',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "录音室" },
      { src: `/images/studio3.webp`, alt: "Studio NOL 休息区 - 配有沙发和吸音墙板的休息空间" },
      { src: `/images/studio4.webp`, alt: "低音提琴演奏者在录音棚进行录音" },
      { src: `/images/studio5.webp`, alt: "Vintech X73i 前置放大器和 Tegeler Vari Tube Compressor 机架" },
      { src: `/images/hardware8.webp`, alt: "控制台配备 Softube Console 1 Fader 和 Proac 监听音箱" }
    ],
    // Locale-specific USP block for Chinese-speaking audience
    localeUsps: {
      title: "专为中国音乐人打造的 Studio NOL",
      items: [
        {
          heading: "远程混音与母带处理",
          body: "无需来首尔。将干声和伴奏的 WAV 文件发送给我们，收到文件后 3 至 7 个工作日内交付成品。沟通以英语进行。"
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
      titlePrefix: "Tu voz, con el mejor sonido.",
      titleHighlight: "Estudio de Grabación Vocal en Seúl",
      titleSuffix: "",
      subtitle: "Desde la grabación vocal hasta la mezcla y masterización, a cargo de un ingeniero profesional. A 5 min de Yeonsinnae. Tu primera sesión, sin complicaciones.",
      backgroundImage: "/images/studio2.webp",
      imageAlt: "Estudio Principal Studio NOL",
      cta: {
        reserve: "Consulta Gratuita de Lanzamiento",
        secondary: "Portafolio",
        secondaryLink: "/portfolio"
      },
      ctaImageAlt: "Studio NOL Seúl - Equipo de grabación profesional"
    },
    homeServices: [
      {
        title: 'Proyecto de Lanzamiento',
        description: 'Desde la planificación hasta la grabación, sesiones, mezcla y distribución — un proyecto de lanzamiento liderado por el productor Hwang Gyeongha. Consulta gratuita, presupuesto personalizado.',
        link: '/release-project',
        icon: 'Disc',
      },
      {
        title: 'Grabación Vocal e Instrumental',
        description: 'Ingeniero dedicado y equipo de alta gama — de la maqueta a pistas listas para publicar.',
        link: '/recording',
        icon: 'Mic',
      },
      {
        title: 'Mezcla y Masterización',
        description: 'Envía tus archivos desde cualquier lugar — precios transparentes por pistas, entrega en 3–7 días hábiles.',
        link: '/mixing-mastering',
        icon: 'SlidersHorizontal',
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
      {
        title: 'Grabación de Video Cover',
        description: 'Filmación + grabación + mezcla + edición todo en uno. Video 4K y WAV/MP3 en una sola sesión de 3 horas.',
        link: '/cover-video',
        icon: 'Video',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "Sala de grabación" },
      { src: `/images/studio3.webp`, alt: "Sala de descanso de Studio NOL con sofá y paneles acústicos" },
      { src: `/images/studio4.webp`, alt: "Sesión de grabación de contrabajo en la cabina de estudio" },
      { src: `/images/studio5.webp`, alt: "Rack con preamplificador Vintech X73i y Tegeler Vari Tube Compressor" },
      { src: `/images/hardware8.webp`, alt: "Mesa de control con Softube Console 1 Fader y monitores Proac" }
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
      titlePrefix: "Giọng hát của bạn, với âm thanh tốt nhất.",
      titleHighlight: "Phòng thu âm giọng hát Seoul",
      titleSuffix: "",
      subtitle: "Từ thu âm giọng hát đến mixing và mastering — kỹ sư chuyên nghiệp trực tiếp thực hiện. Cách ga Yeonsinnae 5 phút. Buổi thu đầu tiên cũng thật dễ dàng.",
      backgroundImage: "/images/studio2.webp",
      imageAlt: "Studio NOL phòng thu chính",
      cta: {
        reserve: "Tư vấn Phát hành Miễn phí",
        secondary: "Portfolio",
        secondaryLink: "/portfolio"
      },
      ctaImageAlt: "Studio NOL Seoul - Thiết bị thu âm chuyên nghiệp"
    },
    homeServices: [
      {
        title: 'Dự án Phát hành',
        description: 'Từ lập kế hoạch, thu âm, kết nối nhạc công, mix đến phát hành — dự án phát hành do Producer Hwang Gyeongha dẫn dắt. Tư vấn miễn phí, báo giá tùy chỉnh.',
        link: '/release-project',
        icon: 'Disc',
      },
      {
        title: 'Thu âm vocal & nhạc cụ',
        description: 'Kỹ sư chuyên trách và thiết bị cao cấp — từ demo đến bản thu sẵn sàng phát hành.',
        link: '/recording',
        icon: 'Mic',
      },
      {
        title: 'Mixing & Mastering',
        description: 'Chỉ cần gửi file từ bất cứ đâu — giá minh bạch theo số track, hoàn thành trong 3–7 ngày làm việc.',
        link: '/mixing-mastering',
        icon: 'SlidersHorizontal',
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
      {
        title: 'Quay Video Cover',
        description: 'Quay phim + thu âm + mix + dựng phim trọn gói. Video 4K và WAV/MP3 trong một buổi 3 giờ.',
        link: '/cover-video',
        icon: 'Video',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "Phòng thu với loa kiểm âm và bàn điều khiển" },
      { src: `/images/studio3.webp`, alt: "Khu vực lounge Studio NOL với sofa và tấm hấp âm" },
      { src: `/images/studio4.webp`, alt: "Phiên thu âm đàn bass đứng trong booth thu" },
      { src: `/images/studio5.webp`, alt: "Rack thiết bị Vintech X73i preamp và Tegeler Vari Tube Compressor" },
      { src: `/images/hardware8.webp`, alt: "Bàn điều khiển với Softube Console 1 Fader và loa monitor Proac" }
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
      titlePrefix: "เสียงของคุณ ในแบบที่ดีที่สุด",
      titleHighlight: "สตูดิโอบันทึกเสียงร้องโซล",
      titleSuffix: "",
      subtitle: "ตั้งแต่บันทึกเสียงร้องไปจนถึงมิกซ์และมาสเตอริ่ง โดยวิศวกรมืออาชีพ เดิน 5 นาทีจากสถานี Yeonsinnae เริ่มต้นบันทึกครั้งแรกได้อย่างง่ายดาย",
      backgroundImage: "/images/studio2.webp",
      imageAlt: "สตูดิโอหลักของ Studio NOL",
      cta: {
        reserve: "ปรึกษาการปล่อยเพลงฟรี",
        secondary: "ผลงาน",
        secondaryLink: "/portfolio"
      },
      ctaImageAlt: "Studio NOL โซล - อุปกรณ์บันทึกเสียงมืออาชีพ"
    },
    homeServices: [
      {
        title: 'โปรเจกต์ปล่อยเพลง',
        description: 'ตั้งแต่วางแผน บันทึกเสียง หานักดนตรี มิกซ์ จัดจำหน่าย — โปรเจกต์ปล่อยเพลงที่นำโดย Producer Hwang Gyeongha ปรึกษาฟรี ราคาสำหรับคุณโดยเฉพาะ',
        link: '/release-project',
        icon: 'Disc',
      },
      {
        title: 'อัดเสียงร้อง·เครื่องดนตรี',
        description: 'วิศวกรเสียงประจำและอุปกรณ์ไฮเอนด์ — ตั้งแต่เดโมจนถึงเพลงพร้อมปล่อย',
        link: '/recording',
        icon: 'Mic',
      },
      {
        title: 'มิกซ์ & มาสเตอร์',
        description: 'เพียงส่งไฟล์จากที่ไหนก็ได้ — ราคาโปร่งใสตามจำนวนแทร็ก เสร็จใน 3–7 วันทำการ',
        link: '/mixing-mastering',
        icon: 'SlidersHorizontal',
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
      {
        title: 'ถ่ายวิดีโอ Cover',
        description: 'ถ่ายทำ + อัดเสียง + มิกซ์ + ตัดต่อครบวงจร วิดีโอ 4K และ WAV/MP3 ในเซสชันเดียว 3 ชั่วโมง',
        link: '/cover-video',
        icon: 'Video',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "ห้องบันทึกเสียงพร้อมลำโพงมอนิเตอร์และโต๊ะคอนโทรล" },
      { src: `/images/studio3.webp`, alt: "พื้นที่พักผ่อนของ Studio NOL พร้อมโซฟาและแผงดูดซับเสียง" },
      { src: `/images/studio4.webp`, alt: "การบันทึกเสียงดับเบิลเบสในห้องบูธอัด" },
      { src: `/images/studio5.webp`, alt: "แร็คพรีแอมป์ Vintech X73i และ Tegeler Vari Tube Compressor" },
      { src: `/images/hardware8.webp`, alt: "โต๊ะควบคุมพร้อม Softube Console 1 Fader และลำโพงมอนิเตอร์ Proac" }
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
          body: "Studio NOL รับบันทึกเสียง มิกซ์ และมาสเตอร์สำหรับเพลงที่มุ่งสู่ตลาดเกาหลี การกำกับเสียงร้องรวมอยู่ในทุกเซสชันบันทึกเสียง และงานมิกซ์·มาสเตอร์สามารถส่งไฟล์มาทำระยะไกลได้"
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
      titlePrefix: "Ovozingiz — eng yaxshi tovushda.",
      titleHighlight: "Seul vokal yozuv studiyasi",
      titleSuffix: "",
      subtitle: "Vokal yozuvdan to miks va masteringgacha — professional muhandis bevosita bajaradi. Yeonsinnae bekatidan 5 daqiqa. Birinchi seansingiz ham oson.",
      backgroundImage: "/images/studio2.webp",
      imageAlt: "Studio NOL asosiy studiyasi",
      cta: {
        reserve: "Bepul Chiqarish Maslahati",
        secondary: "Portfel",
        secondaryLink: "/portfolio"
      },
      ctaImageAlt: "Studio NOL Seul - Professional yozuv uskunalari"
    },
    homeServices: [
      {
        title: 'Chiqarish loyihasi',
        description: "Rejalashdan yozuv, musiqachilar, miks va tarqatishgacha — Producer Hwang Gyeongha boshchiligidagi chiqarish loyihasi. Bepul maslahat, maxsus narx.",
        link: '/release-project',
        icon: 'Disc',
      },
      {
        title: "Vokal va cholg'u yozuvi",
        description: 'Maxsus muhandis va yuqori darajali uskunalar — demodan relizga tayyor treklargacha.',
        link: '/recording',
        icon: 'Mic',
      },
      {
        title: 'Miks va mastering',
        description: "Fayllarni istalgan joydan yuboring — treklar soniga ko'ra shaffof narx, 3–7 ish kunida tayyor.",
        link: '/mixing-mastering',
        icon: 'SlidersHorizontal',
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
      {
        title: "Cover video suratga olish",
        description: "Suratga olish + yozuv + miks + montaj bitta paketda. 3 soatlik bitta seansda 4K video va WAV/MP3.",
        link: '/cover-video',
        icon: 'Video',
      },
    ],
    studioImages: [
      { src: `/images/studio2.webp`, alt: "Monitoring karnaylari va boshqaruv stoli bo'lgan yozuv xonasi" },
      { src: `/images/studio3.webp`, alt: "Studio NOL dam olish zonasi - divan va akustik panellar" },
      { src: `/images/studio4.webp`, alt: "Kontrabas yozuv seanssi studiya kabinasida" },
      { src: `/images/studio5.webp`, alt: "Vintech X73i preamp va Tegeler Vari Tube Compressor rack" },
      { src: `/images/hardware8.webp`, alt: "Nazorat pulti Softube Console 1 Fader va Proac monitoring karnaylari bilan" }
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

/** 프로듀서 신뢰 스트립 — 그동안 /release-project 페이지에만 있던 실적을 홈으로 승격. */
export interface ProducerCredibility {
  eyebrow: string;
  name: string;
  tagline: string;
  stats: { value: string; label: string }[];
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
    cta: { reserve: string; secondary: string; secondaryLink: string };
    ctaImageAlt: string;
  };
  homeServices: { title: string; description: string; link: string; icon: string }[];
  studioImages: { src: string; alt: string }[];
  localeUsps?: LocaleUspsBlock;
  producerCredibility?: ProducerCredibility;
}
