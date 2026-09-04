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
  // 비-ko 페이지 본문·크레딧은 로마자 표기라, 별칭이 없으면 AI 엔진이 "Hwang Kyungha"와
  // "황경하"를 별개 인물로 볼 수 있다. 철자 정본은 Kyungha(authorProfile·llms.txt 동일).
  // 어순은 두 갈래로 실제 쓰인다 — 포트폴리오·siteConfig·data/home.ts 프로즈는 한국식
  // 성-이름 순("Hwang Kyungha"), authorProfile.ts·llms.ts는 영문식 이름-성 순
  // ("Kyungha Hwang"). 한쪽으로 강제 통일하지 않고 배열로 둘 다 실어 GEO 엔티티
  // 병합을 돕는다 — 문자열 하나만 실으면 다른 어순으로 검색·인용된 건은 못 붙는다.
  alternateName: ['Hwang Kyungha', 'Kyungha Hwang'],
  sameAs: operatorProfiles.map((profile) => profile.url),
  // 운영자 인물 사진(정사각, 원형 크롭 전제) — 홈 신뢰 스트립·/author 히어로·Person JSON-LD의
  // image가 함께 쓴다. 사진을 교체하면 치수도 여기서 같이 바뀌도록 src와 한자리에 둔다.
  portrait: { src: '/images/producer-hwang-kyungha.jpg', width: 864, height: 864 },
  // 수상 이력 — JSON-LD Person.award. AI 엔진이 author를 "수상 프로듀서" 엔티티로 인식하는 강한 E-E-A-T 신호.
  //
  // source 필드는 검증 근거를 구분한다. 이 구분을 지울 것:
  //   'press'      — 아래 pressCoverage 보도로 사이트 밖에서 확인 가능
  //   'self'       — 본인 진술. 시상 자체의 실재는 확인했으나(레드어워드=문화연대·노동당 계열,
  //                  '연대'·'현장' 부문 실재) 연도별 수상자 명단이 공개 색인에 없다.
  //                  공식 기록 URL을 찾으면 source를 'press'로 올리고 근거를 pressCoverage에 추가할 것.
  awards: [
    { year: '2024', name: '레드어워드', category: '주목할만한 연대', work: '이름을 모르는 먼 곳의 그대에게', source: 'self' },
    { year: '2019', name: '레드어워드', category: '주목할만한 연대', work: '몸의 중심', source: 'self' },
    // 〈젠트리피케이션〉(자립음악생산조합 기획·제작, 2016.10.05 발매)으로 제14회 한국대중음악상
    // '선정위원 특별상' 공동 수상. 같은 해 '최우수 포크 음반'은 후보 등재.
    { year: '2017', name: '한국대중음악상', category: '선정위원 특별상', work: '젠트리피케이션', source: 'press' },
    { year: '2017', name: '레드어워드', category: '현장', work: '콜트콜텍 투쟁 10주년 기념음반', source: 'self' },
    { year: '2015', name: '레드어워드', category: '주목할만한 연대', work: '테이크아웃드로잉', source: 'self' },
    { year: '2012', name: '다음뮤직 이달의 음반', category: '', work: 'No Control', source: 'self' },
  ],
  // 작업 연보 — 기획·제작·프로듀싱 크레딧. kind로 음반/그 외를 나눈다(프로필 페이지가 두 그룹으로 렌더).
  // 배경 설명은 넣지 않는다: 작품명·연도·역할만 적으면 아는 사람은 알아보고, 모르는 사람에겐 음반 이력으로 읽힌다.
  credits: [
    { year: '2024', title: '이름을 모르는 먼 곳의 그대에게', role: 'producer', kind: 'album' },
    { year: '2024', title: '세민 〈여린잎〉', role: 'planProduce', kind: 'album' },
    { year: '2024', title: '황경하 〈눈녹듯〉', role: 'release', kind: 'album' },
    { year: '2022', title: '〈강호중〉', role: 'producer', kind: 'album' },
    { year: '2022', title: '〈엉아들〉', role: 'producer', kind: 'album' },
    { year: '2022', title: '물고기는 물이 없으면 죽어요', role: 'planProduce', kind: 'album' },
    { year: '2019', title: '몸의 중심', role: 'planProduce', kind: 'album' },
    { year: '2018', title: '경하와 세민 EP 〈볼찌어다 내가 세상 끝날까지 너희와 항상 함께 있으리라〉', role: 'planProduce', kind: 'album' },
    { year: '2017–2018', title: '새 민중음악 선곡집 1·2·3', role: 'planProduce', kind: 'album' },
    { year: '2017', title: '콜트콜텍 기타노동자 밴드 〈콜트콜텍 투쟁 10주년 기념음반〉', role: 'planProduce', kind: 'album' },
    { year: '2016', title: '젠트리피케이션', role: 'planProduce', kind: 'album' },
    { year: '2015', title: '테이크아웃드로잉', role: 'planProduce', kind: 'album' },
    { year: '2014', title: '김사월X김해원 〈비밀〉', role: 'plan', kind: 'album' },
    { year: '2023–2026', title: '강정피스앤뮤직캠프', role: 'coPlan', kind: 'project' },
    { year: '2023', title: '씨앗페', role: 'coPlan', kind: 'project' },
    { year: '2020', title: '전시 〈노량진 — 터, 도시, 사람〉', role: 'planProduce', kind: 'project' },
    { year: '2017', title: '아현포차 요리책', role: 'write', kind: 'project' },
    { year: '2015', title: '한남동 자립심 페스티벌', role: 'plan', kind: 'project' },
    { year: '2012–2015', title: '51플러스 페스티벌', role: 'plan', kind: 'project' },
    { year: '2011–2016', title: '레코드폐허', role: 'plan', kind: 'project' },
  ],
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
    {
      url: 'https://h21.hani.co.kr/arti/society/society_general/44394.html',
      title: '민중음악이 구리다고요?',
      publisher: '한겨레21',
      datePublished: '2017-11-02',
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
      // 사람이 클릭하는 링크(Footer·about·ContactInfoCard). 단축 URL이라 네이버앱 딥링크가 붙는다.
      naverMapUrl: 'https://naver.me/5gFZhS3X',
      // 기계가 읽는 정본. 위 단축 URL이 307로 가리키는 실제 목적지(2026-08-24 리다이렉트 추적 확인).
      // sameAs에 단축 URL을 넣으면 크롤러가 리다이렉트를 따라가야 값을 알고, 단축 링크는 폐기될 수
      // 있다. 플레이스 ID 1527843821이 영구 식별자이므로 엔티티 신호는 이쪽으로 낸다.
      naverPlaceUrl: 'https://map.naver.com/p/entry/place/1527843821',
      // 구글 비즈니스 프로필 CID URL (2026-08-24 브라우저로 상호·주소·전화 직접 대조 확인).
      //
      // 주의 — 같은 사업장의 GBP가 2개 존재한다:
      //   CID 17692560696856302422 = "스튜디오 놀 불광점" (활성, 우리가 관리하는 쪽)  ← 여기
      //   CID 5451462716481993990  = "스튜디오 놀" (폐업함·게시 중지, 소유권 없음)
      // 주소·전화가 완전히 동일한 중복 리스팅이며, 하필 정확한 상호를 가진 쪽이 폐업 표시다.
      // 중복 신고로 정리되기 전까지 검색·LLM이 "폐업"을 집을 위험이 남아 있다.
      // 정리 완료 후에도 이 CID(활성)는 그대로 유지된다.
      googleBusinessUrl: 'https://www.google.com/maps?cid=17692560696856302422',
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
    // 통신판매업 신고번호. 신고 완료 후 값 기입 — 빈 문자열인 동안 소비처(Footer 등)는 렌더하지 않는다.
    mailOrderSalesNumber: '',
    // 사업자등록번호 (전자상거래 표시 의무 — 약관·푸터 표기)
    businessRegistrationNumber: '753-74-00653',
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
