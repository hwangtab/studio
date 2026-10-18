import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import {
  getDownloadIdentityVerdict,
  reserveDownloadIdentityAttempt,
  resetDownloadIdentityAttempts,
} from '../../../../../lib/contracts/admin-rate-limit';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { IDENTITY_DIGITS, verifyIdentityDigits } from '../../../../../lib/contracts/identity';
import { productionRateLimitKey } from '../../../../../lib/contracts/production/links';
import { grantPortalAccess, hasPortalAccess } from '../../../../../lib/contracts/production/portal-session';
import { loadProgressContext, recordProgressEvent, sendEventNotice } from '../../../../../lib/contracts/production/progress';
import {
  encryptRefundAccountNumber,
  loadRefundAccountSummary,
  safeDbErrorSummary,
  saveRefundAccount,
  validateRefundAccount,
} from '../../../../../lib/payments/refundAccount';

const LOCKED = '본인 확인에 너무 여러 번 실패했어요. 잠시 후 다시 시도하거나 010-4255-7893으로 연락해 주세요.';
const THROTTLED = '본인 확인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.';

/**
 * 의뢰인 진행 페이지의 행위.
 *
 * - unlock: 연락처 뒷자리를 확인하고 진행 페이지 쿠키를 준다(portal-session.ts). 시도 제한은 계약서 받기와 같은
 *   장치를 쓰되 키를 나눈다 — 한쪽 잠금이 다른 쪽을 막지 않게.
 * - approve / revision: 쿠키가 있어야 한다. **어느 전달에 대한 답인지(deliveryEventId)를 함께 받는다** — 화면을 연
 *   뒤 스튜디오가 새 결과물을 보냈다면, 옛 화면의 버튼이 새 결과물을 승인하면 안 된다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const { id } = req.query;
  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
  const token = body.token;
  if (typeof id !== 'string' || typeof token !== 'string' || token === '') {
    return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });
  }

  try {
    const context = await loadProgressContext(id);
    const client = context?.contract.signers.find((s) => s.role === 'client' && s.signToken === token);
    if (!context || !client) return res.status(404).json({ ok: false, message: '계약을 찾을 수 없어요.' });
    if (context.contract.purgedAt) return res.status(409).json({ ok: false, message: '보관 기간이 지나 파기된 계약이에요.' });
    // 진행 페이지는 의뢰인 링크로만 연다(승인·수정 요청·환불 계좌는 의뢰인의 행위다).

    if (body.action === 'unlock') {
      const rateKey = `progress:${productionRateLimitKey(id)}`;
      const verdict = await getDownloadIdentityVerdict(rateKey);
      if (verdict !== 'ok') return res.status(429).json({ ok: false, message: verdict === 'locked' ? LOCKED : THROTTLED });

      const identity = verifyIdentityDigits(body.identityDigits, context.contract.clientPhone);
      if (identity.ok || identity.reason === 'mismatch') {
        const reserved = await reserveDownloadIdentityAttempt(rateKey);
        if (reserved !== 'ok') return res.status(429).json({ ok: false, message: reserved === 'locked' ? LOCKED : THROTTLED });
      }
      if (!identity.ok) {
        return res.status(400).json({ ok: false, message: `계약서에 등록된 연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.` });
      }
      await resetDownloadIdentityAttempts(rateKey);
      if (!grantPortalAccess(res, id, token)) {
        console.error('[API/contracts/production/progress] ADMIN_SESSION_SECRET missing — portal cannot be opened');
        return res.status(503).json({ ok: false, message: '지금은 진행 페이지를 열 수 없어요. 010-4255-7893으로 연락해 주세요.' });
      }
      return res.status(200).json({ ok: true });
    }

    if (body.action !== 'approve' && body.action !== 'revision' && body.action !== 'refund-account') {
      return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });
    }
    if (!hasPortalAccess(req, id, token)) {
      return res.status(401).json({ ok: false, message: '본인 확인이 필요해요. 페이지를 새로고침해 주세요.' });
    }

    /**
     * 해지된 계약의 환불 계좌(제10조 3·4항 정산). 결제 공용 refund_accounts에 (production, 계약 id)로 넣는다 —
     * 계좌번호는 암호화하고(lib/crypto/CLAUDE.md), 로그·응답에 싣지 않는다. 돌려받을 금액이 있을 때만 받는다.
     */
    if (body.action === 'refund-account') {
      if (context.contract.status !== 'terminated' || context.ledger.refund.refundable <= 0) {
        return res.status(409).json({ ok: false, message: '돌려받을 금액이 있는 해지 계약에서만 환불 계좌를 받아요.' });
      }
      const account = validateRefundAccount(body);
      if (!account.ok) return res.status(400).json({ ok: false, message: account.message });
      // 한 번 받은 계좌는 여기서 바꾸지 않는다. 다시 쓰면 공용 저장이 송금 완료 표시(refunded_at)를 지워 운영자
      // 화면에 송금 버튼이 되살아나고, 운영자가 계좌를 연 사이 바뀌면 다른 계좌에 송금 완료가 찍힌다.
      const existing = await loadRefundAccountSummary({ kind: 'production', orderNo: id });
      if (existing.status === 'unavailable') {
        return res.status(503).json({ ok: false, message: '지금은 계좌를 받을 수 없어요. 010-4255-7893으로 연락해 주세요.' });
      }
      if (existing.status === 'present') {
        return res.status(409).json({ ok: false, message: '환불 계좌를 이미 받았어요. 바꾸려면 010-4255-7893으로 연락해 주세요.' });
      }
      let accountNumberEnc: string;
      try {
        accountNumberEnc = encryptRefundAccountNumber(account.value.accountNumber);
      } catch {
        console.error('[API/contracts/production/progress] Refund account encryption unavailable');
        return res.status(503).json({ ok: false, message: '지금은 계좌를 받을 수 없어요. 010-4255-7893으로 연락해 주세요.' });
      }
      try {
        await saveRefundAccount(
          { kind: 'production', orderNo: id },
          { bankName: account.value.bankName, accountNumberEnc, accountHolder: account.value.accountHolder, requestedAt: new Date() },
        );
      } catch (error: unknown) {
        console.error('[API/contracts/production/progress] Refund account save failed', safeDbErrorSummary(error));
        return res.status(500).json({ ok: false, message: '계좌를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
      }
      return res.status(200).json({ ok: true });
    }

    // 답하는 결과물(전달 기록)로 (단계, 곡)을 찾는다 — 그 전달이 지금도 답을 기다리는 것이어야 한다. 화면을 연 뒤
    // 새 결과물이 나갔다면 옛 전달은 더 이상 대기가 아니라 여기서 걸린다.
    const state = context.ledger.stages.find(
      (s) => s.pending !== null && s.pending.deliveryEventId === body.deliveryEventId,
    );
    if (!state?.pending || (typeof body.stage === 'string' && body.stage !== state.stage)) {
      return res.status(409).json({ ok: false, message: '그 사이 진행 상황이 바뀌었어요. 페이지를 새로고침해 주세요.' });
    }

    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (body.action === 'revision') {
      if (note === '') return res.status(400).json({ ok: false, message: '수정할 내용을 적어 주세요.' });
      if (note.length > 1000) return res.status(400).json({ ok: false, message: '수정 내용은 1,000자 이내로 적어 주세요.' });
      // 무료 횟수를 넘는 요청은 요금을 알고 보냈다는 확인을 받는다(제5조 3항) — 나중에 "몰랐다"가 되지 않게.
      if (state.freeRemaining === 0 && body.acceptFee !== true) {
        return res.status(400).json({ ok: false, message: '무료 수정 횟수를 넘었어요. 추가 요금에 동의해 주세요.' });
      }
    }

    const recorded = await recordProgressEvent(
      id,
      {
        type: body.action === 'approve' ? 'stage_approved' : 'revision_requested',
        stage: state.stage,
        song: state.song,
        amount: null,
        occurredAt: new Date(),
        data:
          body.action === 'approve'
            ? { mode: 'explicit', deliveryEventId: state.pending.deliveryEventId, ...(note ? { note } : {}) }
            : { note, deliveryEventId: state.pending.deliveryEventId },
        voidsEventId: null,
      },
      { actor: 'client', ip: getClientIp(req) },
    );
    if (!recorded.ok) return res.status(recorded.status).json({ ok: false, message: recorded.message });

    waitUntil(sendEventNotice(id, recorded.event.id));
    return res.status(200).json({ ok: true });
  } catch (error: unknown) {
    console.error('[API/contracts/production/progress] Failed:', error);
    return res.status(500).json({ ok: false, message: '처리하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
}
