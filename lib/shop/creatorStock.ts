import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { setSkuStock } from './adminQueries';
import { isMissingTableError } from './fulfillmentMode';

/**
 * 아티스트가 **자기가 직접 보내는 상품**의 총 재고를 넣는다. 스튜디오가 보관·발송하는 상품은 지금처럼 관리자만 정한다.
 *
 * 쓰기는 관리자와 같은 `setSkuStock`(잠긴 SKU만·한정 수량 합 상한)이다. 이 파일이 하는 일은 **소유 판정**뿐 —
 * SKU가 이 아티스트의 **실물** 상품이고 발송 주체가 'artist'이며 잠겨(판매 시작) 있어야 한다(디지털은 발송이 없다 — `resolveOrderShipper`와 같은 기준). 아티스트 상품 쓰기 경로
 * (`creatorProductWrite.ts`)는 재고 표를 만지지 않는다는 규칙(테스트가 소스를 검사한다)을 지키려고 별도 파일에 둔다.
 */

export type CreatorStockResult = { ok: true } | { ok: false; message: string };

const NOT_YOURS = '재고를 직접 정할 수 있는 상품이 아니에요.';

export const setOwnSkuStock = async (creatorId: string, skuId: string, stock: number): Promise<CreatorStockResult> => {
  try {
    const [row] = await getDb().all<{ n: number }>(sql`
      SELECT COUNT(*) AS n
      FROM shop_product_skus s
      JOIN shop_products p ON p.id = s.product_id
      JOIN shop_product_fulfillment f ON f.product_id = p.id
      WHERE s.id = ${skuId} AND s.locked_at IS NOT NULL
        AND p.creator_id = ${creatorId} AND f.mode = 'artist' AND p.kind <> 'digital' AND p.review_status = 'approved'
    `);
    if (Number(row?.n ?? 0) === 0) return { ok: false, message: NOT_YOURS };
  } catch (error: unknown) {
    if (isMissingTableError(error)) return { ok: false, message: NOT_YOURS };
    throw error;
  }
  return setSkuStock(skuId, stock);
};
