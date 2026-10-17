import type { NextApiRequest, NextApiResponse } from 'next';

import { recordAdminPrivacyAccess } from '../../../../lib/privacy/accessLog';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { importTenancySheet } from '../../../../lib/tenancy/importService';
import { syncAllTenancyCalendars, tenancyCalendarId } from '../../../../lib/tenancy/calendar';
import { parseTenancyInput } from '../../../../lib/tenancy/rules';
import { createTenancy } from '../../../../lib/tenancy/service';

/** POST { action: 'create' | 'import' | 'sync_all', … } — 월 입주 등록 / 시트 가져오기(일회성) / 캘린더 전체 다시 맞추기. */
export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  try {
    if (body.action === 'create') {
      const parsed = parseTenancyInput(body.input);
      if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
      const result = await createTenancy(parsed.value);
      return res.status(result.ok ? 200 : 409).json(result);
    }
    if (body.action === 'import') {
      if (typeof body.csv !== 'string' || body.csv.length > 200_000) return res.status(400).json({ ok: false, message: 'CSV 내용이 필요해요.' });
      return res.status(200).json({ ok: true, summary: await importTenancySheet(body.csv) });
    }
    if (body.action === 'sync_all') {
      if (!tenancyCalendarId()) return res.status(409).json({ ok: false, message: '입주 관리 캘린더가 설정돼 있지 않아요(TENANCY_GCAL_ID).' });
      // 전체 동기화는 모든 입주자의 연락처를 복호화해 일정 설명에 옮긴다 — 열람과 같은 무게로 접속기록에 남긴다.
      await recordAdminPrivacyAccess(req, auth.actor, 'tenancy_private_view', 'sync_all', 'success').catch(() => undefined);
      return res.status(200).json({ ok: true, ...(await syncAllTenancyCalendars()) });
    }
    return res.status(400).json({ ok: false, message: '알 수 없는 요청이에요.' });
  } catch (error) {
    console.error('[API/admin/tenancies] 실패', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ ok: false, message: '처리하지 못했어요.' });
  }
}
