import { readFileSync } from 'node:fs';

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

import {
  buildContractPdfHtml,
  buildFontFaceCss,
  buildSealCss,
  type BuildContractPdfInput,
} from './pdf-html';

export { buildContractPdfHtml, buildFontFaceCss, buildSealCss } from './pdf-html';

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
  const browser = await puppeteer.launch(
    isServerless()
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
