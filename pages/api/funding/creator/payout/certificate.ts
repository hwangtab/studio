import { randomUUID } from 'node:crypto';

import { put } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../lib/contact/origin';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import {
  clearBusinessCertificate,
  deleteTaxDocumentBlob,
  loadBusinessProfile,
  setBusinessCertificate,
  TAX_DOCUMENT_PREFIX,
} from '../../../../../lib/funding/businessProfile';
import { authenticateCreatorApi } from '../../../../../lib/funding/creatorAuth';
import { hasApprovedEngagement } from '../../../../../lib/funding/creatorEligibility';
import { processTaxDocument, TAX_DOCUMENT_MAX_BYTES, TaxDocumentError } from '../../../../../lib/funding/taxDocument';
import { readBodyWithLimit } from '../../../../../lib/funding/uploadBody';

/**
 * 사업자등록증 사본 업로드(POST)·삭제(DELETE).
 *
 * 원문 바이트를 받으므로 JSON 바디 파서를 끈다(`creator/upload.ts`와 같다).
 * 응답에는 키·주소를 싣지 않는다 — 열람은 관리자 경로(접속기록)만 한다.
 */
export const config = { api: { bodyParser: false } };

const SERVER_ERROR = { ok: false, message: '잠시 후 다시 시도해 주세요.' };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ ok: false });

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요해요.' });
  const { creatorId } = auth;

  // 정산 정보를 받아도 되는 계정만 — savePayoutSection과 같은 게이트.
  let profile: Awaited<ReturnType<typeof loadBusinessProfile>>;
  try {
    if (!(await hasApprovedEngagement(creatorId))) {
      return res.status(403).json({ ok: false, message: '승인된 뒤에 올릴 수 있어요.' });
    }
    profile = await loadBusinessProfile(creatorId);
  } catch (error: unknown) {
    console.error('[funding/creator/payout/certificate] 조회 실패:', error);
    return res.status(500).json(SERVER_ERROR);
  }
  if (profile === 'unavailable') {
    return res.status(503).json({ ok: false, message: '사업자 정보는 아직 준비 중이에요.' });
  }
  if (!profile) {
    return res.status(409).json({ ok: false, message: '사업자 정보를 먼저 저장해 주세요.' });
  }

  if (req.method === 'DELETE') {
    try {
      const cleared = await clearBusinessCertificate(creatorId, new Date());
      if (!cleared) return res.status(409).json({ ok: false, message: '사업자 정보를 먼저 저장해 주세요.' });
      await deleteTaxDocumentBlob(cleared.previousKey, creatorId);
    } catch (error: unknown) {
      console.error('[funding/creator/payout/certificate] 삭제 실패:', error);
      return res.status(500).json(SERVER_ERROR);
    }
    return res.status(200).json({ ok: true });
  }

  // 로그인이 이메일만으로 계정을 만들 수 있어 IP 한 겹을 더한다(creator/upload.ts와 같은 이유).
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`tax_doc_upload:ip:${ip}`, 60, 3600))
    || !(await consumeRateLimit(`tax_doc_upload:${creatorId}`, 20, 3600))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  const body = await readBodyWithLimit(req, TAX_DOCUMENT_MAX_BYTES);
  if (body === null) return res.status(413).json({ ok: false, message: '파일이 너무 커요. 8MB 이하로 올려 주세요.' });
  if (body.length === 0) return res.status(400).json({ ok: false, message: '파일이 비어 있어요.' });

  let processed: Awaited<ReturnType<typeof processTaxDocument>>;
  try {
    processed = await processTaxDocument(body);
  } catch (error: unknown) {
    if (!(error instanceof TaxDocumentError)) console.error('[funding/creator/payout/certificate] 처리 실패:', error);
    return res.status(400).json({ ok: false, message: 'JPG·PNG 이미지나 PDF 파일만 올릴 수 있어요.' });
  }

  const key = `${TAX_DOCUMENT_PREFIX}${creatorId}/${randomUUID()}.${processed.ext}`;
  try {
    await put(key, processed.buffer, { access: 'private', contentType: processed.contentType });
  } catch (error: unknown) {
    console.error('[funding/creator/payout/certificate] Blob 저장 실패:', error);
    return res.status(500).json({ ok: false, message: '파일을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }

  const now = new Date();
  let result: Awaited<ReturnType<typeof setBusinessCertificate>>;
  try {
    result = await setBusinessCertificate(creatorId, key, processed.contentType, now);
  } catch (error: unknown) {
    console.error('[funding/creator/payout/certificate] 행 갱신 실패:', error);
    await deleteTaxDocumentBlob(key, creatorId);
    return res.status(500).json(SERVER_ERROR);
  }
  if (!result) {
    await deleteTaxDocumentBlob(key, creatorId);
    return res.status(409).json({ ok: false, message: '사업자 정보를 먼저 저장해 주세요.' });
  }

  await deleteTaxDocumentBlob(result.previousKey, creatorId);
  return res.status(200).json({ ok: true, uploadedAt: now.toISOString() });
}
