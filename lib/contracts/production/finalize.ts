import { eq } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { productionContracts } from '../../../db/schema';
import { sendProductionOperatorNotification, sendProductionSignedEmail } from './email';
import { buildProductionCompleteUrl, buildProductionProgressUrl } from './links';
import { renderProductionPdf, uploadProductionPdf } from './pdf-storage';
import { recordProductionNotificationResult } from './service';
import { parseStoredTerms } from './terms';

/**
 * 체결 직후 후처리 — PDF 생성·보관과 체결 메일. 연습실 finalize.ts와 같은 구조다.
 *
 * 서명 응답을 보낸 뒤(waitUntil) 실행되므로 여기서 던진 오류는 사용자에게 보이지 않는다. 단계를 따로 감싸
 * PDF가 실패해도 메일은 나가게 하고, 실패는 notification_error에 남겨 관리자 화면에 드러낸다. PDF는 관리자
 * 화면의 "완료 메일 재발송"으로 다시 만들 수 있다.
 */
export const finalizeSignedProductionContract = async (contractId: string): Promise<void> => {
  const contract = await getDb().query.productionContracts.findFirst({
    where: eq(productionContracts.id, contractId),
    with: { signers: true },
  });

  if (!contract) {
    console.error('[contracts/production/finalize] Contract not found:', contractId);
    return;
  }

  const clientSigner = contract.signers.find((signer) => signer.role === 'client');
  if (!clientSigner?.signToken) {
    console.error('[contracts/production/finalize] Client signer token missing:', contractId);
    await recordProductionNotificationResult(contractId, '의뢰인 서명자 정보를 찾지 못해 완료 메일을 보내지 못했습니다.');
    return;
  }

  // 메일에는 API가 아니라 완료 화면을 건다 — 내려받기에 연락처 뒷자리가 필요하고, 그 입력을 받는 곳이 완료 화면이다.
  const completeUrl = buildProductionCompleteUrl(contract.id, clientSigner.signToken);
  const guardian = contract.signers.find((signer) => signer.role === 'guardian' && signer.signToken);
  const problems: string[] = [];

  let pdf: Buffer | undefined;
  try {
    pdf = await renderProductionPdf(contract);
    const pdfUrl = await uploadProductionPdf(contract.id, pdf);
    await getDb()
      .update(productionContracts)
      .set({ pdfUrl, pdfGeneratedAt: new Date(), updatedAt: new Date() })
      .where(eq(productionContracts.id, contract.id));
  } catch (error: unknown) {
    console.error('[contracts/production/finalize] Failed to generate or store PDF:', error);
  }
  if (!pdf) problems.push('PDF 생성 실패');

  try {
    const terms = parseStoredTerms(contract.termsJson);
    const [clientResult, guardianResult, operatorResult] = await Promise.all([
      sendProductionSignedEmail(contract, terms, pdf, completeUrl, buildProductionProgressUrl(contract.id, clientSigner.signToken)),
      // 법정대리인도 서명본을 받는다 — 자기 링크(자기 연락처 뒷자리로 내려받기)로.
      guardian?.signToken
        ? sendProductionSignedEmail(contract, terms, pdf, buildProductionCompleteUrl(contract.id, guardian.signToken), null, {
            name: guardian.name,
            email: guardian.email,
          })
        : null,
      sendProductionOperatorNotification(contract, terms, true),
    ]);
    if (!clientResult.ok) problems.push(`체결 메일 발송 실패 (${clientResult.errorCode ?? 'UNKNOWN'})`);
    if (guardianResult && !guardianResult.ok) problems.push(`법정대리인 체결 메일 발송 실패 (${guardianResult.errorCode ?? 'UNKNOWN'})`);
    if (!operatorResult.ok) problems.push(`운영자 알림 메일 발송 실패 (${operatorResult.errorCode ?? 'UNKNOWN'})`);
  } catch (error: unknown) {
    console.error('[contracts/production/finalize] Failed to send signed emails:', error);
    problems.push('체결 메일 발송 중 오류');
  }

  await recordProductionNotificationResult(contract.id, problems.length > 0 ? problems.join(' / ') : null);
};
