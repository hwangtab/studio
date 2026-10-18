import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { serializeProductionContractForAdmin } from '../../../../lib/contracts/production/serialize';
import {
  createProductionContract,
  expireOverdueProductionContracts,
} from '../../../../lib/contracts/production/service';
import { validateProductionContractPayload } from '../../../../lib/contracts/production/validation';

const LIST_LIMIT = 200;

/** 제작 계약 목록·생성(관리자). 연습실 pages/api/contracts/index.ts와 같은 형태. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      await expireOverdueProductionContracts();
      const contracts = await getDb().query.productionContracts.findMany({
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit: LIST_LIMIT,
        with: { signers: true },
      });
      return res
        .status(200)
        .json({ ok: true, contracts: contracts.map((contract) => serializeProductionContractForAdmin(contract)) });
    } catch (error: unknown) {
      console.error('[API/contracts/production] Failed to list contracts:', error);
      return res.status(500).json({ ok: false, message: '계약 목록을 불러오지 못했습니다.' });
    }
  }

  if (req.method === 'POST') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }

    const validation = validateProductionContractPayload(req.body as Record<string, unknown>);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, errors: validation.errors });
    }

    try {
      const contract = await createProductionContract(validation.data);
      return res.status(201).json({ ok: true, contract: { id: contract.id } });
    } catch (error: unknown) {
      console.error('[API/contracts/production] Failed to create contract:', error);
      return res.status(500).json({ ok: false, message: '계약 생성에 실패했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
