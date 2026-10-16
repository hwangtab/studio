import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { syncTenancyCalendar } from '../../../../../lib/tenancy/calendar';
import { parseTenancyInput } from '../../../../../lib/tenancy/rules';
import { endTenancy, listPayments, recordPayment, reopenTenancy, updateTenancy } from '../../../../../lib/tenancy/service';

/** GET 입금 이력 · POST { action: 'update' | 'payment' | 'end' | 'reopen' | 'sync' } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, payments: await listPayments(id) });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ ok: false });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const done = (result: { ok: boolean }) => res.status(result.ok ? 200 : 409).json(result);
    switch (body.action) {
      case 'update': {
        const parsed = parseTenancyInput(body.input);
        if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
        return done(await updateTenancy(id, parsed.value, { keepPrivate: body.keepPrivate === true }));
      }
      case 'payment': {
        const amount = body.amount === undefined || body.amount === '' || body.amount === null ? undefined : Number(body.amount);
        return done(await recordPayment(id, {
          paidOn: typeof body.paidOn === 'string' && body.paidOn ? body.paidOn : undefined, amount,
          memo: typeof body.memo === 'string' && body.memo.trim() ? body.memo.trim().slice(0, 200) : null,
        }));
      }
      case 'end':
        return done(await endTenancy(id, typeof body.endedOn === 'string' && body.endedOn ? body.endedOn : undefined));
      case 'reopen':
        return done(await reopenTenancy(id));
      case 'sync': {
        const r = await syncTenancyCalendar(id);
        return res.status(r.ok ? 200 : 502).json(r.ok ? { ok: true, skipped: r.skipped ?? false } : { ok: false, message: r.error });
      }
      default:
        return res.status(400).json({ ok: false, message: '알 수 없는 요청이에요.' });
    }
  } catch (error) {
    console.error('[API/admin/tenancies/[id]] 실패', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ ok: false, message: '처리하지 못했어요.' });
  }
}
