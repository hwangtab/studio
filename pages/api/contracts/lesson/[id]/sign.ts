import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import { getDb } from '../../../../../db/client';
import { checkIdentityAttempt, resetIdentityAttempts } from '../../../../../lib/contracts/admin-rate-limit';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { IDENTITY_DIGITS, verifyIdentityDigits } from '../../../../../lib/contracts/identity';
import { parseLessonClauses } from '../../../../../lib/contracts/lesson/clauses';
import { lessonRateLimitKey } from '../../../../../lib/contracts/lesson/links';
import { finalizeSignedLessonContract, signLessonContract } from '../../../../../lib/contracts/lesson/service';
import { checkLessonAction, getEffectiveLessonStatus } from '../../../../../lib/contracts/lesson/status';
import { validateSignatureData } from '../../../../../lib/contracts/signature-validation';
import { validateSignerDetails } from '../../../../../lib/contracts/validation';

/** 응답 뒤 후처리(메일)까지 이 함수 시간 안에 끝나야 한다 — 다른 계약 서명 API와 같은 상한. */
export const config = { maxDuration: 60 };

const OPERATOR_PHONE = '010-4255-7893';

/**
 * 수강생 서명. 검사 순서와 원칙은 연습실·제작 계약 서명 API와 같다: 입력 형식 → 계약·토큰 → 상태(만료 포함) → 본인 확인(시도 제한)
 * → 필수 동의(서버에서 다시) → 조건부 쓰기. 서명자가 한 명이라 서명과 성립이 한 문장이다(service.ts signLessonContract).
 * 만 19세 미만은 법정대리인 서명 경로가 없어 받지 않는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }
  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ ok: false, message: '잘못된 계약 ID입니다.' });
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  const body = req.body as Record<string, unknown>;
  const { token, signatureData, agreements, identityDigits, identityConfirmed } = body;
  if (typeof token !== 'string' || token.trim() === '') return res.status(400).json({ ok: false, message: '서명 토큰이 없습니다.' });
  if (typeof signatureData !== 'string' || signatureData.trim() === '') return res.status(400).json({ ok: false, message: '서명이 필요합니다.' });
  const signatureValidation = validateSignatureData(signatureData);
  if (!signatureValidation.ok) return res.status(400).json({ ok: false, message: signatureValidation.message });
  if (!Array.isArray(agreements) || agreements.some((item) => typeof item !== 'string')) return res.status(400).json({ ok: false, message: '동의 항목 형식이 올바르지 않습니다.' });
  const agreedKeys = new Set(agreements as string[]);

  try {
    const contract = await getDb().query.lessonContracts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
    // 계약 id와 토큰이 함께 맞아야 한다. 어느 쪽이 틀렸는지는 알려 주지 않는다.
    if (!contract || !contract.signToken || contract.signToken !== token || contract.purgedAt) {
      return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
    }

    const details = validateSignerDetails({ customerBirthdate: body.studentBirthdate, customerAddress: body.studentAddress }, { allowMinor: false });
    if (!details.ok) {
      const errors = details.errors.map((error) => ({
        field: error.field === 'customerBirthdate' ? 'studentBirthdate' : 'studentAddress',
        message: error.message.includes('19세') ? `만 19세 미만은 이 화면에서 서명할 수 없어요. ${OPERATOR_PHONE}으로 연락해 주세요.` : error.message,
      }));
      return res.status(400).json({ ok: false, message: '입력하신 정보를 확인해 주세요.', errors });
    }

    const effectiveStatus = getEffectiveLessonStatus(contract);
    const allowed = checkLessonAction(effectiveStatus, 'sign');
    if (!allowed.ok) {
      const message = effectiveStatus === 'expired' ? '서명 링크가 만료되었습니다. 스튜디오에 재발송을 요청해 주세요.' : allowed.message;
      return res.status(409).json({ ok: false, message, status: effectiveStatus });
    }
    if (!contract.operatorSignedAt) {
      console.error('[API/contracts/lesson/sign] Operator signature missing:', contract.id);
      return res.status(409).json({ ok: false, message: `계약서 발송 처리가 끝나지 않았습니다. 스튜디오에 재발송을 요청해 주세요. (${OPERATOR_PHONE})` });
    }

    // 형식이 틀린 입력은 세지 않는다 — 세면 링크를 아는 제3자가 빈 요청으로 서명 링크를 잠근다.
    const identity = verifyIdentityDigits(identityDigits, contract.studentPhone);
    if (!identity.ok && identity.reason === 'malformed') {
      return res.status(400).json({ ok: false, message: `계약서에 등록된 연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.` });
    }
    const rateKey = lessonRateLimitKey(contract.id);
    const attempt = await checkIdentityAttempt(rateKey);
    if (attempt === 'locked') return res.status(429).json({ ok: false, message: `본인 확인에 여러 번 실패해 이 서명 링크가 잠겼습니다. 스튜디오에 재발송을 요청해 주세요. (${OPERATOR_PHONE})` });
    if (attempt === 'throttled') return res.status(429).json({ ok: false, message: '본인 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    if (!identity.ok) {
      return res.status(400).json({
        ok: false,
        message: identity.reason === 'unverifiable' ? '계약서의 연락처가 올바르지 않아 본인 확인을 할 수 없습니다. 스튜디오에 문의해 주세요.' : `계약서에 등록된 연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.`,
      });
    }
    if (identityConfirmed !== true) return res.status(400).json({ ok: false, message: '본인 확인 및 전자서명 방식 동의에 체크해 주세요.' });

    const clauses = parseLessonClauses(contract.clausesJson);
    if (clauses.some((clause) => !agreedKeys.has(clause.key))) return res.status(400).json({ ok: false, message: '모든 필수 동의 항목에 동의해야 서명할 수 있습니다.' });

    const now = new Date();
    const result = await signLessonContract({
      contractId: contract.id, token, now, signatureData, ipAddress: getClientIp(req), userAgent: String(req.headers['user-agent'] || ''),
      agreedClauseKeys: clauses.map((clause) => clause.key),
      studentBirthdate: details.data.customerBirthdate, studentAddress: details.data.customerAddress,
    });
    if (result === 'not_found') return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
    if (result === 'conflict') {
      // 졌다 — 이미 서명됐거나, 그 사이 취소·재발송·만료됐다. 실제 상태를 읽어 맞는 안내를 준다.
      const latest = await getDb().query.lessonContracts.findFirst({ where: (t, { eq }) => eq(t.id, contract.id), columns: { status: true } }).catch(() => undefined);
      if (latest && latest.status !== 'signed' && latest.status !== 'sent') {
        return res.status(409).json({ ok: false, message: '계약 상태가 바뀌어 서명을 처리하지 못했습니다. 스튜디오에 확인해 주세요.', status: latest.status });
      }
      return res.status(409).json({ ok: false, message: '이미 서명이 처리된 계약입니다.', status: 'signed' });
    }
    await resetIdentityAttempts(rateKey);
    waitUntil(finalizeSignedLessonContract(contract.id));
    return res.status(200).json({ ok: true });
  } catch (error: unknown) {
    console.error('[API/contracts/lesson/sign] Failed to sign contract:', error);
    return res.status(500).json({ ok: false, message: '서명 처리에 실패했습니다.' });
  }
}
