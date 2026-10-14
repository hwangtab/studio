import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { loadBusinessProfile, loadCreatorTaxType, refreshBusinessStatus } from '../../../../../lib/funding/businessProfile';

/**
 * 운영자 화면의 개설자 사업자 정보 패널(`components/admin/CreatorTaxProfilePanel.tsx`)이 읽고 쓰는 곳.
 *
 * GET — 세금 구분 + 사업자 요약. 계좌·주민등록번호는 싣지 않는다(그건 펀딩 정산 절의 조회 버튼이 따로 연다).
 * POST `{ action: 'recheck' }` — 저장된 번호로 국세청 상태를 다시 조회해 상태 칸만 갱신한다.
 *   국세청 API 일일 한도를 버튼 연타로 쓰지 않게 개설자당 시간당 20회로 막는다.
 */
const RECHECK_LIMIT = 20;
const RECHECK_WINDOW_SECONDS = 3600;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false });
  }

  const creatorId = typeof req.query.creatorId === 'string' ? req.query.creatorId : '';
  if (!creatorId) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });

  try {
    if (req.method === 'POST') {
      const action = (req.body as { action?: unknown } | undefined)?.action;
      if (action !== 'recheck') return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
      if (!(await consumeRateLimit(`nts_admin_recheck:${creatorId}`, RECHECK_LIMIT, RECHECK_WINDOW_SECONDS))) {
        return res.status(429).json({ ok: false, message: '조회를 너무 자주 했어요. 한 시간 뒤에 다시 시도해 주세요.' });
      }
      const business = await refreshBusinessStatus(creatorId);
      if (!business) return res.status(404).json({ ok: false, message: '등록된 사업자 정보가 없어요.' });
      return res.status(200).json({ ok: true, business });
    }

    const creator = await loadCreatorTaxType(creatorId);
    if (!creator) return res.status(404).json({ ok: false, message: '개설자를 찾지 못했어요.' });
    const business = await loadBusinessProfile(creatorId);
    return res.status(200).json({
      ok: true,
      taxType: creator.taxType,
      business: business === 'unavailable' ? null : business,
      businessUnavailable: business === 'unavailable',
    });
  } catch (error: unknown) {
    console.error(`[admin/creators] 사업자 정보 처리 실패 (creatorId=${creatorId}):`, error);
    return res.status(500).json({ ok: false, message: '사업자 정보를 읽지 못했어요.' });
  }
}
