import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { contracts, type Signature } from '../../db/schema';
import { sendContractSignedEmail, sendOperatorContractNotification } from './email';
import { generateContractPdf } from './pdf';
import { uploadContractPdf } from './pdf-storage';
import { buildRulesContent } from './template';

/**
 * 서명 직후의 후처리 — PDF 생성·보관과 확인 메일 발송.
 *
 * 서명 응답을 먼저 돌려준 뒤 실행되므로(waitUntil) 여기서 던진 오류는 사용자에게 보이지
 * 않는다. 따라서 각 단계를 독립적으로 감싸, PDF가 실패해도 확인 메일은 나가도록 한다.
 * PDF는 관리자 화면에서 언제든 재생성할 수 있어 유실이 치명적이지 않다.
 */
export const finalizeSignedContract = async (contractId: string): Promise<void> => {
  const contract = await db.query.contracts.findFirst({
    where: (contractsTable, { eq: equals }) => equals(contractsTable.id, contractId),
    with: { signatures: true, contractClauses: true, contractAttachments: true },
  });

  if (!contract) {
    console.error('[contracts/finalize] Contract not found:', contractId);
    return;
  }

  const customerSignature =
    contract.signatures.find(
      (signature: Signature) => signature.signerRole === 'customer' && signature.status === 'signed',
    ) ?? null;

  let pdfBuffer: Buffer | undefined;

  try {
    pdfBuffer = await generateContractPdf({
      contract,
      signature: customerSignature,
      clauses: contract.contractClauses,
      attachments: contract.contractAttachments,
      rulesContent: buildRulesContent(),
    });

    const pdfUrl = await uploadContractPdf(contract.id, pdfBuffer);

    await db
      .update(contracts)
      .set({ pdfUrl, pdfGeneratedAt: new Date(), updatedAt: new Date() })
      .where(eq(contracts.id, contract.id));
  } catch (error: unknown) {
    console.error('[contracts/finalize] Failed to generate or store PDF:', error);
  }

  try {
    const [customerResult, operatorResult] = await Promise.all([
      sendContractSignedEmail(contract, pdfBuffer),
      sendOperatorContractNotification(contract, true),
    ]);

    if (!customerResult.ok) {
      console.error('[contracts/finalize] Signed email failed:', customerResult);
    }
    if (!operatorResult.ok) {
      console.error('[contracts/finalize] Operator notification failed:', operatorResult);
    }
  } catch (error: unknown) {
    console.error('[contracts/finalize] Failed to send signed emails:', error);
  }
};
