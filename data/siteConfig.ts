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
/**
 * 운영자(황경하) 본인 엔티티의 권위 프로필 — JSON-LD Person.sameAs의 단일 소스.
 *
 * AI 엔진은 author.name + sameAs로 entity resolution을 한다. "황경하"는 동명이인이
 * 여럿이라 프로필이 흩어져 있으면 AI가 다른 사람과 섞는다. 여기 모아 하나로 묶는다.
 *
 * 등록 기준: 본인 확정 근거 2개 이상을 직접 확인한 URL만. 이름만 같은 페이지는 넣지 않는다
 * (Spotify에 이름이 정확히 일치하는 아티스트가 있으나 디스코그래피를 확인하지 못해 제외).
 *
 * id는 authorProfile.ts가 라벨을 붙일 때 쓴다 — 배열 인덱스로 참조하면 순서가 바뀔 때
 * 조용히 어긋나므로 id로 찾게 했다.
 */
export const operatorProfiles = [
  // 2026-06-19 확인
  { id: 'ggac', url: 'https://ggac.kr/artists/hwang-gyeong-ha' },
  { id: 'bugs', url: 'https://music.bugs.co.kr/artist/20045652' },
  // 2026-07-28 확인 — 아래 4곳은 〈눈녹듯〉(2024-08-05) + Bugs 디스코그래피 곡 중복으로 본인 확정.
  // Apple Music은 앨범아트 UPC(888618381700)가 포트폴리오 데이터와 완전히 일치.
  { id: 'appleMusic', url: 'https://music.apple.com/kr/artist/1301544239' },
  { id: 'melon', url: 'https://www.melon.com/artist/song.htm?artistId=957470' },
  { id: 'genie', url: 'https://www.genie.co.kr/detail/artistInfo?xxnm=80600168' },
  { id: 'vibe', url: 'https://vibe.naver.com/artist/481720' },
] as const;

export type OperatorProfileId = (typeof operatorProfiles)[number]['id'];

export const getOperatorProfileUrlById = (id: OperatorProfileId): string =>
  operatorProfiles.find((profile) => profile.id === id)?.url ?? '';

// 사이트 운영자 정보 — JSON-LD Person.author와 article:author 메타에 사용.
// GEO에서 AI 엔진(ChatGPT/Claude/Perplexity)은 author.name + sameAs를 entity 단서로
// 강하게 활용하므로 Organization name이 아닌 실제 운영자 이름을 명시해야 cite 받음.
export const studioOperator = {
  name: '황경하',
  sameAs: operatorProfiles.map((profile) => profile.url),
  // 운영자 인물 사진(정사각, 원형 크롭 전제) — 홈 신뢰 스트립·/author 히어로·Person JSON-LD의
  // image가 함께 쓴다. 사진을 교체하면 치수도 여기서 같이 바뀌도록 src와 한자리에 둔다.
  portrait: { src: '/images/producer-hwang-kyungha.jpg', width: 864, height: 864 },
  // 검증된 수상 이력 — JSON-LD Person.award. AI 엔진이 author를 "수상 프로듀서" 엔티티로 인식하는 강한 E-E-A-T 신호.
  // 〈젠트리피케이션〉(자립음악생산조합 기획·제작, 2016.10.05 발매)의 프로듀서로 2017 제14회 한국대중음악상
  // '선정위원 특별상' 수상. (같은 해 '최우수 포크 음반'은 후보 등재.) 출처: 아래 pressCoverage 노컷뉴스 보도.
  award: '2017 한국대중음악상 선정위원 특별상 〈젠트리피케이션〉',
  // 운영자를 다룬 제3자 언론 보도. sameAs(본인이 관리하는 프로필)와 성격이 다르므로
  // JSON-LD에서도 Person.subjectOf로 따로 낸다 — 수상·이력 주장을 사이트 밖에서
  // 검증할 수 있는 근거다. 전부 2026-07-28 원문 직접 확인.
  pressCoverage: [
    {
      url: 'https://www.nocutnews.co.kr/news/4741803',
      title: '가난·페미니즘·강제철거 반대… 한대음을 빛낸 수상소감',
      publisher: '노컷뉴스',
      datePublished: '2017-03-01',
    },
    {
      url: 'https://www.khan.co.kr/article/201606251956021',
      title: '천 번을 들어줘야 4200원, 먹고 살 수 있습니까?',
      publisher: '경향신문',
      datePublished: '2016-06-25',
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
      email: 'hello@studionol.co.kr',
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
