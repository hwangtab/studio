import type { Locale } from '../lib/i18n';
import { getOperatorProfileUrlById, studioOperator } from './siteConfig';

// 저자 프로필 페이지(/[locale]/author) 콘텐츠 단일 소스.
// 정본 사실만 사용한다: studioOperator(수상·외부 프로필, data/siteConfig.ts)와
// releaseProject.producer 카피(70+ 발매작·15년 경력, public/locales/*/common.json).
// 여기에 없는 새 경력·수치 주장을 추가하려면 먼저 위키 정본(entities/services.md)과 대조할 것.

const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }): string => {
  return dict[locale as keyof typeof dict] || dict.en || dict.ko;
};

export interface AuthorWorkLink {
  href: string;
  title: string;
  description: string;
}

export const getAuthorProfile = (locale: Locale) => ({
  name: studioOperator.name,
  jobTitle: studioOperator.jobTitleByLocale[locale] || studioOperator.jobTitleByLocale.ko,
  tagline: t(locale, {
    ko: '15년차 음반 기획자 · 프로듀서',
    en: 'Record planner & producer, 15 years in the Korean indie scene',
  }),
  seo: {
    title: t(locale, {
      ko: '황경하 — 음악 프로듀서 · 엔지니어 | 스튜디오 놀',
      en: 'Kyungha Hwang — Music Producer · Engineer | Studio NOL',
    }),
    description: t(locale, {
      ko: '15년차 인디씬 음반 기획자·프로듀서 황경하. 70개가 넘는 발매작을 함께했고, 2017 한국대중음악상 선정위원 특별상을 수상했습니다. 서울 연신내 스튜디오 놀에서 기획·녹음·믹싱·발매·PR까지 동행합니다.',
      en: 'Kyungha Hwang, record planner & producer with 15 years in the Korean indie scene: 70+ releases, 2017 Korean Music Awards special committee prize. Runs Studio NOL in Seoul.',
    }),
    keywords: t(locale, {
      ko: '황경하, 음악 프로듀서, 인디 음반 기획, 스튜디오 놀, 연신내 녹음실, 한국대중음악상',
      en: 'Kyungha Hwang, music producer, indie album production, Studio NOL, Korean Music Awards',
    }),
  },
  // 히어로 배경은 스튜디오 사진(studio1.webp)이다 — alt는 실제 이미지 내용을 기술한다.
  // 인물 사진 alt는 photoAlt로 분리(예전엔 배경·인물 구분 없이 heroAlt 하나를 돌려써서
  // 스튜디오 사진에 "프로듀서 프로필"이라는 alt가 붙어 있었다).
  heroAlt: t(locale, {
    ko: '스튜디오 놀 녹음실 내부 — 황경하가 작업하는 공간',
    en: 'Inside the Studio NOL recording room where Kyungha Hwang works',
  }),
  photo: {
    src: studioOperator.portrait.src,
    alt: t(locale, {
      ko: '프로듀서 황경하',
      en: 'Kyungha Hwang, producer',
    }),
  },
  // Person JSON-LD description — 한 문장 자기소개.
  schemaDescription: t(locale, {
    ko: '여러 인디 아티스트와 함께한 15년차 음반 기획자·프로듀서. 서울 연신내 스튜디오 놀 운영 — 기획·보컬 디렉팅·녹음·믹싱·유통·평론 PR 동행.',
    en: 'Record planner & producer with 15 years alongside Korean indie artists. Runs Studio NOL in Seoul — planning, vocal direction, recording, mixing, distribution, and press PR.',
  }),
  intro: [
    t(locale, {
      ko: '인디 싱어송라이터와 밴드의 발매를 15년째 함께해 왔습니다. 곡을 다듬어 멜론·스포티파이에 올리고, 세션 연주자를 연결하고, 음악 매체와 평론에 닿게 하는 일까지 — 한 곡이 인디씬에 자리 잡는 데 필요한 단계들을 처음부터 끝까지 다룹니다.',
      en: 'For 15 years I have released music together with indie singer-songwriters and bands — shaping songs, getting them on Melon and Spotify, connecting session players, and reaching music press and critics.',
    }),
    t(locale, {
      ko: '서울 연신내의 스튜디오 놀을 운영하며 보컬 디렉팅과 녹음·믹싱·마스터링을 인하우스로 진행합니다. 70개가 넘는 발매작을 아티스트와 함께 만들었고, 2017년에는 〈젠트리피케이션〉의 프로듀서로 제14회 한국대중음악상 선정위원 특별상을 받았습니다.',
      en: 'I run Studio NOL in Yeonsinnae, Seoul, handling vocal direction, recording, mixing, and mastering in-house. I have made 70+ releases with artists, and in 2017 received the 14th Korean Music Awards special committee prize as producer of "Gentrification".',
    }),
    t(locale, {
      ko: '성공적인 발매는 혼자 해내기 어렵습니다. 결과를 약속하기보다, 음악이 세상에 닿는 동선을 함께 만드는 동료가 되는 것 — 그게 제가 하는 일입니다.',
      en: 'A successful release is hard to pull off alone. Rather than promising outcomes, my job is to be the colleague who builds the path your music takes into the world.',
    }),
  ],
  stats: [
    { value: '70+', label: t(locale, { ko: '함께한 발매작', en: 'Releases together' }) },
    { value: '15년', label: t(locale, { ko: '음반 작업 경력', en: 'Years of record work' }) },
    { value: '2017', label: t(locale, { ko: '한국대중음악상 선정위원 특별상', en: 'Korean Music Awards special prize' }) },
  ],
  expertise: locale === 'ko'
    ? ['A&R', '음반 기획', '보컬 디렉팅', '믹싱', '인디 음악 유통', '평론 PR', '세션 네트워킹']
    : ['A&R', 'Album Production', 'Vocal Direction', 'Mixing', 'Indie Music Distribution', 'Press PR', 'Session Networking'],
  award: {
    title: t(locale, {
      ko: '2017 제14회 한국대중음악상 — 선정위원 특별상',
      en: '2017 14th Korean Music Awards — Special Committee Prize',
    }),
    detail: t(locale, {
      ko: '〈젠트리피케이션〉(자립음악생산조합 기획·제작, 2016 발매) 프로듀서. 같은 해 최우수 포크 음반 부문 후보.',
      en: 'Producer of "Gentrification" (2016). Also nominated for Best Folk Album the same year.',
    }),
  },
  // URL은 siteConfig.operatorProfiles가 단일 소스 — 여기선 라벨만 붙인다.
  // id로 찾으므로 siteConfig에서 순서가 바뀌어도 어긋나지 않는다.
  externalProfiles: [
    { label: t(locale, { ko: 'ggac.kr 아티스트 프로필', en: 'Artist profile on ggac.kr' }), url: getOperatorProfileUrlById('ggac') },
    { label: t(locale, { ko: '벅스(Bugs) 아티스트 페이지', en: 'Artist page on Bugs Music' }), url: getOperatorProfileUrlById('bugs') },
    { label: t(locale, { ko: 'Apple Music 아티스트 페이지', en: 'Artist page on Apple Music' }), url: getOperatorProfileUrlById('appleMusic') },
    { label: t(locale, { ko: '멜론 아티스트 페이지', en: 'Artist page on Melon' }), url: getOperatorProfileUrlById('melon') },
    { label: t(locale, { ko: '지니 아티스트 페이지', en: 'Artist page on Genie' }), url: getOperatorProfileUrlById('genie') },
    { label: t(locale, { ko: '네이버 바이브 아티스트 페이지', en: 'Artist page on NAVER VIBE' }), url: getOperatorProfileUrlById('vibe') },
  ],
  // 제3자 보도 — 수상 이력을 사이트 밖에서 검증할 수 있는 근거. siteConfig가 단일 소스.
  pressCoverage: studioOperator.pressCoverage.map((article) => ({
    url: article.url,
    title: article.title,
    meta: `${article.publisher} · ${article.datePublished}`,
  })),
  headings: {
    about: t(locale, { ko: '소개', en: 'About' }),
    expertise: t(locale, { ko: '전문 분야', en: 'Expertise' }),
    award: t(locale, { ko: '수상', en: 'Award' }),
    profiles: t(locale, { ko: '외부 프로필', en: 'Profiles elsewhere' }),
    press: t(locale, { ko: '언론 보도', en: 'In the press' }),
    work: t(locale, { ko: '함께 하는 방법', en: 'Work with me' }),
  },
  cta: {
    titleLine1: t(locale, { ko: '발매를 준비하고 있다면,', en: 'Preparing a release?' }),
    titleHighlight: t(locale, { ko: '함께 동선을 만들어 드립니다', en: "Let's build the path together" }),
    subtitle: t(locale, {
      ko: '녹음·믹싱부터 발매·PR까지, 지금 단계에서 무엇이 필요한지 편하게 물어보세요.',
      en: 'From recording and mixing to release and PR — ask what your next step needs.',
    }),
    imageAlt: t(locale, { ko: '스튜디오 놀 내부 전경', en: 'Inside Studio NOL' }),
  },
  workLinks: [
    {
      href: '/release-project',
      title: t(locale, { ko: '발매 프로젝트', en: 'Release Project' }),
      description: t(locale, {
        ko: '기획부터 녹음·세션·유통·매체 PR까지 — 싱글·EP·정규 발매 동행',
        en: 'From planning to recording, sessions, distribution, and press — single, EP, and album releases',
      }),
    },
    {
      href: '/portfolio',
      title: t(locale, { ko: '포트폴리오', en: 'Portfolio' }),
      description: t(locale, {
        ko: '아티스트와 함께 만든 작업물',
        en: 'Work made together with artists',
      }),
    },
    {
      href: '/stories',
      title: t(locale, { ko: '가이드 스토리', en: 'Guide Stories' }),
      description: t(locale, {
        ko: '녹음·믹싱·발매 실전 가이드 라이브러리',
        en: 'A library of hands-on recording, mixing, and release guides',
      }),
    },
  ] as AuthorWorkLink[],
});
