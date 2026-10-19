import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { EVENT_SPEC } from '../../../../../lib/contracts/production/event-spec';
import { parseAdminEventInput, parseVoidInput } from '../../../../../lib/contracts/production/events';
import { loadProgressContext, recordProgressEvent, sendEventNotice } from '../../../../../lib/contracts/production/progress';
import { REVISION_STAGES } from '../../../../../lib/contracts/production/terms';
import { loadRefundAccountSummary } from '../../../../../lib/payments/refundAccount';

const REVISION_STAGE_SET: ReadonlySet<string> = new Set(REVISION_STAGES);

/**
 * 관리자 진행 기록(제작 계약 상세 화면).
 *
 * - action=record: 기록 추가. 통지 대상이면 응답 뒤 의뢰인 메일(waitUntil).
 * - action=void: 앞 기록 무효(사유 필수). 기록은 지우지 않는다.
 * - action=resend-notice: 실패한 통지를 다시 보낸다. 결과물 전달은 이 통지가 나가야 간주 승인이 성립한다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ ok: false, message: '잘못된 계약 ID입니다.' });
  }
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  }

  const body = req.body as Record<string, unknown>;
  const actor = { actor: `admin:${auth.actor}`, ip: getClientIp(req) };

  try {
    if (body.action === 'resend-notice') {
      const context = await loadProgressContext(id);
      const event = context?.events.find((e) => e.id === body.eventId);
      if (!context || !event) return res.status(404).json({ ok: false, message: '기록을 찾을 수 없습니다.' });
      // 진행 중 계약에만 — 해지·완료된 계약의 의뢰인은 진행 페이지에서 답할 수 없는데 기한이 적힌 메일이 나간다.
      if (context.contract.status !== 'signed' || context.contract.purgedAt) {
        return res.status(409).json({ ok: false, message: '진행 중인 계약에만 통지를 다시 보냅니다.' });
      }
      if (!EVENT_SPEC[event.type].notifies) return res.status(409).json({ ok: false, message: '통지하지 않는 기록입니다.' });
      if (event.noticeStatus === 'sent') return res.status(409).json({ ok: false, message: '이미 통지가 나간 기록입니다.' });
      // 무효로 한 기록, 그리고 이미 다음 결과물·답이 나온 전달은 다시 알리지 않는다 — 지금 대기 중인 결과물이 아닌
      // 전달을 알리면 메일의 기한·수정 횟수가 지금 상태와 어긋난다.
      if (!context.ledger.events.some((e) => e.id === event.id)) {
        return res.status(409).json({ ok: false, message: '무효로 한 기록은 통지하지 않습니다.' });
      }
      if (
        event.type === 'stage_delivered' &&
        REVISION_STAGE_SET.has(event.stage ?? '') &&
        !context.ledger.stages.some((s) => s.pending?.deliveryEventId === event.id)
      ) {
        return res.status(409).json({ ok: false, message: '이미 답을 받았거나 새 결과물이 나간 전달입니다.' });
      }
      waitUntil(sendEventNotice(id, event.id));
      return res.status(200).json({ ok: true, message: '통지를 다시 보내는 중입니다. 잠시 후 새로고침해 결과를 확인해 주세요.' });
    }

    const parsed = body.action === 'void' ? parseVoidInput(body) : parseAdminEventInput(body);
    if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });

    // 해지 환불을 이미 보냈으면 정산을 바꾸는 무효 처리를 받지 않는다 — 보낸 금액과 의뢰인 화면의 금액이 갈린다.
    // 환불은 해지한 계약에만 있다 — 진행 중 계약의 무효 처리는 환불 기록과 무관하게 받는다.
    const terminated = body.action === 'void' && (await loadProgressContext(id))?.contract.status === 'terminated';
    if (terminated) {
      const refund = await loadRefundAccountSummary({ kind: 'production', orderNo: id });
      if (refund.status === 'unavailable') {
        return res.status(503).json({ ok: false, message: '환불 기록을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      }
      if (refund.status === 'present' && refund.refundedAt) {
        return res.status(409).json({ ok: false, message: '환불을 이미 보낸 계약입니다. 정산을 바꾸려면 의뢰인과 먼저 협의해 주세요.' });
      }
    }

    const recorded = await recordProgressEvent(id, parsed.input, actor);
    if (!recorded.ok) return res.status(recorded.status).json({ ok: false, message: recorded.message });

    if (EVENT_SPEC[recorded.event.type].notifies) waitUntil(sendEventNotice(id, recorded.event.id));
    return res.status(200).json({ ok: true });
  } catch (error: unknown) {
    console.error('[API/contracts/production/[id]/events] Failed:', error);
    return res.status(500).json({ ok: false, message: '기록하지 못했습니다.' });
  }
}
