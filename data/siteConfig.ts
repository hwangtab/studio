import type { SiteConfig, SEODefaults } from '../types/data';
import type { Locale } from '../lib/i18n';
import { CANONICAL_FACTS } from '../lib/factTokens';

// Social profiles — 계정 개설 시 URL 추가 (schema.org sameAs에 자동 반영됨)
export const socialProfiles = {
  instagram: 'https://www.instagram.com/studio_nol_',
  threads: 'https://www.threads.com/@studio_nol_',
  youtube: '',
  facebook: '',
  twitter: '',
};

// 사이트 운영자 정보 — JSON-LD Person.author와 article:author 메타에 사용.
// GEO에서 AI 엔진(ChatGPT/Claude/Perplexity)은 author.name + sameAs를 entity 단서로
// 강하게 활용하므로 Organization name이 아닌 실제 운영자 이름을 명시해야 cite 받음.
export const studioOperator = {
  name: '황경하',
  // 운영자 본인(Person) 엔티티의 권위 프로필 — JSON-LD author.sameAs에만 반영(Organization sameAs와 분리).
  // AI 엔진(특히 ChatGPT는 상위 인용 ~48%가 Wikipedia급 엔티티)이 author entity resolution에 사용.
  // 실재 검증된 URL만 등록(2026-06-19 확인): ggac.kr 아티스트 프로필, Bugs 음원 DB 아티스트 페이지.
  sameAs: [
    'https://ggac.kr/artists/hwang-gyeong-ha',
    'https://music.bugs.co.kr/artist/20045652',
  ],
  // 검증된 수상 이력 — JSON-LD Person.award. AI 엔진이 author를 "수상 프로듀서" 엔티티로 인식하는 강한 E-E-A-T 신호.
  // 〈젠트리피케이션〉(자립음악생산조합 기획·제작, 2016.10.05 발매)의 프로듀서로 2017 제14회 한국대중음악상
  // '선정위원 특별상' 수상. (같은 해 '최우수 포크 음반'은 후보 등재.) 출처: 한겨레21·한국대중음악상 시상 기록.
  award: '2017 한국대중음악상 선정위원 특별상 〈젠트리피케이션〉',
  // 수상 사실을 확인해 주는 제3자 언론 보도. sameAs(본인 프로필)와 성격이 다르므로
  // JSON-LD에서도 Person.subjectOf로 따로 낸다 — AI 엔진이 "수상 프로듀서" 주장을
  // 자체 사이트 밖에서 검증할 수 있는 유일한 근거다(2026-07-28 원문 확인).
  pressCoverage: [
    {
      url: 'https://www.nocutnews.co.kr/news/4741803',
      title: '가난·페미니즘·강제철거 반대… 한대음을 빛낸 수상소감',
      publisher: '노컷뉴스',
      datePublished: '2017-03-01',
    },
  ],
  jobTitleByLocale: {
    ko: '음악 프로듀서 · 엔지니어',
    en: 'Music Producer · Engineer',
    zh: '音乐制作人 · 工程师',
    es: 'Productor Musical · Ingeniero',
    vi: 'Nhà Sản Xuất Âm Nhạc · Kỹ Sư',
    th: 'โปรดิวเซอร์เพลง · วิศวกร',
    uz: 'Musiqa Prodyuseri · Muhandis',
  } as Record<string, string>,
};

// Translation helper
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

const normalizeSiteUrl = (value: string): string => value.replace(/\/+$/, '');

export const getSiteConfig = (locale: Locale): SiteConfig => {
  return {
    name: t(locale, { ko: '스튜디오 놀', en: 'Studio NOL', zh: 'Studio NOL', es: 'Studio NOL', vi: 'Studio NOL', th: 'Studio NOL', uz: 'Studio NOL' }),
    url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://studionol.co.kr'),
    logo: '/logo/logo.png',
    description: t(locale, {
      ko: '연신내 녹음실, 연습실, 믹싱, 마스터링, 음반 제작 스튜디오',
      en: 'Music recording, practice room, mixing, mastering, and production studio.',
      zh: '录音室、练习室、混音、母带处理、唱片制作工作室',
      es: 'Estudio de grabación, sala de práctica, mezcla, masterización y producción.',
      vi: 'Phòng thu, phòng tập, mixing, mastering và studio sản xuất âm nhạc.',
      th: 'สตูดิโอบันทึกเสียง ห้องซ้อม มิกซ์ มาสเตอริ่ง และโปรดักชันเพลง',
      uz: 'Yozuv studiyasi, mashg‘ulot xonasi, miks, mastering va musiqa prodakshn studiyasi.'
    }),
    contact: {
      phone: CANONICAL_FACTS.phone,
      email: 'hwangtab@gmail.com',
      address: t(locale, {
        ko: '서울특별시 은평구 대조동 84-3 3층(동명여고 바로 옆)',
        en: '3rd Floor, 84-3 Daejo-dong, Eunpyeong-gu, Seoul',
        zh: '首尔特别市恩平区大枣洞 84-3 3层',
        es: '3er piso, 84-3 Daejo-dong, Eunpyeong-gu, Seúl',
        vi: 'Tầng 3, 84-3 Daejo-dong, Eunpyeong-gu, Seoul',
        th: 'ชั้น 3, 84-3 Daejo-dong, Eunpyeong-gu, Seoul',
        uz: 'Seul sh., Eunpyeong-gu, Daejo-dong 84-3, 3-qavat'
      }),
      kakaoUrl: 'https://open.kakao.com/me/nol',
      naverMapUrl: 'https://naver.me/5gFZhS3X',
    },
    vatNotice: t(locale, {
      ko: '* 모든 가격은 VAT 별도입니다.',
      en: '* All prices exclude VAT.',
      zh: '* 所有价格均不含增值税。',
      es: '* Todos los precios excluyen el IVA.',
      vi: '* Tất cả giá chưa bao gồm VAT.',
      th: '* ราคาทั้งหมดไม่รวม VAT',
      uz: '* Barcha narxlar VATsiz.'
    }),
  };
};

export const getSeoDefaults = (locale: Locale): SEODefaults => {
  return {
    title: t(locale, {
      ko: '스튜디오 놀 | 음악 제작 스튜디오',
      en: 'Studio NOL | Music Production Studio',
      zh: 'Studio NOL | 音乐制作工作室',
      es: 'Studio NOL | Estudio de Producción Musical',
      vi: 'Studio NOL | Studio sản xuất âm nhạc',
      th: 'Studio NOL | สตูดิโอผลิตเพลง',
      uz: 'Studio NOL | Musiqa ishlab chiqarish studiyasi'
    }),
    description: t(locale, {
      ko: '연신내역 도보 5분, 스튜디오 놀에서 녹음실·음악연습실·믹싱/마스터링 서비스를 한 번에 이용하세요.',
      en: '5-min walk from station. Experience recording, practice rooms, and mixing/mastering at Studio NOL.',
      zh: '步行5分钟即到。在 Studio NOL 一站式体验录音、练习、混音/母带服务。',
      es: 'A 5 min a pie de la estación. Experimenta grabación, salas de práctica y mezcla/masterización.',
      vi: 'Cách ga 5 phút đi bộ. Trải nghiệm thu âm, phòng tập và mixing/mastering tại Studio NOL.',
      th: 'เดิน 5 นาทีจากสถานี ใช้บริการบันทึกเสียง ห้องซ้อม และมิกซ์/มาสเตอริ่งที่ Studio NOL ได้ในที่เดียว',
      uz: 'Bekatdan 5 daqiqa piyoda. Studio NOL’da yozuv, mashg‘ulot xonasi va miks/mastering xizmatlarini bir joyda oling.'
    }),
    keywords: t(locale, {
      ko: '연신내 녹음실, 음악연습실, 은평구 연습실, 스튜디오 놀, 서울 녹음실, 믹싱 마스터링 스튜디오, 음악 제작 스튜디오, 축가 녹음, 성우 녹음, 오디오북 녹음, 일반인 녹음실',
      en: 'Yeonsinnae recording studio, Eunpyeong practice room, Studio NOL, Seoul recording studio, mixing mastering studio, music production studio, wedding song recording, voice over recording, audiobook recording',
      zh: '延新内录音室, 恩平区练习室, Studio NOL, 首尔录音室, 混音母带工作室, 音乐制作工作室, 婚礼歌曲录制, 配音录制, 有声读物录制',
      es: 'estudio de grabación en Yeonsinnae, sala de práctica en Eunpyeong, Studio NOL, estudio de grabación en Seúl, estudio de mezcla y masterización, estudio de producción musical, grabación de canciones de boda, grabación de voz en off, grabación de audiolibros',
      vi: 'phòng thu Yeonsinnae, phòng tập Eunpyeong, Studio NOL, phòng thu Seoul, studio mixing mastering, studio sản xuất âm nhạc, thu âm nhạc cưới, thu âm voice over, thu âm sách nói',
      th: 'สตูดิโอบันทึกเสียง Yeonsinnae, ห้องซ้อม Eunpyeong, Studio NOL, สตูดิโอบันทึกเสียงในโซล, สตูดิโอมิกซ์มาสเตอริ่ง, สตูดิโอผลิตเพลง, อัดเพลงงานแต่ง, อัดเสียงพากย์, อัดเสียงอ่านหนังสือ',
      uz: 'Yeonsinnae yozuv studiyasi, Eunpyeong mashg‘ulot xonasi, Studio NOL, Seul yozuv studiyasi, miks mastering studiyasi, musiqa prodakshn studiyasi, to‘y qo‘shig‘i yozuvi, voice over yozuvi, audiokitob yozuvi'
    }),
  };
};
