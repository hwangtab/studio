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
        ko: "따뜻하고 입체적인 사운드로 곡을 마무리합니다.",
        en: "Breathing life into music with warm, three-dimensional sound.",
        zh: "实现温暖且立体的声音，为音乐注入生命。",
        es: "Dando vida a la música con un sonido cálido y tridimensional.",
        vi: "Thổi sự sống vào âm nhạc bằng âm thanh ấm áp và có chiều sâu.",
        th: "เติมชีวิตให้เพลงด้วยซาวด์อบอุ่นและมีมิติ",
        uz: "Iliq va uch o‘lchamli tovush bilan musiqaga hayot bag‘ishlaymiz."
      }),
      icon: 'Music'
    },
    {
      title: t(locale, { ko: "디자인", en: "Design", zh: "设计", es: "Diseño", vi: "Thiết kế", th: "ออกแบบ", uz: "Dizayn" }),
      description: t(locale, {
        ko: "앨범 아트워크, 자켓, 프로모션 이미지 제작을 지원합니다.",
        en: "Support for album artwork, jackets, and promotional image creation.",
        zh: "支持专辑封面、封套、宣传图片的制作。",
        es: "Soporte para arte de álbum, portadas e imágenes promocionales.",
        vi: "Hỗ trợ thiết kế artwork album, bìa và hình ảnh quảng bá.",
        th: "สนับสนุนงานอาร์ตเวิร์กอัลบั้ม ปก และภาพโปรโมชัน",
        uz: "Albom artworki, buklet va promo tasvirlarini ishlab chiqishda yordam beramiz."
      }),
      icon: 'Palette'
    },
    {
      title: t(locale, { ko: "유통", en: "Distribution", zh: "发行", es: "Distribución", vi: "Phân phối", th: "จัดจำหน่าย", uz: "Tarqatish" }),
      description: t(locale, {
        ko: "국내외 음원 플랫폼과 오프라인 음반 유통을 진행합니다.",
        en: "Online/offline music and album distribution services.",
        zh: "提供线上/线下音源及唱片发行服务。",
        es: "Servicios de distribución de música y álbumes online/offline.",
        vi: "Cung cấp dịch vụ phân phối nhạc và album online/offline.",
        th: "บริการจัดจำหน่ายเพลงและอัลบั้มทั้งออนไลน์/ออฟไลน์",
        uz: "Onlayn/offlayn musiqa va albom tarqatish xizmatlari."
      }),
      icon: 'Globe'
    },
    {
      title: t(locale, { ko: "홍보/마케팅", en: "PR/Marketing", zh: "宣传/营销", es: "RP/Marketing", vi: "PR/Marketing", th: "ประชาสัมพันธ์/การตลาด", uz: "PR/Marketing" }),
      description: t(locale, {
        ko: "SNS 활용, 언론 배포, 온오프라인 홍보 지원으로 음악을 알립니다.",
        en: "Promoting music via SNS, press releases, and on/offline support.",
        zh: "利用SNS、媒体发布、线上线下宣传支持来推广音乐。",
        es: "Promoción vía redes sociales, comunicados de prensa y soporte on/offline.",
        vi: "Quảng bá qua SNS, phát hành thông cáo báo chí và hỗ trợ online/offline.",
        th: "โปรโมตผ่านโซเชียล มีเดีย, ข่าวประชาสัมพันธ์ และการสนับสนุนออนไลน์/ออฟไลน์",
        uz: "SNS, press-reliz va onlayn/offlayn qo‘llov orqali musiqani targ‘ib qilamiz."
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
        ko: "곡에 필요한 세션 연주자와 각 분야 전문가를 직접 연결합니다.",
        en: "We connect you directly with the session players and specialists your track needs.",
        zh: "为您的作品直接对接所需的乐手与各领域专家。",
        es: "Conectamos directamente con los músicos de sesión y especialistas que tu canción necesita.",
        vi: "Kết nối trực tiếp với nhạc công session và chuyên gia mà bản thu của bạn cần.",
        th: "เชื่อมต่อคุณกับนักดนตรีเซสชันและผู้เชี่ยวชาญที่เพลงของคุณต้องการโดยตรง",
        uz: "Qo‘shig‘ingizga kerak bo‘lgan sessiya musiqachilari va mutaxassislar bilan bevosita bog‘laymiz."
      }),
      icon: 'Users'
    }
  ];

  return { productionProcess, advantages, coreServices };
};
