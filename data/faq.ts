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
    '유통', '배포', '멜론', '지니', '유튜브 뮤직', '애플뮤직',
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
  en: [
    {
      hubKey: 'about',
      title: 'For International Artists in Seoul',
      items: [
        {
          heading: 'Artist Visa (C-4) & KOMCA Registration',
          body: 'Navigating Korean immigration and copyright law can be complex. We guide you through the C-4 artist visa process and Korean Music Copyright Association (KOMCA) registration, so you can focus on making music.'
        },
        {
          heading: 'Bilingual Studio Experience',
          body: 'All communication is in clear English. Our engineers document every session in writing, and we provide contract templates in English for your peace of mind.'
        },
        {
          heading: 'Global Distribution Included',
          body: 'Every production package includes free distribution to Spotify, Apple Music, YouTube Music, and more through our Audioguy partnership. Keep 70% of your streaming revenue.'
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: 'Music Lessons Tailored for Foreign Artists',
      items: [
        {
          heading: 'K-pop Vocal Technique & Korean Language',
          body: 'Our curriculum covers K-pop vocal techniques, Korean pronunciation for lyrics, and performance styling. Whether you\'re preparing for a debut or recording your first single, we build the skills you need.'
        },
        {
          heading: 'Flexible Scheduling for Touring Artists',
          body: 'We offer weekend and evening lessons to accommodate touring schedules. Intensive crash courses are available for artists preparing for an upcoming release.'
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: 'Transparent Pricing for International Clients',
      items: [
        {
          heading: 'Multiple Payment Options',
          body: 'Pay by bank transfer (local Korean banks), credit card, or PayPal. We provide detailed invoices in English for your accounting and tax records.'
        },
        {
          heading: 'No Hidden Fees',
          body: 'All prices include professional engineering. Session photos and a summary report are included with every booking. What you see is what you pay.'
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: 'Equipment You\'ll Actually Use',
      items: [
        {
          heading: 'Microphone Selection Guide',
          body: 'Not sure which mic is right for your voice? Our engineers provide a free 15-minute consultation to match your vocal style with the perfect microphone — from the Neumann U87AI for warm vocals to the AKG C414 for bright acoustic instruments.'
        },
        {
          heading: 'Genre-Specific Setup Recommendations',
          body: 'Whether you\'re recording hip-hop, ballad, rock, or electronic music, we have genre-tailored equipment setups. Tell us your genre and we\'ll prepare the optimal signal chain before you arrive.'
        }
      ]
    }
  ],
  zh: [
    {
      hubKey: 'about',
      title: '在韩中国音乐人专属服务',
      items: [
        {
          heading: '签证与KOMCA版权登记支持',
          body: '从C-4艺术家签证申请到韩国音乐著作权协会(KOMCA)登记，我们全程协助。让您安心专注于音乐创作。'
        },
        {
          heading: '微信付款 · 中文服务',
          body: '支持微信支付和支付宝。中文工作人员常驻，合同、会话记录全部提供中文版本。'
        },
        {
          heading: '中国平台发行',
          body: '支持网易云音乐、QQ音乐、酷狗等中国主流平台发行。让您的音乐触达中国听众。'
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: '中国音乐人专属课程',
      items: [
        {
          heading: 'K-pop声乐技巧与韩语发音',
          body: '课程涵盖K-pop声乐技巧、韩语歌词发音、舞台表演风格。无论您是准备出道还是录制第一首单曲，我们帮您建立所需技能。'
        },
        {
          heading: '巡演艺术家灵活安排',
          body: '提供周末和晚间课程，适应巡演日程。为即将发行的艺术家提供强化速成课程。'
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: '中国客户专属价格方案',
      items: [
        {
          heading: '中国支付方式',
          body: '支持微信支付、支付宝、银联卡付款。提供中文发票，方便您的财务和税务记录。'
        },
        {
          heading: '中国平台发行套餐',
          body: '新增网易云音乐、QQ音乐、酷狗平台发行套餐。让您的音乐触达中国数亿听众。'
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: '适合中国音乐人的设备配置',
      items: [
        {
          heading: '中文设备使用指南',
          body: '提供中文设备使用手册。从麦克风选择到效果器设置，中文工作人员全程指导。'
        },
        {
          heading: '华语流行音乐专用设置',
          body: '针对华语流行音乐特点，我们准备了专门的麦克风、前置放大器和效果器组合，还原您想要的声音。'
        }
      ]
    }
  ],
  es: [
    {
      hubKey: 'about',
      title: 'Para Artistas Latinoamericanos en Corea',
      items: [
        {
          heading: 'Visa de Artista (C-4) y Registro KOMCA',
          body: 'El proceso de inmigración coreano y el registro de derechos de autor pueden ser complejos. Le guiamos desde la visa C-4 hasta el registro en la Korean Music Copyright Association (KOMCA), para que pueda concentrarse en crear música.'
        },
        {
          heading: 'Experiencia en Estudio en Español',
          body: 'Toda la comunicación es en español. Nuestros ingenieros documentan cada sesión por escrito, y proporcionamos plantillas de contrato en español para su tranquilidad.'
        },
        {
          heading: 'Distribución Global Incluida',
          body: 'Cada paquete de producción incluye distribución gratuita a Spotify, Apple Music, YouTube Music y más a través de nuestra asociación con Audioguy. Quedarse con el 70% de sus ingresos por streaming.'
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: 'Lecciones de Música para Artistas Extranjeros',
      items: [
        {
          heading: 'Técnica Vocal K-pop y Español',
          body: 'Nuestro currículo cubre técnicas vocales de K-pop, pronunciación coreana para letras, y estilo de actuación. Si se prepara para un debut o grabando su primer sencillo, construimos las habilidades que necesita.'
        },
        {
          heading: 'Horarios Flexibles para Artistas en Giro',
          body: 'Ofrecemos lecciones de fines de semana y noches para adaptarse a horarios de gira. Cursos intensivos disponibles para artistas que se preparan para un lanzamiento próximo.'
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: 'Precios Transparentes para Clientes Internacionales',
      items: [
        {
          heading: 'Múltiples Opciones de Pago',
          body: 'Pague por transferencia bancaria (bancos coreanos locales), tarjeta de crédito o PayPal. Proporcionamos facturas detalladas en español para su contabilidad y registros fiscales.'
        },
        {
          heading: 'Sin Costos Ocultos',
          body: 'Todos los precios incluyen ingeniería profesional. Fotos de sesión y un informe de resumen se incluyen con cada reserva. Lo que ve es lo que paga.'
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: 'Equipo que Realmente Usarás',
      items: [
        {
          heading: 'Guía de Selección de Micrófono',
          body: '¿No sabe qué micrófono es adecuado para su voz? Nuestros ingenieros brindan una consulta gratuita de 15 minutos para emparejar su estilo vocal con el micrófono perfecto.'
        },
        {
          heading: 'Recomendaciones por Género Musical',
          body: 'Ya sea que grabe reggaetón, balada, rock o música electrónica, tenemos configuraciones de equipo adaptadas por género. Dinos tu género y prepararemos la cadena de señal óptima antes de tu llegada.'
        }
      ]
    }
  ],
  vi: [
    {
      hubKey: 'about',
      title: 'Cho Nghệ Sĩ Việt Nam Tại Hàn Quốc',
      items: [
        {
          heading: 'Hướng dẫn Visa Nghệ sĩ & KOMCA',
          body: 'Quy trình nhập cư Hàn Quốc và đăng ký quyền tác giả có thể phức tạp. Chúng tôi đồng hành bạn từ visa C-4 đến đăng ký tại Korean Music Copyright Association (KOMCA), để bạn tập trung sáng tạo âm nhạc.'
        },
        {
          heading: 'Trải nghiệm Studio bằng Tiếng Việt',
          body: 'Mọi giao tiếp đều bằng tiếng Việt. Kỹ sư của chúng tôi ghi chép mọi buổi session, cung cấp hợp đồng tiếng Việt để bạn an tâm.'
        },
        {
          heading: 'Phân phối Toàn cầu Miễn phí',
          body: 'Mỗi gói sản xuất bao gồm phân phối miễn phí đến Spotify, Apple Music, YouTube Music qua đối tác Audioguy. Giữ 70% doanh thu streaming của bạn.'
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: 'Bài học Âm nhạc cho Nghệ sĩ Nước ngoài',
      items: [
        {
          heading: 'Kỹ thuật Hát K-pop & Tiếng Hàn',
          body: 'Chương trình giảng dạy bao gồm kỹ thuật thanh nhạc K-pop, phát âm tiếng Hàn cho lời bài hát, và phong cách biểu diễn. Dù bạn chuẩn bị ra mắt hay thu âm single đầu tiên, chúng tôi xây dựng kỹ năng bạn cần.'
        },
        {
          heading: 'Lịch học Linh hoạt cho Nghệ sĩ Lưu động',
          body: 'Chúng tôi cung cấp buổi học cuối tuần và buổi tối để phù hợp với lịch biểu diễn. Khóa học intensives có sẵn cho nghệ sĩ chuẩn bị phát hành.'
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: 'Giá Minh bạch cho Khách quốc tế',
      items: [
        {
          heading: 'Nhiều Phương thức Thanh toán',
          body: 'Thanh toán bằng chuyển khoản ngân hàng (ngân hàng Hàn Quốc), thẻ tín dụng hoặc PayPal. Chúng tôi cung cấp hóa đơn chi tiết bằng tiếng Việt cho kế toán và hồ sơ thuế.'
        },
        {
          heading: 'Không Chi phí Ẩn',
          body: 'Tất cả giá đã bao gồm kỹ thuật chuyên nghiệp. Ảnh session và báo cáo tóm tắt được bao gồm với mỗi đặt lịch. Thấy giá nào trả giá đó.'
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: 'Thiết bị Bạn sẽ Thực sự Sử dụng',
      items: [
        {
          heading: 'Hướng dẫn Chọn Micro',
          body: 'Không biết micro nào phù hợp với giọng hát? Kỹ sư tư vấn miễn phí 15 phút để chọn micro hoàn hảo cho phong cách giọng hát của bạn.'
        },
        {
          heading: 'Đề xuất theo Thể loại Âm nhạc',
          body: 'Dù bạn thu hip-hop, ballad, rock hay electronic, chúng tôi có thiết bị chuẩn bị sẵn theo thể loại. Hãy cho chúng tôi biết thể loại của bạn và chúng tôi sẽ chuẩn bị chuỗi tín hiệu tối ưu trước khi bạn đến.'
        }
      ]
    }
  ],
  th: [
    {
      hubKey: 'about',
      title: 'สำหรับศิลปินไทยในเกาหลี',
      items: [
        {
          heading: 'คำแนะนำวีซ่าศิลปิน & KOMCA',
          body: 'กระบวนการเข้าเมืองเกาหลีและการจดทะเบียนลิขสิทธิ์อาจซับซ้อน เราช่วยเหลือคุณตั้งแต่วีซ่า C-4 จนถึงการจดทะเบียนที่ Korean Music Copyright Association (KOMCA) เพื่อให้คุณมุ่งเน้นการสร้างดนตรี'
        },
        {
          heading: 'ประสบการณ์สตูดิโอภาษาไทย',
          body: 'การสื่อสารทั้งหมดเป็นภาษาไทย วิศวกรของเราบันทึกทุกเซสชันเป็นลายลักษณ์อักษร และจัดเตรียมสัญญาเป็นภาษาไทยเพื่อความสบายใจของคุณ'
        },
        {
          heading: 'จัดจำหน่ายทั่วโลกฟรี',
          body: 'ทุกแพ็กเกจการผลิตมาพร้อมจัดจำหน่ายฟรีไปยัง Spotify, Apple Music, YouTube Music ผ่านพันธมิตร Audioguy เก็บรายได้สตรีมมิ่ง 70% ของคุณ'
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: 'บทเรียนดนตรีสำหรับศิลปินต่างชาติ',
      items: [
        {
          heading: 'เทคนิคการร้อง K-pop & ภาษาเกาหลี',
          body: 'หลักสูตรครอบคลุมเทคนิคการร้อง K-pop การออกเสียงภาษาเกาหลีสำหรับเนื้อเพลง และสไตล์การแสดง ไม่ว่าคุณกำลังเตรียมเดบิวต์หรืออัดซิงเกิลแรก เราสร้างทักษะที่คุณต้องการ'
        },
        {
          heading: 'ตารางเรียนยืดหยุ่นสำหรับศิลปินทัวร์',
          body: 'มีบทเรียนวันหยุดสุดสัปดาห์และตอนเย็นเพื่อรองรับตารางทัวร์ มีคอร์สเข้มข้นสำหรับศิลปินที่กำลังเตรียมปล่อยผลงาน'
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: 'ราคาโปร่งใสสำหรับลูกค้าต่างชาติ',
      items: [
        {
          heading: 'หลายตัวเลือกการชำระเงิน',
          body: 'ชำระเงินด้วยการโอนธนาคาร (ธนาคารเกาหลี), บัตรเครดิต หรือ PayPal เราออกใบแจ้งหนี้โดยละเอียดเป็นภาษาไทยสำหรับบัญชีและบันทึกภาษี'
        },
        {
          heading: 'ไม่มีค่าใช้จ่ายแอบแฝง',
          body: 'ราคาทั้งหมดรวมวิศวกรมืออาชีพ มีภาพเซสชันและรายงานสรุปทุกครั้งที่คุณจอง เห็นราคาไหนจ่ายราคา đó'
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: 'อุปกรณ์ที่คุณจะได้ใช้จริง',
      items: [
        {
          heading: 'คู่มือเลือกไมโครโฟน',
          body: 'ไม่รู้ว่าไมโครโฟนไหนเหมาะกับเสียงของคุณ? วิศวกรให้คำปรึกษาฟรี 15 นาที เพื่อจับคู่สไตล์เสียงของคุณกับไมโครโฟนที่สมบูรณ์แบบ'
        },
        {
          heading: 'คำแนะนำตามแนวเพลง',
          body: 'ไม่ว่าคุณจะอัดฮิปฮอป บัลลาด ร็อก หรืออิเล็กทรอนิกส์ เรามีอุปกรณ์เตรียมไว้ตามแนวเพลง บอกแนวเพลงของคุณและเราจะเตรียมสัญญาณที่เหมาะสมก่อนคุณมาถึง'
        }
      ]
    }
  ],
  uz: [
    {
      hubKey: 'about',
      title: "Koreyada San'atkorlar Uchun",
      items: [
        {
          heading: "C-4 Vizasi va KOMCA Ro'yxatdan o'tish",
          body: "Koreya immigratsiya va mualliflik huquqini ro'yxatga olish jarayoni murakkab bo'lishi mumkin. Biz sizni C-4 vizasidan Korean Music Copyright Association (KOMCA) ro'yxatigacha yo'l-yo'riq beramiz."
        },
        {
          heading: "O'zbek tilida Studiya Tajribasi",
          body: "Barcha muloqot o'zbek tilida. Muhandislarimiz har bir sessiyani yozma shaklda hujjatlashtiradi va xavfsizligingiz uchun o'zbek tilida shartnoma shablonlarini taqdim etadi."
        },
        {
          heading: "Global Tarqatish Bepul",
          body: "Har bir prodakshn paketi Audioguy hamkorligi orqali Spotify, Apple Music, YouTube Music ga bepul tarqatishni o'z ichiga oladi. Streaming daromadingizning 70% ni ushlab qoling."
        }
      ]
    },
    {
      hubKey: 'lesson',
      title: "Chet ellik San'atkorlar Uchun Musiqa Darslari",
      items: [
        {
          heading: "K-pop Vokal Texnikasi va Koreys Tili",
          body: "Dastur K-pop vokal texnikasi, koreys tilida so'zlar talaffuzi va sahna uslubini qamrab oladi."
        },
        {
          heading: "G'arbiy San'atkorlar Uchun Moslashuvchan Jadval",
          body: "G'arbiy san'atkorlar uchun dam olish kunlari va kechki darslar mavjud."
        }
      ]
    },
    {
      hubKey: 'pricing',
      title: "Chet Ellik Mijozlar Uchun Shaffof Narxlar",
      items: [
        {
          heading: "Bir nechto To'lov Variantlari",
          body: "Bank o'tkazmasi (mahalliy Koreya banklari), kredit karta yoki PayPal orqali to'lang."
        },
        {
          heading: "Yashirin Xarajatlar Yo'q",
          body: "Barcha narxlar professional muhandislikni o'z ichiga oladi."
        }
      ]
    },
    {
      hubKey: 'studio-info',
      title: "Aslida Foydalanadigan Uskunalar",
      items: [
        {
          heading: "Mikrofon Tanlash Qo'llanmasi",
          body: "Qaysi mikrofon sizning ovozingizga mos? Muhandislarimiz 15 daqiqalik bepul maslahat beradi."
        },
        {
          heading: "Janr bo'yicha Tavsiyalar",
          body: "Gip-hop, ballada, rok yoki elektron musiqa yozayotganingizdan qat'iy nazar, bizda janrga mos uskunalar mavjud."
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
