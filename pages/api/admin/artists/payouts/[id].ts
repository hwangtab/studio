import type { NextApiRequest, NextApiResponse } from 'next';

import { markArtistPayoutPaid } from '../../../../../lib/artistSupport/payout';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';

/** POST {action:'mark_paid', memo?} — 운영자가 이체를 마친 뒤 누른다. pending → paid 한 방향. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const { id } = req.query;
  if (typeof id !== 'string' || id.trim() === '') return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  }
  const { action, memo } = req.body as Record<string, unknown>;
  if (action !== 'mark_paid') return res.status(400).json({ ok: false, message: 'action은 mark_paid여야 합니다.' });

  try {
    const done = await markArtistPayoutPaid(id, typeof memo === 'string' && memo.trim() ? memo.trim() : null, new Date());
    if (!done) return res.status(409).json({ ok: false, message: '이미 지급 완료됐거나 없는 정산입니다.' });
    return res.status(200).json({ ok: true });
  } catch (error: unknown) {
    console.error('[API/admin/artists/payouts/[id]] 지급 완료 실패:', error);
    return res.status(500).json({ ok: false, message: '처리하지 못했습니다.' });
  }
}
