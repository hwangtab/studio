import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { generateContractPdf } from '../../../../lib/contracts/pdf';
import { resolveRulesContent } from '../../../../lib/contracts/template';

/**
 * PDF 생성은 Chromium을 띄운다. 콜드 스타트에서는 64MB짜리 바이너리를 풀어 쓰므로
 * 통상 실행보다 훨씬 오래 걸린다. 기본값에 기대지 않고 상한을 명시한다.
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

    // 파기된 계약도 상태는 signed로 남는다. 그대로 만들면 이름·본문·서명이 모두 빠진
    // 껍데기 계약서가 발급되므로 막는다.
    if (contract.purgedAt) {
      return res.status(409).json({
        ok: false,
        message: '보관 기간이 지나 개인정보가 파기된 계약입니다. 계약서를 다시 발급할 수 없습니다.',
      });
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
