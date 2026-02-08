import type { Locale } from '../lib/i18n';

// Helper for translations
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getReviews = (locale: Locale) => {
  return [
    {
      author: t(locale, { ko: "김*준", en: "Kim *Jun", zh: "Kim *Jun", es: "Kim *Jun", vi: "Kim *Jun", th: "Kim *Jun", uz: "Kim *Jun" }),
      rating: 5,
      categoryKey: 'production',
      category: t(locale, { ko: "음반 프로덕션", en: "Music Production", zh: "唱片制作", es: "Producción Musical", vi: "Sản xuất âm nhạc", th: "โปรดักชันเพลง", uz: "Musiqa prodakshn" }),
      content: t(locale, {
        ko: "단순히 녹음만 하는 곳이 아니라, 아티스트가 가진 의도를 깊게 이해하고 제가 원하는 음악적 방향으로 갈 수 있게 세심하게 가이드해주십니다. 덕분에 첫 음반임에도 불구하고 생각했던 것 이상으로 멋진 결과물이 나왔어요.",
        en: "It's not just a recording studio; they deeply understand the artist's intent and guide you to your desired musical direction. Even though it was my first album, the result was better than I imagined.",
        zh: "不仅仅是录音的地方，而是深入理解艺人的意图，细心引导我走向想要的音乐方向。多亏了这些，虽然是第一张专辑，但是结果比预想的还要好。",
        es: "No es solo un estudio de grabación; entienden profundamente la intención del artista y te guían hacia tu dirección musical deseada. Aunque fue mi primer álbum, el resultado fue mejor de lo que imaginaba.",
        vi: "Không chỉ là phòng thu, họ hiểu sâu ý đồ của nghệ sĩ và hướng dẫn tỉ mỉ để tôi đi đúng hướng âm nhạc. Nhờ vậy dù là album đầu tay, kết quả còn tuyệt hơn mong đợi.",
        th: "ที่นี่ไม่ใช่แค่ห้องอัด แต่เข้าใจเจตนาของศิลปินอย่างลึกซึ้งและคอยชี้แนวทางให้ไปในทิศทางที่ต้องการ แม้จะเป็นอัลบั้มแรก ผลลัพธ์ก็ดีกว่าที่คิดมาก",
        uz: "Bu faqat yozuv studiyasi emas, ular san’atkor niyatini chuqur tushunib, men istagan musiqiy yo‘nalishga nozik yo‘l-yo‘riq beradi. Birinchi albomim bo‘lsa ham, natija kutganimdan ham zo‘r bo‘ldi."
      }),
      datePublished: "2024-11-20"
    },
    {
      author: t(locale, { ko: "이*정", en: "Lee *Jeong", zh: "Lee *Jeong", es: "Lee *Jeong", vi: "Lee *Jeong", th: "Lee *Jeong", uz: "Lee *Jeong" }),
      rating: 5,
      categoryKey: 'wedding',
      category: t(locale, { ko: "셀프 축가 녹음", en: "Self Wedding Recording", zh: "自助婚礼祝歌录音", es: "Grabación de Boda", vi: "Thu âm nhạc cưới tự thực hiện", th: "อัดเพลงงานแต่งด้วยตัวเอง", uz: "O‘z to‘y qo‘shig‘ini yozish" }),
      content: t(locale, {
        ko: "결혼식 셀프 축가 녹음은 처음이라 긴장을 많이 했는데, 단순한 녹음을 넘어 곡의 감정선까지 잘 잡아주셨어요. 제가 원했던 따뜻한 느낌이 소리에 고스란히 담길 수 있도록 디렉팅해주신 덕분에 평생 잊지 못할 선물을 만들었습니다.",
        en: "I was nervous about recording a wedding song for the first time, but they captured the emotions perfectly. Thanks to their directing, I created an unforgettable gift with the warm sound I wanted.",
        zh: "第一次录制婚礼祝歌很紧张，但是不仅仅是录音，连歌曲的感情线也抓得很好。多亏了导演, 让我想要的那种温暖感觉原封不动地融入到了声音中，制作了一份终身难忘的礼物。",
        es: "Estaba nerviosa por grabar una canción de boda por primera vez, pero capturaron las emociones perfectamente. Gracias a su dirección, creé un regalo inolvidable con el sonido cálido que quería.",
        vi: "Lần đầu thu âm bài hát cưới nên tôi rất hồi hộp, nhưng họ không chỉ thu mà còn nắm được cảm xúc của bài. Nhờ phần đạo diễn tỉ mỉ, tôi đã tạo được món quà ấm áp và khó quên.",
        th: "ครั้งแรกที่อัดเพลงงานแต่งด้วยตัวเองก็เลยตื่นเต้นมาก แต่เขาไม่ใช่แค่อัดเสียง ยังจับอารมณ์ของเพลงได้ดีมาก ด้วยการกำกับทำให้ได้ซาวด์อบอุ่นตามที่ต้องการ เป็นของขวัญที่ลืมไม่ลง",
        uz: "To‘y qo‘shig‘imni birinchi marta o‘zim yozayotganim uchun juda hayajonlandim, lekin ular oddiy yozuvdan ham ko‘proq, qo‘shiqning hissiyot chizig‘ini ham ushlab berdi. Yo‘naltirishlari tufayli xohlagan iliq kayfiyatni yaratib, unutilmas sovg‘a tayyorladim."
      }),
      datePublished: "2024-12-05"
    },
    {
      author: t(locale, { ko: "박*현", en: "Park *Hyun", zh: "Park *Hyun", es: "Park *Hyun", vi: "Park *Hyun", th: "Park *Hyun", uz: "Park *Hyun" }),
      rating: 5,
      categoryKey: 'mixing',
      category: t(locale, { ko: "믹싱 & 마스터링", en: "Mixing & Mastering", zh: "混音 & 母带", es: "Mezcla & Masterización", vi: "Mixing & Mastering", th: "มิกซ์ & มาสเตอริ่ง", uz: "Miks & Mastering" }),
      content: t(locale, {
        ko: "추상적으로 표현한 아이디어들을 소리로 구체화하는 능력이 탁월하십니다. 믹싱 과정에서도 소통이 정말 잘 돼서 제가 머릿속으로만 그리던 사운드를 실제로 듣게 됐을 때 전율이 돋았네요. 아티스트의 고집과 대중성 사이의 밸런스를 정말 잘 잡아주십니다.",
        en: "They have an excellent ability to materialize abstract ideas into sound. Communication during mixing was great, and I got chills hearing the sound I only imagined. They balance artist stubbornness and mass appeal very well.",
        zh: "将抽象表达的想法具体化为声音的能力非常卓越。混音过程中沟通也非常顺畅, 实际上听到我脑海中描绘的声音时，战栗不已。真的很好地抓住了艺术家的固执和大众性之间的平衡。",
        es: "Tienen una excelente capacidad para materializar ideas abstractas en sonido. La comunicación durante la mezcla fue genial, y sentí escalofríos al escuchar el sonido que solo imaginaba. Equilibran muy bien la terquedad del artista y el atractivo masivo.",
        vi: "Khả năng biến ý tưởng trừu tượng thành âm thanh của họ rất xuất sắc. Giao tiếp trong quá trình mixing rất tốt và khi nghe được âm thanh mình chỉ tưởng tượng trong đầu thì nổi da gà. Họ cân bằng rất tốt giữa cái tôi nghệ sĩ và tính đại chúng.",
        th: "เขามีความสามารถยอดเยี่ยมในการทำให้ไอเดียที่เป็นนามธรรมกลายเป็นเสียงจริง การสื่อสารระหว่างมิกซ์ดีมาก และ ตอนที่ได้ยินซาวด์ที่เคยมีแค่ในหัวก็ขนลุกเลย เขาจัดสมดุลระหว่างความดื้อของศิลปิน และ ความเป็นสาธารณะได้ดีมาก",
        uz: "Mavhum g‘oyalarni tovushga aniq aylantirish qobiliyati juda kuchli. Miks jarayonida ham muloqot a’lo bo‘ldi, xayolimdagina tasavvur qilgan tovushni eshitganimda hayajonlandim. San’atkor g‘ururi va ommaboplik orasidagi muvozanatni juda yaxshi ushlaydi."
      }),
      datePublished: "2025-01-10"
    },
    {
      author: t(locale, { ko: "최*민", en: "Choi *Min", zh: "Choi *Min", es: "Choi *Min", vi: "Choi *Min", th: "Choi *Min", uz: "Choi *Min" }),
      rating: 5,
      categoryKey: 'practice',
      category: t(locale, { ko: "방음 연습실", en: "Practice Room", zh: "隔음练习室", es: "Sala de Práctica", vi: "Phòng tập", th: "ห้องซ้อม", uz: "Mashg‘ulot xonasi" }),
      content: t(locale, {
        ko: "여러 연습실을 다녀봤지만, 여기만큼 작업에만 몰입할 수 있는 쾌적한 곳은 없었습니다. 특히 공조 시스템이 완벽해서 장시간 작업해도 머리가 아프지 않고, 방음 퀄리티가 전문 스튜디오 급이라 새벽에도 소음 걱정 없이 작업할 수 있어요.",
        en: "I've been to many practice rooms, but none were as comfortable for focusing as this one. The ventilation is perfect, so no headaches after long sessions, and the soundproofing is pro-studio quality.",
        zh: "去过很多练习室, 但是没有比这里更能让人专注于工作的地方了。特别是空调系统非常完美，长久工作也不会头痛，隔音质量也是专业录音室级别的，凌晨也可以毫无噪音地工作。",
        es: "He estado en muchas salas de práctica, pero ninguna era tan cómoda para concentrarse como esta. La ventilación es perfecta, así que no hay dolores de cabeza después de largas sesiones, y la insonorización es de calidad de estudio profesional.",
        vi: "Tôi đã đến nhiều phòng tập, nhưng chưa nơi nào thoải mái để tập trung như ở đây. Hệ thống thông gió rất tốt nên làm lâu cũng không đau đầu, cách âm thì đạt chuẩn studio chuyên nghiệp nên có thể làm việc khuya mà không lo tiếng ồn.",
        th: "ผมเคยไปห้องซ้อมมาหลายที่ แต่ไม่มีที่ไหนสบายและโฟกัสได้เท่านี้ ระบบระบายอากาศดีมากทำงานนานก็ไม่ปวดหัว และกันเสียงระดับสตูดิโอมืออาชีพ จึงทำงานดึกได้แบบไม่ต้องกังวลเสียงรบกวน",
        uz: "Ko‘plab mashg‘ulot xonalarida bo‘lganman, lekin bu joydek ishga to‘liq sho‘ng‘ish mumkin bo‘lgan qulaylik yo‘q edi. Ayniqsa, ventilyatsiya tizimi mukammal — uzoq ishlasam ham bosh og‘rimaydi, ovoz izolyatsiyasi esa professional studiya darajasida."
      }),
      datePublished: "2025-01-25"
    }
  ];
};
