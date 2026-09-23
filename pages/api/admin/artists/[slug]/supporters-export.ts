import type { NextApiRequest, NextApiResponse } from 'next';

import { getSupportedArtist } from '../../../../../data/artists';
import { listSupporterContacts } from '../../../../../lib/artistSupport/supporters';
import { artistSupportTierLabel } from '../../../../../lib/billing/amounts';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { toCsv } from '../../../../../lib/funding/csv';
import { recordAdminPrivacyAccess } from '../../../../../lib/privacy/accessLog';

/**
 * 아티스트별 후원자 연락처 CSV — 월 소식 메일을 운영자가 직접 보낼 때 쓴다(스펙 §12).
 * 개인정보라 관리자 세션 필수, no-store.
 *
 * 내려받은 사실은 접속기록에 남긴다(`privacy_access_logs`) — 아티스트 slug와 건수만이고
 * 이름·이메일은 담지 않는다. 슬러그가 형식에 안 맞거나 없는 아티스트인 404는 남기지
 * 않는다: 아무것도 조회되지 않았고, 인증만 통과하면 밖에서 마음대로 늘릴 수 있는 행이 된다.
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
  await recordAdminPrivacyAccess(req, 'artist_supporter_export', slug, 'success', rows.length).catch(
    (error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 다운로드는 계속됩니다', error);
    },
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="supporters-${slug}.csv"`);
  return res.status(200).send(toCsv(rows, COLUMNS));
}
