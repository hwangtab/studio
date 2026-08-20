// Icon names are used here to avoid serialization issues in getStaticProps
// The actual components will be mapped in the frontend component

import type { Locale } from '../lib/i18n';

// Translation helper
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getServicesData = (locale: Locale) => {
  const productionProcess = [
    {
      title: t(locale, { ko: "기획 단계", en: "Planning", zh: "策划阶段", es: "Planificación", vi: "Giai đoạn lập kế hoạch", th: "ขั้นตอนวางแผน", uz: "Rejalash bosqichi" }),
      description: t(locale, {
        ko: "앨범 콘셉트 설정, 제작 일정 및 예산 계획을 함께 수립합니다.",
        en: "Setting album concepts, scheduling production, and planning budgets together.",
        zh: "设定专辑概念，共同制定制作日程及预算计划。",
        es: "Establecimiento de conceptos, programación y presupuestos del álbum.",
        vi: "Cùng thiết lập концеп album, lịch sản xuất và kế hoạch ngân sách.",
        th: "ร่วมกำหนดคอนเซ็ปต์อัลบั้ม ตารางการผลิต และแผนงบประมาณ",
        uz: "Albom konsepsiyasi, ishlab chiqarish jadvali va byudjet rejasini birga belgilaymiz."
      }),
      icon: 'Lightbulb'
    },
    {
      title: t(locale, { ko: "펀딩 지원", en: "Funding Support", zh: "众筹支持", es: "Soporte de Fondos", vi: "Hỗ trợ gọi vốn", th: "สนับสนุนการระดมทุน", uz: "Moliyalashtirish bo‘yicha yordam" }),
      description: t(locale, {
        ko: "크라우드 펀딩으로 제작비를 마련하는 방법을 함께 잡습니다.",
        en: "Consulting for budget raising through crowdfunding.",
        zh: "提供通过众筹筹集预算的咨询。",
        es: "Consultoría para la recaudación de fondos a través de crowdfunding.",
        vi: "Tư vấn gây quỹ thông qua crowdfunding.",
        th: "ให้คำปรึกษาการระดมทุนผ่านคราวด์ฟันดิง",
        uz: "Crowdfunding orqali byudjet yig‘ish bo‘yicha maslahat beramiz."
      }),
      icon: 'Banknote'
    },
    {
      title: t(locale, { ko: "레코딩", en: "Recording", zh: "录音", es: "Grabación", vi: "Thu âm", th: "บันทึกเสียง", uz: "Yozuv" }),
      description: t(locale, {
        ko: "Neumann·SSL 등 아날로그 장비로 녹음합니다.",
        en: "Recorded on analog equipment such as Neumann and SSL.",
        zh: "使用 Neumann、SSL 等模拟设备录音。",
        es: "Grabación con equipos analógicos como Neumann y SSL.",
        vi: "Thu âm bằng thiết bị analog như Neumann và SSL.",
        th: "บันทึกเสียงด้วยอุปกรณ์อนาล็อก เช่น Neumann และ SSL",
        uz: "Neumann, SSL kabi analog uskunalarda yozib olamiz."
      }),
      icon: 'Headphones'
    },
    {
      title: t(locale, { ko: "믹싱/마스터링", en: "Mixing/Mastering", zh: "混音/母带", es: "Mezcla/Masterización", vi: "Mixing/Mastering", th: "มิกซ์/มาสเตอริ่ง", uz: "Miks/Mastering" }),
      description: t(locale, {
        ko: "Tegeler·SSL 아날로그 아웃보드로 따뜻하고 입체적인 사운드를 만들어 음악에 생명을 불어넣습니다.",
        en: "Tegeler and SSL analog outboard gear brings warm, three-dimensional sound — and breathes life into the music.",
        zh: "用 Tegeler、SSL 模拟外置设备实现温暖且立体的声音，为音乐注入生命。",
        es: "Con equipos analógicos externos Tegeler y SSL logramos un sonido cálido y tridimensional que da vida a la música.",
        vi: "Thiết bị analog outboard Tegeler và SSL mang lại âm thanh ấm áp, có chiều sâu và thổi sự sống vào âm nhạc.",
        th: "อุปกรณ์อนาล็อกภายนอก Tegeler และ SSL สร้างซาวด์อบอุ่นมีมิติ และเติมชีวิตให้เพลง",
        uz: "Tegeler va SSL analog uskunalari iliq, hajmli tovush beradi va musiqaga hayot bag‘ishlaydi."
      }),
      icon: 'Music'
    },
    {
      title: t(locale, { ko: "디자인", en: "Design", zh: "设计", es: "Diseño", vi: "Thiết kế", th: "ออกแบบ", uz: "Dizayn" }),
      description: t(locale, {
        ko: "앨범 아트워크·자켓은 외주 디자이너를 연결해 드립니다.",
        en: "For album artwork and sleeves we connect you with outside designers.",
        zh: "专辑封面与封套，为您对接外部设计师。",
        es: "Para el arte y la portada del álbum te conectamos con diseñadores externos.",
        vi: "Với artwork và bìa album, chúng tôi kết nối bạn với designer bên ngoài.",
        th: "งานอาร์ตเวิร์กและปกอัลบั้ม เราแนะนำนักออกแบบภายนอกให้",
        uz: "Albom dizayni va muqova uchun tashqi dizaynerlar bilan bog‘laymiz."
      }),
      icon: 'Palette'
    },
    {
      title: t(locale, { ko: "유통", en: "Distribution", zh: "发行", es: "Distribución", vi: "Phân phối", th: "จัดจำหน่าย", uz: "Tarqatish" }),
      description: t(locale, {
        ko: "멜론·스포티파이·애플뮤직 등 국내외 음원 플랫폼에 유통 등록을 진행합니다.",
        en: "We register your release with Melon, Spotify, Apple Music, and other platforms at home and abroad.",
        zh: "在 Melon、Spotify、Apple Music 等国内外音乐平台完成发行登记。",
        es: "Registramos tu lanzamiento en Melon, Spotify, Apple Music y otras plataformas.",
        vi: "Đăng ký phát hành trên Melon, Spotify, Apple Music và các nền tảng trong, ngoài nước.",
        th: "ลงทะเบียนจัดจำหน่ายบน Melon, Spotify, Apple Music และแพลตฟอร์มทั้งในและต่างประเทศ",
        uz: "Melon, Spotify, Apple Music kabi ichki va xorijiy platformalarda tarqatishni ro‘yxatdan o‘tkazamiz."
      }),
      icon: 'Globe'
    },
    {
      title: t(locale, { ko: "홍보/마케팅", en: "PR/Marketing", zh: "宣传/营销", es: "RP/Marketing", vi: "PR/Marketing", th: "ประชาสัมพันธ์/การตลาด", uz: "PR/Marketing" }),
      description: t(locale, {
        ko: "보도자료를 쓰고 음악 매체·평론가에게 배포합니다.",
        en: "We write the press release and send it to music press and critics.",
        zh: "撰写新闻稿并发送给音乐媒体与乐评人。",
        es: "Redactamos la nota de prensa y la enviamos a medios y críticos musicales.",
        vi: "Viết thông cáo báo chí và gửi tới báo chí, nhà phê bình âm nhạc.",
        th: "เขียนข่าวประชาสัมพันธ์และส่งให้สื่อและนักวิจารณ์ดนตรี",
        uz: "Press-relizni yozamiz va musiqa nashrlari hamda tanqidchilarga yuboramiz."
      }),
      icon: 'Megaphone'
    },
    {
      title: t(locale, { ko: "공연 기획", en: "Concert Planning", zh: "演出策划", es: "Planificación de Conciertos", vi: "Tổ chức biểu diễn", th: "วางแผนคอนเสิร์ต", uz: "Konsert rejalash" }),
      description: t(locale, {
        ko: "라이브 공연 기획 및 운영 지원으로 아티스트의 무대를 완성합니다.",
        en: "Completing the artist's stage with live concert planning and operation support.",
        zh: "通过现场演出策划及运营支持，完成艺术家的舞台。",
        es: "Completando el escenario del artista con planificación y soporte de conciertos.",
        vi: "Hỗ trợ lập kế hoạch và vận hành show live để hoàn thiện sân khấu của nghệ sĩ.",
        th: "สนับสนุนการวางแผนและการดำเนินงานคอนเสิร์ต เพื่อเติมเต็มเวทีของศิลปิน",
        uz: "Jonli konsertni rejalash va boshqarishni qo‘llab-quvvatlab, san’atkor sahnasini to‘liq qilamiz."
      }),
      icon: 'Calendar'
    }
  ];

  const advantages = [
    {
      title: t(locale, { ko: "소통 오류 최소화", en: "Minimized Miscommunication", zh: "最大限度减少沟通误误", es: "Minimización de Errores", vi: "Giảm thiểu sai sót giao tiếp", th: "ลดความคลาดเคลื่อนในการสื่อสาร", uz: "Muloqot xatolarini kamaytirish" }),
      description: t(locale, {
        ko: "각 단계마다 무엇을 하고 있는지 공유해 오해가 쌓이지 않게 합니다.",
        en: "We share what is happening at each step so misunderstandings do not pile up.",
        zh: "在每个阶段同步进展，避免误解累积。",
        es: "Compartimos lo que ocurre en cada etapa para que no se acumulen malentendidos.",
        vi: "Chia sẻ tiến độ ở từng giai đoạn để hiểu lầm không tích tụ.",
        th: "แจ้งความคืบหน้าในแต่ละขั้นตอน เพื่อไม่ให้ความเข้าใจผิดสะสม",
        uz: "Har bosqichda nima bo‘layotganini bo‘lishamiz — tushunmovchilik to‘planmaydi."
      }),
      icon: 'Users'
    },
    {
      title: t(locale, { ko: "일관된 콘셉트 유지", en: "Consistent Concept", zh: "保持一致的概念", es: "Concepto Consistente", vi: "Giữ concept nhất quán", th: "คงคอนเซ็ปต์ให้สม่ำเสมอ", uz: "Yagona konsepsiyani saqlash" }),
      description: t(locale, {
        ko: "처음부터 끝까지 일관된 앨범 콘셉트를 유지하여 작품의 완성도를 높입니다.",
        en: "Maintaining a consistent album concept from start to finish to enhance quality.",
        zh: "从头到尾保持一致的专辑概念，提高作品的完成度。",
        es: "Manteniendo un concepto de álbum consistente de principio a fin.",
        vi: "Duy trì concept album nhất quán từ đầu đến cuối để nâng cao chất lượng.",
        th: "รักษาคอนเซ็ปต์อัลบั้มให้สม่ำเสมอตั้งแต่ต้นจนจบเพื่อเพิ่มความสมบูรณ์",
        uz: "Boshlanishdan oxirigacha albom konsepsiyasini bir xil saqlab, sifatini oshiramiz."
      }),
      icon: 'Lightbulb'
    },
    {
      title: t(locale, { ko: "시간과 비용 효율성", en: "Time & Cost Efficiency", zh: "时间和成本效率", es: "Eficiencia de Tiempo y Costos", vi: "Hiệu quả thời gian & chi phí", th: "ประสิทธิภาพด้านเวลาและค่าใช้จ่าย", uz: "Vaqt va xarajat samaradorligi" }),
      description: t(locale, {
        ko: "여러 곳에 나눠 맡길 때보다 오가는 시간과 총비용이 줄어듭니다.",
        en: "Fewer handoffs than splitting the work across vendors — less time, lower total cost.",
        zh: "比分散委托多家更省往返时间与总成本。",
        es: "Menos idas y vueltas que repartir el trabajo entre varios proveedores: menos tiempo y menor costo total.",
        vi: "Ít qua lại hơn so với chia việc cho nhiều nơi — tiết kiệm thời gian và tổng chi phí.",
        th: "ไม่ต้องวิ่งไปมาหลายเจ้า ประหยัดทั้งเวลาและค่าใช้จ่ายรวม",
        uz: "Ishni bir necha joyga bo‘lib berishdan ko‘ra kam vaqt va umumiy xarajat ketadi."
      }),
      icon: 'Clock'
    },
    {
      title: t(locale, { ko: "창작 집중 환경", en: "Focus on Creation", zh: "专注于创作的环境", es: "Enfoque en la Creación", vi: "Môi trường tập trung sáng tạo", th: "สภาพแวดล้อมเพื่อโฟกัสการสร้างสรรค์", uz: "Ijodga e’tibor muhiti" }),
      description: t(locale, {
        ko: "뮤지션이 창작에만 집중할 수 있게 나머지를 맡습니다.",
        en: "Providing an environment where musicians can focus solely on creation.",
        zh: "提供音乐人只专注于创作的环境。",
        es: "Proporcionando un entorno donde los músicos pueden centrarse solo en la creación.",
        vi: "Tạo môi trường để nhạc sĩ chỉ tập trung vào sáng tạo.",
        th: "สร้างสภาพแวดล้อมให้ศิลปินโฟกัสการสร้างสรรค์ได้เต็มที่",
        uz: "Musiqachilar faqat ijodga e’tibor qaratishi mumkin bo‘lgan muhit yaratamiz."
      }),
      icon: 'Music'
    },
  ];

  const coreServices = [
    {
      title: t(locale, { ko: "앨범 기획부터 유통까지", en: "From Planning to Distribution", zh: "从专辑策划到发行", es: "De la Planificación a la Distribución", vi: "Từ lên kế hoạch đến phân phối", th: "จากวางแผนถึงจัดจำหน่าย", uz: "Rejalashtirishdan tarqatishgacha" }),
      description: t(locale, {
        ko: "기획·녹음·믹싱·유통을 한 곳에서 끊김 없이 이어서 진행합니다.",
        en: "Planning, recording, mixing, and distribution run back to back in one place.",
        zh: "策划、录音、混音到发行，在同一处连贯进行。",
        es: "Planificación, grabación, mezcla y distribución, todo seguido en un mismo lugar.",
        vi: "Lên kế hoạch, thu âm, mix và phát hành diễn ra liền mạch tại một nơi.",
        th: "วางแผน บันทึกเสียง มิกซ์ และจัดจำหน่าย ดำเนินต่อเนื่องในที่เดียว",
        uz: "Rejalash, yozib olish, miks va tarqatish — hammasi bir joyda ketma-ket."
      }),
      icon: 'Music'
    },
    {
      title: t(locale, { ko: "뮤지션의 비전 실현", en: "Realizing Musician's Vision", zh: "实现音乐人的愿景", es: "Realizando la Visión del Músico", vi: "Hiện thực hóa tầm nhìn nghệ sĩ", th: "ทำให้วิสัยทัศน์ของศิลปินเป็นจริง", uz: "Musiqachi tasavvurini ro‘yobga chiqarish" }),
      description: t(locale, {
        ko: "곡의 방향은 아티스트가 정하고, 저희는 그 결정을 소리로 옮깁니다.",
        en: "The artist decides where the song goes; we turn that decision into sound.",
        zh: "作品的方向由音乐人决定，我们负责把这个决定变成声音。",
        es: "El artista decide la dirección de la canción; nosotros la convertimos en sonido.",
        vi: "Nghệ sĩ quyết định hướng đi của bài hát, chúng tôi biến quyết định đó thành âm thanh.",
        th: "ศิลปินเป็นผู้กำหนดทิศทางของเพลง เราทำหน้าที่เปลี่ยนการตัดสินใจนั้นให้เป็นเสียง",
        uz: "Qo‘shiq yo‘nalishini musiqachi belgilaydi, biz esa bu qarorni ovozga aylantiramiz."
      }),
      icon: 'Lightbulb'
    },
    {
      title: t(locale, { ko: "전문가 연계 시스템", en: "Expert Network System", zh: "专家连接系统", es: "Red de Expertos", vi: "Mạng lưới chuyên gia", th: "เครือข่ายผู้เชี่ยวชาญ", uz: "Mutaxassislar tarmog‘i" }),
      description: t(locale, {
        ko: "세션 연주자부터 엔지니어·디자이너까지, 15년간 함께 일해온 뛰어난 전문가들과 연결해 드립니다.",
        en: "From session players to engineers and designers — we connect you with the outstanding people we have worked with over 15 years.",
        zh: "从乐手到录音工程师、设计师，为您对接15年来一起工作的优秀专业人士。",
        es: "Desde músicos de sesión hasta ingenieros y diseñadores: te conectamos con los grandes profesionales con los que llevamos 15 años trabajando.",
        vi: "Từ nhạc công session đến kỹ sư âm thanh và designer — kết nối bạn với những chuyên gia xuất sắc đã cùng làm việc suốt 15 năm.",
        th: "ตั้งแต่นักดนตรีเซสชันไปจนถึงวิศวกรเสียงและนักออกแบบ เราเชื่อมคุณกับมืออาชีพชั้นดีที่ร่วมงานกันมา 15 ปี",
        uz: "Sessiya musiqachilaridan tortib ovoz muhandislari va dizaynerlargacha — 15 yil davomida birga ishlagan zo‘r mutaxassislar bilan bog‘laymiz."
      }),
      icon: 'Users'
    }
  ];

  return { productionProcess, advantages, coreServices };
};
