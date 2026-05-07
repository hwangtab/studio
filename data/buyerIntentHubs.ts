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
  | 'vocal-beginners-guide';

export interface BuyerIntentHubQuickAnswer {
  q: string;
  a: string;
}

export interface BuyerIntentHubFeature {
  title: string;
  description: string;
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
  /** 가격 모듈 — pricingData.specialPackages의 id를 가리킨다 */
  pricingPackageId: string;
  /** 보조 가격 패키지 (있을 경우) */
  secondaryPricingPackageId?: string;
  /**
   * 관련 portfolio 노출 카테고리 — 'all' | PortfolioItem.category 값.
   * 'all'은 featured 우선으로 셔플.
   */
  portfolioCategory: 'all' | 'single' | 'album' | 'compilation' | 'commercial';
  /** 본 hub와 가장 가까운 service LP — primary CTA 대상 */
  primaryServiceLink: ServiceKey | 'practice-room' | 'contact';
  /** 보조 service LP — secondary CTA */
  secondaryServiceLink?: ServiceKey | 'practice-room' | 'contact';
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
    ],
    pricingPackageId: 'recording-pro',
    secondaryPricingPackageId: 'mixing-level1',
    portfolioCategory: 'single',
    primaryServiceLink: 'pricing',
    secondaryServiceLink: 'practice-room',
  },

  'vocal-beginners-guide': {
    slug: 'vocal-beginners-guide',
    seoTitle: '처음 노래 배우는 사람을 위한 보컬 입문 가이드',
    seoDescription:
      '직장인·취미·오디션 준비생을 위한 보컬 입문 한 페이지 가이드. 호흡·발성부터 음감 훈련, 1:1 레슨, 오디션 데모까지 단계별로 정리했습니다.',
    keywords:
      '보컬 입문, 노래 배우기, 보컬 레슨, 호흡 발성, 음감 훈련, 직장인 보컬, 오디션 준비, 발성 가이드',
    hero: {
      title: '처음 노래를',
      titleHighlight: '배우고 싶다면',
      subtitle:
        '취미·실력 향상·오디션까지 한 페이지로. 호흡·발성·음감·실전 단계별 학습 로드맵.',
      image: '/images/lesson1.webp',
      imageAlt: '보컬 레슨을 받는 학생',
    },
    intro:
      '"노래를 잘 부르고 싶다"는 목표는 같아도 출발점은 사람마다 다릅니다. 직장인이 회식 자리에서 1곡만 잘 부르고 싶은 경우, 오디션 준비생이 단기간에 실력을 끌어올려야 하는 경우, 취미로 꾸준히 발성을 다듬고 싶은 경우. 이 페이지는 보컬을 처음 배우는 분이 자기 목적에 맞게 시작점을 찾을 수 있도록 핵심 가이드를 한 곳에 모았습니다.',
    forWhom: [
      {
        title: '취미로 노래를 잘 부르고 싶은 직장인·일반인',
        description: '주 1회 30분 레슨으로도 회식·노래방·동호회 활동에 충분합니다.',
      },
      {
        title: '오디션·실용음악 입시를 준비하는 학생',
        description: '발성·음감·곡 해석을 단기간에 끌어올리는 1:1 집중 코칭.',
      },
      {
        title: '나이가 부담스러운 성인 입문자',
        description: '40대·50대 처음 시작하는 분도 호흡·발성부터 차근차근 진행합니다.',
      },
    ],
    quickAnswers: [
      {
        q: '음치인데 정말 늘 수 있나요?',
        a: '늘 수 있습니다. "음치"라고 느끼는 대부분은 음감 훈련과 호흡 안정으로 해결됩니다. 첫 1~2개월에 가장 큰 변화를 느끼는 분이 많습니다.',
      },
      {
        q: '레슨은 얼마나 자주 받아야 하나요?',
        a: '주 1회가 가장 보편적입니다. 단기 목표가 명확한 경우(오디션·발표)에는 주 2회로 진행하기도 합니다.',
      },
      {
        q: '비용은 얼마인가요?',
        a: '1:1 보컬 레슨은 시간당 7만원부터 시작합니다. 패키지·장기 등록 시 할인이 적용됩니다.',
      },
      {
        q: '40대·50대 입문자도 가능한가요?',
        a: '가능합니다. 성인 입문자가 절반 이상이며 호흡·발성부터 시작해 노래방·동호회 활동을 즐길 정도까지 충분히 만들 수 있습니다.',
      },
      {
        q: '온라인 레슨도 가능한가요?',
        a: '대면 레슨을 권장합니다. 호흡·발성은 자세 관찰과 즉각 피드백이 중요해 온라인은 효율이 크게 떨어집니다. 대면이 어려운 경우 협의해 일부 진행은 가능합니다.',
      },
    ],
    relatedStorySlugs: [
      'aspiring1',
      'ear-training1',
      'diaphragm1',
      'breath-support1',
      'audition-vocal1',
      'harmony-singing1',
    ],
    pricingPackageId: 'recording-hourly',
    portfolioCategory: 'single',
    primaryServiceLink: 'lesson',
    secondaryServiceLink: 'voice-acting',
  },
};

export const buyerIntentHubSlugs = Object.keys(buyerIntentHubs) as BuyerIntentHubSlug[];
