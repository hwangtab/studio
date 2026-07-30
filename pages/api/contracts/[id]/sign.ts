import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';
import { and, eq, isNull } from 'drizzle-orm';

import { getDb } from '../../../../db/client';
import { contractAttachments, contractClauses, contracts, signatures } from '../../../../db/schema';
import { checkIdentityAttemptLimit, resetIdentityAttempts } from '../../../../lib/contracts/admin-rate-limit';
import { finalizeSignedContract } from '../../../../lib/contracts/finalize';
import { IDENTITY_DIGITS, verifyIdentityDigits } from '../../../../lib/contracts/identity';
import { buildFingerprintInput, computeContractFingerprint } from '../../../../lib/contracts/integrity';
import { serializeContract } from '../../../../lib/contracts/serialize';
import { validateSignatureData } from '../../../../lib/contracts/signature-validation';
import { checkAction, getEffectiveStatus } from '../../../../lib/contracts/status';

const getClientIp = (req: NextApiRequest): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket.remoteAddress || '';
  return String(raw).split(',')[0].trim();
};

/**
 * 응답 뒤에 이어지는 후처리(PDF 생성·메일 발송)까지 이 함수의 실행 시간 안에서 끝나야
 * 한다. 콜드 스타트에서 Chromium을 푸는 시간을 감안해 상한을 명시한다.
 */
export const config = { maxDuration: 60 };

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

  const { token, signatureData, agreements, identityDigits, identityConfirmed } = req.body as Record<
    string,
    unknown
  >;

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

  const agreedIds = new Set(agreements as string[]);

  try {
    const contract = await getDb().query.contracts.findFirst({
      where: (contractsTable, { eq: equals, and: both }) =>
        both(equals(contractsTable.id, id), equals(contractsTable.signToken, token)),
      with: { signatures: true, contractClauses: true, contractAttachments: true },
    });

    if (!contract) {
      return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
    }

    // 만료 기한이 지난 링크는 서명할 수 없다. 상태 전이 규칙과 만료를 한 번에 판정한다.
    const effectiveStatus = getEffectiveStatus(contract);
    const allowed = checkAction(effectiveStatus, 'sign');
    if (!allowed.ok) {
      const message =
        effectiveStatus === 'expired'
          ? '서명 링크가 만료되었습니다. 운영자에게 재발송을 요청해 주세요.'
          : allowed.message;
      return res.status(409).json({ ok: false, message, status: effectiveStatus });
    }

    /**
     * 서명자가 계약 당사자인지 확인한다.
     *
     * 이메일 링크만으로는 그것을 받은 사람이 당사자인지 알 수 없다. 계약서에 적힌 연락처의
     * 뒷자리를 맞추게 해, 링크를 알게 된 제3자를 걸러낸다. 네 자리뿐이라 대입이 가능하므로
     * 시도 횟수도 제한한다.
     */
    const withinAttempts = await checkIdentityAttemptLimit(contract.id);
    if (!withinAttempts) {
      return res.status(429).json({
        ok: false,
        message: '본인 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      });
    }

    const identity = verifyIdentityDigits(identityDigits, contract.customerPhone);
    if (!identity.ok) {
      const message =
        identity.reason === 'unverifiable'
          ? '계약서의 연락처가 올바르지 않아 본인 확인을 할 수 없습니다. 운영자에게 문의해 주세요.'
          : `계약서에 등록된 연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.`;
      return res.status(400).json({ ok: false, message });
    }

    // 본인임을 확인하고 이 방식으로 서명한다는 동의. 서명 행위와 별개로 명시적으로 받는다.
    if (identityConfirmed !== true) {
      return res.status(400).json({
        ok: false,
        message: '본인 확인 및 전자서명 방식 동의에 체크해 주세요.',
      });
    }

    // 필수 동의 항목을 서버에서 다시 확인한다(클라이언트 검사만으로는 우회 가능).
    const missing = [
      ...contract.contractClauses.filter((clause) => !agreedIds.has(clause.id)),
      ...contract.contractAttachments.filter((attachment) => !agreedIds.has(attachment.id)),
    ];

    if (missing.length > 0) {
      return res.status(400).json({
        ok: false,
        message: '모든 필수 동의 항목에 동의해야 서명할 수 있습니다.',
      });
    }

    const now = new Date();
    const ipAddress = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '');

    // 서명자는 계약 당사자로 고정한다. 클라이언트가 보낸 이름·이메일은 신뢰하지 않는다.
    const pendingSignature = contract.signatures.find(
      (signature) => signature.signerRole === 'customer' && signature.status === 'pending',
    );

    // 서명 대기 행이 없다면 이미 처리됐거나 데이터가 어긋난 상태다. 새로 만들지 않는다
    // — 조건 없는 삽입은 중복 서명 기록을 남기는 유일한 구멍이 된다.
    if (!pendingSignature) {
      return res.status(409).json({ ok: false, message: '이미 서명이 처리된 계약입니다.' });
    }

    /**
     * 서명 확정에 필요한 쓰기를 하나의 트랜잭션으로 묶는다.
     *
     * 두 가지를 동시에 만족해야 한다.
     *
     * 하나는 중복 방지다. 상태를 확인한 뒤 쓰기까지는 틈이 있어(TOCTOU) 동시에 들어온
     * 요청이 모두 검사를 통과할 수 있다. 조건 없이 쓰면 늦게 도착한 요청이 이미 확정된
     * 서명 이미지·시각·IP를 덮어쓴다. 그래서 모든 UPDATE에 "아직 처리 전"이라는 조건을
     * 걸고, 실제로 몇 행이 바뀌었는지로 판정한다.
     *
     * 다른 하나는 원자성이다. 선점과 서명 기록을 나눠 실행하면 그 사이에서 실패했을 때
     * 서명 없는 signed 계약이 남고, 재시도는 "이미 서명됨"으로 막혀 복구할 수 없다.
     * batch는 트랜잭션이라 전부 반영되거나 전부 취소된다.
     */
    // 서명 시점 문서의 지문. 나중에 다시 계산해 대조하면 사후 변조를 탐지할 수 있다.
    const contentHash = computeContractFingerprint(
      buildFingerprintInput(contract, {
        attachments: contract.contractAttachments,
        signatureData,
        signedAt: now,
        identityVerifiedAt: now,
      }),
    );

    const [contractResult, signatureResult] = await getDb().batch([
      getDb()
        .update(contracts)
        .set({
          status: 'signed',
          signedAt: now,
          signTokenUsedAt: now,
          rulesAgreed: true,
          rulesAgreedAt: now,
          identityVerifiedAt: now,
          contentHash,
          updatedAt: now,
        })
        .where(and(eq(contracts.id, contract.id), eq(contracts.status, 'sent'))),
      getDb()
        .update(signatures)
        .set({
          status: 'signed',
          signedAt: now,
          signatureData,
          ipAddress,
          userAgent,
          updatedAt: now,
        })
        .where(and(eq(signatures.id, pendingSignature.id), eq(signatures.status, 'pending'))),
      // 동의 시각은 최초 서명 때만 남긴다(재실행이 감사 기록을 밀어내지 않도록).
      getDb()
        .update(contractClauses)
        .set({ agreedAt: now })
        .where(and(eq(contractClauses.contractId, contract.id), isNull(contractClauses.agreedAt))),
      getDb()
        .update(contractAttachments)
        .set({ agreedAt: now })
        .where(
          and(eq(contractAttachments.contractId, contract.id), isNull(contractAttachments.agreedAt)),
        ),
    ]);

    if (contractResult.rowsAffected === 0 || signatureResult.rowsAffected === 0) {
      return res.status(409).json({ ok: false, message: '이미 서명이 처리된 계약입니다.' });
    }

    const signedContract = await getDb().query.contracts.findFirst({
      where: (contractsTable, { eq: equals }) => equals(contractsTable.id, contract.id),
    });

    if (!signedContract) {
      return res.status(500).json({ ok: false, message: '서명 결과를 확인하지 못했습니다.' });
    }

    // PDF 생성·메일 발송은 응답을 보낸 뒤 이어서 처리한다. 서버리스에서 응답 직후 실행이
    // 중단되지 않도록 waitUntil로 런타임에 알린다.
    await resetIdentityAttempts(contract.id);

    waitUntil(finalizeSignedContract(contract.id));

    return res.status(200).json({ ok: true, contract: serializeContract(signedContract) });
  } catch (error: unknown) {
    console.error('[API/contracts/[id]/sign] Failed to sign contract:', error);
    return res.status(500).json({ ok: false, message: '서명 처리에 실패했습니다.' });
  }
}
