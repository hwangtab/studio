import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import { getDb } from '../../../../db/client';
import { checkIdentityAttempt, resetIdentityAttempts } from '../../../../lib/contracts/admin-rate-limit';
import { getClientIp } from '../../../../lib/contracts/client-ip';
import { finalizeSignedContract } from '../../../../lib/contracts/finalize';
import { IDENTITY_DIGITS, verifyIdentityDigits } from '../../../../lib/contracts/identity';
import { buildFingerprintInput, computeContractFingerprint } from '../../../../lib/contracts/integrity';
import { validateSignatureData } from '../../../../lib/contracts/signature-validation';
import { buildSignStatements } from '../../../../lib/contracts/sign-transaction';
import { buildSignedContractContent } from '../../../../lib/contracts/service';
import { checkAction, getEffectiveStatus } from '../../../../lib/contracts/status';
import { validateSignerDetails } from '../../../../lib/contracts/validation';

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

  /**
   * 생년월일·주소는 당사자가 이 화면에서 직접 채운다.
   *
   * 운영자는 그 값을 알 수 없다. 계약을 잡는 과정에서 이름·연락처·이메일은 오가지만
   * 생년월일을 물어보는 일은 없고, 대신 적으면 오타가 나도 확인할 방법이 없다.
   * 계약 당사자를 특정하는 정보라 본인이 적고 본인이 확인한 뒤 서명하는 것이 맞다.
   */
  const signerDetails = validateSignerDetails(req.body as Record<string, unknown>);
  if (!signerDetails.ok) {
    return res.status(400).json({
      ok: false,
      message: '입력하신 정보를 확인해 주세요.',
      errors: signerDetails.errors,
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
    const attemptVerdict = await checkIdentityAttempt(contract.id);
    if (attemptVerdict === 'locked') {
      return res.status(429).json({
        ok: false,
        message:
          '본인 확인에 여러 번 실패해 이 서명 링크가 잠겼습니다. 운영자에게 재발송을 요청해 주세요. (010-4255-7893)',
      });
    }
    if (attemptVerdict === 'throttled') {
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
      // 상태를 함께 돌려준다 — 응답 도중 연결이 끊겨 다시 제출한 고객을 완료 화면으로
      // 보내려면 화면이 "이미 끝났다"는 것을 구별할 수 있어야 한다.
      return res
        .status(409)
        .json({ ok: false, message: '이미 서명이 처리된 계약입니다.', status: 'signed' });
    }

    /**
     * 고객이 채운 정보로 계약 본문을 완성한다. 서명이 붙는 대상은 이 최종본이다.
     * 계약일도 여기서 확정된다 — 초안을 만든 날이 아니라 실제로 서명한 날이다.
     */
    const signedContent = buildSignedContractContent(
      contract,
      signerDetails.data,
      now,
    );

    // 서명 시점 문서의 지문. 나중에 다시 계산해 대조하면 사후 변조를 탐지할 수 있다.
    const contentHash = computeContractFingerprint(
      buildFingerprintInput({ ...contract, ...signerDetails.data, content: signedContent }, {
        attachments: contract.contractAttachments,
        clauses: contract.contractClauses,
        signatureData,
        // 서명란에 인쇄되는 값 그대로. 서명행에 저장하는 것과 같은 값을 지문에도 넣는다.
        signer: {
          name: pendingSignature.signerName,
          email: pendingSignature.signerEmail,
          ipAddress,
        },
        signedAt: now,
        identityVerifiedAt: now,
      }),
    );

    /**
     * 상태를 확인한 뒤 쓰기까지는 틈이 있어(TOCTOU) 동시에 들어온 요청이 모두 검사를
     * 통과할 수 있다. 조건 없이 쓰면 늦게 도착한 요청이 이미 확정된 서명 이미지·시각·IP를
     * 덮어쓴다. 그래서 모든 문장이 "계약이 아직 서명 대기"라는 조건에 걸리고, 실제로 몇
     * 행이 바뀌었는지로 판정한다. 조건과 순서는 sign-transaction.ts에 있다.
     */
    const [signatureResult, , , contractResult] = await getDb().batch(
      buildSignStatements(getDb(), {
        contractId: contract.id,
        signatureId: pendingSignature.id,
        now,
        signatureData,
        ipAddress,
        userAgent,
        contentHash,
        customerBirthdate: signerDetails.data.customerBirthdate,
        customerAddress: signerDetails.data.customerAddress,
        content: signedContent,
      }),
    );

    if (contractResult.rowsAffected === 0 || signatureResult.rowsAffected === 0) {
      return res
        .status(409)
        .json({ ok: false, message: '이미 서명이 처리된 계약입니다.', status: 'signed' });
    }

    // PDF 생성·메일 발송은 응답을 보낸 뒤 이어서 처리한다. 서버리스에서 응답 직후 실행이
    // 중단되지 않도록 waitUntil로 런타임에 알린다.
    await resetIdentityAttempts(contract.id);

    waitUntil(finalizeSignedContract(contract.id));

    /**
     * 계약 레코드를 응답에 싣지 않는다.
     *
     * 서명 화면은 ok와 message만 읽고 완료 페이지로 이동한다(sign.tsx). 쓰지도 않는
     * 연락처·주소·계약 본문을 응답에 담으면 브라우저 이력·중계 로그·확장 프로그램에
     * 남을 뿐이다. 완료 화면에 필요한 값은 완료 페이지가 서버에서 다시 읽는다.
     */
    return res.status(200).json({ ok: true });
  } catch (error: unknown) {
    console.error('[API/contracts/[id]/sign] Failed to sign contract:', error);
    return res.status(500).json({ ok: false, message: '서명 처리에 실패했습니다.' });
  }
}
