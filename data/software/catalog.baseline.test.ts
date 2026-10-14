import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { SOFTWARE_PRODUCTS } from './catalog';

/**
 * 판매를 시작한 가격 id의 금액 고정 — 주문 기록이 가격 id 문자열을 참조하므로, 금액이 바뀌면 화면과 결제 기록이 어긋난다
 * (상점 SKU·펀딩 리워드 기준선과 같은 이유). 상품 slug도 함께 고정한다 — 라이선스 행과 이미 배포된 플러그인이 slug로
 * 상품을 가리킨다(라이선스 파일의 `product`, 활성화 API의 `product`).
 *
 * - 기준선에 있는 가격 id는 **지울 수 없고 금액·상품을 바꿀 수 없다.** 가격을 바꾸려면 새 id를 더한다.
 * - 새 가격을 더하면 `UPDATE_SOFTWARE_CATALOG_BASELINE=1 npx jest data/software/catalog.baseline.test.ts`로 싣는다.
 *   갱신 경로도 위 위반을 거부한다.
 */
const BASELINE_PATH = join(__dirname, 'catalog.baseline.json');
type BaselineEntry = { product: string; krw: number; usdCents: number | null };
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, BaselineEntry>;
const current = Object.fromEntries(
  SOFTWARE_PRODUCTS.flatMap((p) => (p.prices ?? []).map((pr) => [pr.id, { product: p.slug, krw: pr.krw, usdCents: pr.usdCents ?? null }])),
) as Record<string, BaselineEntry>;

const violations = (): string[] =>
  Object.entries(baseline).flatMap(([id, was]) => {
    const now = current[id];
    if (!now) return [`가격 ${id}가 카탈로그에서 사라졌다 — 지우지 말 것(상품 slug도 바꾸지 말 것)`];
    const problems: string[] = [];
    if (now.product !== was.product) problems.push(`가격 ${id}의 상품 ${was.product} → ${now.product} — slug는 라이선스·플러그인이 참조한다`);
    if (now.krw !== was.krw) problems.push(`가격 ${id} 원화 ${was.krw} → ${now.krw} — 새 가격 id로 바꿀 것`);
    if (was.usdCents !== null && now.usdCents !== was.usdCents) problems.push(`가격 ${id} 달러 ${was.usdCents} → ${now.usdCents} — 새 가격 id로 바꿀 것`);
    return problems;
  });

describe('소프트웨어 가격 기준선', () => {
  it('판매를 시작한 가격은 지워지거나 금액이 바뀌지 않는다', () => {
    expect(violations()).toEqual([]);
  });

  it('카탈로그의 모든 가격이 기준선에 있다(새 가격은 기준선 갱신과 같은 커밋으로)', () => {
    if (process.env.UPDATE_SOFTWARE_CATALOG_BASELINE === '1') {
      if (violations().length > 0) throw new Error(`기준선을 갱신할 수 없다:\n${violations().join('\n')}`);
      writeFileSync(BASELINE_PATH, `${JSON.stringify({ ...baseline, ...current }, null, 2)}\n`);
      return;
    }
    expect(Object.keys(current).filter((id) => !(id in baseline))).toEqual([]);
  });
});
