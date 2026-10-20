import type { ProductionContract, ProductionContractSigner } from '../../../db/schema';
import { formatCurrency, formatDateTime } from '../format';
import { escapeHtml } from '../html-escape';
import { renderMarkdown } from '../markdown';
import { CONTRACT_PDF_BASE_CSS, renderSignatureImage } from '../pdf-html';
import type { ProductionClause } from './clauses';
import { contractNameFor, isOneSongKind, releaseTitle, type ProductionTerms } from './terms';

export interface BuildProductionPdfInput {
  contract: ProductionContract;
  terms: ProductionTerms;
  clauses: readonly ProductionClause[];
  signers: readonly ProductionContractSigner[];
  /** 폰트 임베드 CSS(생략하면 시스템 폰트 — 테스트용). */
  fontFaceCss?: string;
  /** 운영자 날인 CSS(생략하면 도장 자리가 빈 칸 — 테스트용). */
  sealCss?: string;
}

/** 서명란 순서 — 계약서 서명란(스튜디오 → 의뢰인)과 같게. */
const SIGNER_ORDER: readonly ProductionContractSigner['role'][] = ['operator', 'client', 'guardian'];

const signerHeading: Record<ProductionContractSigner['role'], string> = {
  operator: '스튜디오',
  client: '의뢰인',
  guardian: '법정대리인',
};

/**
 * 서명란 하나. 운영자는 직인으로 서명하므로(서명 이미지 없음) 이미지 대신 서명 정황만 적는다 — 누가(관리자
 * 계정), 언제, 어디서 이 문서를 보냈는가. 이것이 "운영자 전자서명"의 기록이다.
 */
const renderSigner = (signer: ProductionContractSigner): string => {
  if (signer.status !== 'signed') {
    return `<p style="color: #999;">${signerHeading[signer.role]} 서명 기록이 없습니다.</p>`;
  }

  const image =
    signer.role === 'operator'
      ? '<span class="seal"></span>'
      : renderSignatureImage(signer.signatureData);

  const lines = [
    `서명자: ${escapeHtml(signer.name)}${signer.relation ? ` (의뢰인의 ${escapeHtml(signer.relation)})` : ''}`,
    signer.role === 'operator' ? '' : `이메일: ${escapeHtml(signer.email)}`,
    `서명 일시: ${formatDateTime(signer.signedAt)}`,
    `IP 주소: ${escapeHtml(signer.ipAddress || '-')}`,
    // 제13조 2항 — 서명 시 접속한 브라우저 정보도 서명본에 기재한다.
    signer.userAgent ? `브라우저: ${escapeHtml(signer.userAgent.slice(0, 200))}` : '',
    signer.identityVerifiedAt
      ? `본인 확인: 계약서 등록 연락처 뒷자리 대조 완료 (${formatDateTime(signer.identityVerifiedAt)})`
      : '',
  ].filter(Boolean);

  return `<div style="margin-top: 10px;">
      <h3 style="margin: 0 0 6px;">${signerHeading[signer.role]}</h3>
      ${image}
      <div style="font-size: 11px; color: #666; margin-top: 6px; line-height: 1.6;">${lines.join('<br />')}</div>
    </div>`;
};

/**
 * 제작 계약서 PDF HTML. 구성은 연습실 계약서(pdf-html.ts)와 같다 — 요약 표, 본문, 동의 항목, 전자서명란,
 * 문서 지문. 요약 표는 본문이 아니라 terms에서 그린다(관리자 화면과 같은 값).
 */
export const buildProductionPdfHtml = (input: BuildProductionPdfInput): string => {
  const { contract, terms, clauses, signers, fontFaceCss = '', sealCss = '' } = input;

  // 동의는 서명자마다 따로 받는다 — 법정대리인이 있으면 대리인의 동의도 서명본에 남아야 한다(의뢰인 것만 찍으면
  // 대리인이 무엇에 동의했는지가 PDF에서 사라진다).
  const consenters = signers
    .filter((signer) => signer.role === 'client' || signer.role === 'guardian')
    .sort((a, b) => SIGNER_ORDER.indexOf(a.role) - SIGNER_ORDER.indexOf(b.role))
    .map((signer) => ({
      label: signer.role === 'guardian' ? '법정대리인' : '의뢰인',
      keys: new Set<string>(signer.agreedClauses ? (JSON.parse(signer.agreedClauses) as string[]) : []),
      at: signer.signedAt ?? null,
    }));
  const named = consenters.length > 1;

  const clausesHtml = clauses
    .map((clause) => {
      const marks = consenters.map(({ label, keys, at }) => {
        const agreed = keys.has(clause.key) && at;
        const who = named ? `${label} ` : '';
        return `<span class="${agreed ? 'agreed' : 'not-agreed'}">${who}${agreed ? `✓ 동의 (${formatDateTime(at)})` : '미동의'}</span>`;
      });
      return `<div class="agreement">
          <span><strong>${escapeHtml(clause.clauseNumber)}</strong> ${escapeHtml(clause.title)}</span>
          <span>${marks.join('<br />')}</span>
        </div>`;
    })
    .join('');

  const orderedSigners = [...signers].sort((a, b) => SIGNER_ORDER.indexOf(a.role) - SIGNER_ORDER.indexOf(b.role));

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(contract.title)}</title>
  <style>
    ${fontFaceCss}
    ${sealCss}
    ${CONTRACT_PDF_BASE_CSS}
  </style>
</head>
<body>
  <h1>${contractNameFor(contract.kind)}</h1>
  <p class="meta">${escapeHtml(contract.title)} · 계약번호 ${escapeHtml(contract.id)}</p>

  <h2>계약 요약</h2>
  <table>
    <tr><th style="width: 110px;">의뢰인</th><td>${escapeHtml(contract.clientName)}${
      contract.clientStageName ? ` (${escapeHtml(contract.clientStageName)})` : ''
    }</td></tr>
    <tr><th>이메일</th><td>${escapeHtml(contract.clientEmail)}</td></tr>
    <tr><th>연락처</th><td>${escapeHtml(contract.clientPhone)}</td></tr>
    <tr><th>${isOneSongKind(contract.kind) ? '본 곡' : '음반'}</th><td>${escapeHtml(releaseTitle(contract.kind, terms))}</td></tr>
    <tr><th>계약금액</th><td>${formatCurrency(terms.amount.total)}원 (부가세 포함)</td></tr>
    <tr><th>계약금 · 잔금</th><td>${formatCurrency(terms.amount.deposit)}원 · ${formatCurrency(terms.amount.balance)}원</td></tr>
  </table>

  <h2>계약 본문</h2>
  ${renderMarkdown(contract.content)}

  <h2>동의 항목</h2>
  ${clausesHtml}

  <div class="signature-box">
    <h3 style="margin-top: 0;">전자서명</h3>
    <p>
      각 당사자는 계약서의 내용을 모두 읽고 이해하였으며, 아래 전자서명이 자필 서명과 같은 효력을 가지는 데
      동의하였다. 이 계약은 마지막 당사자가 서명한 때 성립한다.
    </p>
    ${orderedSigners.map(renderSigner).join('')}
    ${
      contract.contentHash
        ? `<div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #d4d4d4; font-size: 10px; color: #666; line-height: 1.7;">
             문서 지문(SHA-256): <span style="font-family: monospace;">${escapeHtml(contract.contentHash)}</span>
           </div>`
        : ''
    }
  </div>
</body>
</html>
  `;
};
