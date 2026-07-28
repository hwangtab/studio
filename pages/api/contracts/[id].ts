import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import { getDb } from '../../../db/client';
import { authenticateAdminApi } from '../../../lib/contracts/admin-auth';
import {
  serializeAttachment,
  serializeClause,
  serializeContractForAdmin,
  serializeSignature,
} from '../../../lib/contracts/serialize';
import {
  cancelContract,
  deleteContract,
  markContractSent,
  sendContractNotifications,
  updateDraftContract,
} from '../../../lib/contracts/service';
import { checkAction, getEffectiveStatus, type ContractAction } from '../../../lib/contracts/status';
import { validateCreateContractPayload } from '../../../lib/contracts/validation';

const MUTABLE_ACTIONS = ['send', 'resend', 'cancel', 'update'] as const;
type MutableAction = (typeof MUTABLE_ACTIONS)[number];

const isMutableAction = (value: unknown): value is MutableAction =>
  typeof value === 'string' && (MUTABLE_ACTIONS as readonly string[]).includes(value);

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

  const contract = await getDb().query.contracts
    .findFirst({
      where: (contractsTable, { eq }) => eq(contractsTable.id, id),
      with: { signatures: true, contractClauses: true, contractAttachments: true },
    })
    .catch((error: unknown) => {
      console.error('[API/contracts/[id]] Query failed:', error);
      return null;
    });

  if (!contract) {
    return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
  }

  // 만료 기한이 지났다면 DB 반영 여부와 무관하게 만료된 것으로 취급한다.
  const effectiveStatus = getEffectiveStatus(contract);

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      contract: serializeContractForAdmin(contract),
      signatures: contract.signatures.map(serializeSignature),
      clauses: contract.contractClauses.map(serializeClause),
      attachments: contract.contractAttachments.map(serializeAttachment),
    });
  }

  if (req.method === 'PATCH') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }

    const { action } = req.body as Record<string, unknown>;
    if (!isMutableAction(action)) {
      return res.status(400).json({
        ok: false,
        message: `action은 ${MUTABLE_ACTIONS.join(', ')} 중 하나여야 합니다.`,
      });
    }

    const allowed = checkAction(effectiveStatus, action as ContractAction);
    if (!allowed.ok) {
      return res.status(409).json({ ok: false, message: allowed.message });
    }

    try {
      if (action === 'update') {
        const validation = validateCreateContractPayload(req.body as Record<string, unknown>);
        if (!validation.ok) {
          return res.status(400).json({ ok: false, errors: validation.errors });
        }

        const updated = await updateDraftContract(id, validation.data);
        if (!updated) {
          // 읽은 뒤 상태가 바뀌었다(동시 발송·서명 등). 확정된 문서를 고치지 않는다.
          return res.status(409).json({
            ok: false,
            message: '계약 상태가 바뀌어 수정할 수 없습니다. 새로고침 후 확인해 주세요.',
          });
        }
        return res.status(200).json({ ok: true, contract: serializeContractForAdmin(updated) });
      }

      if (action === 'cancel') {
        const cancelled = await cancelContract(id);
        if (!cancelled) {
          return res.status(409).json({
            ok: false,
            message: '계약 상태가 바뀌어 취소할 수 없습니다. 새로고침 후 확인해 주세요.',
          });
        }
        return res.status(200).json({ ok: true, contract: serializeContractForAdmin(cancelled) });
      }

      // send | resend — 허용 상태를 조건에 걸어 동시 요청이 두 번 발송되지 않게 한다.
      const result = await markContractSent(id, {
        allowedStatuses: action === 'send' ? ['draft'] : ['sent', 'expired', 'cancelled'],
      });

      if (!result) {
        // 상태가 이미 바뀌었거나, 방금 발송해 쿨다운 중이다. 둘 다 "다시 누르지 마세요"라
        // 같은 안내로 충분하다.
        return res.status(409).json({
          ok: false,
          message: '방금 처리된 요청입니다. 잠시 후 상태를 확인해 주세요.',
        });
      }

      waitUntil(sendContractNotifications(result.contract, result.signUrl));

      return res.status(200).json({ ok: true, contract: serializeContractForAdmin(result.contract) });
    } catch (error: unknown) {
      console.error(`[API/contracts/[id]] Action "${action}" failed:`, error);
      return res.status(500).json({ ok: false, message: '요청을 처리하지 못했습니다.' });
    }
  }

  if (req.method === 'DELETE') {
    const allowed = checkAction(effectiveStatus, 'delete');
    if (!allowed.ok) {
      return res.status(409).json({ ok: false, message: allowed.message });
    }

    try {
      const removed = await deleteContract(id);
      if (!removed) {
        // 읽은 뒤 상태가 바뀌었다. 서명이 끝난 계약은 지우지 않는다 — 서명·동의 이력이
        // 유일한 증거다.
        return res.status(409).json({
          ok: false,
          message: '계약 상태가 바뀌어 삭제할 수 없습니다. 새로고침 후 확인해 주세요.',
        });
      }
      return res.status(200).json({ ok: true });
    } catch (error: unknown) {
      console.error('[API/contracts/[id]] Failed to delete contract:', error);
      return res.status(500).json({ ok: false, message: '계약 삭제에 실패했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
