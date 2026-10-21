/**
 * 의뢰인이 자기 계약서를 다시 받는 경로. 연습실 download.ts와 같은 규칙이다 — 토큰만으로는 주지 않고
 * 연락처 뒷자리를 다시 받는다(링크는 메일함에 몇 년씩 남고, 서명본에는 생년월일·주소·서명이 들어 있다).
 * GET은 완료 화면으로 보낸다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import {
  checkDownloadRateLimit,
  getDownloadIdentityVerdict,
  reserveDownloadIdentityAttempt,
  resetDownloadIdentityAttempts,
} from '../../../../../lib/contracts/admin-rate-limit';
import { IDENTITY_DIGITS, verifyIdentityDigits } from '../../../../../lib/contracts/identity';
import { productionCompletePath, productionRateLimitKey } from '../../../../../lib/contracts/production/links';
import { grantPortalAccess } from '../../../../../lib/contracts/production/portal-session';
import { loadOrRenderProductionPdf } from '../../../../../lib/contracts/production/pdf-storage';
import { hasSignedDocument } from '../../../../../lib/contracts/production/status';

export const config = { maxDuration: 60 };

const LOCKED_MESSAGE =
  '본인 확인에 너무 여러 번 실패했습니다. 잠시 후 다시 시도하거나 운영자에게 문의해 주세요. (010-4255-7893)';
const THROTTLED_MESSAGE = '본인 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const { id, token } = req.query;
  if (typeof id !== 'string' || typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  }

  if (req.method === 'GET') {
    return res.redirect(302, productionCompletePath(id, token));
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const contract = await getDb().query.productionContracts.findFirst({
      where: (t, { eq }) => eq(t.id, id),
      with: { signers: true },
    });
    const linkSigner = contract?.signers.find(
      (signer) => (signer.role === 'client' || signer.role === 'guardian') && signer.signToken === token,
    );
    if (!contract || !linkSigner) {
      return res.status(404).json({ ok: false, message: '계약서를 찾을 수 없습니다.' });
    }
    if (!hasSignedDocument(contract.status)) {
      return res.status(409).json({ ok: false, message: '서명이 완료된 뒤에 계약서를 받으실 수 있습니다.' });
    }
    if (contract.purgedAt) {
      return res.status(409).json({
        ok: false,
        message: '보관 기간이 지나 개인정보가 파기된 계약입니다. 계약서를 다시 발급할 수 없습니다.',
      });
    }

    // 잠김 여부만 먼저 읽고(카운터를 올리지 않는다), 형식이 맞는 시도만 원자적으로 예약한다 — 연습실과 같은 순서.
    const rateKey = `${productionRateLimitKey(contract.id)}:${linkSigner.role}`;
    const verdict = await getDownloadIdentityVerdict(rateKey);
    if (verdict !== 'ok') {
      return res.status(429).json({ ok: false, message: verdict === 'locked' ? LOCKED_MESSAGE : THROTTLED_MESSAGE });
    }

    const identity = verifyIdentityDigits(
      (req.body as { identityDigits?: unknown } | undefined)?.identityDigits,
      // 각자 자기 번호로 — 법정대리인은 운영자가 적은 대리인 연락처.
      linkSigner.role === 'client' ? contract.clientPhone : (linkSigner.phone ?? ''),
    );
    if (identity.ok || identity.reason === 'mismatch') {
      const reserved = await reserveDownloadIdentityAttempt(rateKey);
      if (reserved !== 'ok') {
        return res.status(429).json({ ok: false, message: reserved === 'locked' ? LOCKED_MESSAGE : THROTTLED_MESSAGE });
      }
    }
    if (!identity.ok) {
      const message =
        identity.reason === 'unverifiable'
          ? '계약서의 연락처가 올바르지 않아 본인 확인을 할 수 없습니다. 운영자에게 문의해 주세요.'
          : `계약서에 등록된 연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.`;
      return res.status(400).json({ ok: false, message });
    }

    await resetDownloadIdentityAttempts(rateKey);

    // 의뢰인이 연락처 뒷자리를 맞혔다 — 진행 페이지(unlock)가 요구하는 것과 같은 확인(둘 다 contract.clientPhone 대조, 링크 계약도
    // 서명자가 적은 번호를 대조한다)이라 그 쿠키를 함께 준다. 법정대리인은 진행 페이지를 열 수 없다(의뢰인 토큰만).
    // 쿠키를 못 만들어도(키 없음) 내려받기는 계속된다.
    if (linkSigner.role === 'client') grantPortalAccess(res, contract.id, token);

    // PDF 생성은 Chromium을 띄우는 무거운 작업이다.
    if (!(await checkDownloadRateLimit(rateKey))) {
      return res.status(429).json({ ok: false, message: '잠시 후 다시 시도해 주세요.' });
    }

    const pdf = await loadOrRenderProductionPdf(contract);
    const filename = `${contract.clientName}_음원제작용역계약서.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="production-contract-${contract.id}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.status(200).send(pdf);
  } catch (error: unknown) {
    console.error('[API/contracts/production/download] Failed:', error);
    return res.status(500).json({ ok: false, message: '계약서를 준비하지 못했습니다.' });
  }
}
