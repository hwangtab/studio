import type { Locale } from '../lib/i18n';
import { CANONICAL_FACTS } from '../lib/factTokens';

const faqData = {
  ko: [
    {
      question: '스튜디오 놀의 위치는 어디인가요?',
      answer: '서울특별시 은평구 대조동 84-3 3층(동명여고 바로 옆)에 위치해 있습니다. 지하철 6호선 불광역 7번 출구 또는 연신내역에서 도보 5분 거리입니다.',
    },
    {
      question: '녹음실 이용 요금은 얼마인가요?',
      answer: '보컬 녹음 1프로(1곡 패키지)는 250,000원이며 3시간 기준 전담 엔지니어 진행입니다. 시간당 레코딩은 100,000원(최소 2시간, 성우·악기 추가·보정 등), 6시간 패키지(Day Lock)는 500,000원으로 장시간 앨범 작업에 적합합니다.',
    },
    {
      question: '믹싱 서비스 가격은 어떻게 되나요?',
      answer: '트랙 수에 따라 다릅니다. 10트랙 이하는 200,000원, 11~30트랙은 350,000원, 31트랙 이상은 500,000원입니다. 기본 2회 수정이 포함됩니다.',
    },
    {
      question: '마스터링 비용은 얼마인가요?',
      answer: '마스터링은 곡당 100,000원입니다. 멜론, 지니, 유튜브 뮤직, 애플뮤직 등 주요 음원사이트 규격에 맞게 작업됩니다.',
    },
    {
      question: '연습실 입주 프로그램이 있나요?',
      answer: '네, 월 36만 원부터 프리미엄 방음 연습실과 8가지 부가 혜택(녹음실 할인, 무료 음원 유통, 보도자료 작성 지원, 버스킹 장비 대여 등)을 제공하는 입주 프로그램이 있습니다.',
    },
    {
      question: '어떤 장비를 보유하고 있나요?',
      answer: 'Neumann U87AI, AKG C414 XLS 마이크, Vintech X73i 프리앰프, Prism Sound Lyra 2 인터페이스, SSL Fusion 프로세서 등 프리미엄 아날로그/디지털 장비를 구비하고 있습니다.',
    },
    {
      question: '스튜디오 놀은 주말이나 공휴일에도 영업하나요?',
      answer: '네, 스튜디오 놀은 100% 예약제로 운영되며, 사전 예약 시 주말 및 공휴일, 심야 시간대에도 이용 가능합니다.',
    },
    {
      question: '연신내역 근처에 녹음실이나 연습실이 있나요?',
      answer: '네, 스튜디오 놀은 연신내역과 불광역에서 도보 5분 거리에 위치해 있어 은평구 지역에서 접근성이 매우 좋습니다.',
    },
    {
      question: '초보자도 녹음실을 이용할 수 있나요?',
      answer: '물론입니다. 전문 엔지니어가 녹음 준비부터 진행, 후보정까지 전 과정을 세심하게 도와드리므로 녹음 경험이 없으신 분들도 편안하게 고품질 결과물을 만드실 수 있습니다.',
    },
    {
      question: '축가 녹음은 어디서 할 수 있나요?',
      answer: '스튜디오 놀에서 웨딩·행사 축가 녹음 전문 패키지를 제공합니다. 축가 완성 패키지 350,000원으로 레코딩·믹싱·마스터링을 원스톱으로 진행하며, 연신내역 도보 5분 거리로 접근성도 뛰어납니다.',
    },
    {
      question: '녹음실 예약은 어떻게 하나요?',
      answer: `카카오톡 채널 '스튜디오 놀', 전화(${CANONICAL_FACTS.phone}), 또는 홈페이지 문의 폼을 통해 예약하실 수 있습니다. 당일 예약도 가능하며, 주말·공휴일에도 운영합니다.`,
    },
    {
      question: '일반인도 녹음실을 이용할 수 있나요?',
      answer: '네, 전문가가 아니어도 누구나 환영합니다. 모든 녹음 세션에 전담 엔지니어가 동반해 마이크 세팅부터 보컬 디렉팅, 완성 파일 전달까지 전 과정을 지원하므로 처음 녹음하시는 분도 편안하게 고품질 결과물을 얻으실 수 있습니다. (셀프 녹음·시간 대여는 운영하지 않습니다.)',
    },
    {
      question: '연습실 단기 대여도 가능한가요?',
      answer: '연습실은 월정액 입주 프로그램(월 36만원~) 전용으로 운영하며 시간제·단기 대여는 운영하지 않습니다. 시간 단위로 연습 공간이 필요하시면 인근 시간 대여 운영사를 이용해주세요.',
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
      answer: 'Mastering is 100,000 KRW per song. Mastered for streaming platforms like Spotify and Apple Music.',
    },
    {
      question: 'Do you have a practice room residency program?',
      answer: 'Yes, from 360,000 KRW/month, we offer a premium soundproof practice room and 8 benefits (studio discount, free distribution, press release support, busking gear rental, etc.).',
    },
    {
      question: 'What equipment do you have?',
      answer: 'We have premium gear including Neumann U87AI, AKG C414 XLS mics, Vintech X73i preamp, Prism Sound Lyra 2 interface, and SSL Fusion processor.',
    },
    {
      question: 'Is Studio NOL open on weekends or holidays?',
      answer: 'Yes, Studio NOL operates on a 100% reservation basis. If booked in advance, services are available on weekends, holidays, and late-night hours.',
    },
    {
      question: 'Is there a recording studio near Yeonsinnae Station?',
      answer: 'Yes, Studio NOL is conveniently located just a 5-minute walk from both Yeonsinnae Station and Bulgwang Station in Eunpyeong-gu.',
    },
    {
      question: 'Can beginners use the recording studio?',
      answer: 'Absolutely. Our professional engineers guide you through the entire process, from preparation to post-production, ensuring high-quality results even for those with no prior recording experience.',
    },
    {
      question: 'Where can I record a wedding or event song?',
      answer: 'Studio NOL offers a dedicated wedding/event vocal recording package for 350,000 KRW — all-inclusive recording, mixing, and mastering in one visit. Located just 5 minutes from Yeonsinnae Station.',
    },
    {
      question: 'How do I book the recording studio?',
      answer: `You can book via KakaoTalk (channel: Studio NOL), phone (${CANONICAL_FACTS.phone}), or our website contact form. Same-day bookings are possible, and we are available on weekends and holidays.`,
    },
    {
      question: 'Can non-professionals record here?',
      answer: 'Absolutely. Everyone is welcome regardless of experience. Our dedicated engineer accompanies every session — mic setup, vocal direction, and finished file delivery — first-timers consistently achieve professional-quality results. (Self-recording and hourly rental are not offered.)',
    },
    {
      question: 'Is short-term rental of the practice room available?',
      answer: 'Our practice room primarily operates on a monthly residency program (from 360,000 KRW/month) only. We do not offer short-term or hourly rentals.',
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
      answer: '母带处理每首 100,000 韩元。将按 Spotify、Apple Music 等流媒体平台规格制作。',
    },
    {
      question: '有练习室入驻项目吗？',
      answer: '月费 360,000 韩元起，提供高端隔音练习室及 8 项福利（录音室折扣、免费发行、新闻稿支持、街头演出设备租借等）。',
    },
    {
      question: '有哪些设备？',
      answer: '配备 Neumann U87AI、AKG C414 XLS 麦克风、Vintech X73i 前级、Prism Sound Lyra 2 接口、SSL Fusion 处理器等高端模拟/数字设备。',
    },
    {
      question: '提供音乐发行服务吗？',
      answer: '是的，入驻客户可通过 Audioguy 免费发行至 Spotify、Apple Music、YouTube Music 等全球平台，净收益的 70% 分成给艺人。',
    },
    {
      question: '在哪里可以录制婚礼祝歌？',
      answer: 'Studio NOL 提供婚礼/活动祝歌录音专属套餐，350,000韩元含录音、混音和母带处理，一站式完成。距延新内站步行5分钟。',
    },
    {
      question: '如何预约录音室？',
      answer: `可通过 KakaoTalk 频道"Studio NOL"、电话 ${CANONICAL_FACTS.phone} 或网站联系表单预约。支持当天预约，周末及节假日均可使用。`,
    },
    {
      question: '普通人也可以使用录音室吗？',
      answer: '当然可以，欢迎所有人。所有录音均由专职工程师全程陪同，从麦克风设置到人声指导、成品交付，第一次录音也能轻松获得高品质成果。（不提供自录及小时租赁服务。）',
    },
    {
      question: '练习室可以短期租用吗？',
      answer: '练习室仅提供月费入驻项目（36万韩元/月起）。不提供短期或按小时租赁。',
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
      answer: 'Sí, desde 360.000 KRW/mes ofrecemos una sala premium insonorizada y 8 beneficios (descuento en estudio, distribución gratuita, apoyo con comunicados de prensa, alquiler de equipo de busking, etc.).',
    },
    {
      question: '¿Qué equipo tienen?',
      answer: 'Contamos con equipo premium como Neumann U87AI, AKG C414 XLS, preamplificador Vintech X73i, interfaz Prism Sound Lyra 2 y procesador SSL Fusion.',
    },
    {
      question: '¿Ofrecen distribución musical?',
      answer: 'Sí, para miembros residentes ofrecemos distribución global gratuita (Spotify, Apple Music, etc.) vía Audioguy, y entregamos el 70% de las ganancias netas al artista.',
    },
    {
      question: '¿Dónde puedo grabar una canción para una boda o evento?',
      answer: 'Studio NOL ofrece un paquete de grabación vocal para bodas/eventos por 350.000 KRW — grabación, mezcla y masterización incluidas en una sola sesión. A 5 minutos a pie de la estación Yeonsinnae.',
    },
    {
      question: '¿Cómo reservo el estudio de grabación?',
      answer: `Puedes reservar a través de KakaoTalk (canal: Studio NOL), por teléfono (${CANONICAL_FACTS.phone}) o el formulario de contacto en nuestra web. Las reservas el mismo día son posibles y estamos disponibles los fines de semana y festivos.`,
    },
    {
      question: '¿Pueden grabar personas sin experiencia?',
      answer: 'Absolutamente. Todos son bienvenidos. Un ingeniero dedicado acompaña cada sesión — configuración del micrófono, dirección vocal y entrega de archivos finales — para que los principiantes logren resultados de calidad profesional. (No ofrecemos auto-grabación ni alquiler por horas.)',
    },
    {
      question: '¿Está disponible el alquiler a corto plazo de la sala de práctica?',
      answer: 'Nuestra sala opera únicamente con un programa de residencia mensual (desde 360.000 KRW/mes). No ofrecemos alquiler por horas ni a corto plazo.',
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
      answer: 'Mastering 100.000 KRW/bài. Thực hiện theo chuẩn Spotify, Apple Music, v.v.',
    },
    {
      question: 'Có chương trình phòng tập cư trú không?',
      answer: 'Có, từ 360.000 KRW/tháng cho phòng tập cách âm cao cấp và 8 quyền lợi (giảm giá phòng thu, phát hành miễn phí, hỗ trợ thông cáo báo chí, thuê thiết bị busking, v.v.).',
    },
    {
      question: 'Có những thiết bị nào?',
      answer: 'Trang bị Neumann U87AI, AKG C414 XLS, preamp Vintech X73i, interface Prism Sound Lyra 2, bộ xử lý SSL Fusion, v.v.',
    },
    {
      question: 'Có dịch vụ phát hành nhạc không?',
      answer: 'Có. Khách cư trú được phát hành toàn cầu miễn phí (Spotify, Apple Music, YouTube Music, v.v.) qua Audioguy và nhận 70% lợi nhuận ròng.',
    },
    {
      question: 'Có thể thu âm bài hát chúc mừng đám cưới ở đâu?',
      answer: 'Studio NOL cung cấp gói thu âm bài chúc mừng đám cưới/sự kiện với giá 350.000 KRW — bao gồm thu âm, mixing và mastering trong một lần. Cách ga Yeonsinnae 5 phút đi bộ.',
    },
    {
      question: 'Làm thế nào để đặt phòng thu?',
      answer: `Bạn có thể đặt qua KakaoTalk (kênh: Studio NOL), điện thoại (${CANONICAL_FACTS.phone}) hoặc form liên hệ trên website. Đặt trong ngày được, và chúng tôi mở cửa cả cuối tuần và ngày lễ.`,
    },
    {
      question: 'Người không chuyên có thể sử dụng phòng thu không?',
      answer: 'Hoàn toàn có thể. Tất cả mọi người đều được chào đón. Mọi phiên thu âm đều có kỹ sư chuyên trách đồng hành — cài micro, định hướng giọng hát và bàn giao file hoàn chỉnh, giúp người lần đầu thu âm cũng có kết quả chất lượng cao. (Không cung cấp dịch vụ tự thu âm và thuê theo giờ.)',
    },
    {
      question: 'Có thể thuê phòng tập ngắn hạn không?',
      answer: 'Phòng tập chỉ hoạt động theo chương trình cư trú hàng tháng (từ 360.000 KRW/tháng). Không cung cấp thuê ngắn hạn hoặc theo giờ.',
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
      answer: 'มาสเตอริ่ง 100,000 วอน/เพลง ทำตามมาตรฐาน Spotify, Apple Music ฯลฯ',
    },
    {
      question: 'มีโปรแกรมห้องซ้อมรายเดือนหรือไม่?',
      answer: 'เดือนละ 360,000 วอนขึ้นไป ได้ห้องซ้อมกันเสียงระดับพรีเมียมและสิทธิประโยชน์ 8 อย่าง (ส่วนลดสตูดิโอ, แจกจ่ายเพลงฟรี, ช่วยเขียนข่าวประชาสัมพันธ์, เช่าอุปกรณ์บัสกิ้ง ฯลฯ)',
    },
    {
      question: 'มีอุปกรณ์อะไรบ้าง?',
      answer: 'มีอุปกรณ์ระดับพรีเมียม เช่น ไมค์ Neumann U87AI, AKG C414 XLS, พรีแอมป์ Vintech X73i, อินเทอร์เฟซ Prism Sound Lyra 2 และโปรเซสเซอร์ SSL Fusion เป็นต้น',
    },
    {
      question: 'มีบริการจัดจำหน่ายเพลงไหม?',
      answer: 'มี สำหรับสมาชิกที่พักประจำ เราให้บริการจัดจำหน่ายทั่วโลกฟรีผ่าน Audioguy (Spotify, Apple Music, YouTube Music ฯลฯ) และแบ่งรายได้สุทธิ 70% ให้ศิลปิน',
    },
    {
      question: 'จะบันทึกเพลงอวยพรงานแต่งงานได้ที่ไหน?',
      answer: 'Studio NOL มีแพ็กเกจบันทึกเสียงเพลงอวยพรงานแต่งงาน/งานอีเวนต์ราคา 350,000 วอน ครอบคลุมการอัด มิกซ์ และมาสเตอริ่งในครั้งเดียว ห่างจากสถานี Yeonsinnae เพียง 5 นาที',
    },
    {
      question: 'จะจองห้องอัดได้อย่างไร?',
      answer: `จองได้ผ่าน KakaoTalk (ช่อง: Studio NOL), โทรศัพท์ (${CANONICAL_FACTS.phone}) หรือฟอร์มติดต่อบนเว็บไซต์ รับจองในวันเดียวกัน และเปิดให้บริการทั้งวันหยุดสุดสัปดาห์และวันหยุดนักขัตฤกษ์`,
    },
    {
      question: 'คนทั่วไป (บันทึกเสียงเอง) ใช้ห้องอัดได้ไหม?',
      answer: 'ได้แน่นอน ทุกคนยินดีต้อนรับ วิศวกรประจำจะดูแลตั้งแต่เซ็ตอัพไมค์ ชี้แนะการร้อง ไปจนถึงส่งมอบไฟล์สำเร็จ ทำให้แม้แต่มือใหม่ก็ได้ผลลัพธ์ระดับมืออาชีพ',
    },
    {
      question: 'เช่าห้องซ้อมระยะสั้นได้ไหม?',
      answer: 'ห้องซ้อมของเราดำเนินการแบบโปรแกรมรายเดือนเท่านั้น (เริ่มต้น 360,000 วอน/เดือน) ไม่ได้ให้บริการเช่าระยะสั้นหรือรายชั่วโมง',
    },
  ],
  uz: [
    {
      question: 'Studio NOL qayerda joylashgan?',
      answer: "Biz Seul sh., Eunpyeong-gu, Daejo-dong 84-3, 3\u2011qavatda joylashganmiz (Dongmyeong qizlar maktabi yonida). 6\u2011yo'nalishdagi Bulgwang bekati 7\u2011chi chiqishidan yoki Yeonsinnae bekatidan 5 daqiqada piyoda.",
    },
    {
      question: 'Yozuv studiyasi narxi qancha?',
      answer: 'Yozuv 100,000 KRW/soat, minimal 2 soat. 6 soatlik paket (Day Lock) 500,000 KRW (taxm. 17% chegirma). Professional muhandislik kiritilgan.',
    },
    {
      question: 'Miks xizmatlari narxi qanday?',
      answer: "Track soniga bog'liq. 10 trackgacha 200,000 KRW, 11–30 track 350,000 KRW, 31+ track 500,000 KRW. 2 ta asosiy tahrir kiritilgan.",
    },
    {
      question: 'Mastering narxi qancha?',
      answer: "Mastering 100,000 KRW/qo'shiq. Spotify, Apple Music kabi platformalar standartiga mos.",
    },
    {
      question: "Mashg'ulot xonasi rezident dasturi bormi?",
      answer: "Ha. Oyiga 360,000 KRW dan premium ovoz izolyatsiyali mashg'ulot xonasi va 8 ta imtiyoz (studiyada chegirma, bepul tarqatish, press-reliz qo'llovi, busking uskunalari ijarasi va h.k.) beriladi.",
    },
    {
      question: 'Qanday uskunalar bor?',
      answer: 'Neumann U87AI, AKG C414 XLS mikrofonlari, Vintech X73i preamp, Prism Sound Lyra 2 interfeys, SSL Fusion protsessori kabi premium analog/raqamli uskunalar mavjud.',
    },
    {
      question: 'Musiqa tarqatish xizmati ham bormi?',
      answer: "Ha. Rezident mijozlar Audioguy orqali global platformalarga (Spotify, Apple Music, YouTube Music va b.) bepul tarqatish xizmatini oladi va sof daromadning 70% san'atkorga beriladi.",
    },
    {
      question: "To'y qo'shig'ini qayerda yozib olish mumkin?",
      answer: "Studio NOL to'y/tadbir uchun maxsus vokal yozish paketi taklif etadi — 350,000 KRW, yozish, miks va mastering kiritilgan, bir borish yetarli. Yeonsinnae bekatidan 5 daqiqada.",
    },
    {
      question: "Yozuv studiyasini qanday band qilish mumkin?",
      answer: `KakaoTalk (kanal: Studio NOL), telefon (${CANONICAL_FACTS.phone}) yoki veb-saytdagi murojaat formasi orqali band qilishingiz mumkin. Bir kunlik band ham mumkin, dam olish va bayram kunlarida ham ishlaydi.`,
    },
    {
      question: "Oddiy odamlar (mustaqil yozish) studiyadan foydalana oladimi?",
      answer: "Ha, albatta. Hamma xush kelibsiz. Muhandis mikrofonni sozlashdan vokal yo'naltirishgacha va tayyor fayllarni topshirishgacha barcha jarayonda yordam beradi, birinchi marta yozayotganlar ham yuqori sifatli natija oladi.",
    },
    {
      question: "Mashg'ulot xonasini qisqa muddatga ijaraga olish mumkinmi?",
      answer: "Mashgʻulot xonasi faqat oylik rezident dastur (360,000 KRW/oy dan) asosida ishlaydi. Qisqa muddatli yoki soatbay ijara taklif etilmaydi.",
    },
  ]
};

export const getFaqData = (locale: Locale) => {
  return faqData[locale] || faqData['ko']; // Fallback to Korean if translation missing
};

// Page-specific FAQ filters for SEO rich snippets
export const getStudioFaqData = (locale: Locale) => {
  const allFaq = getFaqData(locale);
  const studioKeywords = [
    // Korean
    '장비', '스튜디오', '녹음실', '축가', '예약', '일반인', '셀프',
    // English
    'equipment', 'studio', 'gear', 'wedding', 'book', 'non-professional',
    // Chinese
    '设备', '录音室', '祝歌', '预约',
    // Spanish
    'equipo', 'estudio', 'boda', 'reserv',
    // Vietnamese
    'thiết bị', 'phòng thu', 'chúc mừng', 'đặt',
    // Thai
    'อุปกรณ์', 'สตูดิโอ', 'อวยพร', 'จอง',
    // Uzbek
    'uskunalar', 'studiya', 'to\'y', 'band'
  ];
  return allFaq.filter(faq =>
    studioKeywords.some(keyword =>
      faq.question.toLowerCase().includes(keyword.toLowerCase()) ||
      faq.answer.toLowerCase().includes(keyword.toLowerCase())
    )
  );
};

// Hub page locale-specific content blocks for thin-content mitigation
export interface HubLocaleContentItem {
  heading: string;
  body: string;
}

export interface HubLocaleContent {
  hubKey: string;
  title: string;
  items: HubLocaleContentItem[];
}

const hubLocaleContentData: Record<Locale, HubLocaleContent[]> = {
  ko: [], // Korean hub pages use full native content — no locale block needed
  // 2026-07-28 전면 재작성. 이전 내용은 실재하지 않는 서비스를 6개 언어로 광고하고 있었다
  // (존재하지 않는 예술인 비자·저작권 등록 대행 지원, 실재하지 않는 보컬 레슨, 미지원 결제수단, 각 언어 상주 인력 등).
  // 지금은 저장소 SSOT로 검증되는 사실만 쓴다 — 영어 제공 범위는 예약 응대와 원격 믹싱·마스터링뿐이다.
  en: [
    {
      hubKey: 'about',
      title: 'Working with Studio NOL from Abroad',
      items: [
        {
          heading: 'Mixing and Mastering, Handled Remotely',
          body: 'You do not need to be in Seoul. Send your dry vocal and instrumental tracks as WAV files over KakaoTalk, Google Drive, or WeTransfer, and we return the finished master the same way. Quotes, mix notes, and revision requests are all handled in English.'
        },
        {
          heading: 'Turnaround and Revisions',
          body: 'Finished files are delivered within 3 to 7 business days of receiving your tracks. Mixing includes two revision rounds and mastering includes one.'
        },
        {
          heading: 'Distribution',
          body: 'Release production packages include distribution to Spotify, Apple Music, YouTube Music and other platforms through our Audioguy partnership, and you keep 70% of your streaming revenue.'
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: 'What the Lesson Actually Covers',
      items: [
        {
          heading: 'Production, Not Performance',
          body: 'The lesson teaches music production: MIDI composition and arrangement, recording technique, mixing, mastering, and releasing your track to streaming platforms. We do not teach vocal or instrumental performance — if you want singing lessons, work with a vocal coach and come to us for the production side.'
        },
        {
          heading: 'Format and Pace',
          body: 'One 60-minute private session per week, four sessions a month. The recommended path is six months: three months to finish one song of your own, then three months through mixing, mastering, and release. Lessons are taught in Korean.'
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: 'Pricing, Stated Up Front',
      items: [
        {
          heading: 'Every Rate Is Published',
          body: 'Recording, mixing, mastering, lessons, and the practice room all have posted prices on this site — nothing is quote-only. All prices exclude VAT.'
        },
        {
          heading: 'What Is Not Included',
          body: 'Mixing covers balance, tone, and effects with two revisions. Detailed vocal tuning and timing correction is a separate 150,000 KRW per song. Session musicians, arrangement, and press outreach on release projects are quoted per project.'
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: 'The Room and the Gear',
      items: [
        {
          heading: 'Microphones and Signal Chain',
          body: 'Neumann U87Ai and AKG C414 XLS condensers, Shure SM58 and SM57 dynamics, a Vintech X73i preamp in the Neve 1073 tradition, and Prism Sound Lyra 2 conversion. A Yamaha U3 upright piano is available for acoustic recording.'
        },
        {
          heading: 'Monitoring',
          body: 'Mixes are checked across three monitor pairs — Proac Tablett 50, EVE Audio SC207, and ADAM Audio A5 — alongside SSL Fusion, Tegeler Vari Tube, and SPL Optimizer outboard.'
        }
      ]
    }
  ],
  zh: [
    {
      hubKey: 'about',
      title: '身在海外，也能与 Studio NOL 合作',
      items: [
        {
          heading: '远程完成混音与母带处理',
          body: '不必人在首尔。通过 KakaoTalk、Google Drive 或 WeTransfer 发送人声干声与伴奏的 WAV 文件即可，完成后的母带也会以同样方式交还给您。报价、混音说明和修改需求均以英文沟通。'
        },
        {
          heading: '交付周期与修改次数',
          body: '收到您的音轨后，3~7个工作日内交付完成文件。混音含2次修改，母带处理含1次修改。'
        },
        {
          heading: '发行',
          body: '发行制作套餐通过我们与 Audioguy 的合作，将作品发行至 Spotify、Apple Music、YouTube Music 等平台，净收益的70%归您所有。'
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: '课程实际教什么',
      items: [
        {
          heading: '教制作，不教演唱',
          body: '课程教授的是音乐制作：MIDI作曲编曲、录音技术、混音、母带处理，以及将作品发行到流媒体平台的全过程。我们不教授演唱或乐器演奏技巧——如果您需要歌唱指导，请另寻歌唱老师，制作部分再来找我们。'
        },
        {
          heading: '课程形式与进度',
          body: '每周1次60分钟一对一课程，每月共4次。建议周期为6个月：前3个月完成一首属于自己的单曲，后3个月完成混音、母带处理与发行。课程以韩语授课。'
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: '价格提前公开',
      items: [
        {
          heading: '所有价格均公开标示',
          body: '录音、混音、母带处理、课程和练习室的价格都公开标示在本网站上，没有“仅限报价”的项目。所有价格均不含增值税。'
        },
        {
          heading: '不包含的项目',
          body: '混音服务涵盖平衡、音色和效果处理，含2次修改。精细的人声调音与节奏校正需另加150,000韩元/首。发行项目中的会话乐手、编曲和媒体宣传按项目单独报价。'
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: '录音室与设备',
      items: [
        {
          heading: '麦克风与信号链',
          body: '配备 Neumann U87Ai 和 AKG C414 XLS 电容麦克风、Shure SM58 和 SM57 动圈麦克风、承袭 Neve 1073 血统的 Vintech X73i 前级，以及 Prism Sound Lyra 2 音频接口。此外还有 Yamaha U3 立式钢琴，可供原声录音使用。'
        },
        {
          heading: '监听',
          body: '混音会在 Proac Tablett 50、EVE Audio SC207、ADAM Audio A5 三组监听音箱间交叉核对，并配合 SSL Fusion、Tegeler Vari Tube、SPL Optimizer 等外部处理设备。'
        }
      ]
    }
  ],
  es: [
    {
      hubKey: 'about',
      title: 'Trabajar con Studio NOL desde el extranjero',
      items: [
        {
          heading: 'Mezcla y masterización remotas',
          body: 'No hace falta estar en Seúl. Envía tus pistas de voz limpia e instrumental en WAV por KakaoTalk, Google Drive o WeTransfer, y te devolvemos el máster terminado por el mismo medio. El presupuesto, las notas de mezcla y las solicitudes de revisión se gestionan en inglés.'
        },
        {
          heading: 'Plazos de entrega y revisiones',
          body: 'Entregamos los archivos terminados entre 3 y 7 días hábiles después de recibir tus pistas. La mezcla incluye 2 rondas de revisión y la masterización, 1.'
        },
        {
          heading: 'Distribución',
          body: 'Los paquetes de producción para lanzamiento incluyen distribución a Spotify, Apple Music, YouTube Music y otras plataformas a través de nuestra alianza con Audioguy, y te quedas con el 70% de tus ingresos por streaming.'
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: 'Qué cubre realmente la clase',
      items: [
        {
          heading: 'Producción, no interpretación',
          body: 'La clase enseña producción musical: composición y arreglos en MIDI, técnica de grabación, mezcla, masterización y cómo lanzar tu tema a las plataformas de streaming. No enseñamos técnica vocal ni interpretación instrumental — si buscas clases de canto, trabaja con un coach vocal y ven a nosotros para la parte de producción.'
        },
        {
          heading: 'Formato y ritmo',
          body: 'Una sesión privada de 60 minutos por semana, 4 sesiones al mes. El plan recomendado es de 6 meses: 3 meses para terminar un tema propio, y otros 3 meses hasta la mezcla, masterización y lanzamiento. Las clases se imparten en coreano.'
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: 'Precios claros desde el principio',
      items: [
        {
          heading: 'Todas las tarifas están publicadas',
          body: 'La grabación, la mezcla, la masterización, las clases y la sala de práctica tienen precios publicados en este sitio — nada funciona solo por presupuesto. Todos los precios excluyen el IVA.'
        },
        {
          heading: 'Qué no incluye el precio',
          body: 'La mezcla cubre balance, tono y efectos, con 2 revisiones. La afinación vocal detallada y la corrección de tiempo cuestan aparte, 150.000 KRW por canción. Los músicos de sesión, el arreglo y la difusión con medios en proyectos de lanzamiento se cotizan por proyecto.'
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: 'La sala y el equipo',
      items: [
        {
          heading: 'Micrófonos y cadena de señal',
          body: 'Condensadores Neumann U87Ai y AKG C414 XLS, dinámicos Shure SM58 y SM57, un preamplificador Vintech X73i dentro de la tradición Neve 1073, y conversión Prism Sound Lyra 2. También contamos con un piano vertical Yamaha U3 para grabación acústica.'
        },
        {
          heading: 'Monitoreo',
          body: 'Las mezclas se revisan en tres pares de monitores — Proac Tablett 50, EVE Audio SC207 y ADAM Audio A5 — junto con outboard SSL Fusion, Tegeler Vari Tube y SPL Optimizer.'
        }
      ]
    }
  ],
  vi: [
    {
      hubKey: 'about',
      title: 'Làm việc với Studio NOL từ nước ngoài',
      items: [
        {
          heading: 'Mixing và Mastering từ xa',
          body: 'Bạn không cần có mặt tại Seoul. Gửi track vocal khô và instrumental dạng WAV qua KakaoTalk, Google Drive hoặc WeTransfer, chúng tôi sẽ gửi lại bản master hoàn thiện theo cách tương tự. Báo giá, ghi chú mixing và yêu cầu sửa đều trao đổi bằng tiếng Anh.'
        },
        {
          heading: 'Thời gian giao và số lần sửa',
          body: 'Sau khi nhận track của bạn, chúng tôi giao file hoàn thiện trong 3-7 ngày làm việc. Mixing gồm 2 lần sửa, mastering gồm 1 lần.'
        },
        {
          heading: 'Phát hành',
          body: 'Gói sản xuất phát hành bao gồm phân phối đến Spotify, Apple Music, YouTube Music và các nền tảng khác qua đối tác Audioguy, và bạn giữ 70% doanh thu streaming của mình.'
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: 'Khóa học thực sự dạy gì',
      items: [
        {
          heading: 'Dạy sản xuất, không dạy trình diễn',
          body: 'Khóa học dạy sản xuất âm nhạc: sáng tác và phối khí MIDI, kỹ thuật thu âm, mixing, mastering, và phát hành track của bạn lên các nền tảng streaming. Chúng tôi không dạy kỹ thuật hát hay chơi nhạc cụ — nếu bạn muốn học hát, hãy tìm một vocal coach, rồi quay lại đây cho phần sản xuất.'
        },
        {
          heading: 'Hình thức và tiến độ học',
          body: '1 buổi riêng 60 phút mỗi tuần, 4 buổi mỗi tháng. Lộ trình khuyên dùng là 6 tháng: 3 tháng đầu hoàn thiện một track của riêng bạn, 3 tháng sau đi qua mixing, mastering và phát hành. Lớp học dạy bằng tiếng Hàn.'
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: 'Giá cả công khai ngay từ đầu',
      items: [
        {
          heading: 'Mọi mức giá đều được công khai',
          body: 'Thu âm, mixing, mastering, khóa học và phòng tập đều có giá niêm yết trên trang này — không có mục nào chỉ báo giá riêng. Tất cả giá đều chưa gồm VAT.'
        },
        {
          heading: 'Những gì không nằm trong giá',
          body: 'Mixing bao gồm cân bằng, tông màu và hiệu ứng, với 2 lần sửa. Chỉnh giọng chi tiết và sửa timing tính riêng, 150.000 KRW/bài. Nhạc công session, phối khí và tiếp cận báo chí trong các dự án phát hành được báo giá theo từng dự án.'
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: 'Phòng thu và thiết bị',
      items: [
        {
          heading: 'Micro và chuỗi tín hiệu',
          body: 'Micro condenser Neumann U87Ai và AKG C414 XLS, micro dynamic Shure SM58 và SM57, preamp Vintech X73i theo phong cách Neve 1073, và bộ chuyển đổi Prism Sound Lyra 2. Ngoài ra còn có piano đứng Yamaha U3 cho thu âm mộc.'
        },
        {
          heading: 'Giám sát âm thanh (Monitor)',
          body: 'Bản mix được kiểm tra qua ba cặp loa monitor — Proac Tablett 50, EVE Audio SC207 và ADAM Audio A5 — cùng với outboard SSL Fusion, Tegeler Vari Tube và SPL Optimizer.'
        }
      ]
    }
  ],
  th: [
    {
      hubKey: 'about',
      title: 'ทำงานกับ Studio NOL จากต่างประเทศ',
      items: [
        {
          heading: 'มิกซ์และมาสเตอริ่งทางไกล',
          body: 'คุณไม่จำเป็นต้องอยู่ที่โซล ส่งแทร็กเสียงร้องดิบและแทร็กดนตรีเป็นไฟล์ WAV ผ่าน KakaoTalk, Google Drive หรือ WeTransfer แล้วเราจะส่งมาสเตอร์ที่เสร็จสมบูรณ์กลับให้ด้วยวิธีเดียวกัน ใบเสนอราคา บันทึกการมิกซ์ และคำขอแก้ไขทั้งหมดสื่อสารเป็นภาษาอังกฤษ'
        },
        {
          heading: 'ระยะเวลาส่งงานและการแก้ไข',
          body: 'หลังจากได้รับแทร็กของคุณ เราจะส่งไฟล์ที่เสร็จสมบูรณ์ภายใน 3-7 วันทำการ มิกซ์รวมแก้ไข 2 ครั้ง มาสเตอร์รวมแก้ไข 1 ครั้ง'
        },
        {
          heading: 'การจัดจำหน่าย',
          body: 'แพ็กเกจโปรดักชันเพื่อปล่อยเพลงรวมการจัดจำหน่ายไปยัง Spotify, Apple Music, YouTube Music และแพลตฟอร์มอื่นๆ ผ่านพันธมิตร Audioguy ของเรา และคุณจะได้รับ 70% ของรายได้จากสตรีมมิ่ง'
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: 'คอร์สนี้สอนอะไรจริงๆ',
      items: [
        {
          heading: 'สอนโปรดักชัน ไม่ใช่การแสดง',
          body: 'คอร์สนี้สอนการโปรดักชันเพลง ได้แก่ การแต่งเพลงและเรียบเรียงด้วย MIDI เทคนิคการบันทึกเสียง มิกซ์ มาสเตอริ่ง และการปล่อยเพลงของคุณลงแพลตฟอร์มสตรีมมิ่ง เราไม่สอนเทคนิคการร้องหรือการเล่นเครื่องดนตรี — หากต้องการเรียนร้องเพลง ให้หาครูสอนร้องแยกต่างหาก แล้วมาหาเราสำหรับส่วนโปรดักชัน'
        },
        {
          heading: 'รูปแบบและจังหวะการเรียน',
          body: 'เรียนส่วนตัวสัปดาห์ละ 1 ครั้ง ครั้งละ 60 นาที เดือนละ 4 ครั้ง แผนที่แนะนำคือ 6 เดือน: 3 เดือนแรกทำเพลงของคุณเองให้เสร็จ 1 เพลง จากนั้น 3 เดือนถัดไปคือมิกซ์ มาสเตอริ่ง และปล่อยเพลง คอร์สสอนเป็นภาษาเกาหลี'
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: 'ราคาที่เปิดเผยตั้งแต่ต้น',
      items: [
        {
          heading: 'ทุกราคาเปิดเผยต่อสาธารณะ',
          body: 'การบันทึกเสียง มิกซ์ มาสเตอริ่ง คอร์สเรียน และห้องซ้อม ล้วนมีราคาที่ระบุไว้บนเว็บไซต์นี้ — ไม่มีรายการใดที่ต้องขอใบเสนอราคาเท่านั้น ราคาทั้งหมดไม่รวม VAT'
        },
        {
          heading: 'สิ่งที่ไม่รวมอยู่ในราคา',
          body: 'มิกซ์ครอบคลุมบาลานซ์ โทนเสียง และเอฟเฟกต์ พร้อมแก้ไข 2 ครั้ง การจูนเสียงร้องแบบละเอียดและการแก้ timing คิดแยก 150,000 วอนต่อเพลง นักดนตรีเซสชัน การเรียบเรียง และการประชาสัมพันธ์สื่อในโปรเจกต์ปล่อยเพลง คิดราคาตามแต่ละโปรเจกต์'
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: 'ห้องอัดและอุปกรณ์',
      items: [
        {
          heading: 'ไมโครโฟนและสัญญาณเสียง',
          body: 'ไมค์คอนเดนเซอร์ Neumann U87Ai และ AKG C414 XLS ไมค์ไดนามิก Shure SM58 และ SM57 ปรีแอมป์ Vintech X73i ในสาย Neve 1073 และตัวแปลงสัญญาณ Prism Sound Lyra 2 นอกจากนี้ยังมีเปียโนตั้ง Yamaha U3 สำหรับบันทึกเสียงอะคูสติก'
        },
        {
          heading: 'มอนิเตอร์',
          body: 'การมิกซ์จะถูกตรวจสอบข้ามลำโพงมอนิเตอร์ 3 คู่ — Proac Tablett 50, EVE Audio SC207 และ ADAM Audio A5 — พร้อมกับเอาต์บอร์ด SSL Fusion, Tegeler Vari Tube และ SPL Optimizer'
        }
      ]
    }
  ],
  uz: [
    {
      hubKey: 'about',
      title: "Chet eldan Studio NOL bilan ishlash",
      items: [
        {
          heading: "Miks va mastering — masofadan",
          body: "Seulda bo'lishingiz shart emas. Vokal va instrumental treklaringizni WAV formatida KakaoTalk, Google Drive yoki WeTransfer orqali yuboring, tayyor masterni ham xuddi shu tarzda qaytarib beramiz. Narx taklifi, miks bo'yicha izohlar va tuzatish so'rovlari ingliz tilida olib boriladi."
        },
        {
          heading: "Yetkazib berish muddati va tuzatishlar",
          body: "Treklaringizni qabul qilgandan so'ng, tayyor fayllarni 3-7 ish kuni ichida yetkazamiz. Miksda 2 marta, masteringda 1 marta tuzatish kiritilgan."
        },
        {
          heading: "Tarqatish",
          body: "Reliz uchun prodakshn paketlari Audioguy hamkorligimiz orqali Spotify, Apple Music, YouTube Music va boshqa platformalarga tarqatishni o'z ichiga oladi, va siz streaming daromadingizning 70% ni saqlab qolasiz."
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: "Dars aslida nimani qamrab oladi",
      items: [
        {
          heading: "Prodakshn, ijro emas",
          body: "Dars musiqa prodakshnini o'rgatadi: MIDI bastakorlik va aranjirovka, yozuv texnikasi, miks, mastering va trekingizni streaming platformalariga chiqarish. Biz vokal yoki instrument ijrosini o'rgatmaymiz — agar qo'shiq aytish darslari kerak bo'lsa, vokal murabbiyi bilan ishlang va prodakshn qismi uchun bizga keling."
        },
        {
          heading: "Format va sur'at",
          body: "Haftada 1 marta 60 daqiqalik shaxsiy dars, oyiga 4 dars. Tavsiya etilgan yo'l — 6 oy: birinchi 3 oyda o'zingizning bitta qo'shig'ingizni yakunlash, keyingi 3 oyda miks, mastering va relizgacha. Darslar koreys tilida o'tiladi."
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: "Narxlar oldindan ochiq e'lon qilingan",
      items: [
        {
          heading: "Har bir narx e'lon qilingan",
          body: "Yozuv, miks, mastering, darslar va mashg'ulot xonasining barchasi ushbu saytda e'lon qilingan narxlarga ega — hech narsa faqat so'rov bo'yicha emas. Barcha narxlar VATsiz ko'rsatilgan."
        },
        {
          heading: "Narxga kirmaydigan narsalar",
          body: "Miks balans, ton va effektlarni qamrab oladi, 2 marta tuzatish bilan. Batafsil vokal tuning va timing tuzatish alohida — qo'shiq boshiga 150,000 KRW. Reliz loyihalaridagi sessiya musiqachilari, aranjirovka va OAVga yetkazish har bir loyiha uchun alohida taklif qilinadi."
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: "Xona va uskunalar",
      items: [
        {
          heading: "Mikrofonlar va signal zanjiri",
          body: "Neumann U87Ai va AKG C414 XLS kondensator mikrofonlari, Shure SM58 va SM57 dinamik mikrofonlari, Neve 1073 an'analaridagi Vintech X73i preamp va Prism Sound Lyra 2 konvertatsiya. Akustik yozuv uchun Yamaha U3 pianino ham mavjud."
        },
        {
          heading: "Monitoring",
          body: "Mikslar uchta monitor jufti — Proac Tablett 50, EVE Audio SC207 va ADAM Audio A5 — orqali tekshiriladi, shuningdek SSL Fusion, Tegeler Vari Tube va SPL Optimizer outboard uskunalari bilan."
        }
      ]
    }
  ]
};

/** Get locale-specific content blocks for hub pages (about, lesson, pricing, studio-info) */
export const getHubLocaleContent = (locale: Locale, hubKey: string): HubLocaleContent | null => {
  const allContent = hubLocaleContentData[locale] || [];
  return allContent.find(c => c.hubKey === hubKey) || null;
};
