import type { Locale } from '../lib/i18n';

const faqData = {
  ko: [
    {
      question: '스튜디오 놀의 위치는 어디인가요?',
      answer: '서울특별시 은평구 대조동 84-3 3층(동명여고 바로 옆)에 위치해 있습니다. 지하철 6호선 불광역 7번 출구 또는 연신내역에서 도보 5분 거리입니다.',
    },
    {
      question: '녹음실 이용 요금은 얼마인가요?',
      answer: '시간당 레코딩은 100,000원이며 최소 2시간 예약이 필요합니다. 6시간 패키지(Day Lock)는 500,000원으로 약 17% 할인이 적용됩니다. 전문 엔지니어링이 포함됩니다.',
    },
    {
      question: '믹싱 서비스 가격은 어떻게 되나요?',
      answer: '트랙 수에 따라 다릅니다. 10트랙 이하는 200,000원, 11~30트랙은 350,000원, 31트랙 이상은 500,000원입니다. 기본 2회 수정이 포함됩니다.',
    },
    {
      question: '마스터링 비용은 얼마인가요?',
      answer: '싱글 마스터링은 곡당 100,000원이며, EP/앨범 패키지(4곡 이상)는 곡당 80,000원입니다. Spotify, Apple Music 등 스트리밍 플랫폼 규격에 맞게 작업됩니다.',
    },
    {
      question: '연습실 입주 프로그램이 있나요?',
      answer: '네, 월 40만 원으로 프리미엄 방음 연습실과 8가지 부가 혜택(녹음실 할인, 무료 음원 유통, 보도자료 작성 지원, 버스킹 장비 대여 등)을 제공하는 입주 프로그램이 있습니다.',
    },
    {
      question: '어떤 장비를 보유하고 있나요?',
      answer: 'Neumann U87AI, AKG C414 XLS 마이크, Vintech X73i 프리앰프, Prism Sound Lyra 2 인터페이스, SSL Fusion 프로세서 등 프리미엄 아날로그/디지털 장비를 구비하고 있습니다.',
    },
    {
      question: '음원 유통 서비스도 제공하나요?',
      answer: '네, 입주 고객에게는 오디오가이를 통한 글로벌 플랫폼(Spotify, Apple Music, YouTube Music 등) 배포 서비스를 무료로 제공하며, 순이익의 70%를 아티스트에게 배분합니다.',
    },
  ],
  en: [
    {
      question: 'Where is Studio NOL located?',
      answer: 'We are located at 3rd Floor, 84-3 Daejo-dong, Eunpyeong-gu, Seoul. It is a 5-minute walk from Bulgwang Station (Exit 7) or Yeonsinnae Station on Line 6.',
    },
    {
      question: 'How much is the recording studio fee?',
      answer: 'Recording is 100,000 KRW per hour, with a minimum booking of 2 hours. The 6-hour package (Day Lock) is 500,000 KRW (approx. 17% discount). Professional engineering is included.',
    },
    {
      question: 'What are the mixing service prices?',
      answer: 'It depends on the track count. Under 10 tracks: 200,000 KRW, 11-30 tracks: 350,000 KRW, 31+ tracks: 500,000 KRW. Includes 2 basic revisions.',
    },
    {
      question: 'How much is mastering?',
      answer: 'Single mastering is 100,000 KRW per song. EP/Album package (4+ songs) is 80,000 KRW per song. Mastered for streaming platforms like Spotify and Apple Music.',
    },
    {
      question: 'Do you have a practice room residency program?',
      answer: 'Yes, for 400,000 KRW/month, we offer a premium soundproof practice room and 8 benefits (studio discount, free distribution, press release support, busking gear rental, etc.).',
    },
    {
      question: 'What equipment do you have?',
      answer: 'We have premium gear including Neumann U87AI, AKG C414 XLS mics, Vintech X73i preamp, Prism Sound Lyra 2 interface, and SSL Fusion processor.',
    },
    {
      question: 'Do you offer music distribution?',
      answer: 'Yes, for resident members, we offer free global distribution (Spotify, Apple Music, etc.) via Audioguy, distributing 70% of net revenue to the artist.',
    },
  ],
  zh: [
    {
      question: 'Studio NOL 位于哪里？',
      answer: '位于首尔恩平区大枣洞 84-3 3楼。从地铁6号线佛光站7号出口或延身内站步行5分钟即到。',
    },
    {
      question: '录音室费用是多少？',
      answer: '录音每小时 100,000 韩元，最少预订 2 小时。6 小时套餐 (Day Lock) 为 500,000 韩元（约优惠 17%）。包含专业工程服务。',
    },
    {
      question: '混音服务价格是多少？',
      answer: '根据轨道数量不同。10 轨以下 200,000 韩元，11-30 轨 350,000 韩元，31 轨以上 500,000 韩元。包含 2 次基础修改。',
    },
    {
      question: '母带处理费用是多少？',
      answer: '单曲母带处理每首 100,000 韩元；EP/专辑套餐（4 首以上）每首 80,000 韩元。将按 Spotify、Apple Music 等流媒体平台规格制作。',
    },
    {
      question: '有练习室入驻项目吗？',
      answer: '有，月费 400,000 韩元，提供高端隔音练习室及 8 项福利（录音室折扣、免费发行、新闻稿支持、街头演出设备租借等）。',
    },
    {
      question: '有哪些设备？',
      answer: '配备 Neumann U87AI、AKG C414 XLS 麦克风、Vintech X73i 前级、Prism Sound Lyra 2 接口、SSL Fusion 处理器等高端模拟/数字设备。',
    },
    {
      question: '提供音乐发行服务吗？',
      answer: '是的，入驻客户可通过 Audioguy 免费发行至 Spotify、Apple Music、YouTube Music 等全球平台，净收益的 70% 分成给艺人。',
    },
  ],
  es: [
    {
      question: '¿Dónde está ubicado Studio NOL?',
      answer: 'Estamos en el 3er piso, 84-3 Daejo-dong, Eunpyeong-gu, Seúl. A 5 minutos a pie de la estación Bulgwang (Salida 7) o la estación Yeonsinnae.',
    },
    {
      question: '¿Cuánto cuesta el estudio de grabación?',
      answer: 'La grabación cuesta 100.000 KRW por hora, con un mínimo de 2 horas. El paquete de 6 horas (Day Lock) cuesta 500.000 KRW (aprox. 17% de descuento). Incluye ingeniería profesional.',
    },
    {
      question: '¿Cuánto cuestan los servicios de mezcla?',
      answer: 'Depende del número de pistas. Hasta 10 pistas: 200.000 KRW; 11-30 pistas: 350.000 KRW; 31+ pistas: 500.000 KRW. Incluye 2 revisiones básicas.',
    },
    {
      question: '¿Cuánto cuesta la masterización?',
      answer: 'La masterización de un sencillo cuesta 100.000 KRW por canción. El paquete EP/Álbum (4+ canciones) cuesta 80.000 KRW por canción. Se entrega según estándares de plataformas como Spotify y Apple Music.',
    },
    {
      question: '¿Tienen un programa de residencia para salas de práctica?',
      answer: 'Sí, por 400.000 KRW/mes ofrecemos una sala premium insonorizada y 8 beneficios (descuento en estudio, distribución gratuita, apoyo con comunicados de prensa, alquiler de equipo de busking, etc.).',
    },
    {
      question: '¿Qué equipo tienen?',
      answer: 'Contamos con equipo premium como Neumann U87AI, AKG C414 XLS, preamplificador Vintech X73i, interfaz Prism Sound Lyra 2 y procesador SSL Fusion.',
    },
    {
      question: '¿Ofrecen distribución musical?',
      answer: 'Sí, para miembros residentes ofrecemos distribución global gratuita (Spotify, Apple Music, etc.) vía Audioguy, y entregamos el 70% de las ganancias netas al artista.',
    },
  ],
  vi: [
    {
      question: 'Studio NOL ở đâu?',
      answer: 'Chúng tôi ở tầng 3, 84-3 Daejo-dong, Eunpyeong-gu, Seoul (ngay bên trường nữ Dongmyeong). Cách ga Bulgwang (Line 6) cửa số 7 hoặc ga Yeonsinnae khoảng 5 phút đi bộ.',
    },
    {
      question: 'Phí sử dụng phòng thu là bao nhiêu?',
      answer: 'Thu âm 100.000 KRW/giờ, tối thiểu 2 giờ. Gói 6 giờ (Day Lock) là 500.000 KRW (giảm khoảng 17%). Bao gồm kỹ thuật chuyên nghiệp.',
    },
    {
      question: 'Giá dịch vụ mixing như thế nào?',
      answer: 'Tùy theo số track. Dưới 10 track: 200.000 KRW; 11–30 track: 350.000 KRW; 31+ track: 500.000 KRW. Bao gồm 2 lần chỉnh sửa cơ bản.',
    },
    {
      question: 'Mastering giá bao nhiêu?',
      answer: 'Mastering single 100.000 KRW/bài; gói EP/album (4+ bài) 80.000 KRW/bài. Thực hiện theo chuẩn Spotify, Apple Music, v.v.',
    },
    {
      question: 'Có chương trình phòng tập cư trú không?',
      answer: 'Có, 400.000 KRW/tháng cho phòng tập cách âm cao cấp và 8 quyền lợi (giảm giá phòng thu, phát hành miễn phí, hỗ trợ thông cáo báo chí, thuê thiết bị busking, v.v.).',
    },
    {
      question: 'Có những thiết bị nào?',
      answer: 'Trang bị Neumann U87AI, AKG C414 XLS, preamp Vintech X73i, interface Prism Sound Lyra 2, bộ xử lý SSL Fusion, v.v.',
    },
    {
      question: 'Có dịch vụ phát hành nhạc không?',
      answer: 'Có. Khách cư trú được phát hành toàn cầu miễn phí (Spotify, Apple Music, YouTube Music, v.v.) qua Audioguy và nhận 70% lợi nhuận ròng.',
    },
  ],
  th: [
    {
      question: 'Studio NOL อยู่ที่ไหน?',
      answer: 'เราตั้งอยู่ชั้น 3 เลขที่ 84-3 Daejo-dong, Eunpyeong-gu, Seoul (ติดกับโรงเรียนหญิง Dongmyeong) เดินประมาณ 5 นาทีจากสถานี Bulgwang (สาย 6) ทางออก 7 หรือสถานี Yeonsinnae',
    },
    {
      question: 'ค่าห้องอัดเท่าไหร่?',
      answer: 'อัดเสียง 100,000 วอน/ชั่วโมง ขั้นต่ำ 2 ชั่วโมง แพ็กเกจ 6 ชั่วโมง (Day Lock) 500,000 วอน (ลดประมาณ 17%) รวมวิศวกรเสียงมืออาชีพ',
    },
    {
      question: 'ค่าบริการมิกซ์คิดอย่างไร?',
      answer: 'ขึ้นอยู่กับจำนวนแทร็ก ต่ำกว่า 10 แทร็ก 200,000 วอน, 11–30 แทร็ก 350,000 วอน, 31+ แทร็ก 500,000 วอน รวมแก้ไขพื้นฐาน 2 ครั้ง',
    },
    {
      question: 'ค่ามาสเตอริ่งเท่าไหร่?',
      answer: 'มาสเตอริ่งซิงเกิล 100,000 วอน/เพลง แพ็กเกจ EP/อัลบั้ม (4 เพลงขึ้นไป) 80,000 วอน/เพลง ทำตามมาตรฐาน Spotify, Apple Music ฯลฯ',
    },
    {
      question: 'มีโปรแกรมห้องซ้อมรายเดือนหรือไม่?',
      answer: 'มีค่ะ เดือนละ 400,000 วอน ได้ห้องซ้อมกันเสียงระดับพรีเมียมและสิทธิประโยชน์ 8 อย่าง (ส่วนลดสตูดิโอ, แจกจ่ายเพลงฟรี, ช่วยเขียนข่าวประชาสัมพันธ์, เช่าอุปกรณ์บัสกิ้ง ฯลฯ)',
    },
    {
      question: 'มีอุปกรณ์อะไรบ้าง?',
      answer: 'มีอุปกรณ์ระดับพรีเมียม เช่น ไมค์ Neumann U87AI, AKG C414 XLS, พรีแอมป์ Vintech X73i, อินเทอร์เฟซ Prism Sound Lyra 2 และโปรเซสเซอร์ SSL Fusion เป็นต้น',
    },
    {
      question: 'มีบริการจัดจำหน่ายเพลงไหม?',
      answer: 'มี สำหรับสมาชิกที่พักประจำ เราให้บริการจัดจำหน่ายทั่วโลกฟรีผ่าน Audioguy (Spotify, Apple Music, YouTube Music ฯลฯ) และแบ่งรายได้สุทธิ 70% ให้ศิลปิน',
    },
  ],
  uz: [
    {
      question: 'Studio NOL qayerda joylashgan?',
      answer: 'Biz Seul sh., Eunpyeong-gu, Daejo-dong 84-3, 3‑qavatda joylashganmiz (Dongmyeong qizlar maktabi yonida). 6‑yo‘nalishdagi Bulgwang bekati 7‑chi chiqishidan yoki Yeonsinnae bekatidan 5 daqiqada piyoda.',
    },
    {
      question: 'Yozuv studiyasi narxi qancha?',
      answer: 'Yozuv 100,000 KRW/soat, minimal 2 soat. 6 soatlik paket (Day Lock) 500,000 KRW (taxm. 17% chegirma). Professional muhandislik kiritilgan.',
    },
    {
      question: 'Miks xizmatlari narxi qanday?',
      answer: 'Track soniga bog‘liq. 10 trackgacha 200,000 KRW, 11–30 track 350,000 KRW, 31+ track 500,000 KRW. 2 ta asosiy tahrir kiritilgan.',
    },
    {
      question: 'Mastering narxi qancha?',
      answer: 'Single mastering 100,000 KRW/qo‘shiq, EP/album paketi (4+ qo‘shiq) 80,000 KRW/qo‘shiq. Spotify, Apple Music kabi platformalar standartiga mos.',
    },
    {
      question: 'Mashg‘ulot xonasi rezident dasturi bormi?',
      answer: 'Ha. Oyiga 400,000 KRW evaziga premium ovoz izolyatsiyali mashg‘ulot xonasi va 8 ta imtiyoz (studiyada chegirma, bepul tarqatish, press-reliz qo‘llovi, busking uskunalari ijarasi va h.k.) beriladi.',
    },
    {
      question: 'Qanday uskunalar bor?',
      answer: 'Neumann U87AI, AKG C414 XLS mikrofonlari, Vintech X73i preamp, Prism Sound Lyra 2 interfeys, SSL Fusion protsessori kabi premium analog/raqamli uskunalar mavjud.',
    },
    {
      question: 'Musiqa tarqatish xizmati ham bormi?',
      answer: 'Ha. Rezident mijozlar Audioguy orqali global platformalarga (Spotify, Apple Music, YouTube Music va b.) bepul tarqatish xizmatini oladi va sof daromadning 70% san’atkorga beriladi.',
    },
  ]
};

export const getFaqData = (locale: Locale) => {
  return faqData[locale] || faqData['ko']; // Fallback to Korean if translation missing
};

// Page-specific FAQ filters for SEO rich snippets
export const getPricingFaqData = (locale: Locale) => {
  const allFaq = getFaqData(locale);
  const pricingKeywords = [
    // Korean
    '요금', '가격', '비용', '얼마',
    // English
    'fee', 'price', 'cost', 'how much',
    // Chinese
    '费用', '价格', '多少',
    // Spanish
    'precio', 'cuesta', 'cuánto',
    // Vietnamese
    'giá', 'phí', 'bao nhiêu',
    // Thai
    'ราคา', 'ค่า', 'เท่าไหร่',
    // Uzbek
    'narx', 'qancha'
  ];
  return allFaq.filter(faq =>
    pricingKeywords.some(keyword =>
      faq.question.toLowerCase().includes(keyword.toLowerCase()) ||
      faq.answer.toLowerCase().includes(keyword.toLowerCase())
    )
  );
};

export const getStudioFaqData = (locale: Locale) => {
  const allFaq = getFaqData(locale);
  const studioKeywords = [
    // Korean
    '장비', '스튜디오', '녹음실',
    // English
    'equipment', 'studio', 'gear',
    // Chinese
    '设备', '录音室',
    // Spanish
    'equipo', 'estudio',
    // Vietnamese
    'thiết bị', 'phòng thu',
    // Thai
    'อุปกรณ์', 'สตูดิโอ',
    // Uzbek
    'uskunalar', 'studiya'
  ];
  return allFaq.filter(faq =>
    studioKeywords.some(keyword =>
      faq.question.toLowerCase().includes(keyword.toLowerCase()) ||
      faq.answer.toLowerCase().includes(keyword.toLowerCase())
    )
  );
};

export const getPracticeRoomFaqData = (locale: Locale) => {
  const allFaq = getFaqData(locale);
  const practiceKeywords = [
    // Korean
    '연습실', '입주', '방음',
    // English
    'practice', 'residency', 'soundproof',
    // Chinese
    '练习室', '入驻', '隔音',
    // Spanish
    'práctica', 'residencia', 'insonoriza',
    // Vietnamese
    'phòng tập', 'cư trú', 'cách âm',
    // Thai
    'ห้องซ้อม', 'กันเสียง',
    // Uzbek
    'mashg\'ulot', 'rezident', 'ovoz izolyatsiya'
  ];
  return allFaq.filter(faq =>
    practiceKeywords.some(keyword =>
      faq.question.toLowerCase().includes(keyword.toLowerCase()) ||
      faq.answer.toLowerCase().includes(keyword.toLowerCase())
    )
  );
};

export const getDistributionFaqData = (locale: Locale) => {
  const allFaq = getFaqData(locale);
  const distributionKeywords = [
    // Korean
    '유통', '배포', 'Spotify', 'Apple Music',
    // English
    'distribution', 'distribute',
    // Chinese
    '发行',
    // Spanish
    'distribución',
    // Vietnamese
    'phát hành',
    // Thai
    'จัดจำหน่าย',
    // Uzbek
    'tarqatish'
  ];
  return allFaq.filter(faq =>
    distributionKeywords.some(keyword =>
      faq.question.toLowerCase().includes(keyword.toLowerCase()) ||
      faq.answer.toLowerCase().includes(keyword.toLowerCase())
    )
  );
};
