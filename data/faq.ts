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
    // ... Simplified Chinese placeholders or partial translations ...
  ],
  es: [
    {
      question: '¿Dónde está ubicado Studio NOL?',
      answer: 'Estamos en el 3er piso, 84-3 Daejo-dong, Eunpyeong-gu, Seúl. A 5 minutos a pie de la estación Bulgwang (Salida 7) o la estación Yeonsinnae.',
    },
     {
      question: '¿Cuánto cuesta el estudio de grabación?',
      answer: 'La grabación cuesta 100,000 KRW por hora, con un mínimo de 2 horas. El paquete de 6 horas cuesta 500,000 KRW. Incluye ingeniería profesional.',
    },
    // ... Spanish placeholders ...
  ]
};

export const getFaqData = (locale: Locale) => {
  return faqData[locale] || faqData['ko']; // Fallback to Korean if translation missing
};