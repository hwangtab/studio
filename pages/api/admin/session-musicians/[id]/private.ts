import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { FieldCryptoError } from '../../../../../lib/crypto/fieldCrypto';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../../lib/privacy/accessLog';
import { openSessionPrivate } from '../../../../../lib/sessionMusicians/privateData';
import { getSessionMusician, isSessionMusicianTableMissing } from '../../../../../lib/sessionMusicians/repository';

/**
 * GET — 세션 연주자의 실명·휴대전화·이메일·카카오톡 ID를 **응답으로만** 내보낸다(props·HTML·알림 메일에 싣지 않는다).
 * 열람 사실은 접속기록(`session_musician_private_view`)에 남기되 값은 적지 않는다. 실패도 남긴다.
 * 월 입주 `tenancy_private_view`(pages/api/admin/tenancies/[id]/private.ts)와 같은 구조다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, auth.actor, 'session_musician_private_view', id, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error);
    });
  try {
    const row = await getSessionMusician(id);
    if (!row) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '등록 기록을 찾을 수 없어요.' });
    }
    const data = openSessionPrivate(row.privateEnc);
    await log('success');
    return res.status(200).json({ ok: true, private: data });
  } catch (error) {
    if (isSessionMusicianTableMissing(error)) {
      return res.status(503).json({ ok: false, code: 'migration_needed', message: '마이그레이션 0077이 필요해요.' });
    }
    if (error instanceof FieldCryptoError) {
      await log('decrypt_failed');
      console.error(`[session-musicians] 개인정보 복호화 실패 (id=${id}, code=${error.code})`);
      return res.status(500).json({ ok: false, code: error.code, message: '복호화하지 못했어요. 암호화 키를 확인해 주세요.' });
    }
    await log('error');
    console.error(`[session-musicians] 개인정보 조회 실패 (id=${id})`);
    return res.status(500).json({ ok: false, message: '읽지 못했어요.' });
  }
}
