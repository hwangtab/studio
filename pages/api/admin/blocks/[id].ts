import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../../db/client';
import { availabilityBlocks } from '../../../../db/schema';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const { id } = req.query;
  if (typeof id !== 'string' || id.trim() === '') {
    return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  }

  if (req.method === 'DELETE') {
    try {
      const result = await getDb().delete(availabilityBlocks).where(eq(availabilityBlocks.id, id));

      if ((result.rowsAffected ?? 0) === 0) {
        return res.status(404).json({ ok: false, message: '블록을 찾을 수 없습니다.' });
      }

      return res.status(200).json({ ok: true });
    } catch (error: unknown) {
      console.error('[API/admin/blocks/[id]] Failed to delete block:', error);
      return res.status(500).json({ ok: false, message: '블록 삭제에 실패했습니다.' });
    }
  }

  res.setHeader('Allow', 'DELETE');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
