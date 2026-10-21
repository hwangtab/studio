import type { Locale } from '../lib/i18n';

// Helper for translations
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getReviews = (locale: Locale) => {
  return [
    {
      id: 'review-1',
      author: t(locale, { ko: "김*준", en: "Kim *Jun", zh: "Kim *Jun", es: "Kim *Jun", vi: "Kim *Jun", th: "Kim *Jun", uz: "Kim *Jun" }),
      rating: 5,
      categoryKey: 'production',
      category: t(locale, { ko: "음반 프로덕션", en: "Music Production", zh: "唱片制作", es: "Producción Musical", vi: "Sản xuất âm nhạc", th: "โปรดักชันเพลง", uz: "Musiqa prodakshn" }),
      content: t(locale, {
        ko: "녹음만 하고 끝나는 곳이 아닙니다. 가사와 레퍼런스 곡을 미리 보냈더니 세션 전에 편곡 방향을 같이 정리해주셨고, 녹음 중에도 테이크를 여러 번 쌓은 뒤 그중 가장 좋은 구간만 골라 컴핑해주셨어요. 아티스트 의도를 깊이 이해하고 제가 원하는 음악적 방향으로 세심하게 가이드해주신 덕에, 첫 음반이었는데도 생각했던 것보다 훨씬 멋진 결과물이 나왔습니다.",
        en: "It's not just a recording studio. I sent lyrics and a reference track ahead of time, and we worked out the arrangement direction together before the session; during recording, they stacked several takes and comped only the best parts. They deeply understood my intent and guided me carefully toward the sound I wanted — even though it was my first album, the result was better than I imagined.",
        zh: "不仅仅是录音的地方。提前发了歌词和参考曲，录音前就一起理清了编曲方向；录音时也录了多个take，再挑出最好的部分进行拼接。深入理解艺人的意图，细心引导我走向想要的音乐方向。多亏了这些，虽然是第一张专辑，但是结果比预想的还要好。",
        es: "No es solo un estudio de grabación. Envié la letra y una canción de referencia con antelación, y decidimos juntos la dirección del arreglo antes de la sesión; durante la grabación, grabaron varias tomas y editaron solo las mejores partes. Entendieron profundamente mi intención y me guiaron con cuidado hacia el sonido que quería — aunque fue mi primer álbum, el resultado fue mejor de lo que imaginaba.",
        vi: "Không chỉ là phòng thu. Tôi gửi lời bài hát và bài tham khảo trước, và chúng tôi cùng thống nhất hướng phối khí trước buổi thu; khi thu âm, họ ghi nhiều take rồi chỉ chọn những đoạn tốt nhất để ghép lại. Họ hiểu sâu ý đồ của tôi và hướng dẫn tỉ mỉ để tôi đi đúng hướng âm nhạc mong muốn — dù là album đầu tay, kết quả còn tuyệt hơn mong đợi.",
        th: "ที่นี่ไม่ใช่แค่ห้องอัด ผมส่งเนื้อเพลงและเพลงอ้างอิงไปก่อน แล้วเรากำหนดทิศทางการเรียบเรียงร่วมกันก่อนเข้าห้องอัด ตอนอัดก็อัดหลายเทค แล้วเลือกเอาแค่ช่วงที่ดีที่สุดมาตัดต่อ เข้าใจเจตนาของศิลปินอย่างลึกซึ้งและคอยชี้แนวทางให้ไปในทิศทางที่ต้องการอย่างละเอียด แม้จะเป็นอัลบั้มแรก ผลลัพธ์ก็ดีกว่าที่คิดมาก",
        uz: "Bu faqat yozuv studiyasi emas. Qo‘shiq matni va referens trekni oldindan yubordim, va sessiyadan oldin aranjirovka yo‘nalishini birgalikda belgiladik; yozib olishda bir nechta take olib, faqat eng yaxshi qismlarini tanlab birlashtirdi. San’atkor niyatini chuqur tushunib, men istagan musiqiy yo‘nalishga nozik yo‘l-yo‘riq berdi. Birinchi albomim bo‘lsa ham, natija kutganimdan ham zo‘r bo‘ldi."
      }),
      datePublished: "2024-11-20"
    },
    {
      id: 'review-2',
      author: t(locale, { ko: "이*정", en: "Lee *Jeong", zh: "Lee *Jeong", es: "Lee *Jeong", vi: "Lee *Jeong", th: "Lee *Jeong", uz: "Lee *Jeong" }),
      rating: 5,
      categoryKey: 'wedding',
      category: t(locale, { ko: "축가 녹음", en: "Wedding Song Recording", zh: "婚礼祝歌录音", es: "Grabación de Boda", vi: "Thu âm nhạc cưới", th: "อัดเพลงงานแต่ง", uz: "To‘y qo‘shig‘i yozuvi" }),
      content: t(locale, {
        ko: "결혼식 축가 녹음은 처음이라 긴장을 많이 했는데, 녹음 전에 가벼운 웜업을 같이 해주셔서 긴장이 금방 풀렸어요. 엔지니어분이 그냥 녹음만 해주신 게 아니라 곡의 감정선까지 잘 잡아주시고, 제 음역에 맞게 키를 조정해주셨습니다. 제가 원했던 따뜻한 느낌이 소리에 고스란히 담기도록 디렉팅해주시고 피치까지 꼼꼼히 다듬어주신 덕분에, 3시간이 전혀 길게 느껴지지 않았고 평생 잊지 못할 선물을 만들었어요.",
        en: "I was nervous about recording a wedding song for the first time, but a short warm-up before the session eased that quickly. The engineer didn't just record — they captured the song's emotional arc and adjusted the key to fit my range. Thanks to their directing and careful pitch correction, the warm feeling I wanted came through perfectly, and the 3 hours didn't feel long at all — I ended up with a gift I'll never forget.",
        zh: "第一次录制婚礼祝歌很紧张，但录音前一起做了简单的热身，很快就放松了。工程师不仅仅是录音，连歌曲的感情线也抓得很好，还按我的音域调整了调性。多亏了细致的情感指导和音准修正，我想要的那种温暖感觉原封不动地融入到了声音中，3个小时完全不觉得长，制作了一份终身难忘的礼物。",
        es: "Estaba nerviosa por grabar una canción de boda por primera vez, pero un breve calentamiento antes de la sesión me relajó rápido. El ingeniero no solo grabó, sino que capturó el arco emocional de la canción y ajustó la tonalidad a mi registro. Gracias a su dirección y a una cuidadosa corrección de tono, el sonido cálido que quería quedó perfecto, y las 3 horas no se sintieron largas — creé un regalo inolvidable.",
        vi: "Lần đầu thu âm bài hát cưới nên tôi rất hồi hộp, nhưng được làm nóng giọng nhẹ trước khi thu nên nhanh chóng thoải mái hơn. Kỹ sư không chỉ thu mà còn nắm được cảm xúc của bài và chỉnh key phù hợp âm vực của tôi. Nhờ phần đạo diễn tỉ mỉ và chỉnh pitch cẩn thận, cảm giác ấm áp tôi muốn được giữ nguyên trong âm thanh, 3 giờ trôi qua chẳng thấy dài, tôi đã tạo được món quà ấm áp và khó quên.",
        th: "ครั้งแรกที่อัดเพลงงานแต่งก็เลยตื่นเต้นมาก แต่ได้วอร์มอัพเบาๆ ก่อนอัดทำให้คลายตื่นเต้นได้เร็ว วิศวกรไม่ใช่แค่อัดเสียง ยังจับอารมณ์ของเพลงได้ดีมากและปรับคีย์ให้เหมาะกับช่วงเสียงของผม ด้วยการกำกับอย่างละเอียดและแก้พิตช์อย่างพิถีพิถัน ทำให้ได้ซาวด์อบอุ่นตามที่ต้องการเป๊ะ 3 ชั่วโมงไม่รู้สึกนานเลย เป็นของขวัญที่ลืมไม่ลง",
        uz: "To‘y qo‘shig‘imni birinchi marta yozayotganim uchun juda hayajonlandim, lekin sessiyadan oldin qisqa qizdirish mashqi hayajonimni tezda yengdi. Muhandis oddiy yozuvdan ham ko‘proq, qo‘shiqning hissiyot chizig‘ini ham ushlab, ovoz registrimga mos tonnalikni moslashtirdi. Yo‘naltirishlari va aniq pitch tuzatish tufayli xohlagan iliq kayfiyat tovushda to‘liq saqlanib qoldi, 3 soat umuman uzoq tuyulmadi — unutilmas sovg‘a tayyorladim."
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
        ko: "추상적으로 표현한 아이디어를 소리로 만들어내는 능력이 탁월하십니다. '조금 더 어두운 느낌'이라고만 말씀드려도 레퍼런스 곡 없이도 의도를 정확히 짚어내시더라고요. 믹싱 과정에서 수정 의견을 보내면 하루 안에 반영한 버전을 보내주셔서 소통도 빨랐고, 머릿속으로만 그리던 사운드를 실제로 들었을 때는 소름이 돋았네요. 아티스트의 고집과 대중성 사이에서 밸런스 잡는 것도 정말 잘하십니다.",
        en: "They have an excellent ability to materialize abstract ideas into sound. Even when I just said 'a bit darker' without a reference track, they nailed exactly what I meant. During mixing, they'd send back a revised version within a day of my notes, so communication was fast — and I got chills hearing the sound I only imagined. They balance artist stubbornness and mass appeal very well.",
        zh: "将抽象表达的想法具体化为声音的能力非常卓越。就算我只说了“再暗一点”也没给参考曲，也能准确抓住我的意图。混音过程中发出修改意见后一天内就能收到反映过的版本，沟通也很快, 实际上听到我脑海中描绘的声音时，战栗不已。真的很好地抓住了艺术家的固执和大众性之间的平衡。",
        es: "Tienen una excelente capacidad para materializar ideas abstractas en sonido. Incluso cuando solo dije 'un poco más oscuro' sin una pista de referencia, acertaron exactamente lo que quería decir. Durante la mezcla, enviaban una versión revisada en un día tras mis notas, así que la comunicación fue rápida, y sentí escalofríos al escuchar el sonido que solo imaginaba. Equilibran muy bien la terquedad del artista y el atractivo masivo.",
        vi: "Khả năng biến ý tưởng trừu tượng thành âm thanh của họ rất xuất sắc. Chỉ nói 'tối hơn một chút' mà không có bài tham khảo, họ vẫn bắt đúng ý tôi. Trong lúc mixing, gửi góp ý là nhận lại bản chỉnh sửa trong một ngày, giao tiếp rất nhanh, và khi nghe được âm thanh mình chỉ tưởng tượng trong đầu thì nổi da gà. Họ cân bằng rất tốt giữa cái tôi nghệ sĩ và tính đại chúng.",
        th: "เขามีความสามารถยอดเยี่ยมในการทำให้ไอเดียที่เป็นนามธรรมกลายเป็นเสียงจริง แค่บอกว่า 'มืดขึ้นอีกหน่อย' โดยไม่มีเพลงอ้างอิง เขาก็จับใจความได้ตรงเป๋ง ระหว่างมิกซ์ส่งความเห็นไปก็ได้เวอร์ชันแก้ไขกลับมาภายในวันเดียว สื่อสารเร็วมาก และตอนที่ได้ยินซาวด์ที่เคยมีแค่ในหัวก็ขนลุกเลย เขาจัดสมดุลระหว่างความดื้อของศิลปิน และ ความเป็นสาธารณะได้ดีมาก",
        uz: "Mavhum g‘oyalarni tovushga aniq aylantirish qobiliyati juda kuchli. Referens trek bo‘lmasa-da, faqat 'biroz qorong‘uroq' deganimda ham aynan niyatimni to‘g‘ri tushundi. Miks jarayonida fikr yuborsam, bir kun ichida tahrirlangan versiyani yuborardi — muloqot tez bo‘ldi, xayolimdagina tasavvur qilgan tovushni eshitganimda hayajonlandim. San’atkor g‘ururi va ommaboplik orasidagi muvozanatni juda yaxshi ushlaydi."
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
        ko: "연습실을 여러 군데 다녀봤습니다. 여기만큼 쾌적하게 작업에만 몰입할 수 있는 곳은 없었어요. 특히 환기가 완벽해서 장시간 작업해도 머리가 아프지 않습니다. 방음 퀄리티는 전문 스튜디오 급이라 새벽에도 소음 걱정 없이 작업해요. 24시간 개인 공간으로 쓸 수 있고 보증금도 없어서 짧게 써보고 결정하기도 부담이 없었습니다.",
        en: "I've been to many practice rooms, but none were as comfortable for focusing as this one. The ventilation is perfect, so no headaches after long sessions, and the soundproofing is pro-studio quality — no noise worries even late at night. It's a 24-hour private space with no deposit, so it was easy to try out short-term before committing.",
        zh: "去过很多练习室, 但是没有比这里更能让人专注于工作的地方了。特别是空调系统非常完美，长久工作也不会头痛，隔音质量也是专业录音室级别的，凌晨也可以毫无噪音地工作。24小时可用的个人空间，也不用交保证金，先短期试用再决定也没有负担。",
        es: "He estado en muchas salas de práctica, pero ninguna era tan cómoda para concentrarse como esta. La ventilación es perfecta, así que no hay dolores de cabeza después de largas sesiones, y la insonorización es de calidad de estudio profesional, sin preocupaciones de ruido ni de madrugada. Es un espacio privado de 24 horas sin depósito, así que fue fácil probarlo a corto plazo antes de decidir.",
        vi: "Tôi đã đến nhiều phòng tập, nhưng chưa nơi nào thoải mái để tập trung như ở đây. Hệ thống thông gió rất tốt nên làm lâu cũng không đau đầu, cách âm thì đạt chuẩn studio chuyên nghiệp nên có thể làm việc khuya mà không lo tiếng ồn. Là không gian riêng 24 giờ và không cần đặt cọc, nên thử ngắn hạn trước khi quyết định cũng không áp lực.",
        th: "ผมเคยไปห้องซ้อมมาหลายที่ แต่ไม่มีที่ไหนสบายและโฟกัสได้เท่านี้ ระบบระบายอากาศดีมากทำงานนานก็ไม่ปวดหัว และกันเสียงระดับสตูดิโอมืออาชีพ จึงทำงานดึกได้แบบไม่ต้องกังวลเสียงรบกวน เป็นพื้นที่ส่วนตัว 24 ชั่วโมงและไม่ต้องวางเงินมัดจำ จะลองใช้สั้นๆก่อนตัดสินใจก็ไม่มีภาระ",
        uz: "Ko‘plab mashg‘ulot xonalarida bo‘lganman, lekin bu joydek ishga to‘liq sho‘ng‘ish mumkin bo‘lgan qulaylik yo‘q edi. Ayniqsa, ventilyatsiya tizimi mukammal — uzoq ishlasam ham bosh og‘rimaydi, ovoz izolyatsiyasi esa professional studiya darajasida, tungi payt ham shovqin haqida tashvishlanmayman. 24 soat shaxsiy joy sifatida ishlatish mumkin va depozit talab qilinmaydi, shuning uchun qisqa muddat sinab ko‘rib keyin qaror qilish qulay bo‘ldi."
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
      categoryKey: 'practice',
      category: t(locale, { ko: "음악연습실", en: "Music Practice Room", zh: "音乐练习室", es: "Sala de Práctica Musical", vi: "Phòng tập nhạc", th: "ห้องซ้อมดนตรี", uz: "Musiqa mashg’ulot xonasi" }),
      content: t(locale, {
        ko: "연습실에 입실할 때도 컴퓨터 탁자 피아노 오인페 마이크 스피커 의자 조명 다 마련해주셔서 장비가 완전히 다 마련된 채로 몸만 들어가면 되었다!!! ...엔지니어시라기보다는 프로듀서에 가깝게 보컬테크닉적인 부분이라던지 감정 같은 것, 곡의 색채에 맞는 프로듀싱을 해주셔서 지도하에 따라가며 녹음했더니 기대 이상의 결과가 나왔다.",
        en: "When I moved into the practice room, the computer, desk, piano, audio interface, mic, speakers, chair, and lighting were all already set up, so I just had to walk in with nothing. [...] More like a producer than an engineer, they directed things like vocal technique and emotion to match the song's color, and following that direction while recording gave me a result beyond what I expected.",
        zh: "入住练习室时，电脑、桌子、钢琴、音频接口、麦克风、音箱、椅子、灯光全都已经准备好了，人去就能直接用！[...] 比起工程师更像制作人，指导了声乐技巧、情感之类符合歌曲色彩的内容，跟着这个方向录音后，得到了超出预期的结果。",
        es: "Cuando me instalé en la sala de práctica, el ordenador, la mesa, el piano, la interfaz de audio, el micrófono, los altavoces, la silla y la iluminación ya estaban todos preparados, así que solo tuve que entrar. [...] Más como un productor que un ingeniero, dirigió cosas como la técnica vocal y la emoción para encajar con el color de la canción, y seguir esa dirección mientras grababa dio un resultado mejor de lo que esperaba.",
        vi: "Khi vào phòng tập, máy tính, bàn, piano, audio interface, mic, loa, ghế, đèn đều đã chuẩn bị sẵn, chỉ cần đi vào là dùng được! [...] Giống producer hơn là kỹ sư, anh chỉ đạo về kỹ thuật hát, cảm xúc sao cho hợp với màu sắc bài hát, và khi thu theo sự chỉ đạo đó, kết quả vượt ngoài mong đợi.",
        th: "ตอนเข้าห้องซ้อม คอมพิวเตอร์ โต๊ะ เปียโน ออดิโออินเตอร์เฟส ไมค์ ลำโพง เก้าอี้ ไฟ เตรียมพร้อมไว้หมดแล้ว แค่เดินตัวเปล่าเข้าไปก็ใช้ได้เลย! [...] เหมือนโปรดิวเซอร์มากกว่าวิศวกร กำกับเรื่องเทคนิคการร้องและอารมณ์ให้เข้ากับสีสันของเพลง ทำตามคำแนะนำนั้นแล้วผลลัพธ์ดีเกินคาด",
        uz: "Mashg‘ulot xonasiga kirganimda kompyuter, stol, pianino, audio interfeys, mikrofon, dinamik, stul, yorug‘lik — hammasi tayyor edi, shunchaki kirib bordim! [...] Muhandisdan ko‘ra prodyuser kabi, vokal texnikasi va qo‘shiq kayfiyatiga mos hissiyotni yo‘naltirdi, shu yo‘nalishga ergashib yozib olganimda kutganimdan ham yaxshi natija chiqdi."
      }),
      sourceUrl: 'https://blog.naver.com/soulwon05/224339683075',
      datePublished: "2026-07-07"
    }
  ];
};
