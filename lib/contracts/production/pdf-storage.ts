import { get, put } from '@vercel/blob';

import type { ProductionContract, ProductionContractSigner } from '../../../db/schema';
import { buildFontFaceCss, buildSealCss, renderContractHtmlToPdf } from '../pdf';
import { contractPdfPathname, PRODUCTION_PDF_PREFIX } from '../pdfPath';
import { parseStoredClauses } from './clauses';
import { buildProductionPdfHtml } from './pdf-html';
import { parseStoredTerms } from './terms';

export type ProductionContractWithSigners = ProductionContract & { signers: ProductionContractSigner[] };

export const renderProductionPdf = (contract: ProductionContractWithSigners): Promise<Buffer> =>
  renderContractHtmlToPdf(
    buildProductionPdfHtml({
      contract,
      terms: parseStoredTerms(contract.termsJson),
      clauses: parseStoredClauses(contract.clausesJson),
      signers: contract.signers,
      fontFaceCss: buildFontFaceCss(),
      sealCss: buildSealCss(),
    }),
  );

/** 반환값은 Blob 경로 — 주소가 아니라 경로를 저장한다(pdfPath.ts: 저장소를 옮겨도 같은 파일을 찾는다). */
export const uploadProductionPdf = async (contractId: string, pdf: Buffer): Promise<string> => {
  const blob = await put(`${PRODUCTION_PDF_PREFIX}${contractId}.pdf`, pdf, {
    access: 'private',
    contentType: 'application/pdf',
    // 완료 메일 재발송이 같은 경로에 다시 올린다(연습실 uploadContractPdf 주석).
    allowOverwrite: true,
  });
  return blob.pathname;
};

/**
 * 보관본을 먼저 주고, 없을 때만 새로 만든다. 서명 당시 발급한 문서를 그대로 주는 것이 원칙이고, 서명 후
 * 내용이 바뀌지 않으므로 다시 만들어도 같은 문서다(연습실 loadOrRenderContractPdf와 같은 이유).
 */
export const loadOrRenderProductionPdf = async (contract: ProductionContractWithSigners): Promise<Buffer> => {
  if (contract.pdfUrl) {
    try {
      const stored = await get(contractPdfPathname(contract.pdfUrl), { access: 'private' });
      if (stored?.stream) {
        const buffer = Buffer.from(await new Response(stored.stream).arrayBuffer());
        if (buffer.length > 0) return buffer;
      }
    } catch (error: unknown) {
      console.error('[contracts/production/pdf-storage] Stored PDF unavailable, re-rendering:', error);
    }
  }
  return renderProductionPdf(contract);
};
