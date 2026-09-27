import {
  formatPriceLabel,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL3_PRICE,
  RELEASE_PRESS_INTRO_ENDS_ON,
  RELEASE_PRESS_INTRO_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_PACKAGE_PRICE,
} from './pricing';

/**
 * "따로 맡기면 vs 스튜디오 놀 번들" 비교표의 데이터 — 전략 축 A "가격 비교 안심".
 *
 * **비교 광고다.** 시장 쪽 숫자는 전부 docs/market-price-survey-2026-09.md에 URL과 함께 적힌
 * 공개 요금에서 온다. 그 문서를 먼저 고치고 여기를 따라 고친다. 업체 이름은 사이트에 싣지 않는다.
 * 공개 가격이 없는 항목(음악 홍보)은 숫자를 만들지 않고 없다고 쓴다.
 *
 * 금액은 숫자로 둔다 — "N만원" 문자열로 박으면 data/pricing.test.ts의 가격 리터럴 스캔이
 * 우리 상품 가격으로 오인한다. 표기는 컴포넌트가 formatPriceLabel로 한다.
 */
export const MARKET_SURVEY_CHECKED_ON = '2026-09-26';

export type MarketRow = {
  id: string;
  item: string;
  /** 시장 쪽. range가 없으면 note만 쓴다(숫자로 말할 수 없는 항목). */
  market: { range?: [number, number]; median?: number; sample?: string; note?: string };
  /** 스튜디오 놀 단품 가격(부가세 별도). 단품이 없으면 undefined. */
  ours?: [number, number];
  /** 단품을 범위 숫자로 말할 수 없을 때의 표기(예: 단독 홍보 상품). */
  oursLabel?: string;
  /** 싱글 번들에 들어가는가. */
  inBundle: boolean;
};

export const MARKET_ROWS: readonly MarketRow[] = [
  {
    id: 'recording',
    item: '보컬 녹음 1곡 (엔지니어 포함, 3~4시간)',
    market: { range: [150000, 400000], median: 225000, sample: '서울 독립 녹음실 4곳' },
    ours: [VOCAL_PACKAGE_PRICE, VOCAL_PACKAGE_PRICE],
    inBundle: true,
  },
  {
    id: 'mixing',
    item: '믹싱 1곡',
    market: { range: [200000, 700000], median: 500000, sample: '독립 스튜디오 5곳 · 트랙 수 제한 없는 가격, 2곳은 마스터링 포함' },
    ours: [MIXING_LEVEL1_PRICE, MIXING_LEVEL3_PRICE],
    inBundle: true,
  },
  {
    id: 'mastering',
    item: '마스터링 1곡',
    market: { range: [50000, 200000], median: 100000, sample: '독립 스튜디오 5곳' },
    ours: [MASTERING_SINGLE_PRICE, MASTERING_SINGLE_PRICE],
    inBundle: true,
  },
  {
    id: 'distribution',
    item: '디지털 유통 등록',
    market: { note: '연회비·건당·수익 수수료형으로 요금 구조가 제각각' },
    inBundle: true,
  },
  {
    id: 'promotion',
    item: '보도자료 · 국내외 매체·라디오·플레이리스트 피칭',
    market: { note: '음악 홍보 캠페인의 공개 가격을 찾기 어려움' },
    oursLabel: `단독 홍보 ${formatPriceLabel(RELEASE_PRESS_INTRO_PRICE, 'ko')} (${RELEASE_PRESS_INTRO_ENDS_ON}까지 초기가)`,
    inBundle: true,
  },
];

/*
 * 서로 다른 업체의 중앙값을 더한 합계는 싣지 않는다 — 어느 업체에서도 청구되지 않는 금액이고,
 * 조건(트랙 수·마스터링 포함 여부)이 번들과 달라 차이를 과장한다(2026-09-27 정정).
 */
export const MARKET_COMPARISON_BUNDLE_PRICE = SINGLE_BUNDLE_PRICE;
