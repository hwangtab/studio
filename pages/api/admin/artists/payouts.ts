import type { NextApiRequest, NextApiResponse } from 'next';

import { buildAllArtistPayoutPreviews, PERIOD_PATTERN, recordArtistPayout } from '../../../../lib/artistSupport/payout';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';

/**
 * GET ?period=YYYY-MM — 등록 아티스트 전부의 그 달 정산 미리보기(기록이 있으면 함께).
 * POST {artistSlug, period} — 미리보기 숫자를 정산 기록으로 고정한다.
 */
const RECORD_ERROR: Record<string, { status: number; message: string }> = {
  not_found: { status: 404, message: '아티스트를 찾을 수 없습니다.' },
  already_recorded: { status: 409, message: '이미 기록된 정산입니다.' },
  nothing_to_pay: { status: 409, message: '그 달에 결제된 회차가 없어 정산할 것이 없습니다.' },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method === 'GET') {
    const period = typeof req.query.period === 'string' ? req.query.period : '';
    if (!PERIOD_PATTERN.test(period)) return res.status(400).json({ ok: false, message: 'period는 YYYY-MM 형식이어야 합니다.' });
    try {
      const previews = await buildAllArtistPayoutPreviews(period);
      return res.status(200).json({ ok: true, previews });
    } catch (error: unknown) {
      console.error('[API/admin/artists/payouts] 미리보기 실패:', error);
      return res.status(500).json({ ok: false, message: '정산을 계산하지 못했습니다.' });
    }
  }

  if (req.method === 'POST') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }
    const { artistSlug, period } = req.body as Record<string, unknown>;
    if (typeof artistSlug !== 'string' || artistSlug.trim() === '' || typeof period !== 'string' || !PERIOD_PATTERN.test(period)) {
      return res.status(400).json({ ok: false, message: '아티스트와 기간(YYYY-MM)을 지정해 주세요.' });
    }
    try {
      const result = await recordArtistPayout(artistSlug, period, new Date());
      if (!result.ok) {
        const mapped = RECORD_ERROR[result.code];
        return res.status(mapped.status).json({ ok: false, code: result.code, message: mapped.message });
      }
      return res.status(201).json({ ok: true, id: result.payout.id });
    } catch (error: unknown) {
      console.error('[API/admin/artists/payouts] 기록 실패:', error);
      return res.status(500).json({ ok: false, message: '정산을 기록하지 못했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false });
}
