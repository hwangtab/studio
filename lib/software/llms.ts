import { formatPriceAmount } from '../../data/pricing';
import type { SoftwareProduct } from '../../data/software/catalog';
import { SOFTWARE_SALES_OPEN } from '../../data/software/policy';
import { listPublishedSoftware, trialDaysOf } from './catalog';

const PLATFORM: Record<string, string> = { macos: 'macOS', windows: 'Windows' };

/** llms.txt의 소프트웨어 절 — 순수 함수. 닫혀 있거나 공개 상품이 없으면 빈 문자열. 가격은 지금 가격(맨 앞)만. */
export const renderSoftwareLlmsSection = (input: { open: boolean; siteUrl: string; products: readonly SoftwareProduct[] }): string => {
  if (!input.open || input.products.length === 0) return '';
  const { siteUrl } = input;
  const lines = input.products.map((p) => {
    const price = p.prices?.[0];
    const meta = [p.kind === 'plugin' ? 'audio plugin' : 'desktop app', p.formats.join('/'), p.platforms.map((x) => PLATFORM[x] ?? x).join(', ')].join(' · ');
    return `- ${p.titleEn} (${p.title}) — ${p.summaryEn} ${meta}. ${price ? `${formatPriceAmount(price.krw)} KRW, VAT included, perpetual license.` : 'Not on sale yet.'} Free ${trialDaysOf(p)}-day full-feature trial. ${siteUrl}/en/software/${p.slug}`;
  });
  return [
    '\n## Software — Plugins & Tools\n',
    `Studio NOL makes its own audio software. Perpetual licenses, activated once online and then used offline; checkout is in Korean won for now (card or easy-pay through Toss). Every product has a free trial that is the same installer as the full version. Software: ${siteUrl}/en/software (Korean: ${siteUrl}/ko/software)\n`,
    ...lines,
    '',
  ].join('\n');
};

export const loadSoftwareLlmsSection = (siteUrl: string): string =>
  SOFTWARE_SALES_OPEN ? renderSoftwareLlmsSection({ open: true, siteUrl, products: listPublishedSoftware() }) : '';
