import { get, put } from '@vercel/blob';

import type { Contract, ContractAttachment, ContractClause, Signature } from '../../db/schema';
import { generateContractPdf } from './pdf';
import { resolveRulesContent } from './template';

export const uploadContractPdf = async (
  contractId: string,
  pdfBuffer: Buffer,
): Promise<string> => {
  const filename = `contracts/${contractId}.pdf`;

  const blob = await put(filename, pdfBuffer, {
    access: 'private',
    contentType: 'application/pdf',
    // 서명 당시 보관본을 덮어쓰지 않는 것은 호출부(finalize)가 지킨다 — pdfUrl이 이미 있으면 올리지
    // 않는다. 그래도 덮어쓰기는 허용해 둔다: 업로드는 됐는데 pdfUrl 기록이 실패한 계약은 blob만 같은
    // 경로에 남아 있어, 기본값(false)이면 "이미 존재"로 던지고 영영 pdfUrl이 채워지지 않는다.
    allowOverwrite: true,
  });

  return blob.url;
};

/**
 * 보관된 PDF를 읽는다. 읽지 못하면(파일이 지워졌거나 일시 장애) null — 호출부가 대신 그린다.
 */
export const readStoredContractPdf = async (pdfUrl: string): Promise<Buffer | null> => {
  try {
    const stored = await get(pdfUrl, { access: 'private' });
    if (stored?.stream) {
      const buffer = Buffer.from(await new Response(stored.stream).arrayBuffer());
      if (buffer.length > 0) return buffer;
    }
  } catch (error: unknown) {
    console.error('[contracts/pdf-storage] Stored PDF unavailable:', error);
  }
  return null;
};

export type ContractWithRelations = Contract & {
  signatures: Signature[];
  contractClauses: ContractClause[];
  contractAttachments: ContractAttachment[];
};

/**
 * 보관된 PDF를 먼저 찾고, 없을 때만 새로 만든다.
 *
 * 서명 당시 발급한 문서를 그대로 주는 것이 원칙이다. 보관본을 읽지 못하면(파일이 지워졌거나
 * 저장에 실패했던 경우) 계약 내용으로 다시 만든다 — 계약 내용은 서명 후 바뀌지 않으므로
 * 같은 문서가 나온다.
 *
 * 고객용·관리자용 두 라우트가 이 함수를 함께 쓴다. 인증 방식은 서로 다르지만(토큰 대 세션)
 * "어떤 문서를 주는가"는 같아야 한다. 한쪽만 보관본을 무시하면 같은 계약에서 두 사람이
 * 서로 다른 시점에 만들어진 PDF를 들고 있게 되고, 매 요청마다 Chromium을 새로 띄우는
 * 비용도 든다.
 */
export const loadOrRenderContractPdf = async (
  contract: ContractWithRelations,
): Promise<Buffer> => {
  if (contract.pdfUrl) {
    const stored = await readStoredContractPdf(contract.pdfUrl);
    if (stored) return stored;
  }

  const customerSignature =
    contract.signatures.find((s) => s.signerRole === 'customer' && s.status === 'signed') ?? null;

  return generateContractPdf({
    contract,
    signature: customerSignature,
    clauses: contract.contractClauses,
    attachments: contract.contractAttachments,
    rulesContent: resolveRulesContent(contract.contractAttachments),
  });
};
