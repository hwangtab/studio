import { readFileSync } from 'node:fs';
import path from 'node:path';

import { escapeMarkdown, escapeTableCell } from './html-escape';

export interface ContractTemplateData {
  customerName: string;
  customerBirthdate?: string;
  customerPhone: string;
  customerAddress?: string;
  roomNumber: string;
  roomArea?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  paymentDay?: number;
  contractDate: string;
  specialTerms?: string[];
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('ko-KR').format(amount);

const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const buildContractContent = (data: ContractTemplateData): string => {
  const templatePath = path.join(
    process.cwd(),
    'lib',
    'contracts',
    'contract-template.md',
  );

  let content = readFileSync(templatePath, 'utf-8');

  // 아래 값은 모두 마크다운 표의 셀 안에 들어간다. 파이프·개행까지 막지 않으면
  // 이름 한 줄로 계약서에 없던 칸과 문구를 심을 수 있다.
  const replacements: Record<string, string> = {
    '{{customerName}}': escapeTableCell(data.customerName),
    '{{customerBirthdate}}': data.customerBirthdate ? escapeTableCell(data.customerBirthdate) : '',
    '{{customerPhone}}': escapeTableCell(data.customerPhone),
    '{{customerAddress}}': data.customerAddress ? escapeTableCell(data.customerAddress) : '',
    '{{roomNumber}}': escapeTableCell(data.roomNumber),
    '{{roomArea}}': data.roomArea ? escapeTableCell(data.roomArea) : '3m × 2m',
    '{{startDate}}': formatDate(data.startDate),
    '{{endDate}}': formatDate(data.endDate),
    '{{monthlyRent}}': formatCurrency(data.monthlyRent),
    '{{depositAmount}}': formatCurrency(data.depositAmount),
    '{{paymentDay}}': String(data.paymentDay ?? 1),
    '{{contractDate}}': formatDate(data.contractDate),
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, value);
  }

  const termsRows = (data.specialTerms ?? [])
    .map((term, index) => `| ${index + 1} | ${escapeMarkdown(term)} |`)
    .join('\n');
  content = content.replace('{{specialTerms}}', termsRows || '| 1 | |\n| 2 | |\n| 3 | |');

  return content;
};

/**
 * 공동생활 이용수칙 원본. 계약서의 첨부 문서로 서명 페이지·PDF에 함께 실린다.
 * 배포 환경의 파일 트레이싱을 위해 lib/contracts 아래에 두며(next.config.mjs 참조),
 * 수정할 때는 이 파일이 단일 원본이다.
 */
export const buildRulesContent = (): string => {
  const rulesPath = path.join(process.cwd(), 'lib', 'contracts', 'house-rules.md');
  return readFileSync(rulesPath, 'utf-8');
};
