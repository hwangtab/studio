import type { Locale } from '../lib/i18n';

// Helper for translations
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getReviews = (locale: Locale) => {
  return [
    {
      id: 'review-2',
      author: t(locale, { ko: "이*정", en: "Lee *Jeong", zh: "Lee *Jeong", es: "Lee *Jeong", vi: "Lee *Jeong", th: "Lee *Jeong", uz: "Lee *Jeong" }),
      rating: 5,
      categoryKey: 'wedding',
      category: t(locale, { ko: "축가 녹음", en: "Wedding Song Recording", zh: "婚礼祝歌录音", es: "Grabación de Boda", vi: "Thu âm nhạc cưới", th: "อัดเพลงงานแต่ง", uz: "To‘y qo‘shig‘i yozuvi" }),
      content: t(locale, {
        ko: "결혼식 축가 녹음은 처음이라 긴장을 많이 했는데, 엔지니어분이 그냥 녹음만 해주신 게 아니라 곡의 감정선까지 잘 잡아주시더라고요. 제가 원했던 따뜻한 느낌이 소리에 고스란히 담기도록 디렉팅해주신 덕분에 평생 잊지 못할 선물을 만들었어요.",
        en: "I was nervous about recording a wedding song for the first time, but the engineer captured the emotions perfectly. Thanks to their directing, I created an unforgettable gift with the warm sound I wanted.",
        zh: "第一次录制婚礼祝歌很紧张，但工程师不仅仅是录音，连歌曲的感情线也抓得很好。多亏了导演, 让我想要的那种温暖感觉原封不动地融入到了声音中，制作了一份终身难忘的礼物。",
        es: "Estaba nerviosa por grabar una canción de boda por primera vez, pero el ingeniero capturó las emociones perfectamente. Gracias a su dirección, creé un regalo inolvidable con el sonido cálido que quería.",
        vi: "Lần đầu thu âm bài hát cưới nên tôi rất hồi hộp, nhưng kỹ sư không chỉ thu mà còn nắm được cảm xúc của bài. Nhờ phần đạo diễn tỉ mỉ, tôi đã tạo được món quà ấm áp và khó quên.",
        th: "ครั้งแรกที่อัดเพลงงานแต่งก็เลยตื่นเต้นมาก แต่วิศวกรไม่ใช่แค่อัดเสียง ยังจับอารมณ์ของเพลงได้ดีมาก ด้วยการกำกับทำให้ได้ซาวด์อบอุ่นตามที่ต้องการ เป็นของขวัญที่ลืมไม่ลง",
        uz: "To‘y qo‘shig‘imni birinchi marta yozayotganim uchun juda hayajonlandim, lekin muhandis oddiy yozuvdan ham ko‘proq, qo‘shiqning hissiyot chizig‘ini ham ushlab berdi. Yo‘naltirishlari tufayli xohlagan iliq kayfiyatni yaratib, unutilmas sovg‘a tayyorladim."
      }),
      datePublished: "2024-12-05"
    },
    {
      id: 'review-3',
      author: t(locale, { ko: "박*현", en: "Park *Hyun", zh: "Park *Hyun", es: "Park *Hyun", vi: "Park *Hyun", th: "Park *Hyun", uz: "Park *Hyun" }),
      rating: 5,
      categoryKey: 'mixing',
      category: t(locale, { ko: "믹싱 & 마스터링", en: "Mixing & Mastering", zh: "混音 & 母带", es: "Mezcla & Masterización", vi: "Mixing & Mastering", th: "มิกซ์ & มาสเตอริ่ง", uz: "Miks & Mastering" }),
      content: t(locale, {
        ko: "추상적으로 표현한 아이디어를 소리로 만들어내는 능력이 탁월하십니다. 믹싱 과정에서도 소통이 워낙 잘 돼서 머릿속으로만 그리던 사운드를 실제로 들었을 때는 소름이 돋았네요. 아티스트의 고집과 대중성 사이에서 밸런스 잡는 것도 정말 잘하십니다.",
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
      id: 'review-4',
      author: t(locale, { ko: "최*민", en: "Choi *Min", zh: "Choi *Min", es: "Choi *Min", vi: "Choi *Min", th: "Choi *Min", uz: "Choi *Min" }),
      rating: 5,
      categoryKey: 'practice',
      category: t(locale, { ko: "음악연습실", en: "Music Practice Room", zh: "音乐练习室", es: "Sala de Práctica Musical", vi: "Phòng tập nhạc", th: "ห้องซ้อมดนตรี", uz: "Musiqa mashg’ulot xonasi" }),
      content: t(locale, {
        ko: "연습실을 여러 군데 다녀봤습니다. 여기만큼 쾌적하게 작업에만 몰입할 수 있는 곳은 없었어요. 특히 환기가 완벽해서 장시간 작업해도 머리가 아프지 않습니다. 방음 퀄리티는 전문 스튜디오 급이라 새벽에도 소음 걱정 없이 작업해요.",
        en: "I've been to many practice rooms, but none were as comfortable for focusing as this one. The ventilation is perfect, so no headaches after long sessions, and the soundproofing is pro-studio quality.",
        zh: "去过很多练习室, 但是没有比这里更能让人专注于工作的地方了。特别是空调系统非常完美，长久工作也不会头痛，隔音质量也是专业录音室级别的，凌晨也可以毫无噪音地工作。",
        es: "He estado en muchas salas de práctica, pero ninguna era tan cómoda para concentrarse como esta. La ventilación es perfecta, así que no hay dolores de cabeza después de largas sesiones, y la insonorización es de calidad de estudio profesional.",
        vi: "Tôi đã đến nhiều phòng tập, nhưng chưa nơi nào thoải mái để tập trung như ở đây. Hệ thống thông gió rất tốt nên làm lâu cũng không đau đầu, cách âm thì đạt chuẩn studio chuyên nghiệp nên có thể làm việc khuya mà không lo tiếng ồn.",
        th: "ผมเคยไปห้องซ้อมมาหลายที่ แต่ไม่มีที่ไหนสบายและโฟกัสได้เท่านี้ ระบบระบายอากาศดีมากทำงานนานก็ไม่ปวดหัว และกันเสียงระดับสตูดิโอมืออาชีพ จึงทำงานดึกได้แบบไม่ต้องกังวลเสียงรบกวน",
        uz: "Ko‘plab mashg‘ulot xonalarida bo‘lganman, lekin bu joydek ishga to‘liq sho‘ng‘ish mumkin bo‘lgan qulaylik yo‘q edi. Ayniqsa, ventilyatsiya tizimi mukammal — uzoq ishlasam ham bosh og‘rimaydi, ovoz izolyatsiyasi esa professional studiya darajasida."
      }),
      datePublished: "2025-01-25"
    },
    {
      // 네이버 플레이스 방문자 리뷰(2026-07-07, soulwon05 블로그) — 본인(가원) 동의로 추가.
      // 2026-10-21: 처음엔 요약으로 넣었으나, 가원 님이 "원문을 마음대로 인용해도 좋다"고
      // 추가로 허락해 원문 문장을 그대로(따옴표 안 내용 편집 없음) 옮겼다. ko는 원문 그대로,
      // 나머지 로케일은 그 문장의 번역. sourceUrl로 원문 전체를 추가로 링크한다.
      id: 'review-5',
      author: t(locale, { ko: "가원", en: "Ga-won", zh: "Ga-won", es: "Ga-won", vi: "Ga-won", th: "Ga-won", uz: "Ga-won" }),
      rating: 5,
      categoryKey: 'recording',
      category: t(locale, { ko: "보컬 녹음", en: "Vocal Recording", zh: "人声录音", es: "Grabación de voz", vi: "Thu âm giọng hát", th: "อัดเสียงร้อง", uz: "Vokal yozuvi" }),
      content: t(locale, {
        ko: "엔지니어시라기보다는 프로듀서에 가깝게 보컬테크닉적인 부분이라던지 감정 같은 것, 곡의 색채에 맞는 프로듀싱을 해주셔서 지도하에 따라가며 녹음했더니 기대 이상의 결과가 나왔다.",
        en: "More like a producer than an engineer, they directed things like vocal technique and emotion to match the song's color, and following that direction while recording gave me a result beyond what I expected.",
        zh: "比起工程师更像制作人，指导了声乐技巧、情感之类符合歌曲色彩的内容，跟着这个方向录音后，得到了超出预期的结果。",
        es: "Más como un productor que un ingeniero, dirigió cosas como la técnica vocal y la emoción para encajar con el color de la canción, y seguir esa dirección mientras grababa me dio un resultado mejor de lo esperado.",
        vi: "Giống producer hơn là kỹ sư, anh chỉ đạo về kỹ thuật hát, cảm xúc sao cho hợp với màu sắc bài hát, và khi thu theo sự chỉ đạo đó, kết quả vượt ngoài mong đợi.",
        th: "เหมือนโปรดิวเซอร์มากกว่าวิศวกร กำกับเรื่องเทคนิคการร้องและอารมณ์ให้เข้ากับสีสันของเพลง ทำตามคำแนะนำนั้นแล้วผลลัพธ์ดีเกินคาด",
        uz: "Muhandisdan ko‘ra prodyuser kabi, vokal texnikasi va qo‘shiq kayfiyatiga mos hissiyotni yo‘naltirdi, shu yo‘nalishga ergashib yozib olganimda kutganimdan ham yaxshi natija chiqdi."
      }),
      sourceUrl: 'https://blog.naver.com/soulwon05/224339683075',
      datePublished: "2026-07-07"
    }
  ];
};
