import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { SHOP_PRODUCTS } from './catalog';

/**
 * 판매를 시작한 SKU의 id·가격 고정 — 주문 기록이 `sku_id` 문자열로 재고를 세므로 id가 바뀌면 판매 수량이 0으로 보여
 * 재고가 부풀고, 가격이 바뀌면 화면과 결제 기록이 어긋난다(펀딩 리워드 기준선과 같은 이유).
 *
 * - 기준선에 있는 SKU는 카탈로그에서 **지울 수 없고 가격을 바꿀 수 없다.** 그만 팔려면 `retired: true`, 가격을 바꾸려면 새 id.
 * - 새 SKU를 더하면 `UPDATE_SHOP_CATALOG_BASELINE=1 npx jest data/shop/catalog.baseline.test.ts`로 기준선에 싣는다.
 *   갱신 경로도 위 두 위반을 거부한다(검사만 막으면 열쇠가 자물쇠 옆에 걸린다 — 펀딩 약관 게이트의 교훈).
 */
const BASELINE_PATH = join(__dirname, 'catalog.baseline.json');
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, number>;
const current = Object.fromEntries(SHOP_PRODUCTS.flatMap((p) => p.skus.map((s) => [s.id, s.price]))) as Record<string, number>;

const violations = (): string[] =>
  Object.entries(baseline).flatMap(([id, price]) => {
    if (!(id in current)) return [`SKU ${id}가 카탈로그에서 사라졌다 — 지우지 말고 retired: true로 내릴 것`];
    if (current[id] !== price) return [`SKU ${id} 가격 ${price} → ${current[id]} — 가격은 새 SKU id로 바꿀 것`];
    return [];
  });

describe('상점 SKU 기준선', () => {
  it('판매를 시작한 SKU는 지워지거나 가격이 바뀌지 않는다', () => {
    expect(violations()).toEqual([]);
  });

  it('카탈로그의 모든 SKU가 기준선에 있다(새 SKU는 기준선 갱신과 같은 커밋으로)', () => {
    if (process.env.UPDATE_SHOP_CATALOG_BASELINE === '1') {
      if (violations().length > 0) throw new Error(`기준선을 갱신할 수 없다:\n${violations().join('\n')}`);
      writeFileSync(BASELINE_PATH, `${JSON.stringify({ ...baseline, ...current }, null, 2)}\n`);
      return;
    }
    expect(Object.keys(current).filter((id) => !(id in baseline))).toEqual([]);
  });
});
