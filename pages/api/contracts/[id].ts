import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import { db } from '../../../db/client';
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

  const contract = await db.query.contracts
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
        return res.status(200).json({ ok: true, contract: serializeContractForAdmin(updated) });
      }

      if (action === 'cancel') {
        const cancelled = await cancelContract(id);
        return res.status(200).json({ ok: true, contract: serializeContractForAdmin(cancelled) });
      }

      // send | resend — 재발송은 이전 링크를 무효화하기 위해 토큰을 새로 발급한다.
      const { contract: sent, signUrl } = await markContractSent(id, {
        regenerateToken: action === 'resend',
      });

      waitUntil(sendContractNotifications(sent, signUrl));

      return res.status(200).json({ ok: true, contract: serializeContractForAdmin(sent) });
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
      await deleteContract(id);
      return res.status(200).json({ ok: true });
    } catch (error: unknown) {
      console.error('[API/contracts/[id]] Failed to delete contract:', error);
      return res.status(500).json({ ok: false, message: '계약 삭제에 실패했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
