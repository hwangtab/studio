/**
 * 이용자가 자기 계약서를 다시 받는 경로.
 *
 * 관리자용 PDF 라우트와 나눈 이유는 인증 방식이 다르기 때문이다. 관리자는 세션으로,
 * 이용자는 서명 링크에 실린 토큰으로 자신을 증명한다. 한 라우트에서 두 방식을 받으면
 * 어느 쪽 검사가 빠졌는지 알기 어려워진다.
 *
 * 보관된 PDF가 있으면 그것을 그대로 내려 준다 — 서명 당시 발급한 문서와 같아야 하고,
 * Chromium을 다시 띄우는 비용도 들지 않는다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { checkDownloadRateLimit } from '../../../../lib/contracts/admin-rate-limit';
import { loadOrRenderContractPdf } from '../../../../lib/contracts/pdf-storage';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const { id, token } = req.query;

  if (typeof id !== 'string' || typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  }

  try {
    // 계약 ID와 토큰이 함께 맞아야 한다 — ID만으로는 남의 계약서를 받을 수 없다.
    const contract = await getDb().query.contracts.findFirst({
      where: (contractsTable, { eq, and }) =>
        and(eq(contractsTable.id, id), eq(contractsTable.signToken, token)),
      with: { signatures: true, contractClauses: true, contractAttachments: true },
    });

    if (!contract) {
      return res.status(404).json({ ok: false, message: '계약서를 찾을 수 없습니다.' });
    }

    if (contract.status !== 'signed') {
      return res.status(409).json({
        ok: false,
        message: '서명이 완료된 뒤에 계약서를 받으실 수 있습니다.',
      });
    }

    if (contract.purgedAt) {
      return res.status(409).json({
        ok: false,
        message: '보관 기간이 지나 개인정보가 파기된 계약입니다. 계약서를 다시 발급할 수 없습니다.',
      });
    }

    // PDF 생성은 Chromium을 띄우는 무거운 작업이라, 토큰을 아는 쪽이 반복 요청하면 부담이 된다.
    const allowed = await checkDownloadRateLimit(contract.id);
    if (!allowed) {
      return res.status(429).json({
        ok: false,
        message: '잠시 후 다시 시도해 주세요.',
      });
    }

    const pdf = await loadOrRenderContractPdf(contract);

    const filename = `${contract.customerName}_음악연습실_이용계약서.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contract-${contract.id}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.status(200).send(pdf);
  } catch (error: unknown) {
    console.error('[API/contracts/[id]/download] Failed:', error);
    return res.status(500).json({ ok: false, message: '계약서를 준비하지 못했습니다.' });
  }
}

