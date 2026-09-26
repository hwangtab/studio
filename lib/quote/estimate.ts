import {
  ALBUM_BUNDLE_PRICE,
  COVER_VIDEO_PACKAGE_PRICE,
  DAY_LOCK_4H_PRICE,
  DAY_LOCK_8H_PRICE,
  EP_BUNDLE_PRICE,
  FUNDING_DESIGN_PRICE,
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  formatPriceLabel,
  LESSON_MONTHLY_PRICE,
  MASTERING_PACKAGE_PRICE,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL2_PRICE,
  MIXING_LEVEL3_PRICE,
  PRACTICE_ROOM_HOURLY_PRICE_INCL,
  PRACTICE_ROOM_MONTHLY_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_PACKAGE_PRICE,
  VOICEOVER_HOURLY_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';

/**
 * 견적 요청서의 즉시 견적 — 순수 함수. 화면은 components/quote/QuoteWizard.tsx.
 *
 * **숫자는 전부 data/pricing.ts 상수에서 계산한다.** 이 파일에 금액 리터럴을 두지 않는다
 * (가격 리터럴 스캔은 data/만 보지만, 여기서 한 번 어긋나면 고객이 받은 견적과 결제 금액이
 * 다르다). 범위를 낼 수 없는 상품(발매·펀딩)은 "~부터"로만 말한다 — 상담 전에 상한을
 * 약속하지 않는다.
 */

export type QuoteService =
  | 'recording'
  | 'mixing'
  | 'release'
  | 'wedding'
  | 'cover'
  | 'voice'
  | 'practice'
  | 'lesson'
  | 'funding';

export type Choice = { id: string; label: string };

export const SERVICE_CHOICES: readonly (Choice & { id: QuoteService })[] = [
  { id: 'recording', label: '보컬·악기 녹음' },
  { id: 'mixing', label: '믹싱·마스터링' },
  { id: 'release', label: '음반 발매 (기획부터 홍보까지)' },
  { id: 'wedding', label: '축가 녹음' },
  { id: 'cover', label: '커버 영상' },
  { id: 'voice', label: '성우·내레이션 녹음' },
  { id: 'practice', label: '음악연습실' },
  { id: 'lesson', label: '프로듀싱 레슨' },
  { id: 'funding', label: '크라우드펀딩 설계' },
];

/** 서비스별 규모 문항. 없으면 그 문항을 건너뛴다(축가·커버·레슨·펀딩은 규모가 정해진 상품). */
export const SCALE_QUESTIONS: Partial<Record<QuoteService, { question: string; choices: readonly Choice[] }>> = {
  recording: {
    question: '몇 곡을 녹음하시나요?',
    choices: [
      { id: '1', label: '1곡' },
      { id: '2-3', label: '2~3곡' },
      { id: '4+', label: '4곡 이상' },
    ],
  },
  mixing: {
    question: '어떤 작업인가요?',
    choices: [
      { id: 'l1', label: '1곡 · 트랙 10개 이하' },
      { id: 'l2', label: '1곡 · 트랙 11~30개' },
      { id: 'l3', label: '1곡 · 트랙 31개 이상' },
      { id: 'multi', label: '여러 곡 (EP·앨범)' },
    ],
  },
  release: {
    question: '어떤 규모의 음반인가요?',
    choices: [
      { id: 'single', label: '싱글 (1곡)' },
      { id: 'ep', label: 'EP (3~5곡)' },
      { id: 'album', label: '정규 (8곡 안팎)' },
    ],
  },
  voice: {
    question: '녹음실을 얼마나 쓰실 것 같나요?',
    choices: [
      { id: '2', label: '2시간 안팎' },
      { id: '4', label: '4시간 안팎' },
      { id: '8', label: '하루 (8시간)' },
    ],
  },
  practice: {
    question: '어떻게 쓰실 건가요?',
    choices: [
      { id: 'hourly', label: '시간 단위로' },
      { id: 'monthly', label: '월 단위로 입주' },
    ],
  },
};

/** 준비 상태 — 곡을 만드는 서비스에만 묻는다. */
export const READINESS_SERVICES: readonly QuoteService[] = ['recording', 'mixing', 'release'];
export const READINESS_CHOICES: readonly Choice[] = [
  { id: 'ready', label: '곡·가사가 완성돼 있어요' },
  { id: 'demo', label: '데모가 있어요' },
  { id: 'idea', label: '아이디어 단계예요' },
];

export const TIMING_CHOICES: readonly Choice[] = [
  { id: '2w', label: '2주 안' },
  { id: '1m', label: '한 달 안' },
  { id: '3m', label: '3개월 안' },
  { id: 'open', label: '아직 미정' },
];

/** 제작비 마련 방법 — 발매에만 묻는다(펀딩 설계로 이어질 수 있어서). */
export const FUNDING_SOURCE_CHOICES: readonly Choice[] = [
  { id: 'self', label: '직접 준비한 예산' },
  { id: 'funding', label: '크라우드펀딩' },
  { id: 'grant', label: '예술지원사업' },
  { id: 'unsure', label: '아직 모르겠어요' },
];

export type QuoteAnswers = {
  service?: QuoteService;
  scale?: string;
  readiness?: string;
  timing?: string;
  fundingSource?: string;
};

/** 가격 표기의 부가세 기준 — 연습실만 다르다(시간제 VAT 포함, 월세 최종가). */
export type VatBasis = 'excluded' | 'included' | 'final';

export type Estimate = {
  /** 한 줄 요약(예: "25만원", "50만~75만원", "180만원부터"). */
  priceLabel: string;
  vat: VatBasis;
  /** 무엇이 기준인지 — 상품 구성 한두 줄. */
  basis: string[];
  /** 온라인으로 바로 결제할 수 있으면 그 경로. 없으면 카카오 상담만. */
  bookingHref?: string;
};

const won = (v: number) => formatPriceLabel(v, 'ko');
const range = (min: number, max: number) => (min === max ? won(min) : `${won(min).replace('만원', '만')}~${won(max)}`);

export const scaleQuestionFor = (service: QuoteService | undefined) => (service ? SCALE_QUESTIONS[service] : undefined);

/** 필요한 문항이 모두 답해졌는가. */
export const isComplete = (a: QuoteAnswers): boolean => {
  if (!a.service) return false;
  if (scaleQuestionFor(a.service) && !a.scale) return false;
  if (READINESS_SERVICES.includes(a.service) && !a.readiness) return false;
  if (a.service === 'release' && !a.fundingSource) return false;
  return Boolean(a.timing);
};

export const estimate = (a: QuoteAnswers): Estimate | null => {
  if (!isComplete(a)) return null;
  switch (a.service) {
    case 'recording':
      if (a.scale === '1') {
        return {
          priceLabel: won(VOCAL_PACKAGE_PRICE),
          vat: 'excluded',
          basis: ['보컬 녹음 1프로 — 3시간, 전담 엔지니어·디렉팅 포함'],
          bookingHref: '/ko/booking/recording?product=recording-pro',
        };
      }
      if (a.scale === '2-3') {
        return {
          priceLabel: range(VOCAL_PACKAGE_PRICE * 2, VOCAL_PACKAGE_PRICE * 3),
          vat: 'excluded',
          basis: [
            `곡당 보컬 녹음 1프로(${won(VOCAL_PACKAGE_PRICE)}) 기준`,
            `3곡을 하루에 몰아 녹음하면 Day Lock 8시간 ${won(DAY_LOCK_8H_PRICE)}이 더 쌉니다`,
          ],
          bookingHref: '/ko/booking/recording',
        };
      }
      return {
        priceLabel: range(DAY_LOCK_8H_PRICE, DAY_LOCK_8H_PRICE * 2),
        vat: 'excluded',
        basis: [`Day Lock 8시간(${won(DAY_LOCK_8H_PRICE)}) 1~2회 기준 — 곡 수와 테이크에 따라 달라집니다`],
        bookingHref: '/ko/booking/recording?product=recording-daylock-8h',
      };
    case 'mixing': {
      const tiers: Record<string, [number, string]> = {
        l1: [MIXING_LEVEL1_PRICE, 'mixing-level1'],
        l2: [MIXING_LEVEL2_PRICE, 'mixing-level2'],
        l3: [MIXING_LEVEL3_PRICE, 'mixing-level3'],
      };
      const tier = a.scale ? tiers[a.scale] : undefined;
      if (tier) {
        return {
          priceLabel: range(tier[0], tier[0] + MASTERING_SINGLE_PRICE),
          vat: 'excluded',
          basis: [`믹싱 ${won(tier[0])} (수정 2회)`, `마스터링까지 맡기면 +${won(MASTERING_SINGLE_PRICE)} (수정 1회)`],
          bookingHref: `/ko/booking/mixing-mastering?product=${tier[1]}`,
        };
      }
      return {
        priceLabel: `곡당 ${range(MIXING_LEVEL1_PRICE + MASTERING_PACKAGE_PRICE, MIXING_LEVEL3_PRICE + MASTERING_PACKAGE_PRICE)}`,
        vat: 'excluded',
        basis: [
          `믹싱은 곡마다 트랙 수로 ${won(MIXING_LEVEL1_PRICE)}~${won(MIXING_LEVEL3_PRICE)}`,
          `4곡 이상 함께 마스터링하면 곡당 ${won(MASTERING_PACKAGE_PRICE)}`,
        ],
        bookingHref: '/ko/booking/mixing-mastering',
      };
    }
    case 'release': {
      const bundle = { single: SINGLE_BUNDLE_PRICE, ep: EP_BUNDLE_PRICE, album: ALBUM_BUNDLE_PRICE }[a.scale as 'single' | 'ep' | 'album'];
      return {
        priceLabel: `${won(bundle)}부터`,
        vat: 'excluded',
        basis: [
          '기획·녹음·믹싱·마스터링·디지털 유통 등록·국내외 매체 홍보를 묶은 번들 기준',
          '세션 연주비는 포함되지 않고 연주자 실비만 따로 받습니다',
          ...(a.fundingSource === 'funding'
            ? [`펀딩으로 만들면 설계비 ${won(FUNDING_DESIGN_PRICE)}(부가세 별도)가 더해지고, 모금액에서 플랫폼 ${FUNDING_PLATFORM_FEE_PERCENT}%·결제 ${FUNDING_PAYMENT_FEE_PERCENT}% 수수료를 뗍니다`]
            : []),
        ],
      };
    }
    case 'wedding':
      return {
        priceLabel: won(WEDDING_PACKAGE_PRICE),
        vat: 'excluded',
        basis: ['2시간 녹음 + 보컬 튠 + 믹싱·마스터링'],
        bookingHref: '/ko/booking/wedding-song',
      };
    case 'cover':
      return {
        priceLabel: won(COVER_VIDEO_PACKAGE_PRICE),
        vat: 'excluded',
        basis: ['3시간 세션 — 촬영·믹싱·편집, 4K 영상과 음원 납품'],
        bookingHref: '/ko/booking/cover-video',
      };
    case 'voice': {
      const hours = Number(a.scale);
      return {
        priceLabel: won(VOICEOVER_HOURLY_PRICE * hours),
        vat: 'excluded',
        basis: [
          `시간당 ${won(VOICEOVER_HOURLY_PRICE)} × ${hours}시간 (최소 2시간)`,
          ...(hours >= 4 ? [`긴 녹음은 Day Lock 4시간 ${won(DAY_LOCK_4H_PRICE)} · 8시간 ${won(DAY_LOCK_8H_PRICE)}이 더 쌉니다`] : []),
        ],
        bookingHref: '/ko/booking/voice-acting',
      };
    }
    case 'practice':
      if (a.scale === 'monthly') {
        return {
          priceLabel: `월 ${won(PRACTICE_ROOM_MONTHLY_PRICE)}`,
          vat: 'final',
          basis: ['개인 방음 연습실 월 입주, 24시간 이용 — 빈방 여부는 상담에서 확인합니다'],
        };
      }
      return {
        priceLabel: `시간당 ${PRACTICE_ROOM_HOURLY_PRICE_INCL.toLocaleString('en-US')}원`,
        vat: 'included',
        basis: ['1시간부터, 24시간 무인 이용'],
        bookingHref: '/ko/booking/practice-room',
      };
    case 'lesson':
      return {
        priceLabel: `월 ${won(LESSON_MONTHLY_PRICE)}`,
        vat: 'excluded',
        basis: ['1:1 프로듀싱 레슨(미디·작곡·믹싱·마스터링) 월 4회, 회당 60분'],
      };
    case 'funding':
      return {
        priceLabel: `설계비 ${won(FUNDING_DESIGN_PRICE)}`,
        vat: 'excluded',
        basis: [
          '스토리·리워드 설계와 페이지 제작, 스튜디오 놀 펀딩에서 엽니다 — 성공 수수료 없음',
          `모금액에서 플랫폼 ${FUNDING_PLATFORM_FEE_PERCENT}%·결제 ${FUNDING_PAYMENT_FEE_PERCENT}% 수수료(부가세 포함)를 뗍니다`,
        ],
      };
    default:
      return null;
  }
};

export const VAT_NOTE: Record<VatBasis, string> = {
  excluded: '부가세 별도',
  included: '부가세 포함',
  final: '최종가 (부가세 없음)',
};

const labelOf = (choices: readonly Choice[], id?: string) => choices.find((c) => c.id === id)?.label;

/** 견적 코드 — 카톡으로 넘어온 요약과 분석 이벤트를 짝지을 때 쓴다. 개인정보는 담지 않는다. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const makeQuoteCode = (random: (n: number) => Uint8Array): string => {
  const bytes = random(6);
  return `NOL-${Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`;
};

/** 카톡에 붙여 넣는 요약 — 답한 문항만 싣는다. */
export const buildQuoteSummary = (a: QuoteAnswers, est: Estimate, code: string): string => {
  const service = SERVICE_CHOICES.find((s) => s.id === a.service);
  const scaleQ = scaleQuestionFor(a.service);
  const lines = [
    `[스튜디오 놀 견적 요청 ${code}]`,
    `서비스: ${service?.label ?? ''}${scaleQ && a.scale ? ` — ${labelOf(scaleQ.choices, a.scale)}` : ''}`,
    ...(a.readiness ? [`준비 상태: ${labelOf(READINESS_CHOICES, a.readiness)}`] : []),
    ...(a.fundingSource ? [`제작비: ${labelOf(FUNDING_SOURCE_CHOICES, a.fundingSource)}`] : []),
    `희망 시기: ${labelOf(TIMING_CHOICES, a.timing)}`,
    `예상 비용: ${est.priceLabel} (${VAT_NOTE[est.vat]})`,
  ];
  return lines.join('\n');
};
