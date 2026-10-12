import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { setSkuStock } from '../../../../lib/shop/adminQueries';

/** 관리자 — SKU 총 재고 정하기. 판매·보류 수량은 주문에서 계산하므로 여기 값은 "지금까지 내놓은 총수량"이다. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  if (typeof b.skuId !== 'string' || typeof b.stock !== 'number') return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });
  const result = await setSkuStock(b.skuId, b.stock);
  return result.ok ? res.status(200).json({ ok: true }) : res.status(400).json(result);
}
