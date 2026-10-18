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
import { REVISION_STAGES, type RevisionStage } from '../../../../../lib/contracts/production/terms';

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

    if (body.action !== 'approve' && body.action !== 'revision') {
      return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });
    }
    if (!hasPortalAccess(req, id, token)) {
      return res.status(401).json({ ok: false, message: '본인 확인이 필요해요. 페이지를 새로고침해 주세요.' });
    }

    const stage = body.stage;
    if (typeof stage !== 'string' || !(REVISION_STAGES as readonly string[]).includes(stage)) {
      return res.status(400).json({ ok: false, message: '단계를 확인할 수 없어요.' });
    }
    const state = context.ledger.stages[stage as RevisionStage];
    if (!state.pending || state.pending.deliveryEventId !== body.deliveryEventId) {
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
        stage: stage as RevisionStage,
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
