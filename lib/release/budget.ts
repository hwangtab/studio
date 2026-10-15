import {
  ALBUM_BUNDLE_PER_SONG_PRICE,
  ALBUM_BUNDLE_PRICE,
  ARRANGEMENT_BAND_PRICE,
  ARRANGEMENT_LARGE_PRICE,
  ARRANGEMENT_SMALL_PRICE,
  EP_BUNDLE_PER_SONG_PRICE,
  EP_BUNDLE_PRICE,
  FUNDING_DESIGN_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL2_PRICE,
  MIXING_LEVEL3_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_TUNING_ADDON_PRICE,
} from '../../data/pricing';

/**
 * 발매 예산 계산 — 순수 함수. 화면은 components/release/ReleaseBudgetCalculator.tsx.
 *
 * **금액은 전부 data/pricing.ts 상수에서 온다**(리터럴 금지 — 견적 요청서 lib/quote/estimate.ts와 같은 원칙).
 *
 * 곡 수별 기본 번들(운영자 결정 2026-10-12, "티어별 곡당 단가"):
 * - 1곡 싱글 번들, 2곡 싱글 번들 × 2
 * - 3~4곡 EP 번들(3곡도 같은 하한 — 기획·유통·보도자료는 곡수와 무관한 고정비)
 * - 5~7곡 EP 곡당 단가 × 곡 수
 * - 8곡 정규 번들, 9곡부터 정규 곡당 단가 × 곡 수
 * 각 티어 페이지 "가격은 이런 변수로" 문구(싱글 추가 1곡 +30~50만, EP 5곡 +45만, 정규 10곡 +85만·12곡 +170만)와
 * 같은 값이다 — budget.test.ts가 대조한다.
 *
 * 번들은 곡마다 믹싱 10트랙 이하 기준이라, 편성이 크면 믹싱 등급 차액을 곡마다 더한다. 편곡은 번들에 없고
 * (2026-10-05 운영자), 편곡 등급은 믹싱과 같은 트랙 수 등급을 쓴다. 세션 연주비는 실비라 계산에 넣지 않는다.
 */

export const RELEASE_BUDGET_MAX_SONGS = 12;

export type TrackScale = 'l1' | 'l2' | 'l3';
export type FundingSource = 'self' | 'funding' | 'grant' | 'unsure';
export type ReleaseTier = 'single' | 'ep' | 'album';

export type ReleaseBudgetInput = {
  songs: number;
  trackScale: TrackScale;
  /** 편곡이 필요한 곡 수(0~songs). */
  arrangementSongs: number;
  vocalTuning: boolean;
  fundingSource: FundingSource;
};

export type BudgetLine = { id: string; label: string; amount: number };

export type ReleaseBudget = {
  tier: ReleaseTier;
  lines: BudgetLine[];
  /** 합계(VAT 포함 — 번들가·옵션가 전부 포함 표기). */
  total: number;
};

const MIXING_BY_SCALE: Record<TrackScale, number> = { l1: MIXING_LEVEL1_PRICE, l2: MIXING_LEVEL2_PRICE, l3: MIXING_LEVEL3_PRICE };
const ARRANGEMENT_BY_SCALE: Record<TrackScale, number> = { l1: ARRANGEMENT_SMALL_PRICE, l2: ARRANGEMENT_BAND_PRICE, l3: ARRANGEMENT_LARGE_PRICE };
const ARRANGEMENT_LABEL: Record<TrackScale, string> = { l1: '소편성 편곡', l2: '풀밴드 편곡', l3: '대편성 편곡' };

const clampSongs = (n: number) => Math.min(RELEASE_BUDGET_MAX_SONGS, Math.max(1, Math.round(n) || 1));

/** 곡 수 → 기본 번들 금액과 티어. */
export const releaseBundleFor = (songsIn: number): { tier: ReleaseTier; amount: number; label: string } => {
  const songs = clampSongs(songsIn);
  if (songs === 1) return { tier: 'single', amount: SINGLE_BUNDLE_PRICE, label: '싱글 번들' };
  if (songs === 2) return { tier: 'single', amount: SINGLE_BUNDLE_PRICE * 2, label: '싱글 번들 × 2곡' };
  if (songs <= 4) return { tier: 'ep', amount: EP_BUNDLE_PRICE, label: `EP 번들 (${songs}곡)` };
  if (songs <= 7) return { tier: 'ep', amount: EP_BUNDLE_PER_SONG_PRICE * songs, label: `EP 곡당 단가 × ${songs}곡` };
  if (songs === 8) return { tier: 'album', amount: ALBUM_BUNDLE_PRICE, label: '정규 번들 (8곡)' };
  return { tier: 'album', amount: ALBUM_BUNDLE_PER_SONG_PRICE * songs, label: `정규 곡당 단가 × ${songs}곡` };
};

export const computeReleaseBudget = (input: ReleaseBudgetInput): ReleaseBudget => {
  const songs = clampSongs(input.songs);
  const arrangementSongs = Math.min(songs, Math.max(0, Math.round(input.arrangementSongs) || 0));
  const bundle = releaseBundleFor(songs);
  const lines: BudgetLine[] = [{ id: 'bundle', label: `${bundle.label} — 기획·녹음·믹싱·마스터링·유통·홍보`, amount: bundle.amount }];

  const mixingDiff = MIXING_BY_SCALE[input.trackScale] - MIXING_LEVEL1_PRICE;
  if (mixingDiff > 0) {
    lines.push({ id: 'mixing', label: `큰 편성 믹싱 차액 × ${songs}곡`, amount: mixingDiff * songs });
  }
  if (arrangementSongs > 0) {
    lines.push({ id: 'arrangement', label: `${ARRANGEMENT_LABEL[input.trackScale]} × ${arrangementSongs}곡`, amount: ARRANGEMENT_BY_SCALE[input.trackScale] * arrangementSongs });
  }
  if (input.vocalTuning) {
    lines.push({ id: 'tuning', label: `보컬 튜닝·박자 보정 × ${songs}곡`, amount: VOCAL_TUNING_ADDON_PRICE * songs });
  }
  if (input.fundingSource === 'funding') {
    lines.push({ id: 'funding', label: '펀딩 설계 대행', amount: FUNDING_DESIGN_PRICE });
  }

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return { tier: bundle.tier, lines, total };
};
