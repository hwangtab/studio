import {
  ALBUM_BUNDLE_PRICE,
  EP_BUNDLE_PRICE,
  formatPriceAmount,
  formatPriceLabel,
  FUNDING_DESIGN_PRICE,
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  SINGLE_BUNDLE_PRICE,
} from './pricing';
import { CASES_CHECKED_ON, CROWDFUNDING_CASES, type CrowdfundingCase } from './crowdfundingCases';

/**
 * 발매 파이프라인 — /ko/release-project의 ko 전용 절(제작비 마련·목표액 계산기·사례·추가 FAQ) 카피.
 * 설계: docs/superpowers/specs/2026-09-25-release-pipeline-design.md.
 *
 * 펀딩은 ko 전용 상품이라(lib/koOnlyRoutes.ts) 이 절들은 ko에서만 렌더한다. 그래서 common.json
 * 7로케일 대신 이 모듈에 둔다(data/crowdfundingDesign.ts와 같은 방식 — 7로케일 키 동형 테스트를
 * 건드리지 않는다).
 *
 * 숫자는 전부 계산한다: 가격은 data/pricing.ts 상수, 모금 통계는 data/crowdfundingCases.ts.
 * 리터럴을 박으면 data/pricing.test.ts의 가격 리터럴 스캔이 잡는다.
 * 운영자 결정(2026-09-25): 파이프라인 펀딩은 스튜디오 놀 펀딩에서만 연다 · 성공 수수료 없음 ·
 * 유통은 여러 협력 유통사 중 고객과 상의해 최적의 곳 · 목표 미달 펀딩은 싣지 않는다.
 */

export type ReleaseTierKey = 'single' | 'ep' | 'album';

/** 계산기의 티어별 제작비 — 발매 번들가(= 발매 프로젝트 티어 하한, 부가세 별도). */
export const PIPELINE_BUNDLE_PRICES: Record<ReleaseTierKey, number> = {
  single: SINGLE_BUNDLE_PRICE,
  ep: EP_BUNDLE_PRICE,
  album: ALBUM_BUNDLE_PRICE,
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/**
 * 최근 N년 안에 마감한 **성공한 음반 펀딩**의 모금액 통계. 기준 시점은 CASES_CHECKED_ON.
 * 목표 미달 건은 CROWDFUNDING_CASES에 애초에 없다(운영자 결정).
 */
export const recentAlbumFundingStats = (years = 5) => {
  const [y, m] = CASES_CHECKED_ON.split('-').map(Number);
  const since = `${y - years}-${String(m).padStart(2, '0')}`;
  const recent = CROWDFUNDING_CASES.filter(
    (c) => c.kind === '음반' && c.state === 'succeeded' && c.period >= since
  );
  const raised = recent.map((c) => c.raised);
  return {
    count: recent.length,
    median: recent.length ? median(raised) : 0,
    min: recent.length ? Math.min(...raised) : 0,
    max: recent.length ? Math.max(...raised) : 0,
    since,
  };
};

/** "펀딩으로 시작해 발매까지 간 음반" 카드 — release 필드가 있는 건만, 최신순. */
type PipelineCase = CrowdfundingCase & { release: NonNullable<CrowdfundingCase['release']> };
export const pipelineCases = (): PipelineCase[] =>
  CROWDFUNDING_CASES.filter((c): c is PipelineCase => Boolean(c.release))
    .slice()
    .sort((a, b) => b.period.localeCompare(a.period));

/** 만원 단위 반올림 표기 — "약 N만원". */
const manwon = (won: number) => `약 ${formatPriceAmount(Math.round(won / 10000))}만원`;

const stats = recentAlbumFundingStats();
const designFee = formatPriceLabel(FUNDING_DESIGN_PRICE, 'ko');
const fundingFees = `플랫폼 수수료 ${FUNDING_PLATFORM_FEE_PERCENT}% · 결제 수수료 ${FUNDING_PAYMENT_FEE_PERCENT}%(부가세 포함)`;

export const releasePipelineCopy = {
  hero: {
    subtitle:
      '제작비를 만드는 펀딩부터 녹음·믹싱, 국내외 매체 홍보, 협력 유통사 연결까지. 발매의 모든 단계를 한 팀이 끝까지 함께해요.',
    cta: '카톡으로 발매 상담 (무료 30분)',
  },
  paths: {
    title: '제작비, 이렇게 만들어요',
    subtitle: '곡은 있는데 제작비에서 막혀 있다면, 돈을 만드는 단계부터 같이 가요.',
    items: [
      {
        id: 'funding',
        title: '스튜디오 놀 펀딩으로',
        body: `티저 한 곡을 먼저 만들고, 그 곡으로 스튜디오 놀 펀딩을 열어요. 모금액으로 나머지를 녹음·믹싱하고 홍보해 발매해요. 설계비 ${designFee}(부가세 별도)까지 한 견적으로 드리고, 설계비와 제작비는 펀딩이 끝나 모금액을 정산할 때 모금액에서 받아요. 성공 수수료 없음.`,
        stat: `공개로 확인 가능한 음반 펀딩 최근 ${stats.count}건 모금 중앙값 ${manwon(stats.median)}`,
        links: [
          { href: '#funding-goal', label: '목표액 계산해 보기' },
          { href: '/ko/crowdfunding-design', label: '펀딩 설계 자세히' },
        ],
      },
      {
        id: 'grant',
        title: '예술지원사업으로',
        body: '신청서는 본인이 써요. 스튜디오 놀은 견적서·제작 사양·일정표 같은 제작처 서류를 드려요. 선정돼도 여기서 제작할 의무는 없어요.',
        stat: '선정 여부는 심사 기관이 정해요',
        links: [{ href: '/ko/stories/music-grants1', label: '음악 지원사업 가이드' }],
      },
      {
        id: 'self',
        title: '직접 준비한 예산으로',
        body: `싱글 ${formatPriceLabel(SINGLE_BUNDLE_PRICE, 'ko')}부터 규모별로 견적해요. 녹음·믹싱·마스터링만 단계별로 맡기는 것도 돼요.`,
        stat: `EP ${formatPriceLabel(EP_BUNDLE_PRICE, 'ko')}~ · 정규 ${formatPriceLabel(ALBUM_BUNDLE_PRICE, 'ko')}~ (부가세 별도)`,
        links: [{ href: '/ko/pricing', label: '요금 전체 보기' }],
      },
    ],
  },
  calculator: {
    anchorId: 'funding-goal',
    title: '펀딩 목표액 계산기',
    subtitle: '목표액은 거꾸로 계산해야 해요. 수수료와 리워드 원가를 빼먹으면 달성해도 제작비가 모자라요.',
    tierLabel: '스튜디오 놀 제작',
    tiers: { single: '싱글', ep: 'EP (4곡 기준)', album: '정규 (8곡 기준)' } as Record<ReleaseTierKey, string>,
    // 작은 펀딩도 같은 흐름이다(2026-09-28 운영자) — 제작을 이미 마쳤거나 다른 곳에서 하면 제작비 없이,
    // 설계를 맡기지 않고 직접 열면 설계비 없이 같은 식으로 계산한다.
    noProduction: '제작 없음 (이미 만든 음원)',
    designLabel: '펀딩 개설',
    designOptions: { design: '설계 대행', direct: '직접 개설' },
    otherCostLabel: '리워드 원가·기타 비용',
    otherCostHelp: 'CD·굿즈 제작, 배송, 세션·아트워크처럼 모금액으로 충당할 비용을 원 단위로 넣으세요.',
    withholdingLabel: '개인으로 정산받음(부가세 상당액·원천징수 3.3% 공제)',
    withholdingHelp: '사업자로 세금계산서를 발행하면 끄세요. 개인 정산은 세금계산서가 없어 수수료를 뗀 금액에서 부가세 상당액(10/110)을 빼고 원천징수해요.',
    resultLabel: '필요한 목표액',
    rows: {
      production: '제작비 (발매 번들, 부가세 포함)',
      design: '펀딩 설계비 (부가세 포함)',
      other: '리워드 원가·기타 비용',
      platformFee: `플랫폼 수수료 ${FUNDING_PLATFORM_FEE_PERCENT}%`,
      paymentFee: `결제 수수료 ${FUNDING_PAYMENT_FEE_PERCENT}%`,
      vatDeduction: '부가세 상당액 (개인 정산)',
      withheld: '원천징수 3.3% (종합소득세 정산 대상)',
    },
    compare: `참고: 공개로 확인 가능한 음반 펀딩 최근 ${stats.count}건의 모금액은 ${formatPriceAmount(Math.round(stats.min / 10000))}만~${formatPriceAmount(Math.round(stats.max / 10000))}만원, 중앙값 ${manwon(stats.median)}이에요.`,
    note: `스튜디오 놀 펀딩 기준 — ${fundingFees}. 모금액을 보장하지 않아요. 목표에 못 미쳐도 모인 금액으로 진행하는 방식이라, 약속한 리워드는 그대로 보내야 해요.`,
    cta: '이 계산으로 발매 자금 상담',
    copied: '계산 내용을 복사했어요. 카카오톡에 붙여 넣어 주세요.',
  },
  process: {
    subtitle: '제작비 마련부터 발매까지, 6단계로 함께 완성해요.',
    fundingStep: {
      title: '제작비 마련 · 펀딩 기획',
      desc: '펀딩이나 예술지원사업으로 제작비를 먼저 만들어요. 펀딩이면 티저 한 곡으로 스튜디오 놀 펀딩을 열고, 모금액으로 나머지를 제작해요.',
    },
  },
  cases: {
    title: '펀딩으로 시작해 발매까지 간 음반',
    subtitle: '스튜디오 놀이 펀딩부터 기획·제작·음향까지 맡은 음반이에요. 모금액·후원자 수는 펀딩 플랫폼에서 직접 확인한 값이에요.',
    role: '기획 · 제작 · 음향',
    raisedLabel: '모금',
    backersLabel: '후원자',
    fundingLink: '펀딩 페이지',
    releaseLink: '발매작 보기',
    storyLink: '제작기 읽기',
    checkedOn: `${CASES_CHECKED_ON} 확인`,
  },
  /**
   * /ko/funding(목록)과 /ko/funding/apply(개설 신청)에서 파이프라인으로 가는 길(설계 3단계).
   * 펀딩 목록에 온 사람은 대개 "내 음반도 이렇게 만들 수 있나"를 궁금해하는데, 그 다음 걸음이 없었다.
   */
  fundingPromo: {
    title: '내 음반도 펀딩으로 만들고 싶다면',
    subtitle: '직접 열 수도, 기획부터 맡길 수도, 제작·홍보·유통까지 한 번에 갈 수도 있어요.',
    items: [
      {
        id: 'self',
        title: '직접 개설',
        // "만"은 공제 항목의 전부를 말하는 완결성 단정이다. 개인 자격 개설자는 정산에서
        // 부가세 상당액과 원천징수 3.3%가 더 빠지므로(lib/funding/payout.ts, 같은 파일
        // calculator.rows) 사실이 아니다. data/pricing.ts의 같은 취지 카피와 같은 표기로 맞춘다.
        body: `설계비 없이 신청해요. 성공 수수료 없음 · 모금액에서 ${fundingFees}를 떼요.`,
        href: '/ko/funding/apply',
        label: '개설 신청',
      },
      {
        id: 'design',
        title: '펀딩 설계 대행',
        body: `스토리·리워드·목표액·페이지를 기획부터 같이 만들어요. 설계비 ${designFee}(부가세 별도), 성공 수수료 없음.`,
        href: '/ko/crowdfunding-design',
        label: '설계 대행 보기',
      },
      {
        id: 'pipeline',
        title: '발매 프로젝트',
        body: '펀딩 설계부터 녹음·믹싱·마스터링, 국내외 매체 홍보, 협력 유통사 연결까지 한 견적이에요. 비용은 정산 때 모금액에서 받아요.',
        href: '/ko/release-project',
        label: '발매 프로젝트 보기',
      },
    ],
  },
  applyHelp: {
    title: '혼자 쓰기 막막하다면',
    body: `스토리·리워드·목표액을 기획부터 같이 만드는 펀딩 설계 대행(설계비 ${designFee}, 성공 수수료 없음)이 있어요. 제작비를 모아 녹음부터 발매까지 이어 가려면 발매 프로젝트로 오세요.`,
    links: [
      { href: '/ko/crowdfunding-design', label: '펀딩 설계 대행' },
      { href: '/ko/release-project', label: '발매 프로젝트' },
    ],
  },
  consultationFirstStepDesc:
    '어떤 곡인지, 어디까지 왔는지, 제작비는 어떻게 마련할 생각인지(펀딩·지원사업·자비·아직 모름) 가볍게 보내주세요. 10분 내외.',
  faq: [
    {
      question: '펀딩으로 제작비를 모으면 어떤 순서로 진행되나요?',
      answer:
        '상담 → 티저 한 곡 제작과 펀딩 페이지 준비 → 스튜디오 놀 펀딩 진행 → 정산 뒤 나머지 곡 제작 → 국내외 매체 홍보 → 협력 유통사를 통한 발매 순서예요. 티저 곡은 음반에 그대로 들어가요. 기간은 음반 규모와 펀딩 기간에 따라 상담에서 정해요.',
    },
    {
      question: '펀딩이 목표에 못 미치면 어떻게 되나요?',
      answer:
        '스튜디오 놀 펀딩은 목표에 못 미쳐도 모인 금액으로 진행하는 방식이라, 후원자에게 약속한 리워드는 그대로 보내야 해요. 그래서 목표액은 제작비·리워드 원가·수수료에, 개인으로 정산받으면 부가세 상당액과 원천징수까지 넣어 거꾸로 계산하고, 상담에서 현실적인지 함께 따져요. 모금액을 보장하지는 않아요. 목표에 못 미쳐도 모인 금액으로 제작을 그대로 집행하고, 설계비와 제작비도 그 모금액에서 정산해요. 모금액이 견적에 못 미치면 모자라는 금액은 차액으로 청구할지 제작 규모를 조정할지 상의해 정해요.',
    },
    {
      question: '펀딩으로 하면 비용은 언제, 어떻게 내나요?',
      answer:
        `펀딩 설계비(${designFee}, 부가세 별도)부터 녹음·믹싱·마스터링, 국내외 매체 홍보, 협력 유통사 연결까지 한 견적으로 드려요. 설계비와 제작비는 펀딩이 끝나고 모금액을 정산할 때 모금액에서 받아요. 모금액이 견적에 못 미치면 모자라는 금액은 차액으로 청구할지 제작 규모를 조정할지 상의해 정해요. 발매 번들 가격 외에 단계를 더한다고 붙는 추가 할인은 없고, 세션 연주비만 연주자 실비로 따로 받아요.`,
    },
    {
      question: '지원사업에 선정되면 꼭 여기서 제작해야 하나요?',
      answer:
        '아니에요. 신청서는 본인이 쓰고, 스튜디오 놀은 견적서·제작 사양·일정표 같은 제작처 서류만 드려요. 다른 스튜디오 견적과 비교해 정하시면 돼요.',
    },
    {
      question: '유통은 어디를 통해 하나요?',
      answer: '여러 협력 유통사 가운데 음반의 장르와 목표에 가장 맞는 곳을 상담에서 함께 골라 연결해요.',
    },
  ],
} as const;
