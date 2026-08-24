import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { contracts, type Signature } from '../../db/schema';
import { sendContractSignedEmail, sendOperatorContractNotification } from './email';
import { generateContractPdf } from './pdf';
import { uploadContractPdf } from './pdf-storage';
import { resolveRulesContent } from './template';

/**
 * 서명 직후의 후처리 — PDF 생성·보관과 확인 메일 발송.
 *
 * 서명 응답을 먼저 돌려준 뒤 실행되므로(waitUntil) 여기서 던진 오류는 사용자에게 보이지
 * 않는다. 따라서 각 단계를 독립적으로 감싸, PDF가 실패해도 확인 메일은 나가도록 한다.
 * PDF는 관리자 화면에서 언제든 재생성할 수 있어 유실이 치명적이지 않다.
 */
export const finalizeSignedContract = async (contractId: string): Promise<void> => {
  const contract = await getDb().query.contracts.findFirst({
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

  /**
   * 첨부가 유실되거나 열리지 않는 경우가 있어 메일에도 다시 받는 링크를 넣는다.
   *
   * API 라우트가 아니라 완료 페이지를 가리킨다. 다운로드는 연락처 뒷자리를 요구하도록
   * 바뀌었고(pages/api/contracts/[id]/download.ts 주석 참조), 그 입력을 받는 화면이
   * 완료 페이지다. 이 링크는 고객 메일함에 몇 년씩 남으므로, 누르면 곧바로 무엇을
   * 해야 하는지 보이는 쪽으로 보낸다.
   */
  const downloadUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr'}/ko/contracts/${contract.id}/complete?token=${encodeURIComponent(contract.signToken)}`;

  let pdfBuffer: Buffer | undefined;

  try {
    pdfBuffer = await generateContractPdf({
      contract,
      signature: customerSignature,
      clauses: contract.contractClauses,
      attachments: contract.contractAttachments,
      rulesContent: resolveRulesContent(contract.contractAttachments),
    });

    const pdfUrl = await uploadContractPdf(contract.id, pdfBuffer);

    await getDb()
      .update(contracts)
      .set({ pdfUrl, pdfGeneratedAt: new Date(), updatedAt: new Date() })
      .where(eq(contracts.id, contract.id));
  } catch (error: unknown) {
    console.error('[contracts/finalize] Failed to generate or store PDF:', error);
  }

  // 메일 결과도 계약에 남긴다. 서명은 이미 확정됐지만, 확인 메일과 PDF가 고객에게
  // 닿지 않은 사실을 관리자가 알아야 다시 보낼 수 있다.
  const problems: string[] = [];
  if (!pdfBuffer) problems.push('PDF 생성 실패');

  try {
    const [customerResult, operatorResult] = await Promise.all([
      sendContractSignedEmail(contract, pdfBuffer, downloadUrl),
      sendOperatorContractNotification(contract, true),
    ]);

    if (!customerResult.ok) {
      console.error('[contracts/finalize] Signed email failed:', customerResult);
      problems.push(`서명 완료 메일 발송 실패 (${customerResult.errorCode ?? 'UNKNOWN'})`);
    }
    if (!operatorResult.ok) {
      console.error('[contracts/finalize] Operator notification failed:', operatorResult);
    }
  } catch (error: unknown) {
    console.error('[contracts/finalize] Failed to send signed emails:', error);
    problems.push('서명 완료 메일 발송 중 오류');
  }

  try {
    await getDb()
      .update(contracts)
      .set({
        notificationError: problems.length > 0 ? problems.join(' / ') : null,
        notifiedAt: new Date(),
      })
      .where(eq(contracts.id, contract.id));
  } catch (error: unknown) {
    console.error('[contracts/finalize] Failed to record notification result:', error);
  }
};
