import fs from 'node:fs';
import path from 'node:path';
import { MARKET_PRODUCTION_MEDIAN_SUM, MARKET_ROWS, MARKET_SURVEY_CHECKED_ON } from './marketPriceSurvey';

/**
 * 비교 광고의 입증 가드. 사이트에 싣는 시장 숫자는 근거 문서에 같은 숫자로 적혀 있어야 한다 —
 * 데이터만 고치고 문서를 안 고치면(또는 그 반대면) 여기서 선다.
 */
const DOC = fs.readFileSync(path.join(process.cwd(), 'docs/market-price-survey-2026-09.md'), 'utf-8');
const fmt = (n: number) => n.toLocaleString('en-US');

describe('시장 가격 비교표', () => {
  it('중앙값은 범위 안에 있다', () => {
    for (const r of MARKET_ROWS) {
      if (!r.market.range || r.market.median === undefined) continue;
      expect(r.market.median).toBeGreaterThanOrEqual(r.market.range[0]);
      expect(r.market.median).toBeLessThanOrEqual(r.market.range[1]);
    }
  });

  it('사이트에 싣는 범위·중앙값이 근거 문서에 같은 숫자로 적혀 있다', () => {
    expect(DOC).toContain(MARKET_SURVEY_CHECKED_ON);
    for (const r of MARKET_ROWS) {
      if (!r.market.range) continue;
      expect(DOC).toContain(`${fmt(r.market.range[0])}~${fmt(r.market.range[1])}원`);
      if (r.market.median) expect(DOC).toContain(`중앙값 ${fmt(r.market.median)}원`);
    }
  });

  it('숫자가 없는 항목은 숫자 대신 이유를 말한다 — 없는 시세를 만들지 않는다', () => {
    for (const r of MARKET_ROWS) {
      if (r.market.range) continue;
      expect(r.market.note).toBeTruthy();
      expect(r.market.note).not.toMatch(/\d/);
    }
  });

  it('중앙값 합계는 녹음·믹싱·마스터링 세 항목의 합이다', () => {
    const medians = MARKET_ROWS.filter((r) => r.market.median).map((r) => r.market.median!);
    expect(medians).toHaveLength(3);
    expect(MARKET_PRODUCTION_MEDIAN_SUM).toBe(medians.reduce((a, b) => a + b, 0));
  });
});
