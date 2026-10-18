import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import { getDb } from '../../../../../db/client';
import { checkIdentityAttempt, resetIdentityAttempts } from '../../../../../lib/contracts/admin-rate-limit';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { IDENTITY_DIGITS, verifyIdentityDigits } from '../../../../../lib/contracts/identity';
import { parseStoredClauses } from '../../../../../lib/contracts/production/clauses';
import { finalizeSignedProductionContract } from '../../../../../lib/contracts/production/finalize';
import { computeProductionFingerprint } from '../../../../../lib/contracts/production/integrity';
import { productionRateLimitKey } from '../../../../../lib/contracts/production/links';
import { buildSignedProductionContent } from '../../../../../lib/contracts/production/service';
import { buildProductionSignStatements } from '../../../../../lib/contracts/production/sign-transaction';
import { checkProductionAction, getEffectiveProductionStatus } from '../../../../../lib/contracts/production/status';
import { validateSignatureData } from '../../../../../lib/contracts/signature-validation';
import { validateSignerDetails } from '../../../../../lib/contracts/validation';

/** 응답 뒤 후처리(PDF·메일)까지 이 함수 시간 안에 끝나야 한다 — 연습실 서명 API와 같은 상한. */
export const config = { maxDuration: 60 };

const OPERATOR_PHONE = '010-4255-7893';

/**
 * 의뢰인 서명. 검사 순서와 원칙은 연습실 서명 API(pages/api/contracts/[id]/sign.ts)와 같다:
 * 입력 형식 → 계약·토큰 → 상태(만료 포함) → 본인 확인(시도 제한) → 필수 동의(서버에서 다시) → 본문 완성 →
 * 지문 → 조건부 batch. 다른 점은 둘이다 — 동의 항목은 계약에 떠 둔 사본으로 대조하고, 운영자 서명이 먼저
 * 있어야 한다(이 계약서는 양 당사자 서명으로 성립한다).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ ok: false, message: '잘못된 계약 ID입니다.' });
  }
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  }

  const body = req.body as Record<string, unknown>;
  const { token, signatureData, agreements, identityDigits, identityConfirmed } = body;

  // 생년월일·주소는 당사자가 이 화면에서 채운다(연습실 validateSignerDetails 재사용 — 만 19세 미만도 여기서 막는다).
  const details = validateSignerDetails({
    customerBirthdate: body.clientBirthdate,
    customerAddress: body.clientAddress,
  });
  if (!details.ok) {
    return res.status(400).json({
      ok: false,
      message: '입력하신 정보를 확인해 주세요.',
      // 화면의 칸 이름에 맞춰 돌려준다.
      errors: details.errors.map((error) => ({
        field: error.field === 'customerBirthdate' ? 'clientBirthdate' : 'clientAddress',
        message: error.message,
      })),
    });
  }

  if (typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({ ok: false, message: '서명 토큰이 없습니다.' });
  }
  if (typeof signatureData !== 'string' || signatureData.trim() === '') {
    return res.status(400).json({ ok: false, message: '서명이 필요합니다.' });
  }
  const signatureValidation = validateSignatureData(signatureData);
  if (!signatureValidation.ok) {
    return res.status(400).json({ ok: false, message: signatureValidation.message });
  }
  if (!Array.isArray(agreements) || agreements.some((item) => typeof item !== 'string')) {
    return res.status(400).json({ ok: false, message: '동의 항목 형식이 올바르지 않습니다.' });
  }
  const agreedKeys = new Set(agreements as string[]);

  try {
    const contract = await getDb().query.productionContracts.findFirst({
      where: (t, { eq }) => eq(t.id, id),
      with: { signers: true },
    });
    const clientSigner = contract?.signers.find((signer) => signer.role === 'client' && signer.signToken === token);

    // 계약 id와 토큰이 함께 맞아야 한다. 어느 쪽이 틀렸는지는 알려 주지 않는다.
    if (!contract || !clientSigner) {
      return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
    }

    const effectiveStatus = getEffectiveProductionStatus(contract);
    const allowed = checkProductionAction(effectiveStatus, 'sign');
    if (!allowed.ok) {
      // 응답 도중 끊겨 다시 제출한 의뢰인을 완료 화면으로 보내려면 "이미 끝났다"를 구별할 수 있어야 한다.
      const message =
        effectiveStatus === 'expired'
          ? '서명 링크가 만료되었습니다. 운영자에게 재발송을 요청해 주세요.'
          : allowed.message;
      return res.status(409).json({ ok: false, message, status: effectiveStatus });
    }

    // 운영자가 먼저 서명한 문서여야 한다(발송 = 운영자 서명). 없으면 발송 처리가 반쯤 실패한 것이다.
    const operatorSigner = contract.signers.find((signer) => signer.role === 'operator');
    if (operatorSigner?.status !== 'signed') {
      console.error('[API/contracts/production/sign] Operator signature missing:', contract.id);
      return res.status(409).json({
        ok: false,
        message: `계약서 발송 처리가 끝나지 않았습니다. 운영자에게 재발송을 요청해 주세요. (${OPERATOR_PHONE})`,
      });
    }

    if (clientSigner.status !== 'pending') {
      return res.status(409).json({ ok: false, message: '이미 서명이 처리된 계약입니다.', status: 'signed' });
    }

    // 본인 확인 — 링크를 알게 된 제3자를 걸러낸다. 네 자리뿐이라 시도 횟수를 제한한다.
    const rateKey = productionRateLimitKey(contract.id);
    const attempt = await checkIdentityAttempt(rateKey);
    if (attempt === 'locked') {
      return res.status(429).json({
        ok: false,
        message: `본인 확인에 여러 번 실패해 이 서명 링크가 잠겼습니다. 운영자에게 재발송을 요청해 주세요. (${OPERATOR_PHONE})`,
      });
    }
    if (attempt === 'throttled') {
      return res.status(429).json({ ok: false, message: '본인 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    }

    const identity = verifyIdentityDigits(identityDigits, contract.clientPhone);
    if (!identity.ok) {
      const message =
        identity.reason === 'unverifiable'
          ? '계약서의 연락처가 올바르지 않아 본인 확인을 할 수 없습니다. 운영자에게 문의해 주세요.'
          : `계약서에 등록된 연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.`;
      return res.status(400).json({ ok: false, message });
    }
    if (identityConfirmed !== true) {
      return res.status(400).json({ ok: false, message: '본인 확인 및 전자서명 방식 동의에 체크해 주세요.' });
    }

    // 필수 동의를 서버에서 다시 본다 — 계약에 떠 둔 동의 항목 사본이 기준이다.
    const clauses = parseStoredClauses(contract.clausesJson);
    if (clauses.some((clause) => !agreedKeys.has(clause.key))) {
      return res.status(400).json({ ok: false, message: '모든 필수 동의 항목에 동의해야 서명할 수 있습니다.' });
    }

    const now = new Date();
    const ipAddress = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '');
    const clientDetails = {
      clientBirthdate: details.data.customerBirthdate,
      clientAddress: details.data.customerAddress,
    };

    // 서명자가 읽은 본문을 만든 템플릿 사본으로 완성한다. 계약일도 여기서 확정된다.
    const content = buildSignedProductionContent(contract, clientDetails, now);

    // 지문은 "서명이 끝난 뒤의 문서"를 덮는다 — 서명자 행을 이번 서명 값으로 바꿔 넣고 계산한다.
    const contentHash = computeProductionFingerprint({
      contract: { ...contract, ...clientDetails, content },
      clauses,
      signers: contract.signers.map((signer) =>
        signer.id === clientSigner.id
          ? { ...signer, signedAt: now, identityVerifiedAt: now, ipAddress, signatureData }
          : signer,
      ),
      signedAt: now,
    });

    const [signerResult, contractResult] = await getDb().batch(
      buildProductionSignStatements(getDb(), {
        contractId: contract.id,
        signerId: clientSigner.id,
        signToken: token,
        now,
        signatureData,
        ipAddress,
        userAgent,
        agreedClauseKeys: clauses.map((clause) => clause.key),
        ...clientDetails,
        content,
        contentHash,
      }),
    );

    if (signerResult.rowsAffected === 0 || contractResult.rowsAffected === 0) {
      // 졌다 — 이미 서명됐거나, 그 사이 취소·재발송됐다. 실제 상태를 읽어 맞는 안내를 준다.
      const latest = await getDb()
        .query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, contract.id), columns: { status: true } })
        .catch(() => undefined);
      if (latest && latest.status !== 'signed') {
        return res.status(409).json({
          ok: false,
          message: '계약 상태가 바뀌어 서명을 처리하지 못했습니다. 운영자에게 확인해 주세요.',
          status: latest.status,
        });
      }
      return res.status(409).json({ ok: false, message: '이미 서명이 처리된 계약입니다.', status: 'signed' });
    }

    await resetIdentityAttempts(rateKey);
    waitUntil(finalizeSignedProductionContract(contract.id));

    // 계약 레코드를 응답에 싣지 않는다 — 화면은 ok만 보고 완료 페이지로 간다(연습실과 같다).
    return res.status(200).json({ ok: true });
  } catch (error: unknown) {
    console.error('[API/contracts/production/sign] Failed to sign contract:', error);
    return res.status(500).json({ ok: false, message: '서명 처리에 실패했습니다.' });
  }
}
