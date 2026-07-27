import { readFileSync } from 'node:fs';
import path from 'node:path';

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

import type { Contract, Signature, ContractClause, ContractAttachment } from '../../db/schema';
import { escapeHtml } from './html-escape';
import { renderMarkdown } from './markdown';

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('ko-KR').format(amount);

const formatDateTime = (date: string | Date | null): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (date: string | Date | null): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

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
 * 운영자(갑) 날인. 계약서 템플릿의 서명란에 `<span class="seal">` 자리가 있으며,
 * 채우지 않으면 갑의 날인이 빈 칸인 채로 발행된다.
 */
const SEAL_PATH = path.join(process.cwd(), 'public', 'images', 'contract-seal.png');

let cachedSealCss: string | null = null;

export const buildSealCss = (): string => {
  if (cachedSealCss !== null) return cachedSealCss;

  try {
    const base64 = readFileSync(SEAL_PATH).toString('base64');
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
  } catch (error: unknown) {
    console.error('[contracts/pdf] Failed to embed operator seal:', error);
    cachedSealCss = '';
  }

  return cachedSealCss;
};

interface BuildContractPdfInput {
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

  const signatureHtml = signature?.signatureData
    ? `<div style="margin-top: 8px;">
        <img src="${signature.signatureData}" alt="서명" style="max-height: 80px; border: 1px solid #e5e5e5; border-radius: 6px;" />
        <div style="font-size: 11px; color: #666; margin-top: 6px; line-height: 1.6;">
          서명자: ${escapeHtml(signature.signerName)}<br />
          이메일: ${escapeHtml(signature.signerEmail)}<br />
          서명 일시: ${formatDateTime(signature.signedAt)}<br />
          IP 주소: ${escapeHtml(signature.ipAddress || '-')}
        </div>
       </div>`
    : '<p style="color: #999;">서명 기록이 없습니다.</p>';

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
    <p>본 계약서의 내용을 충분히 읽고 이해하였으며, 상기 내용에 동의하고 서명합니다.</p>
    ${signatureHtml}
  </div>

  ${rulesHtml}
</body>
</html>
  `;
};

/**
 * Vercel 서버리스에서는 @sparticuz/chromium이 제공하는 바이너리를, 로컬에서는 설치된
 * Chrome을 쓴다. puppeteer(전체 패키지)는 Chromium을 통째로 내려받아 서버리스 번들
 * 한도를 넘기므로 puppeteer-core만 의존한다.
 */
const LOCAL_CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

const isServerless = (): boolean =>
  Boolean(process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.VERCEL);

const resolveLocalChrome = (): string => {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv) return fromEnv;

  for (const candidate of LOCAL_CHROME_CANDIDATES) {
    try {
      readFileSync(candidate, { flag: 'r' });
      return candidate;
    } catch {
      // 다음 후보로
    }
  }

  throw new Error(
    'Chrome을 찾을 수 없습니다. PUPPETEER_EXECUTABLE_PATH 환경 변수로 실행 파일 경로를 지정하세요.',
  );
};

export const generateContractPdf = async (
  input: Omit<BuildContractPdfInput, 'fontFaceCss' | 'sealCss'>,
): Promise<Buffer> => {
  const serverless = isServerless();

  const browser = await puppeteer.launch(
    serverless
      ? {
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: true,
        }
      : {
          executablePath: resolveLocalChrome(),
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
  );

  try {
    const page = await browser.newPage();
    const html = buildContractPdfHtml({
      ...input,
      fontFaceCss: buildFontFaceCss(),
      sealCss: buildSealCss(),
    });

    await page.setContent(html, { waitUntil: 'load' });
    // 인라인 base64 폰트가 실제로 적용된 뒤에 인쇄해야 두부(□) 렌더링을 피한다.
    await page.evaluateHandle('document.fonts.ready');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="width: 100%; font-size: 8px; color: #999; text-align: center; padding: 0 16mm;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
};
