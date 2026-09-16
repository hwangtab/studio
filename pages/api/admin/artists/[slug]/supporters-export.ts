import type { NextApiRequest, NextApiResponse } from 'next';

import { getSupportedArtist } from '../../../../../data/artists';
import { listSupporterContacts } from '../../../../../lib/artistSupport/supporters';
import { artistSupportTierLabel } from '../../../../../lib/billing/amounts';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { toCsv } from '../../../../../lib/funding/csv';

/**
 * 아티스트별 후원자 연락처 CSV — 월 소식 메일을 운영자가 직접 보낼 때 쓴다(스펙 §12).
 * 개인정보라 관리자 세션 필수, no-store.
 */
const COLUMNS = ['customerName', 'customerEmail', 'displayName', 'displayConsent', 'tier', 'status', 'since'];
const SLUG_PATTERN = /^[a-z0-9-]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  if (!SLUG_PATTERN.test(slug) || !getSupportedArtist(slug)) return res.status(404).json({ ok: false });

  const rows = (await listSupporterContacts(slug)).map((r) => ({
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    displayName: r.displayName,
    displayConsent: r.displayConsent ? '동의' : '',
    tier: artistSupportTierLabel(r.tierId),
    status: r.status,
    since: r.createdAt.toISOString().slice(0, 10),
  }));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="supporters-${slug}.csv"`);
  return res.status(200).send(toCsv(rows, COLUMNS));
}
