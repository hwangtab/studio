import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import { getDb } from '../../../../../db/client';
import { checkIdentityAttempt, resetIdentityAttempts } from '../../../../../lib/contracts/admin-rate-limit';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { IDENTITY_DIGITS, verifyIdentityDigits } from '../../../../../lib/contracts/identity';
import { parseStoredClauses } from '../../../../../lib/contracts/production/clauses';
import { finalizeSignedProductionContract } from '../../../../../lib/contracts/production/finalize';
import { productionSignerRateLimitKey } from '../../../../../lib/contracts/production/links';
import { isOpenProductionContract, validateOpenLinkClient, type OpenLinkClientInput } from '../../../../../lib/contracts/production/open-link';
import { finalizeProductionContractIfComplete } from '../../../../../lib/contracts/production/service';
import { buildProductionSignStatements } from '../../../../../lib/contracts/production/sign-transaction';
import { checkProductionAction, getEffectiveProductionStatus } from '../../../../../lib/contracts/production/status';
import { validateSignatureData } from '../../../../../lib/contracts/signature-validation';
import { validateSignerDetails } from '../../../../../lib/contracts/validation';

/** 응답 뒤 후처리(PDF·메일)까지 이 함수 시간 안에 끝나야 한다 — 연습실 서명 API와 같은 상한. */
export const config = { maxDuration: 60 };

const OPERATOR_PHONE = '010-4255-7893';

/**
 * 의뢰인·법정대리인 서명. 검사 순서와 원칙은 연습실 서명 API(pages/api/contracts/[id]/sign.ts)와 같다:
 * 입력 형식 → 계약·토큰 → 상태(만료 포함) → 본인 확인(시도 제한) → 필수 동의(서버에서 다시) → 조건부 batch.
 *
 * 다른 점:
 * - 서명자는 토큰으로 정해진다(의뢰인·법정대리인이 각자 링크를 받는다). 본인 확인은 각자의 연락처 뒷자리.
 * - 의뢰인은 생년월일·주소를 채운다. 법정대리인이 지정된 계약만 미성년 의뢰인을 받는다.
 * - 운영자 서명이 먼저 있어야 한다(발송 = 운영자 서명, 계약서 제14조 "양 당사자 서명으로 성립").
 * - 성립(본문 완성·지문·signed)은 서명 쓰기 뒤에 **다시 읽은 상태로** 따로 한다 — 마지막 서명자가 누구든
 *   같은 경로다(service.ts finalizeProductionContractIfComplete).
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
    const signer = contract?.signers.find(
      (s) => (s.role === 'client' || s.role === 'guardian') && s.signToken === token,
    );

    // 계약 id와 토큰이 함께 맞아야 한다. 어느 쪽이 틀렸는지는 알려 주지 않는다.
    if (!contract || !signer || (signer.role !== 'client' && signer.role !== 'guardian')) {
      return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
    }
    const role = signer.role;
    const hasGuardian = contract.signers.some((s) => s.role === 'guardian');

    // 의뢰인만 생년월일·주소를 채운다. 대리인이 지정된 계약이면 미성년이어도 받는다.
    let clientDetails: { clientBirthdate: string; clientAddress: string } | undefined;
    if (role === 'client') {
      const details = validateSignerDetails(
        { customerBirthdate: body.clientBirthdate, customerAddress: body.clientAddress },
        { allowMinor: hasGuardian },
      );
      if (!details.ok) {
        return res.status(400).json({
          ok: false,
          message: '입력하신 정보를 확인해 주세요.',
          errors: details.errors.map((error) => ({
            field: error.field === 'customerBirthdate' ? 'clientBirthdate' : 'clientAddress',
            // 대리인 없는 계약의 미성년 차단은 운영자가 대리인을 지정해야 풀린다 — 그 사실을 알려 준다.
            message: error.message.includes('19세')
              ? `만 19세 미만이면 법정대리인이 함께 서명해야 해요. ${OPERATOR_PHONE}으로 연락해 주시면 대리인 서명을 준비해 드려요.`
              : error.message,
          })),
        });
      }
      clientDetails = { clientBirthdate: details.data.customerBirthdate, clientAddress: details.data.customerAddress };
    }

    // 링크 계약(open-link.ts) — 의뢰인이 이름·이메일·연락처를 여기서 채운다. 본인 확인 대조 번호가 없다.
    const openLink = role === 'client' && isOpenProductionContract(contract);
    let openClient: OpenLinkClientInput | undefined;
    if (openLink) {
      const client = validateOpenLinkClient(body);
      if (!client.ok) {
        return res.status(400).json({ ok: false, message: '입력하신 정보를 확인해 주세요.', errors: client.errors });
      }
      openClient = client.data;
    }

    const effectiveStatus = getEffectiveProductionStatus(contract);
    const allowed = checkProductionAction(effectiveStatus, 'sign');
    if (!allowed.ok) {
      const message =
        effectiveStatus === 'expired' ? '서명 링크가 만료되었습니다. 운영자에게 재발송을 요청해 주세요.' : allowed.message;
      return res.status(409).json({ ok: false, message, status: effectiveStatus });
    }

    if (contract.signers.find((s) => s.role === 'operator')?.status !== 'signed') {
      console.error('[API/contracts/production/sign] Operator signature missing:', contract.id);
      return res.status(409).json({
        ok: false,
        message: `계약서 발송 처리가 끝나지 않았습니다. 운영자에게 재발송을 요청해 주세요. (${OPERATOR_PHONE})`,
      });
    }

    if (signer.status !== 'pending') {
      return res.status(409).json({ ok: false, message: '이미 서명이 처리된 계약입니다.', status: 'signed' });
    }

    // 각자 자기 번호로 확인한다 — 의뢰인은 계약서의 의뢰인 연락처, 대리인은 운영자가 적은 대리인 연락처.
    // 형식이 틀린 입력은 세지 않는다 — 세면 링크를 아는 제3자가 빈 요청으로 서명 링크를 잠근다(연습실과 같다).
    // 링크 계약은 대조할 번호가 없어 이 단계를 건너뛴다 — 링크를 1:1로 받은 사람이 서명자라는 전제(open-link.ts).
    const identity = openLink
      ? ({ ok: true } as const)
      : verifyIdentityDigits(identityDigits, role === 'client' ? contract.clientPhone : (signer.phone ?? ''));
    if (!identity.ok && identity.reason === 'malformed') {
      return res.status(400).json({
        ok: false,
        message: `계약서에 등록된 ${role === 'guardian' ? '법정대리인 ' : ''}연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.`,
      });
    }

    const rateKey = productionSignerRateLimitKey(contract.id, role);
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

    if (!identity.ok) {
      const message =
        identity.reason === 'unverifiable'
          ? '계약서의 연락처가 올바르지 않아 본인 확인을 할 수 없습니다. 운영자에게 문의해 주세요.'
          : `계약서에 등록된 ${role === 'guardian' ? '법정대리인 ' : ''}연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.`;
      return res.status(400).json({ ok: false, message });
    }
    if (identityConfirmed !== true) {
      return res.status(400).json({ ok: false, message: '본인 확인 및 전자서명 방식 동의에 체크해 주세요.' });
    }

    const clauses = parseStoredClauses(contract.clausesJson);
    if (clauses.some((clause) => !agreedKeys.has(clause.key))) {
      return res.status(400).json({ ok: false, message: '모든 필수 동의 항목에 동의해야 서명할 수 있습니다.' });
    }

    const now = new Date();
    const [signerResult] = await getDb().batch(
      buildProductionSignStatements(getDb(), {
        contractId: contract.id,
        signerId: signer.id,
        signToken: token,
        now,
        signatureData,
        ipAddress: getClientIp(req),
        userAgent: String(req.headers['user-agent'] || ''),
        agreedClauseKeys: clauses.map((clause) => clause.key),
        clientDetails,
        openClient,
      }),
    );

    if (signerResult.rowsAffected === 0) {
      // 졌다 — 이미 서명됐거나, 그 사이 취소·재발송·만료됐다. 실제 상태를 읽어 맞는 안내를 준다.
      const latest = await getDb()
        .query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, contract.id), columns: { status: true } })
        .catch(() => undefined);
      if (latest && latest.status !== 'signed' && latest.status !== 'sent') {
        return res.status(409).json({
          ok: false,
          message: '계약 상태가 바뀌어 서명을 처리하지 못했습니다. 운영자에게 확인해 주세요.',
          status: latest.status,
        });
      }
      return res.status(409).json({ ok: false, message: '이미 서명이 처리된 계약입니다.', status: 'signed' });
    }

    await resetIdentityAttempts(rateKey);

    // 다른 서명자가 남았으면 여기서 끝난다(완료 화면이 "상대 서명을 기다려요"를 보인다).
    const completed = await finalizeProductionContractIfComplete(contract.id, now);
    if (completed) waitUntil(finalizeSignedProductionContract(contract.id));

    // 계약 레코드를 응답에 싣지 않는다 — 화면은 ok만 보고 완료 페이지로 간다(연습실과 같다).
    return res.status(200).json({ ok: true });
  } catch (error: unknown) {
    console.error('[API/contracts/production/sign] Failed to sign contract:', error);
    return res.status(500).json({ ok: false, message: '서명 처리에 실패했습니다.' });
  }
}
