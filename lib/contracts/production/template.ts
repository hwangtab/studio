import { readFileSync } from 'node:fs';
import path from 'node:path';

import { formatCurrency, formatDate } from '../format';
import { escapeTableCell } from '../html-escape';
import type { ProductionTerms } from './terms';

/**
 * 제작 계약서 본문 만들기. 연습실 template.ts와 같은 규칙을 따른다 — 사용자 값은 표 셀 이스케이프,
 * 치환은 함수로(`$'` 같은 replace 패턴이 템플릿 뒷부분을 끌어오지 못하게), 날짜·금액은 format.ts 한 곳에서.
 *
 * 템플릿 파일은 배포 파일 트레이싱에 걸려 있어야 한다(next.config.mjs outputFileTracingIncludes).
 */

/** 현재 템플릿 원문. 새 계약을 만들 때만 읽는다 — 만든 계약은 저장된 사본(production_contracts.template)을 쓴다. */
export const readProductionTemplate = (): string =>
  readFileSync(path.join(process.cwd(), 'lib', 'contracts', 'production', 'single-template.md'), 'utf-8');

export interface ProductionTemplateData {
  clientName: string;
  clientStageName: string | null;
  clientPhone: string;
  /** 서명 전에는 비어 있다 — 서명자가 채운다. */
  clientBirthdate?: string | null;
  clientAddress?: string | null;
  terms: ProductionTerms;
  /** 계약일. 서명 순간에 확정된다(초안을 만든 날이 아니다). */
  contractDate: string;
}

export const buildProductionContent = (data: ProductionTemplateData, template: string): string => {
  const { terms } = data;
  // 문자열 값은 표 밖(조항 문장)에 들어가도 escapeTableCell을 쓴다. 꺾쇠·파이프가 마크업으로 살아나지
  // 않아야 하는 것은 표 밖에서도 같다.
  const cell = (value: string | null | undefined, fallback = '') => (value ? escapeTableCell(value) : fallback);
  const won = (amount: number) => formatCurrency(amount);

  const refundRows = [
    ...terms.refundSchedule.map((item) => `| ${escapeTableCell(item.label)} | ${won(item.amount)}원 |`),
    `| **합계** | **${won(terms.amount.total)}원** |`,
  ].join('\n');

  const replacements: Record<string, string> = {
    '{{clientName}}': cell(data.clientName),
    '{{clientStageName}}': cell(data.clientStageName, '-'),
    '{{clientBirthdate}}': cell(data.clientBirthdate),
    '{{clientPhone}}': cell(data.clientPhone),
    '{{clientAddress}}': cell(data.clientAddress),
    '{{songTitle}}': terms.songTitle ? escapeTableCell(terms.songTitle) : '1곡 (제목 미정)',
    '{{total}}': won(terms.amount.total),
    '{{deposit}}': won(terms.amount.deposit),
    '{{balance}}': won(terms.amount.balance),
    '{{depositDueDays}}': String(terms.amount.depositDueDays),
    '{{balanceDueDays}}': String(terms.amount.balanceDueDays),
    '{{bank}}': escapeTableCell(terms.payment.bank),
    '{{account}}': escapeTableCell(terms.payment.account),
    '{{holder}}': escapeTableCell(terms.payment.holder),
    '{{workWeeks}}': String(terms.workWeeks),
    '{{arrangementTracks}}': String(terms.scope.arrangementTracks),
    '{{recordingHours}}': String(terms.scope.recordingHours),
    '{{mixingTracks}}': String(terms.scope.mixingTracks),
    '{{revArrangement}}': String(terms.revisions.arrangement),
    '{{revMixing}}': String(terms.revisions.mixing),
    '{{revMastering}}': String(terms.revisions.mastering),
    '{{feeArrangement}}': won(terms.extraRevisionFees.arrangement),
    '{{feeMixing}}': won(terms.extraRevisionFees.mixing),
    '{{feeMastering}}': won(terms.extraRevisionFees.mastering),
    '{{deemedApprovalDays}}': String(terms.deemedApprovalDays),
    '{{clientUnresponsiveDays}}': String(terms.clientUnresponsiveDays),
    '{{paymentDelayDays}}': String(terms.paymentDelayDays),
    '{{studioDelayWeeks}}': String(terms.studioDelayWeeks),
    '{{credits}}': escapeTableCell(terms.credits),
    '{{refundRows}}': refundRows,
    '{{contractDate}}': formatDate(data.contractDate),
  };

  let content = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, () => value);
  }
  return content;
};

/** 템플릿에 남은 자리표시자. 테스트가 "모든 변수가 채워졌다"를 확인하는 데 쓴다. */
export const findUnfilledPlaceholders = (content: string): string[] => content.match(/\{\{[a-zA-Z]+\}\}/g) ?? [];
