import type { NextApiRequest, NextApiResponse } from 'next';

import { processTossWebhook } from '../../../lib/booking/webhook';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { status } = await processTossWebhook(req.body);
  return res.status(status).json({ ok: status === 200 });
}
