import { get } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { isOwnTaxDocumentKey, loadBusinessCertificateKey } from '../../../../../lib/funding/businessProfile';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../../lib/privacy/accessLog';

/**
 * GET — 개설자의 사업자등록증 사본(private Blob `tax-docs/<creatorId>/<uuid>.pdf|webp`)을 관리자에게만 내보낸다.
 *
 * 모양은 주민등록번호 조회(`../../funding/projects/[id]/resident-number.ts`)와 같다: 열람을
 * `privacy_access_logs`에 남기고(성공도 실패도), 기록 실패가 열람을 끊지 않는다. 기록에는 creatorId만 —
 * 파일 경로·이름은 적지 않는다.
 *
 * 응답 형식은 저장된 메타데이터가 아니라 **키의 확장자**로 고정 표에서 고른다. 업로드가 매직 바이트로 판정해
 * 두 형식만 남기지만, 열람 쪽도 그 밖의 형식을 내보낼 길을 두지 않는다. PDF는 내려받기로 준다 — 바로 보기에
 * `Content-Security-Policy: sandbox`를 걸면 크롬 PDF 뷰어가 빈 화면이 된다. 이미지는 바로 보기 + 좁은 CSP.
 */
const CERTIFICATE_TYPES = {
  pdf: { contentType: 'application/pdf', disposition: 'attachment' },
  webp: { contentType: 'image/webp', disposition: 'inline' },
} as const;
type CertificateExt = keyof typeof CERTIFICATE_TYPES;

const extensionOf = (key: string): CertificateExt | null => {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return ext === 'pdf' || ext === 'webp' ? ext : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, private');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }

  const creatorId = typeof req.query.creatorId === 'string' ? req.query.creatorId : '';
  if (!creatorId) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });

  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, auth.actor, 'creator_business_certificate_view', creatorId, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 열람은 계속됩니다', error);
    });

  try {
    const key = await loadBusinessCertificateKey(creatorId);
    if (!key) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '등록된 사업자등록증이 없어요.' });
    }
    // 저장된 키가 이 개설자의 tax-docs/ 아래가 아니거나 형식이 다르면 값이 조작된 것이다 — 열지 않는다.
    const ext = extensionOf(key);
    if (!isOwnTaxDocumentKey(key, creatorId) || !ext) {
      await log('error');
      console.error(`[admin/creators] 사업자등록증 키가 규칙 밖이다 (creatorId=${creatorId})`);
      return res.status(404).json({ ok: false, message: '등록된 사업자등록증이 없어요.' });
    }

    const blob = await get(key, { access: 'private' });
    if (!blob?.stream) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '사업자등록증 파일을 찾지 못했어요.' });
    }
    const body = Buffer.from(await new Response(blob.stream).arrayBuffer());

    const type = CERTIFICATE_TYPES[ext];
    res.setHeader('Content-Type', type.contentType);
    res.setHeader('Content-Disposition', `${type.disposition}; filename="business-certificate.${ext}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (ext === 'webp') res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
    await log('success');
    console.warn(`[admin/creators] 사업자등록증 열람 (creatorId=${creatorId}, at=${new Date().toISOString()})`);
    return res.status(200).send(body);
  } catch (error: unknown) {
    await log('error');
    console.error(`[admin/creators] 사업자등록증 열람 실패 (creatorId=${creatorId}):`, error);
    return res.status(500).json({ ok: false, message: '사업자등록증을 읽지 못했어요.' });
  }
}
