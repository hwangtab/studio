import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { authenticateAdminApi } from '../../../lib/contracts/admin-auth';
import { serializeContractForAdmin } from '../../../lib/contracts/serialize';
import { createContract, expireOverdueContracts, findRoomConflict } from '../../../lib/contracts/service';
import { describeRoomConflict } from '../../../lib/contracts/conflict';
import { validateCreateContractPayload } from '../../../lib/contracts/validation';

const LIST_LIMIT = 200;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      await expireOverdueContracts();

      const allContracts = await getDb().query.contracts.findMany({
        orderBy: (contractsTable, { desc }) => [desc(contractsTable.createdAt)],
        limit: LIST_LIMIT,
      });

      return res.status(200).json({
        ok: true,
        contracts: allContracts.map((contract) => serializeContractForAdmin(contract)),
      });
    } catch (error: unknown) {
      console.error('[API/contracts] Failed to list contracts:', error);
      return res.status(500).json({ ok: false, message: '계약 목록을 불러오지 못했습니다.' });
    }
  }

  if (req.method === 'POST') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }

    const validation = validateCreateContractPayload(req.body as Record<string, unknown>);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, errors: validation.errors });
    }

    try {
      const conflict = await findRoomConflict({
        roomNumber: validation.data.roomNumber,
        startDate: new Date(validation.data.startDate),
        endDate: new Date(validation.data.endDate),
      });

      if (conflict) {
        return res.status(409).json({ ok: false, message: describeRoomConflict(conflict) });
      }

      const contract = await createContract(validation.data);
      return res.status(201).json({ ok: true, contract: serializeContractForAdmin(contract) });
    } catch (error: unknown) {
      console.error('[API/contracts] Failed to create contract:', error);
      return res.status(500).json({ ok: false, message: '계약 생성에 실패했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
