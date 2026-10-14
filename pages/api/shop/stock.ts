import type { NextApiRequest, NextApiResponse } from 'next';

import { findShopProductAsync } from '../../../lib/shop/repository';
import { getRemainingStock } from '../../../lib/shop/service';

/**
 * 상품 하나의 SKU별 남은 수량 — 상세 화면이 마운트 뒤 다시 읽는다(SSR 페이지는 CDN에 짧게 캐시된다).
 * 실패하면 화면은 SSR 값을 그대로 쓴다. 판매 가능 여부의 최종 판정은 주문 생성의 재고 게이트다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const product = await findShopProductAsync(req.query.slug);
  if (!product) return res.status(404).json({ ok: false });
  try {
    const remaining = await getRemainingStock(product.skus.filter((s) => !s.retired).map((s) => s.id), new Date());
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
    return res.status(200).json({ ok: true, remaining });
  } catch (error) {
    console.error('[api/shop/stock] 조회 실패', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ ok: false });
  }
}
