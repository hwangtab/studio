import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { loadOrRenderContractPdf } from '../../../../lib/contracts/pdf-storage';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../lib/privacy/accessLog';

/**
 * 성명·생년월일·주소·서명 이미지가 한 파일로 나가는 경로라, 내려받은 사실을
 * 접속기록에 남긴다(`privacy_access_logs`). CSV는 아니지만 개인정보가 파일로 빠져나가는
 * 같은 동작이다. 담는 것은 계약 id뿐 — 이름도 본문도 적지 않는다.
 *
 * 이용자가 자기 계약서를 받는 경로(`download.ts`)는 남기지 않는다. 접속기록은
 * 개인정보취급자의 접속을 남기는 것이고, 정보주체 본인의 열람은 그 대상이 아니다.
 */

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

  /** 기록 경로의 예외가 다운로드를 끊지 않게 한 겹 더 받는다(payout-account.ts와 같은 이유). */
  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, 'contract_pdf_download', id, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 다운로드는 계속됩니다', error);
    });

  try {
    const contract = await getDb().query.contracts.findFirst({
      where: (contractsTable, { eq }) => eq(contractsTable.id, id),
      with: { signatures: true, contractClauses: true, contractAttachments: true },
    });

    if (!contract) {
      await log('not_found');
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

    // 보관본이 있으면 그것을 그대로 준다. 고객이 받은 문서와 같아야 하고, 요청마다
    // Chromium을 새로 띄우면 느린 데다 비용도 든다.
    const pdfBuffer = await loadOrRenderContractPdf(contract);

    // 한글 파일명은 RFC 5987 filename*로 넘긴다. filename만 쓰면 일부 브라우저가 깨뜨린다.
    const filename = `${contract.customerName}_이용계약서.pdf`;

    await log('success');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contract-${contract.id}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.status(200).send(pdfBuffer);
  } catch (error: unknown) {
    await log('error');
    console.error('[API/contracts/[id]/pdf] Failed to generate PDF:', error);
    return res.status(500).json({ ok: false, message: 'PDF 생성에 실패했습니다.' });
  }
}
