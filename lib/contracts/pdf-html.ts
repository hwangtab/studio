import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Contract, Signature, ContractClause, ContractAttachment } from '../../db/schema';
import { escapeHtml } from './html-escape';
import { renderMarkdown } from './markdown';
import { formatCurrency, formatDate, formatDateTime } from './format';
import { isSignatureDataUrl } from './signature-validation';

/**
 * 계약서 PDF의 HTML을 만든다. 브라우저 실행(pdf.ts)과 분리해 둔 이유는 두 가지다.
 * 하나는 관심사가 다르다는 것, 다른 하나는 puppeteer가 없어야 이 순수 로직을
 * 테스트할 수 있다는 것이다(서명 이미지 주입 방어는 반드시 테스트로 고정해야 한다).
 */


/**
 * 서버리스 Chromium에는 한글 폰트가 없어 그대로 두면 계약서 전체가 두부(□)로 렌더링된다.
 * 완성형 11,172자를 모두 담은 원본 Pretendard를 base64로 인라인해 네트워크·시스템 폰트에
 * 의존하지 않게 한다. 본문용 subset(pretendard-variable.woff2)은 KS X 1001 기반이라
 * 드문 음절의 이름이 깨질 수 있어 법적 문서에는 쓰지 않는다.
 */
const FONT_PATH = path.join(process.cwd(), 'lib', 'fonts', 'pretendard-variable-full.woff2');

let cachedFontCss: string | null = null;

export const buildFontFaceCss = (): string => {
  if (cachedFontCss !== null) return cachedFontCss;

  try {
    const base64 = readFileSync(FONT_PATH).toString('base64');
    cachedFontCss = `
    @font-face {
      font-family: 'Pretendard';
      src: url(data:font/woff2;base64,${base64}) format('woff2');
      font-weight: 45 930;
      font-style: normal;
      font-display: block;
    }`;
  } catch (error: unknown) {
    // 폰트를 못 읽어도 PDF 생성 자체는 계속한다(로컬 시스템 폰트로 폴백).
    console.error('[contracts/pdf] Failed to embed Korean font:', error);
    cachedFontCss = '';
  }

  return cachedFontCss;
};

/**
 * 운영자(갑) 날인. 계약서 템플릿 서명란의 `<span class="seal">` 자리를 채운다.
 * 값이 없으면 그 자리가 빈 칸으로 발행된다.
 *
 * 이미지는 환경변수에서 읽는다.
 *
 * 도장 이미지는 저장소에 두면 안 된다. public/ 아래 있으면 사이트에서 그대로 받아갈 수 있고,
 * 저장소가 공개면 raw 경로로도 열린다. 한번 나간 인감은 회수할 방법이 없다 — 파일을 지워도
 * git 이력과 이미 복제된 사본에 남는다.
 *
 * 환경변수에 두면 저장소·이력 어디에도 남지 않고, 나중에 도장을 새로 파도 값 한 줄만 바꾸면
 * 된다(코드·배포 무관). Blob에 두는 방법도 있지만 PDF를 만들 때마다 네트워크 왕복이 붙어,
 * 가뜩이나 Chromium을 띄우는 경로를 더 느리게 만든다.
 *
 * 값이 없으면 날인 없이 발행한다 — 도장이 없다고 계약서 생성을 막을 이유는 없고, 서명과
 * 문서 지문이 이미 문서의 진정성을 뒷받침한다. 다만 눈에 띄도록 로그를 남긴다.
 */
let cachedSealCss: string | null = null;

export const buildSealCss = (): string => {
  if (cachedSealCss !== null) return cachedSealCss;

  const base64 = (process.env.CONTRACT_SEAL_BASE64 ?? '').replace(/\s/g, '');

  if (!base64) {
    console.error(
      '[contracts/pdf] CONTRACT_SEAL_BASE64가 없어 날인 없이 발행합니다. ' +
        '값을 등록하면 이후 발행분부터 도장이 찍힙니다.',
    );
    cachedSealCss = '';
    return cachedSealCss;
  }

  // 값이 잘못 들어오면 계약서에 깨진 이미지가 찍힌다. 형태를 먼저 본다.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    console.error('[contracts/pdf] CONTRACT_SEAL_BASE64 형식이 올바르지 않습니다 — 날인을 생략합니다.');
    cachedSealCss = '';
    return cachedSealCss;
  }

  cachedSealCss = `
    .seal {
      display: inline-block;
      width: 62px;
      height: 62px;
      background-image: url(data:image/png;base64,${base64});
      background-size: contain;
      background-position: center;
      background-repeat: no-repeat;
      vertical-align: middle;
    }`;

  return cachedSealCss;
};

const renderSignatureImage = (signatureData: string | null): string => {
  if (!signatureData) {
    return '<p style="color: #999;">서명 이미지가 없습니다.</p>';
  }

  /**
   * 저장 시점에도 검증하지만(signature-validation) 여기서 한 번 더 확인한다 — 이 문자열은
   * Chromium이 실제로 렌더링하는 HTML 속성에 들어가므로, 따옴표가 섞이면 속성을 탈출해
   * 임의의 태그·핸들러를 주입할 수 있다. 저장 경로가 하나 늘어나는 것만으로 무너지지
   * 않도록 sink에서 막는다.
   *
   * 판정 함수는 저장 쪽과 같은 것을 쓴다. 규칙을 따로 두면 한쪽만 통과하는 값이 생겨,
   * 서명은 접수됐는데 계약서에는 오류 문구가 인쇄되는 상태가 만들어진다.
   */
  if (!isSignatureDataUrl(signatureData)) {
    console.error('[contracts/pdf] Unexpected signature data format — image omitted.');
    return '<p style="color: #b91c1c;">서명 이미지를 표시할 수 없습니다.</p>';
  }

  return `<img src="${escapeHtml(signatureData)}" alt="서명" style="max-height: 80px; border: 1px solid #e5e5e5; border-radius: 6px;" />`;
};

export interface BuildContractPdfInput {
  contract: Contract;
  signature: Signature | null;
  clauses: ContractClause[];
  attachments: ContractAttachment[];
  rulesContent: string;
  /** 폰트 임베드 CSS. 생략하면 시스템 폰트로 렌더링된다(테스트용). */
  fontFaceCss?: string;
  /** 운영자 날인 CSS. 생략하면 서명란의 도장 자리가 빈 칸으로 남는다(테스트용). */
  sealCss?: string;
}

export const buildContractPdfHtml = (input: BuildContractPdfInput): string => {
  const {
    contract,
    signature,
    clauses,
    attachments,
    rulesContent,
    fontFaceCss = '',
    sealCss = '',
  } = input;

  const agreementRow = (label: string, agreedAt: Date | null) => `
        <div class="agreement">
          <span>${label}</span>
          <span class="${agreedAt ? 'agreed' : 'not-agreed'}">
            ${agreedAt ? `✓ 동의 (${formatDateTime(agreedAt)})` : '미동의'}
          </span>
        </div>`;

  const clausesHtml = clauses
    .map((clause) =>
      agreementRow(
        `<strong>${escapeHtml(clause.clauseNumber)}</strong> ${escapeHtml(clause.title)}`,
        clause.agreedAt,
      ),
    )
    .join('');

  const attachmentsHtml = attachments
    .map((attachment) =>
      agreementRow(`「${escapeHtml(attachment.title)}」`, attachment.agreedAt),
    )
    .join('');

  const signatureImageHtml = renderSignatureImage(signature?.signatureData ?? null);

  const signatureHtml = signature
    ? `<div style="margin-top: 8px;">
        ${signatureImageHtml}
        <div style="font-size: 11px; color: #666; margin-top: 6px; line-height: 1.6;">
          서명자: ${escapeHtml(signature.signerName)}<br />
          이메일: ${escapeHtml(signature.signerEmail)}<br />
          서명 일시: ${formatDateTime(signature.signedAt)}<br />
          IP 주소: ${escapeHtml(signature.ipAddress || '-')}
        </div>
       </div>`
    : '<p style="color: #999;">서명 기록이 없습니다.</p>';

  /**
   * 본인 확인과 문서 지문을 계약서에 함께 남긴다.
   *
   * 증거는 보이는 곳에 있어야 쓸 수 있다. 서명 당시 연락처 뒷자리로 당사자를 확인했다는
   * 사실과, 그때 문서의 지문을 적어 두면 사후에 문서를 대조할 근거가 문서 안에 남는다.
   */
  const verificationRows = [
    contract.identityVerifiedAt
      ? `<div>본인 확인: 계약서 등록 연락처 뒷자리 대조 완료 (${formatDateTime(contract.identityVerifiedAt)})</div>`
      : '',
    contract.contentHash
      ? `<div>문서 지문(SHA-256): <span style="font-family: monospace;">${escapeHtml(contract.contentHash)}</span></div>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const verificationHtml = verificationRows
    ? `<div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #d4d4d4; font-size: 10px; color: #666; line-height: 1.7;">${verificationRows}</div>`
    : '';

  const rulesHtml = rulesContent
    ? `<div class="page-break">
        ${renderMarkdown(rulesContent)}
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(contract.title)}</title>
  <style>
    ${fontFaceCss}
    ${sealCss}
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      font-size: 11.5px;
      line-height: 1.7;
      color: #1a1a1a;
      margin: 0;
    }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 14px; margin: 20px 0 10px; border-bottom: 2px solid #111; padding-bottom: 5px; }
    h3 { font-size: 12.5px; margin: 14px 0 6px; }
    p { margin: 6px 0; }
    blockquote {
      margin: 10px 0;
      padding: 10px 14px;
      background: #f6f8fa;
      border-left: 3px solid #d4d4d4;
    }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #d4d4d4; padding: 7px 9px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
    ol, ul { margin: 6px 0; padding-left: 20px; }
    li { margin: 3px 0; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 18px 0; }
    /* 조문이 페이지 경계에서 쪼개지지 않도록 */
    h2, h3 { break-after: avoid; }
    table, blockquote { break-inside: avoid; }
    .page-break { break-before: page; }
    .agreement {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 6px;
      padding: 8px 10px;
      background: #f9f9f9;
      border-radius: 5px;
    }
    .agreed { color: #16a34a; white-space: nowrap; }
    .not-agreed { color: #dc2626; white-space: nowrap; }
    .signature-box {
      margin-top: 24px;
      padding: 16px;
      border: 1px solid #d4d4d4;
      border-radius: 8px;
      background: #fafafa;
      break-inside: avoid;
    }
    .meta { color: #666; font-size: 10.5px; }
  </style>
</head>
<body>
  <h1>음악연습실 이용계약서</h1>
  <p class="meta">${escapeHtml(contract.title)} · 계약번호 ${escapeHtml(contract.id)}</p>

  <h2>계약 요약</h2>
  <table>
    <tr><th style="width: 110px;">이용자</th><td>${escapeHtml(contract.customerName)}</td></tr>
    <tr><th>이메일</th><td>${escapeHtml(contract.customerEmail)}</td></tr>
    <tr><th>연락처</th><td>${escapeHtml(contract.customerPhone)}</td></tr>
    <tr><th>주소</th><td>${escapeHtml(contract.customerAddress || '-')}</td></tr>
    <tr><th>호실</th><td>${escapeHtml(contract.roomNumber)}호</td></tr>
    <tr><th>계약 기간</th><td>${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}</td></tr>
    <tr><th>월 이용료</th><td>${formatCurrency(contract.monthlyRent)}원 (매월 ${contract.paymentDay}일 선불)</td></tr>
    <tr><th>보증금</th><td>${formatCurrency(contract.depositAmount)}원 (제5조에 따라 납부 면제)</td></tr>
  </table>

  <h2>계약 본문</h2>
  ${renderMarkdown(contract.content)}

  <h2>동의 항목</h2>
  ${clausesHtml}
  ${attachmentsHtml}

  <div class="signature-box">
    <h3 style="margin-top: 0;">전자서명</h3>
    <p>
      이용자는 본인이 계약 당사자임을 확인하고, 계약서의 내용을 모두 읽고 이해하였으며,
      아래 전자서명이 자필 서명과 같은 효력을 가지는 데 동의하였다.
    </p>
    ${signatureHtml}
    ${verificationHtml}
  </div>

  ${rulesHtml}
</body>
</html>
  `;
};
