import type { NextApiRequest, NextApiResponse } from 'next';

import { sessionMusicianStatusEnum } from '../../../../../db/schema';
import { SESSION_LIMITS } from '../../../../../data/sessionMusicians';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { deleteSessionMusicianById, isSessionMusicianTableMissing, updateOperatorFields } from '../../../../../lib/sessionMusicians/repository';
import { cleanMultiline } from '../../../../../lib/sessionMusicians/validate';

/**
 * PATCH { status?, operatorMemo? } — 운영자 상태·메모. 본인 입력(프로필)은 건드리지 않는다.
 * DELETE — 등록 즉시 삭제(행 삭제). 관리 링크를 잃은 본인이 삭제를 요구할 때(열람·정정·삭제권) 쓴다.
 * 메모는 개인정보로 취급한다 — 행과 함께 지워지고 알림 메일에 싣지 않는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'PATCH, DELETE');
    return res.status(405).json({ ok: false });
  }
  try {
    if (req.method === 'DELETE') {
      const deleted = await deleteSessionMusicianById(id);
      return deleted ? res.status(200).json({ ok: true }) : res.status(404).json({ ok: false, message: '등록 기록을 찾을 수 없어요.' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const fields: Parameters<typeof updateOperatorFields>[1] = {};
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !(sessionMusicianStatusEnum as readonly string[]).includes(body.status)) {
        return res.status(400).json({ ok: false, message: '상태 값이 올바르지 않아요.' });
      }
      fields.status = body.status as (typeof sessionMusicianStatusEnum)[number];
    }
    if (body.operatorMemo !== undefined) {
      if (body.operatorMemo !== null && typeof body.operatorMemo !== 'string') {
        return res.status(400).json({ ok: false, message: '메모 형식이 올바르지 않아요.' });
      }
      const memo = cleanMultiline(body.operatorMemo);
      if (memo.length > SESSION_LIMITS.operatorMemo.max) {
        return res.status(400).json({ ok: false, message: `메모는 ${SESSION_LIMITS.operatorMemo.max}자 이하로 적어 주세요.` });
      }
      fields.operatorMemo = memo || null;
    }
    if (Object.keys(fields).length === 0) return res.status(400).json({ ok: false, message: '바꿀 값이 없어요.' });
    const updated = await updateOperatorFields(id, fields);
    return updated ? res.status(200).json({ ok: true }) : res.status(404).json({ ok: false, message: '등록 기록을 찾을 수 없어요.' });
  } catch (error) {
    if (isSessionMusicianTableMissing(error)) {
      return res.status(503).json({ ok: false, code: 'migration_needed', message: '마이그레이션 0077이 필요해요.' });
    }
    console.error(`[API/admin/session-musicians/[id]] 실패 (id=${id})`, error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ ok: false, message: '처리하지 못했어요.' });
  }
}
