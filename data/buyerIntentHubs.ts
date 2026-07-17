/**
 * Buyer-intent 큐레이션 hub 정의.
 *
 * Story category hub(주제 분류)와 달리 buyer-intent hub는 구매·예약 직전 의도를
 * 한 페이지에 응축한 LP다. 자산은 모두 기존 1,730 스토리 + portfolio + pricing에
 * 이미 존재하며, 이 파일은 그것들을 buyer-intent 키워드로 재조합한 큐레이션 매니페스트.
 *
 * 한국어(ko)에 우선 노출하고 다른 locale은 noindex로 처리해 fallback 페이지가
 * Google에 인덱싱되지 않도록 한다 — 실제 번역 작업이 들어오면 hreflang을 활성화.
 */

import type { ServiceKey } from './serviceRelatedStories';

export type BuyerIntentHubSlug =
  | 'wedding-song-singing'
  | 'audiobook-asmr-getting-started'
  | 'home-recording-survival'
  | 'vocal-beginners-guide'
  | 'cover-video-production'
  | 'indie-release-guide';

export interface BuyerIntentHubQuickAnswer {
  q: string;
  a: string;
}

export interface BuyerIntentHubFeature {
  title: string;
  description: string;
}

/**
 * pricingPackageId 매핑이 안 맞는 hub 전용 fallback 가격 카드.
 * 예: lesson 가격은 data/pricing.ts에 별도 entry가 없어 hub에서 직접 정의.
 */
export interface BuyerIntentHubPricingFallback {
  id: string;
  title: string;
  priceDisplay: string;
  unit?: string;
  description: string;
  features: readonly string[];
  recommended?: boolean;
}

export interface BuyerIntentHub {
  slug: BuyerIntentHubSlug;
  /** SEO title — 60자 이내 권장 */
  seoTitle: string;
  /** SEO meta description — 160자 이내 권장 */
  seoDescription: string;
  /** SEO keywords (선택) */
  keywords?: string;
  /** Hero 영역 콘텐츠 */
  hero: {
    title: string;
    titleHighlight: string;
    subtitle: string;
    image: string;
    imageAlt: string;
  };
  /** 인트로 단락 — 의도와 적합 대상을 명시 */
  intro: string;
  /** "이런 분들에게 어울려요" 3-4 항목 */
  forWhom: BuyerIntentHubFeature[];
  /** 빠른 답변 4-6개 — FAQ schema로도 발행 */
  quickAnswers: BuyerIntentHubQuickAnswer[];
  /** 큐레이션된 관련 스토리 6편 */
  relatedStorySlugs: readonly string[];
  /**
   * 가격 모듈 — pricingData의 id(specialPackages/recordingOffers/mixingOffers)를 가리킨다.
   * pricing 데이터에 매핑되지 않는 경우(예: lesson)는 빈 문자열로 두고 pricingFallback을 사용.
   */
  pricingPackageId: string;
  /** 보조 가격 패키지 (있을 경우) */
  secondaryPricingPackageId?: string;
  /**
   * pricingPackageId 매핑이 빈 문자열이거나 lookup 실패 시 사용할 fallback 카드.
   * lesson처럼 pricing 데이터에 entry가 없는 서비스에서 사용.
   */
  pricingFallback?: BuyerIntentHubPricingFallback;
  /**
   * 관련 portfolio 노출 카테고리 — 'all' | PortfolioItem.category 값.
   * 'all'은 featured 우선으로 셔플.
   */
  portfolioCategory: 'all' | 'single' | 'album' | 'compilation' | 'commercial';
  /** 본 hub와 가장 가까운 service LP — primary CTA 대상 */
  primaryServiceLink: ServiceKey | 'practice-room' | 'release-project' | 'contact';
  /** 보조 service LP — secondary CTA */
  secondaryServiceLink?: ServiceKey | 'practice-room' | 'release-project' | 'contact';
}

export const buyerIntentHubs: Record<BuyerIntentHubSlug, BuyerIntentHub> = {
  'wedding-song-singing': {
    slug: 'wedding-song-singing',
    seoTitle: '결혼식 축가 직접 부르기 — 신랑·신부를 위한 녹음 가이드',
    seoDescription:
      '결혼식에서 축가를 직접 부르고 싶은 신랑·신부를 위한 한 페이지 가이드. 선곡·연습부터 스튜디오 녹음, 식장 납품까지 한 번에 정리했습니다.',
    keywords:
      '결혼식 축가, 신랑 신부 축가, 셀프 축가, 축가 녹음, 축가 준비, 웨딩송 녹음, 축가 패키지',
    hero: {
      title: '결혼식 축가,',
      titleHighlight: '직접 부르고 싶다면',
      subtitle:
        '연습·녹음·식장 납품까지 D-30일부터 당일까지 한 번에 정리했습니다. 노래를 잘 못해도 괜찮습니다.',
      image: '/images/recording7.webp',
      imageAlt: '결혼식 축가 녹음을 준비하는 신랑·신부',
    },
    intro:
      '결혼식 당일 라이브 축가는 감동적이지만 리스크가 큽니다. 한 번의 기회에 200명 앞에서 모든 걸 걸어야 합니다. 녹음 축가는 여러 테이크 중 가장 좋은 부분을 골라 완성된 음원으로 만들어 식장에서 안정적으로 재생하는 방식입니다. 이 페이지는 신랑·신부가 처음 축가를 준비할 때 알아야 할 모든 가이드를 한 곳에 모은 색인입니다.',
    forWhom: [
      {
        title: '직접 부른 음원으로 식장에서 재생하고 싶은 분',
        description: '식장 음향 시스템 호환성과 USB 납품까지 안내합니다.',
      },
      {
        title: '노래에 자신이 없어 라이브가 부담스러운 분',
        description: '여러 테이크 + 보컬 튠으로 완성도 있는 결과물을 만들 수 있습니다.',
      },
      {
        title: '듀엣·합창 축가를 준비하는 분',
        description: '파트 분배와 호흡 맞추기, 부스 세팅까지 함께 진행합니다.',
      },
    ],
    quickAnswers: [
      {
        q: '노래를 잘 못해도 축가 녹음이 가능한가요?',
        a: '가능합니다. 보컬 튠(피치·박자 보정)이 패키지에 포함되어 있고 엔지니어가 디렉팅을 함께해 처음 녹음하는 분도 좋은 결과물을 만들 수 있습니다.',
      },
      {
        q: '준비는 언제부터 시작해야 하나요?',
        a: 'D-30일부터 시작을 권장합니다. D-30 선곡, D-14 스튜디오 예약·연습, D-7 최종 체크, D-Day 녹음, D+3~5 믹싱·납품 순으로 진행합니다.',
      },
      {
        q: '비용은 얼마인가요?',
        a: '축가 완성 패키지는 35만원입니다. 녹음 2시간 + 보컬 튠 + 믹싱·마스터링이 모두 포함된 올인원 가격입니다.',
      },
      {
        q: '듀엣·합창 축가도 가능한가요?',
        a: '가능합니다. 두 분이 함께 부스에 들어가거나 파트를 나누어 녹음할 수 있습니다. 예약 시 형태를 알려주시면 세팅을 미리 준비합니다.',
      },
      {
        q: '식장에서 바로 재생할 수 있는 파일을 받을 수 있나요?',
        a: 'WAV·MP3 두 포맷으로 납품해 대부분의 식장 음향 시스템에서 즉시 재생 가능합니다.',
      },
    ],
    relatedStorySlugs: [
      'wedding-song-guide1',
      'vocal-prep1',
      'vocal-recording-guide1',
      'diaphragm1',
      'breath-support1',
      'balladstyle1',
      'practice-room-yeonsinnae1',
    ],
    pricingPackageId: 'package-wedding',
    portfolioCategory: 'single',
    primaryServiceLink: 'wedding-song',
    secondaryServiceLink: 'pricing',
  },

  'audiobook-asmr-getting-started': {
    slug: 'audiobook-asmr-getting-started',
    seoTitle: '오디오북·ASMR·내레이션 첫 도전 — 녹음부터 유통까지',
    seoDescription:
      '오디오북·ASMR·내레이션·팟캐스트 녹음을 처음 시작하는 분을 위한 한 페이지 가이드. 원고 준비부터 마이크 세팅, 편집·마스터링, 유통 플랫폼 등록까지 정리했습니다.',
    keywords:
      '오디오북 만들기, ASMR 녹음, 내레이션 녹음, 팟캐스트 녹음, 성우 데모, 오디오북 유통, 보이스 녹음 스튜디오',
    hero: {
      title: '오디오북·ASMR·내레이션,',
      titleHighlight: '첫 도전 한 번에',
      subtitle:
        '원고 준비부터 마이크 세팅, 편집·마스터링, 유통까지 단계별로 정리한 한 페이지 가이드.',
      image: '/images/recording6.webp',
      imageAlt: '오디오북·내레이션 녹음 부스',
    },
    intro:
      '오디오북·ASMR·내레이션은 음악 보컬과 다른 기술이 필요합니다. 발음 명확성, 일관된 속도, 룸 노이즈 제어, 플랫폼별 라우드니스 규격(ACX/Audible -23 LUFS) 같은 요소가 결과물 품질을 좌우합니다. 이 페이지는 첫 도전을 준비하는 분이 알아야 할 핵심 가이드를 한 곳에 모은 색인입니다.',
    forWhom: [
      {
        title: '내 책·콘텐츠를 직접 낭독해 오디오북으로 만들고 싶은 분',
        description: '원고 변환부터 ACX 규격 마스터링, 윌라·밀리의 서재 등록까지 안내.',
      },
      {
        title: '유튜브·팟캐스트용 깨끗한 보이스 트랙이 필요한 분',
        description: 'Neumann U87AI 등 하이엔드 마이크로 드라이하고 깨끗한 소스를 확보합니다.',
      },
      {
        title: '성우 오디션·데모를 처음 준비하는 분',
        description: '발음·아티큘레이션 가이드와 데모 녹음 흐름을 함께 보세요.',
      },
    ],
    quickAnswers: [
      {
        q: '전문 성우가 아니어도 오디오북을 낼 수 있나요?',
        a: '가능합니다. 작가 직접 낭독본이 별도 카테고리로 인기를 끌고 있고, 발음 명확성과 일관된 속도가 더 중요합니다.',
      },
      {
        q: '비용은 얼마나 드나요?',
        a: '성우/내레이션 녹음은 시간당 10만원입니다. 분량·편집·마스터링은 별도 협의로 진행합니다.',
      },
      {
        q: '홈레코딩으로도 가능한가요?',
        a: '가능하지만 방음과 마이크 품질이 관건입니다. 에어컨·냉장고·차량 소음이 섞이면 편집 시간이 크게 늘어 스튜디오 녹음이 결국 더 빠릅니다.',
      },
      {
        q: '오디오북은 어디에서 판매할 수 있나요?',
        a: '국내는 윌라·밀리의 서재·네이버 시리즈온, 해외는 Audible(ACX)·Findaway Voices를 통해 전 세계 플랫폼에 배포할 수 있습니다.',
      },
      {
        q: 'ASMR 녹음과 오디오북 녹음은 어떻게 다른가요?',
        a: 'ASMR은 양이 마이크와 미세한 입소리 처리가 핵심이고, 오디오북은 일관된 톤과 라우드니스 규격이 핵심입니다. 마이크와 처리 방식이 다릅니다.',
      },
    ],
    relatedStorySlugs: [
      'audiobook-guide1',
      'asmr1',
      'podcast1',
      'voice-actor-demo1',
      'articulation1',
      'audio-interface1',
      'practice-room-yeonsinnae1',
    ],
    pricingPackageId: 'package-voiceover',
    portfolioCategory: 'commercial',
    primaryServiceLink: 'voice-acting',
    secondaryServiceLink: 'pricing',
  },

  'home-recording-survival': {
    slug: 'home-recording-survival',
    seoTitle: '원룸·자취방에서 데모 만들기 — 홈레코딩 생존 가이드',
    seoDescription:
      '원룸·자취방·옆집 소음 환경에서 데모를 만드는 현실적인 방법. 마이크·인터페이스·방음·DAW 템플릿부터 스튜디오로 갈 시점까지 정리했습니다.',
    keywords:
      '홈레코딩, 원룸 녹음, 자취방 녹음, 데모 녹음, 오디오 인터페이스, 방음 처리, DAW 입문, 홈스튜디오',
    hero: {
      title: '원룸·자취방에서',
      titleHighlight: '데모 만들기',
      subtitle:
        '방음 한계를 인정하고 결과물을 살리는 현실적인 홈레코딩 가이드. 언제 스튜디오로 가야 하는지도 함께.',
      image: '/images/hardware2.webp',
      imageAlt: '홈레코딩용 오디오 인터페이스와 마이크',
    },
    intro:
      '원룸·자취방 환경에서 완벽한 방음은 불가능에 가깝습니다. 그렇다고 데모 제작을 미룰 필요는 없습니다. 룸 노이즈를 받아들이고 마이크 포지셔닝, 흡음, 후처리로 보완하는 방법이 있습니다. 이 페이지는 홈레코딩 생존 가이드와 "이쯤이면 스튜디오로 가는 게 빠르다"는 판단 기준을 함께 제공합니다.',
    forWhom: [
      {
        title: '원룸·자취방에서 데모를 만들고 싶은 인디 뮤지션',
        description: '최소 장비 셋업과 흡음 트릭, DAW 템플릿까지 안내.',
      },
      {
        title: '홈레코딩 결과물 품질에 한계를 느끼는 분',
        description: '스튜디오 녹음 vs 홈레코딩 비교와 전환 시점 판단 기준.',
      },
      {
        title: '믹싱·마스터링만 외주를 맡기고 싶은 분',
        description: '프로 엔지니어 의뢰 시 어떤 파일을 어떻게 정리해 보내야 하는지.',
      },
    ],
    quickAnswers: [
      {
        q: '원룸에서도 진짜 들을 만한 데모가 나오나요?',
        a: '나옵니다. 단, 마이크 거리·각도·흡음 처리·DAW 후처리 4가지를 모두 신경 써야 합니다. 한두 가지만 빠져도 결과물 품질이 크게 떨어집니다.',
      },
      {
        q: '오디오 인터페이스는 어떤 걸 사야 하나요?',
        a: '입문은 Focusrite Scarlett 2i2급(20~30만원)이면 충분합니다. 마이크는 콘덴서 입문급(SM7B·AT2020·AKG C214 중)에서 환경에 맞는 걸 고릅니다.',
      },
      {
        q: '옆집·아래층 소음이 걱정됩니다.',
        a: '낮 시간대 녹음, 마이크 입력 게인 낮추고 입과 마이크 거리를 가깝게, 두꺼운 이불·옷장·매트리스로 임시 흡음 부스를 만들면 옆집 민원과 룸 노이즈를 동시에 줄일 수 있습니다.',
      },
      {
        q: '언제 스튜디오로 가는 게 좋나요?',
        a: '발매를 목표로 하는 곡, 보컬 컴핑이 많이 필요한 곡, 라우드니스 규격을 맞춰야 하는 곡은 스튜디오가 결국 더 빠르고 저렴합니다.',
      },
      {
        q: '믹싱·마스터링만 의뢰할 수도 있나요?',
        a: '가능합니다. 트랙별로 정리해 WAV로 보내주시면 곡의 복잡도에 따라 견적을 안내해 드립니다.',
      },
    ],
    relatedStorySlugs: [
      'home-vs-studio1',
      'audio-interface1',
      'acoustic-treatment1',
      'demo-recording1',
      'vocal-recording-guide1',
      'daw-template1',
      'practice-room-yeonsinnae1',
    ],
    pricingPackageId: 'recording-pro',
    secondaryPricingPackageId: 'mixing-level1',
    portfolioCategory: 'single',
    primaryServiceLink: 'pricing',
    secondaryServiceLink: 'practice-room',
  },

  'vocal-beginners-guide': {
    slug: 'vocal-beginners-guide',
    seoTitle: '음원 발매를 목표로 하는 작곡·프로듀싱 1:1 레슨 가이드',
    seoDescription:
      '현직 프로듀서의 1:1 실전 레슨으로 MIDI 작곡·편곡·믹싱·마스터링·음원 발매까지. 월 35만원 정액제(주 1회 60분, 월 4회), 첫 상담 무료. 곡 만들기부터 발매·저작권까지 한 페이지에 정리했습니다.',
    keywords:
      '작곡 레슨, 프로듀싱 레슨, 미디 작곡, 믹싱 레슨, 음원 발매 레슨, 1:1 작곡 레슨, 홈레코딩 레슨, 연신내 작곡 레슨',
    hero: {
      title: '음원 발매를 목표로',
      titleHighlight: '1:1 실전 레슨',
      subtitle:
        '현직 프로듀서가 MIDI 작곡·편곡·믹싱·마스터링·발매까지 함께. 월 35만원 정액제로 부담 없이 시작하세요.',
      image: '/images/lesson1.webp',
      imageAlt: '연신내 스튜디오 놀 1:1 레슨실',
    },
    intro:
      '"내 곡을 직접 만들어 발매하고 싶다" — 목표는 사람마다 다릅니다. 스튜디오 놀의 1:1 레슨은 현직 프로듀서가 MIDI 작곡·편곡·믹싱·마스터링·발매·저작권 상담까지 함께 진행하는 실전 커리큘럼입니다. 본인 목표에 맞춰 비중을 조정하고, 본 페이지에 모은 가이드로 자가 학습을 병행하면 효율이 크게 올라갑니다.',
    forWhom: [
      {
        title: '취미로 작곡을 시작하고 싶은 직장인',
        description: '주 1회 60분 정액제로 꾸준히 — DAW 기초부터 곡 완성까지 함께합니다.',
      },
      {
        title: '홈레코딩·자작곡을 발전시키고 싶은 창작자',
        description: '작곡·편곡·믹싱을 1:1로 점검하며 완성도를 끌어올립니다.',
      },
      {
        title: '내 곡을 직접 발매하고 싶은 작곡 입문자',
        description: 'MIDI 작곡·믹싱·마스터링·저작권·발매까지 단일 강사가 끝까지 동행합니다.',
      },
    ],
    quickAnswers: [
      {
        q: '작곡을 한 번도 안 해봤는데 가능한가요?',
        a: '가능합니다. DAW 설치와 기본 조작부터 시작해 첫 곡을 완성하는 데까지 단계별로 진행합니다. 입문자가 다수입니다.',
      },
      {
        q: '레슨 빈도와 시간은 어떻게 되나요?',
        a: '주 1회 · 회당 60분 · 월 4회 정액제로 진행합니다. 회당 시간 분배(작곡 vs 편곡 vs 믹싱)는 강사와 협의해 본인 목표에 맞게 조정합니다.',
      },
      {
        q: '비용은 얼마인가요?',
        a: '월 35만원 정액제(월 4회 · 회당 약 87,500원)입니다. 첫 상담은 무료이며 스튜디오 장비 사용료는 별도로 없습니다.',
      },
      {
        q: '어떤 DAW를 쓰나요? 장비가 없어도 되나요?',
        a: '본인이 쓰는 DAW에 맞춰 진행하며, 없다면 추천부터 도와드립니다. 레슨 중에는 스튜디오 장비를 사용할 수 있습니다.',
      },
      {
        q: '발매까지 정말 도와주나요?',
        a: '네. 곡 완성 후 마스터링·유통사 등록·저작권 등록까지 단일 강사가 끝까지 함께합니다.',
      },
    ],
    relatedStorySlugs: [
      'daw-choice1',
      'songstructure1',
      'chord-progression1',
      'plugins1',
      'distribution1',
      'revenue1',
      'practice-room-yeonsinnae1',
      'practice-room-eunpyeong1',
    ],
    // lesson 가격은 data/pricing.ts에 entry가 없어 hub 전용 fallback 카드를 사용한다.
    pricingPackageId: '',
    pricingFallback: {
      id: 'lesson-monthly',
      title: '1:1 음악 레슨 (월 정액제)',
      priceDisplay: '350,000원',
      unit: '/ 월',
      description:
        '현직 프로듀서가 진행하는 MIDI 작곡·편곡·믹싱·마스터링 통합 1:1 레슨입니다. 첫 상담은 무료로 진행됩니다.',
      recommended: true,
      features: [
        '주 1회 · 회당 60분 · 월 4회',
        'MIDI 작곡·편곡·믹싱·마스터링 통합 커리큘럼',
        '음원 발매·저작권 상담 포함',
        '첫 상담 무료 · 스튜디오 장비 사용료 별도 없음',
      ],
    },
    portfolioCategory: 'single',
    primaryServiceLink: 'lesson',
    secondaryServiceLink: 'contact',
  },

  'cover-video-production': {
    slug: 'cover-video-production',
    seoTitle: '커버 영상 촬영·제작 — 기획부터 유튜브 업로드까지',
    seoDescription:
      '노래 커버 영상을 처음 만드는 분을 위한 한 페이지 가이드. 선곡·의상·촬영 세팅부터 음원 믹싱, 4K 편집, 유튜브·SNS 업로드까지 단계별로 정리했습니다.',
    keywords:
      '커버 영상 촬영, 노래 커버 동영상, 커버곡 영상 제작, 유튜브 커버 영상, SNS 커버 영상, 커버 음원 녹음, 스튜디오 커버 촬영',
    hero: {
      title: '커버 영상,',
      titleHighlight: '처음부터 완성까지',
      subtitle:
        '선곡·의상·촬영 세팅부터 음원 믹싱, 4K 편집, 유튜브·SNS 업로드까지 한 번에 정리했습니다.',
      image: '/images/recording1.webp',
      imageAlt: '스튜디오 커버 영상 촬영 세팅',
    },
    intro:
      '유튜브·인스타그램·틱톡에 커버 영상을 올리고 싶지만 어디서 시작해야 할지 막막한 분이 많습니다. 촬영 공간, 음원 품질, 편집 퀄리티 — 셋 중 하나라도 아쉬우면 시청자가 이탈합니다. 스튜디오 놀의 커버 영상 올인원 패키지는 촬영·음원 녹음·믹싱·편집을 한 번에 해결합니다. 이 페이지는 처음 커버 영상을 준비하는 분이 알아야 할 모든 가이드를 한 곳에 모은 색인입니다.',
    forWhom: [
      {
        title: '유튜브·인스타·틱톡에 커버 영상을 올리고 싶은 분',
        description: '4K 촬영 + 믹싱 음원 + 편집까지 원스톱으로 해결합니다.',
      },
      {
        title: '홈 촬영 품질에 한계를 느끼는 분',
        description: '전문 스튜디오 조명·카메라·방음 환경에서 촬영 퀄리티를 한 단계 끌어올립니다.',
      },
      {
        title: '음원과 영상을 따로 외주 맡기기 번거로운 분',
        description: '촬영·녹음·믹싱·영상 편집을 한 팀이 담당해 납품까지 한 번에 끝납니다.',
      },
    ],
    quickAnswers: [
      {
        q: '악기 연주 없이 보컬만 촬영해도 되나요?',
        a: '가능합니다. MR 위에 보컬만 올리는 방식이 가장 일반적입니다. MR을 직접 가져오거나 스튜디오에서 MR 선정을 도와드립니다.',
      },
      {
        q: '비용은 얼마인가요?',
        a: '커버 영상 촬영 올인원 패키지는 350,000원(VAT 별도)입니다. 촬영·작업 3시간 기준 1곡이며, 4K MP4 영상 + WAV·MP3 음원을 제공합니다.',
      },
      {
        q: '저작권 처리는 어떻게 하나요?',
        a: '커버곡을 유튜브에 업로드하면 Content ID로 원저작자에게 수익이 귀속됩니다. 상업적 사용이 필요한 경우 한국음악저작권협회(KMCA) 신청을 안내해 드립니다.',
      },
      {
        q: '의상·소품은 직접 준비해야 하나요?',
        a: '의상·소품은 직접 가져오시면 됩니다. 스튜디오 배경·조명 세팅은 촬영 전 함께 협의합니다.',
      },
      {
        q: '결과물은 어떤 포맷으로 받나요?',
        a: '4K MP4 영상 파일과 WAV(무손실)·MP3 음원 파일 3종을 함께 드립니다. 유튜브·릴스·틱톡 바로 업로드 가능한 형태로 납품합니다.',
      },
    ],
    relatedStorySlugs: [
      'cover1',
      'music-video1',
      'practice-room-video-audition1',
      'youtube-music-channel1',
      'vocal-recording-guide1',
      'copyright-cover1',
      'practice-room-yeonsinnae1',
    ],
    pricingPackageId: 'package-cover-video',
    portfolioCategory: 'single',
    primaryServiceLink: 'cover-video',
    secondaryServiceLink: 'pricing',
  },

  'indie-release-guide': {
    slug: 'indie-release-guide',
    seoTitle: '인디 음원 발매 A to Z — 싱글·EP·정규, 혼자서도 막히지 않게',
    seoDescription:
      '처음 음원을 발매하는 인디 아티스트를 위한 한 페이지 가이드. 싱글·EP·정규 발매 절차, 유통사 선택, 저작권료, 발매 타임라인부터 프로듀서와 함께하는 발매 프로젝트까지 한 곳에 정리했습니다.',
    keywords:
      '음원 발매 방법, 첫 싱글 발매, 인디 음원 발매, 싱글 발매 절차, 음원 내는 법, EP 발매, 정규앨범 발매, 발매 프로젝트',
    hero: {
      title: '첫 음원 발매,',
      titleHighlight: '어디서 시작할지 막막하다면',
      subtitle:
        '싱글·EP·정규까지 발매의 모든 단계를 한 페이지에 정리했습니다. 혼자서도, 함께서도 갈 수 있게.',
      image: '/images/room7.webp',
      imageAlt: '인디 음원 발매를 준비하는 아티스트',
    },
    intro:
      '곡은 완성했는데 그다음이 막막한 분이 많습니다. 유통사는 어디를 골라야 하는지, 발매일은 언제로 잡아야 하는지, 저작권료는 어떻게 받는지 — 처음이면 모든 단계가 낯섭니다. 이 페이지는 인디·1인 아티스트가 첫 음원을 발매할 때 알아야 할 가이드를 싱글·EP·정규 규모별로 한 곳에 모은 색인입니다. 절차만 확인하고 혼자 발매해도 되고, 기획부터 유통·평단 PR까지 함께 갈 파트너가 필요하면 발매 프로젝트로 이어집니다.',
    forWhom: [
      {
        title: '첫 싱글을 발매하려는데 절차가 막막한 분',
        description: '유통사 선택·앨범아트 규격·발매 타임라인을 단계별로 정리했습니다.',
      },
      {
        title: '녹음·믹싱까지는 했는데 그다음을 모르는 분',
        description: '유통 등록·저작권료·선공개 전략까지 발매 뒷단을 이어서 안내합니다.',
      },
      {
        title: '레이블 없이 혼자 준비 중인 인디 아티스트',
        description: '기획·세션 연결·홍보·평단 접점까지 필요하다면 프로듀서 동행 발매 프로젝트로 연결됩니다.',
      },
    ],
    quickAnswers: [
      {
        q: '첫 싱글 발매, 비용이 얼마나 드나요?',
        a: '유통 자체는 DistroKid 연 3만원대 정액제로 해결됩니다. 녹음·믹싱·마스터링은 별도로, 보컬 녹음 1곡 250,000원 + 싱글 마스터링 100,000원선이 기준입니다(VAT 별도). 기획·세션·홍보까지 함께하는 발매 프로젝트는 싱글 규모 약 50만원부터 규모별 견적으로 진행합니다.',
      },
      {
        q: '혼자 발매하는 것과 프로듀서와 함께하는 발매는 뭐가 다른가요?',
        a: '절차만 보면 유통 등록은 누구나 혼자 할 수 있습니다. 다만 곡의 완성도를 높이는 기획·편곡, 세션 연주자 연결, 발매 후 홍보와 매체·평론 접점은 혼자 만들기 어렵습니다. 발매 프로젝트는 이 과정을 15년차 프로듀서 황경하가 처음부터 끝까지 함께 설계합니다.',
      },
      {
        q: '발매 준비는 얼마나 걸리나요?',
        a: '싱글은 6~12주, EP는 3~6개월, 정규앨범은 6~12개월을 잡는 것이 현실적입니다. 유통사에는 모든 플랫폼 동시 공개를 위해 발매일 최소 4주 전에 음원을 제출해야 합니다.',
      },
      {
        q: '유통사는 어떻게 고르나요?',
        a: '해외 플랫폼(Spotify·Apple Music)은 DistroKid 같은 정액제 유통사, 국내 플랫폼(멜론·지니·벅스)은 카카오엔터·지니뮤직 계열 국내 유통사로 나눠 이중 유통하는 것이 표준입니다. 자세한 비교는 음원 유통 가이드에서 확인하세요.',
      },
      {
        q: '발매하면 저작권료는 어떻게 받나요?',
        a: '한국음악저작권협회(KOMCA)에 저작권을 등록하고, 음원 녹음에 대한 저작인접권을 함께 관리하면 스트리밍·방송 사용료를 정산받을 수 있습니다. 등록 절차는 음악 저작권료 가이드에 단계별로 정리돼 있습니다.',
      },
    ],
    relatedStorySlugs: [
      'single-release1',
      'distribution1',
      'ep-making1',
      'album-release1',
      'indie-label1',
      'royalty1',
      'solo-album1',
      'revenue1',
    ],
    // 발매 프로젝트는 규모별 맞춤 견적이라 data/pricing.ts에 고정 entry가 없어
    // hub 전용 fallback 카드로 티어 구조를 안내한다.
    pricingPackageId: '',
    pricingFallback: {
      id: 'release-project',
      title: '발매 프로젝트 (프로듀서 동행)',
      priceDisplay: '싱글 50만원~',
      unit: '/ 규모별 견적',
      description:
        '기획부터 녹음·세션·믹싱·유통, 매체·평론에 닿는 일까지 15년차 프로듀서 황경하가 함께하는 인디 발매 프로젝트입니다. 첫 상담은 무료로 진행됩니다.',
      recommended: true,
      features: [
        '싱글 약 50만원~ · EP 약 150만원~ (3-5곡) · 정규 약 400만원~ (8곡 기준)',
        '기획·녹음·믹싱·마스터링 + 세션 연결·편곡·유통',
        '발매 후 매체·평론 접점까지 동행',
        '무료 발매 상담(30분 기획 상담)으로 시작',
      ],
    },
    portfolioCategory: 'all',
    primaryServiceLink: 'release-project',
    secondaryServiceLink: 'pricing',
  },
};

export const buyerIntentHubSlugs = Object.keys(buyerIntentHubs) as BuyerIntentHubSlug[];
