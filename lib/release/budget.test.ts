import {
  ALBUM_BUNDLE_PRICE,
  ARRANGEMENT_BAND_PRICE,
  EP_BUNDLE_PRICE,
  FUNDING_DESIGN_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL3_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_TUNING_ADDON_PRICE,
} from '../../data/pricing';
import ko from '../../public/locales/ko/common.json';
import { computeReleaseBudget, releaseBundleFor, RELEASE_BUDGET_MAX_SONGS, type ReleaseBudgetInput } from './budget';

const base: ReleaseBudgetInput = { songs: 1, trackScale: 'l1', arrangementSongs: 0, vocalTuning: false, fundingSource: 'self' };
const amount = (songs: number) => releaseBundleFor(songs).amount;
/** "+45만원" → 450000 */
const manwon = (s: string) => Number(s.replace(/,/g, '')) * 10000;

describe('발매 예산 — 곡 수별 기본 번들', () => {
  it('정본 번들 곡 수는 번들가 그대로', () => {
    expect(amount(1)).toBe(SINGLE_BUNDLE_PRICE);
    expect(amount(3)).toBe(EP_BUNDLE_PRICE); // 3곡도 EP 하한
    expect(amount(4)).toBe(EP_BUNDLE_PRICE);
    expect(amount(8)).toBe(ALBUM_BUNDLE_PRICE);
  });

  it('곡 수가 늘면 금액이 줄지 않는다', () => {
    for (let n = 2; n <= RELEASE_BUDGET_MAX_SONGS; n += 1) expect(amount(n)).toBeGreaterThanOrEqual(amount(n - 1));
  });

  it('티어 페이지의 "가격은 이런 변수로" 곡수 문구와 같다', () => {
    const t = ko.releaseProject.tiers;
    const single = t.single.detail.priceFactors[0].detail.match(/\+(\d+)~(\d+)만원/)!;
    const extraSingle = amount(2) - amount(1);
    expect(extraSingle).toBeGreaterThanOrEqual(manwon(single[1]));
    expect(extraSingle).toBeLessThanOrEqual(manwon(single[2]));
    const ep = t.ep.detail.priceFactors[0].detail.match(/5곡 \+(\d+)만원/)!;
    expect(amount(5) - amount(4)).toBe(manwon(ep[1]));
    const album = t.album.detail.priceFactors[0].detail.match(/10곡 \+(\d+)만원 \/ 12곡 \+(\d+)만원/)!;
    expect(amount(10) - amount(8)).toBe(manwon(album[1]));
    expect(amount(12) - amount(8)).toBe(manwon(album[2]));
  });

  it('범위 밖 곡 수는 1~최대로 자른다', () => {
    expect(amount(0)).toBe(amount(1));
    expect(amount(99)).toBe(amount(RELEASE_BUDGET_MAX_SONGS));
  });
});

describe('발매 예산 — 추가 항목', () => {
  it('기본값(1곡·10트랙 이하·추가 없음·직접 준비)은 싱글 번들 하나', () => {
    const b = computeReleaseBudget(base);
    expect(b.lines.map((l) => l.id)).toEqual(['bundle']);
    expect(b.total).toBe(SINGLE_BUNDLE_PRICE);
    expect('totalWithVat' in b).toBe(false); // 번들가·옵션가가 전부 VAT 포함이라 합계도 포함액이다
  });

  it('큰 편성은 곡마다 믹싱 차액, 편곡은 같은 등급으로 고른 곡 수만큼', () => {
    const b = computeReleaseBudget({ ...base, songs: 4, trackScale: 'l3', arrangementSongs: 2 });
    expect(b.lines.find((l) => l.id === 'mixing')!.amount).toBe((MIXING_LEVEL3_PRICE - MIXING_LEVEL1_PRICE) * 4);
    const band = computeReleaseBudget({ ...base, songs: 4, trackScale: 'l2', arrangementSongs: 9 });
    expect(band.lines.find((l) => l.id === 'arrangement')!.amount).toBe(ARRANGEMENT_BAND_PRICE * 4); // 곡 수를 넘지 않는다
  });

  it('튜닝은 곡마다, 펀딩이면 설계비 한 번 — 지원사업·미정은 더하지 않는다', () => {
    const b = computeReleaseBudget({ ...base, songs: 3, vocalTuning: true, fundingSource: 'funding' });
    expect(b.total).toBe(EP_BUNDLE_PRICE + VOCAL_TUNING_ADDON_PRICE * 3 + FUNDING_DESIGN_PRICE);
    expect(computeReleaseBudget({ ...base, fundingSource: 'grant' }).total).toBe(SINGLE_BUNDLE_PRICE);
    expect(computeReleaseBudget({ ...base, fundingSource: 'unsure' }).total).toBe(SINGLE_BUNDLE_PRICE);
  });
});
