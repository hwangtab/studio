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
      answer: '싱글 마스터링은 곡당 100,000원이며, EP/앨범 패키지(4곡 이상)는 곡당 80,000원입니다. 멜론, 지니, 유튜브 뮤직, 애플뮤직 등 주요 음원사이트 규격에 맞게 작업됩니다.',
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
      answer: "카카오톡 채널 \'스튜디오 놀\', 전화(070-8065-6700), 또는 홈페이지 문의 폼을 통해 예약하실 수 있습니다. 당일 예약도 가능하며, 주말·공휴일에도 운영합니다.",
    },
    {
      question: '일반인(셀프 녹음)도 녹음실을 이용할 수 있나요?',
      answer: '네, 전문가가 아니어도 누구나 환영합니다. 전담 엔지니어가 마이크 세팅부터 보컬 디렉팅, 완성 파일 전달까지 전 과정을 지원하므로 처음 녹음하시는 분도 편안하게 고품질 결과물을 얻으실 수 있습니다.',
    },
    {
      question: '연습실 단기 대여도 가능한가요?',
      answer: '현재 연습실은 월정액 입주 프로그램(월 40만 원)으로 운영 중입니다. 단기 또는 시간제 이용 문의는 카카오톡·전화로 상담해 주시면 가능 여부를 안내해 드립니다.',
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
      answer: 'You can book via KakaoTalk (channel: Studio NOL), phone (070-8065-6700), or our website contact form. Same-day bookings are possible, and we are available on weekends and holidays.',
    },
    {
      question: 'Can non-professionals record here (self-recording)?',
      answer: 'Absolutely. Everyone is welcome regardless of experience. Our dedicated engineer handles mic setup, vocal direction, and delivers finished files — first-timers consistently achieve professional-quality results.',
    },
    {
      question: 'Is short-term rental of the practice room available?',
      answer: 'Our practice room primarily operates on a monthly residency program (400,000 KRW/month). For short-term or hourly inquiries, please contact us via KakaoTalk or phone and we will advise on availability.',
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
      question: 'Studio NOL 周末或节假日也营业吗？',
      answer: '是的，Studio NOL 采用 100% 预约制，提前预约即可在周末、节假日及深夜时段使用。',
    },
    {
      question: '延新内站附近有录音室或练习室吗？',
      answer: '是的，Studio NOL 距延新内站和佛光站步行均约 5 分钟，在恩平区交通十分便利。',
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
      answer: '可通过 KakaoTalk 频道"Studio NOL"、电话 070-8065-6700 或网站联系表单预约。支持当天预约，周末及节假日均可使用。',
    },
    {
      question: '普通人（自录）也可以使用录音室吗？',
      answer: '当然可以，欢迎所有人。专职工程师将协助完成麦克风设置、人声指导及成品交付等全流程，即使是第一次录音也能轻松获得高品质成果。',
    },
    {
      question: '练习室可以短期租用吗？',
      answer: '练习室目前以月费入驻项目（40万韩元/月）为主。如需短期或按小时使用，请通过 KakaoTalk 或电话咨询，我们将告知具体情况。',
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
      question: '¿Studio NOL abre los fines de semana o en días festivos?',
      answer: 'Sí, Studio NOL opera con un sistema de reservas al 100%. Con reserva previa, el servicio está disponible los fines de semana, festivos y en horario nocturno.',
    },
    {
      question: '¿Hay algún estudio de grabación o sala de práctica cerca de la estación Yeonsinnae?',
      answer: 'Sí, Studio NOL se encuentra a tan solo 5 minutos a pie de la estación Yeonsinnae y la estación Bulgwang, en Eunpyeong-gu.',
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
      answer: 'Puedes reservar a través de KakaoTalk (canal: Studio NOL), por teléfono (070-8065-6700) o el formulario de contacto en nuestra web. Las reservas el mismo día son posibles y estamos disponibles los fines de semana y festivos.',
    },
    {
      question: '¿Pueden grabar personas sin experiencia (grabación propia)?',
      answer: 'Absolutamente. Todos son bienvenidos. Nuestro ingeniero dedicado se encarga de la configuración del micrófono, la dirección vocal y la entrega de archivos finales, para que los principiantes logren resultados de calidad profesional.',
    },
    {
      question: '¿Está disponible el alquiler a corto plazo de la sala de práctica?',
      answer: 'Nuestra sala opera principalmente con un programa de residencia mensual (400.000 KRW/mes). Para consultas de uso a corto plazo o por horas, contáctenos vía KakaoTalk o teléfono.',
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
      question: 'Studio NOL có mở cửa vào cuối tuần hoặc ngày lễ không?',
      answer: 'Có, Studio NOL hoạt động hoàn toàn theo hệ thống đặt lịch trước. Nếu đặt trước, bạn có thể sử dụng dịch vụ vào cuối tuần, ngày lễ và ban đêm.',
    },
    {
      question: 'Có phòng thu âm hoặc phòng tập gần ga Yeonsinnae không?',
      answer: 'Có, Studio NOL cách ga Yeonsinnae và ga Bulgwang ở Eunpyeong-gu chỉ khoảng 5 phút đi bộ, rất thuận tiện di chuyển.',
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
      answer: 'Bạn có thể đặt qua KakaoTalk (kênh: Studio NOL), điện thoại (070-8065-6700) hoặc form liên hệ trên website. Đặt trong ngày được, và chúng tôi mở cửa cả cuối tuần và ngày lễ.',
    },
    {
      question: 'Người không chuyên (tự thu âm) có thể sử dụng phòng thu không?',
      answer: 'Hoàn toàn có thể. Tất cả mọi người đều được chào đón. Kỹ sư chuyên trách sẽ hỗ trợ cài micro, định hướng giọng hát và bàn giao file hoàn chỉnh, giúp người lần đầu thu âm cũng có kết quả chất lượng cao.',
    },
    {
      question: 'Có thể thuê phòng tập ngắn hạn không?',
      answer: 'Phòng tập hiện chủ yếu hoạt động theo chương trình cư trú hàng tháng (400.000 KRW/tháng). Nếu có nhu cầu thuê ngắn hạn hoặc theo giờ, hãy liên hệ qua KakaoTalk hoặc điện thoại để được tư vấn.',
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
      question: 'Studio NOL เปิดบริการในวันหยุดสุดสัปดาห์หรือวันหยุดนักขัตฤกษ์ไหม?',
      answer: 'เปิดค่ะ Studio NOL ดำเนินการแบบจองล่วงหน้า 100% หากจองล่วงหน้าสามารถใช้บริการได้ทั้งวันหยุดสุดสัปดาห์ วันหยุดนักขัตฤกษ์ และช่วงดึก',
    },
    {
      question: 'มีห้องอัดเสียงหรือห้องซ้อมใกล้สถานี Yeonsinnae ไหม?',
      answer: 'มีค่ะ Studio NOL อยู่ห่างจากสถานี Yeonsinnae และสถานี Bulgwang ในเขต Eunpyeong-gu เพียง 5 นาทีเดินเท้า สะดวกสบายมาก',
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
      answer: 'จองได้ผ่าน KakaoTalk (ช่อง: Studio NOL), โทรศัพท์ (070-8065-6700) หรือฟอร์มติดต่อบนเว็บไซต์ รับจองในวันเดียวกัน และเปิดให้บริการทั้งวันหยุดสุดสัปดาห์และวันหยุดนักขัตฤกษ์',
    },
    {
      question: 'คนทั่วไป (บันทึกเสียงเอง) ใช้ห้องอัดได้ไหม?',
      answer: 'ได้แน่นอน ทุกคนยินดีต้อนรับ วิศวกรประจำจะดูแลตั้งแต่เซ็ตอัพไมค์ ชี้แนะการร้อง ไปจนถึงส่งมอบไฟล์สำเร็จ ทำให้แม้แต่มือใหม่ก็ได้ผลลัพธ์ระดับมืออาชีพ',
    },
    {
      question: 'เช่าห้องซ้อมระยะสั้นได้ไหม?',
      answer: 'ห้องซ้อมของเราส่วนใหญ่ดำเนินการแบบโปรแกรมรายเดือน (400,000 วอน/เดือน) หากสนใจเช่าระยะสั้นหรือรายชั่วโมง ติดต่อสอบถามผ่าน KakaoTalk หรือโทรศัพท์',
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
      answer: "Single mastering 100,000 KRW/qo'shiq, EP/album paketi (4+ qo'shiq) 80,000 KRW/qo'shiq. Spotify, Apple Music kabi platformalar standartiga mos.",
    },
    {
      question: "Mashg'ulot xonasi rezident dasturi bormi?",
      answer: "Ha. Oyiga 400,000 KRW evaziga premium ovoz izolyatsiyali mashg'ulot xonasi va 8 ta imtiyoz (studiyada chegirma, bepul tarqatish, press-reliz qo'llovi, busking uskunalari ijarasi va h.k.) beriladi.",
    },
    {
      question: 'Qanday uskunalar bor?',
      answer: 'Neumann U87AI, AKG C414 XLS mikrofonlari, Vintech X73i preamp, Prism Sound Lyra 2 interfeys, SSL Fusion protsessori kabi premium analog/raqamli uskunalar mavjud.',
    },
    {
      question: "Studio NOL dam olish kunlari va bayramlarda ham ishlaydimi?",
      answer: "Ha. Studio NOL 100% oldindan bron asosida ishlaydi. Oldindan bron qilinsa, dam olish kunlari, bayramlar va kech tungi soatlarda ham xizmatdan foydalanish mumkin.",
    },
    {
      question: "Yeonsinnae bekati yaqinida yozuv studiyasi yoki mashg'ulot xonasi bormi?",
      answer: "Ha, Studio NOL Eunpyeong-gudagi Yeonsinnae va Bulgwang bekatlaridan piyoda atigi 5 daqiqa masofada joylashgan.",
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
      answer: "KakaoTalk (kanal: Studio NOL), telefon (070-8065-6700) yoki veb-saytdagi murojaat formasi orqali band qilishingiz mumkin. Bir kunlik band ham mumkin, dam olish va bayram kunlarida ham ishlaydi.",
    },
    {
      question: "Oddiy odamlar (mustaqil yozish) studiyadan foydalana oladimi?",
      answer: "Ha, albatta. Hamma xush kelibsiz. Muhandis mikrofonni sozlashdan vokal yo'naltirishgacha va tayyor fayllarni topshirishgacha barcha jarayonda yordam beradi, birinchi marta yozayotganlar ham yuqori sifatli natija oladi.",
    },
    {
      question: "Mashg'ulot xonasini qisqa muddatga ijaraga olish mumkinmi?",
      answer: "Mashg'ulot xonasi asosan oylik rezident dastur (400,000 KRW/oy) asosida ishlaydi. Qisqa muddatli yoki soatbay foydalanish bo'yicha so'rovlar uchun KakaoTalk yoki telefon orqali bog'laning.",
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
