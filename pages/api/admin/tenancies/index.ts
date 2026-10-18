import type { NextApiRequest, NextApiResponse } from 'next';

import { recordAdminPrivacyAccess } from '../../../../lib/privacy/accessLog';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { importTenancySheet } from '../../../../lib/tenancy/importService';
import { syncAllTenancyCalendars, tenancyCalendarId } from '../../../../lib/tenancy/calendar';
import { safeDbErrorSummary } from '../../../../lib/payments/refundAccount';
import { parseTenancyInput } from '../../../../lib/tenancy/rules';
import { createTenancy } from '../../../../lib/tenancy/service';

/** POST { action: 'create' | 'import' | 'sync_all', … } — 월 입주 등록 / 시트 가져오기(일회성) / 캘린더 전체 다시 맞추기. */
const logExport = (req: NextApiRequest, actor: string, targetId: string, rowCount?: number) =>
  recordAdminPrivacyAccess(req, actor, 'tenancy_calendar_export', targetId, 'success', rowCount).catch(() => undefined);

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
      // 등록은 연락처를 복호화해 캘린더 일정 설명에 내보낸다(캘린더가 설정된 경우) — 접속기록에 남긴다.
      if (result.ok) await logExport(req, auth.actor, result.id);
      return res.status(result.ok ? 200 : 409).json(result);
    }
    if (body.action === 'import') {
      if (typeof body.csv !== 'string' || body.csv.length > 200_000) return res.status(400).json({ ok: false, message: 'CSV 내용이 필요해요.' });
      const summary = await importTenancySheet(body.csv);
      if (tenancyCalendarId() && summary.created > 0) await logExport(req, auth.actor, 'import', summary.created);
      return res.status(200).json({ ok: true, summary });
    }
    if (body.action === 'sync_all') {
      if (!tenancyCalendarId()) return res.status(409).json({ ok: false, message: '입주 관리 캘린더가 설정돼 있지 않아요(TENANCY_GCAL_ID).' });
      // 전체 동기화는 모든 입주자의 연락처를 복호화해 일정 설명에 옮긴다 — 값이 서버를 떠나므로 열람과 따로 남긴다.
      const synced = await syncAllTenancyCalendars();
      await logExport(req, auth.actor, 'sync_all', synced.total);
      return res.status(200).json({ ok: true, ...synced });
    }
    return res.status(400).json({ ok: false, message: '알 수 없는 요청이에요.' });
  } catch (error) {
    // drizzle 오류 메시지에는 바인딩된 값(이름·메모)이 실린다 — 이름과 코드만 남긴다.
    console.error('[API/admin/tenancies] 실패', safeDbErrorSummary(error));
    return res.status(500).json({ ok: false, message: '처리하지 못했어요.' });
  }
}
