import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import { getDb } from '../../../../db/client';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { getClientIp } from '../../../../lib/contracts/client-ip';
import { serializeProductionContractForAdmin } from '../../../../lib/contracts/production/serialize';
import {
  cancelProductionContract,
  closeProductionContract,
  deleteProductionContract,
  sendProductionContract,
  sendProductionSignRequestNotifications,
  updateDraftProductionContract,
} from '../../../../lib/contracts/production/service';
import {
  checkProductionAction,
  getEffectiveProductionStatus,
  type ProductionContractAction,
} from '../../../../lib/contracts/production/status';
import { validateProductionContractPayload } from '../../../../lib/contracts/production/validation';
import { recordAdminPrivacyAccess } from '../../../../lib/privacy/accessLog';

const MUTABLE_ACTIONS = ['update', 'send', 'resend', 'resend-signed', 'cancel', 'complete', 'terminate'] as const;
type MutableAction = (typeof MUTABLE_ACTIONS)[number];

const isMutableAction = (value: unknown): value is MutableAction =>
  typeof value === 'string' && (MUTABLE_ACTIONS as readonly string[]).includes(value);

/** 끝난 날은 KST 달력 날짜로 받는다(YYYY-MM-DD). 비우면 지금. 보관 기간의 기산점이라 실제 날짜를 넣게 한다. */
const parseClosedAt = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === '') return new Date();
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) return null;
  return date;
};

/** 제작 계약 상세·조작(관리자). 연습실 pages/api/contracts/[id].ts와 같은 형태와 원칙. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ ok: false, message: '잘못된 계약 ID입니다.' });
  }

  // 조회 실패와 "없음"을 나눈다 — 장애를 "찾을 수 없다"로 보이면 계약이 사라진 줄 안다(연습실 주석).
  let contract;
  try {
    contract = await getDb().query.productionContracts.findFirst({
      where: (t, { eq }) => eq(t.id, id),
      with: { signers: true },
    });
  } catch (error: unknown) {
    console.error('[API/contracts/production/[id]] Query failed:', error);
    return res.status(500).json({ ok: false, message: '계약을 불러오지 못했습니다.' });
  }

  if (req.method === 'GET') {
    await recordAdminPrivacyAccess(req, auth.actor, 'production_contract_view', id, contract ? 'success' : 'not_found').catch(
      (error: unknown) => console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error),
    );
  }

  if (!contract) {
    return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
  }

  const effectiveStatus = getEffectiveProductionStatus(contract);

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, contract: serializeProductionContractForAdmin(contract) });
  }

  if (req.method === 'PATCH') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }
    const body = req.body as Record<string, unknown>;
    const { action } = body;
    if (!isMutableAction(action)) {
      return res.status(400).json({ ok: false, message: `action은 ${MUTABLE_ACTIONS.join(', ')} 중 하나여야 합니다.` });
    }

    const allowed = checkProductionAction(effectiveStatus, action as ProductionContractAction);
    if (!allowed.ok) {
      return res.status(409).json({ ok: false, message: allowed.message });
    }

    const stale = () =>
      res.status(409).json({ ok: false, message: '계약 상태가 바뀌어 처리할 수 없습니다. 새로고침 후 확인해 주세요.' });

    try {
      if (action === 'update') {
        const validation = validateProductionContractPayload(body);
        if (!validation.ok) return res.status(400).json({ ok: false, errors: validation.errors });
        const updated = await updateDraftProductionContract(id, validation.data);
        return updated ? res.status(200).json({ ok: true }) : stale();
      }

      if (action === 'send' || action === 'resend') {
        // 발송 = 운영자 서명. 누가 어디서 눌렀는지가 서명 기록이 된다.
        const result = await sendProductionContract(id, {
          allowedStatuses: action === 'send' ? ['draft'] : ['sent', 'expired'],
          adminActor: auth.actor,
          ipAddress: getClientIp(req),
          userAgent: String(req.headers['user-agent'] || ''),
        });
        if (!result) {
          return res.status(409).json({ ok: false, message: '방금 처리된 요청입니다. 잠시 후 상태를 확인해 주세요.' });
        }
        waitUntil(sendProductionSignRequestNotifications(result.contract, result.signUrl));
        return res.status(200).json({ ok: true });
      }

      if (action === 'resend-signed') {
        // 상태·토큰은 그대로 두고 PDF·체결 메일만 다시 만든다(연습실과 같다). finalize는 Chromium 체인을
        // 끌어오므로 쓸 때만 불러온다.
        const { finalizeSignedProductionContract } = await import('../../../../lib/contracts/production/finalize');
        waitUntil(finalizeSignedProductionContract(id));
        return res.status(200).json({
          ok: true,
          message: '체결 메일을 다시 보내는 중입니다. 잠시 후 새로고침해 결과를 확인해 주세요.',
        });
      }

      if (action === 'cancel') {
        return (await cancelProductionContract(id)) ? res.status(200).json({ ok: true }) : stale();
      }

      // complete | terminate
      const at = parseClosedAt(body.closedOn);
      if (!at) {
        return res.status(400).json({ ok: false, message: '끝난 날은 오늘이나 그 이전 날짜(YYYY-MM-DD)로 입력해 주세요.' });
      }

      if (action === 'complete') {
        return (await closeProductionContract(id, { kind: 'completed', at })) ? res.status(200).json({ ok: true }) : stale();
      }

      const { reason } = body;
      if (typeof reason !== 'string' || reason.trim() === '') {
        return res.status(400).json({ ok: false, message: '해지 사유를 입력해 주세요.' });
      }
      if (reason.length > 500) {
        return res.status(400).json({ ok: false, message: '해지 사유가 너무 깁니다.' });
      }
      return (await closeProductionContract(id, { kind: 'terminated', at, reason: reason.trim() }))
        ? res.status(200).json({ ok: true })
        : stale();
    } catch (error: unknown) {
      console.error(`[API/contracts/production/[id]] Action "${action}" failed:`, error);
      return res.status(500).json({ ok: false, message: '요청을 처리하지 못했습니다.' });
    }
  }

  if (req.method === 'DELETE') {
    const allowed = checkProductionAction(effectiveStatus, 'delete');
    if (!allowed.ok) return res.status(409).json({ ok: false, message: allowed.message });
    try {
      return (await deleteProductionContract(id))
        ? res.status(200).json({ ok: true })
        : res.status(409).json({ ok: false, message: '계약 상태가 바뀌어 삭제할 수 없습니다. 새로고침 후 확인해 주세요.' });
    } catch (error: unknown) {
      console.error('[API/contracts/production/[id]] Failed to delete contract:', error);
      return res.status(500).json({ ok: false, message: '계약 삭제에 실패했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
