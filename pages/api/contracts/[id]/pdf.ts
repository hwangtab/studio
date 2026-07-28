import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { generateContractPdf } from '../../../../lib/contracts/pdf';
import { resolveRulesContent } from '../../../../lib/contracts/template';

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

  try {
    const contract = await getDb().query.contracts.findFirst({
      where: (contractsTable, { eq }) => eq(contractsTable.id, id),
      with: { signatures: true, contractClauses: true, contractAttachments: true },
    });

    if (!contract) {
      return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
    }

    if (contract.status !== 'signed') {
      return res.status(409).json({ ok: false, message: '서명이 완료된 계약만 PDF로 받을 수 있습니다.' });
    }

    const customerSignature =
      contract.signatures.find((s) => s.signerRole === 'customer' && s.status === 'signed') ?? null;

    const pdfBuffer = await generateContractPdf({
      contract,
      signature: customerSignature,
      clauses: contract.contractClauses,
      attachments: contract.contractAttachments,
      rulesContent: resolveRulesContent(contract.contractAttachments),
    });

    // 한글 파일명은 RFC 5987 filename*로 넘긴다. filename만 쓰면 일부 브라우저가 깨뜨린다.
    const filename = `${contract.customerName}_이용계약서.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contract-${contract.id}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.status(200).send(pdfBuffer);
  } catch (error: unknown) {
    console.error('[API/contracts/[id]/pdf] Failed to generate PDF:', error);
    return res.status(500).json({ ok: false, message: 'PDF 생성에 실패했습니다.' });
  }
}
