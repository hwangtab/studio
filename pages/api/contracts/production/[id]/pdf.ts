import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { loadOrRenderProductionPdf } from '../../../../../lib/contracts/production/pdf-storage';
import { hasSignedDocument } from '../../../../../lib/contracts/production/status';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../../lib/privacy/accessLog';

/**
 * 관리자 제작 계약서 PDF. 연습실 pdf.ts와 같은 규칙 — 개인정보가 파일로 나가므로 접속기록을 남기고,
 * 보관본을 먼저 주며, 파기된 계약은 발급하지 않는다.
 */
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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

  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, auth.actor, 'production_contract_pdf_download', id, result).catch(
      (error: unknown) => console.error('[privacy] 접속기록 호출 실패 — 다운로드는 계속됩니다', error),
    );

  try {
    const contract = await getDb().query.productionContracts.findFirst({
      where: (t, { eq }) => eq(t.id, id),
      with: { signers: true },
    });

    if (!contract) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
    }
    if (!hasSignedDocument(contract.status)) {
      return res.status(409).json({ ok: false, message: '체결된 계약만 PDF로 받을 수 있습니다.' });
    }
    if (contract.purgedAt) {
      return res.status(409).json({
        ok: false,
        message: '보관 기간이 지나 개인정보가 파기된 계약입니다. 계약서를 다시 발급할 수 없습니다.',
      });
    }

    const pdf = await loadOrRenderProductionPdf(contract);
    const filename = `${contract.clientName}_음원제작용역계약서.pdf`;

    await log('success');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="production-contract-${contract.id}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.status(200).send(pdf);
  } catch (error: unknown) {
    await log('error');
    console.error('[API/contracts/production/[id]/pdf] Failed to generate PDF:', error);
    return res.status(500).json({ ok: false, message: 'PDF 생성에 실패했습니다.' });
  }
}
