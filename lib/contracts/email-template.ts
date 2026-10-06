import { buildEmailLayout, strong, type EmailLayoutRow } from '../email/layout';

/**
 * 계약 메일 템플릿. 골격은 공용 레이아웃(`lib/email/layout.ts`)이고, 이 파일은 계약 메일의
 * 입력 형태만 유지한다. 계약 서명 요청은 피싱과 구별되어야 하므로 보내는 곳·계약 조건·문의
 * 전화가 드러나는 레이아웃의 설계가 그대로 적용된다.
 */

export { strong };

export type ContractEmailRow = EmailLayoutRow;

export interface ContractEmailCta {
  label: string;
  url: string;
}

export interface ContractEmailInput {
  /** 메일 제목과 별개로 본문 맨 위에 오는 제목 */
  heading: string;
  /** 인사말·상황 설명 (문장 배열, 각 항목이 한 단락) */
  paragraphs: string[];
  rows?: ContractEmailRow[];
  cta?: ContractEmailCta;
  /** 링크 유효기간·본인 확인처럼 미리 알아야 하는 것 */
  notices?: string[];
}

export const buildContractEmailHtml = (input: ContractEmailInput): string =>
  buildEmailLayout({
    heading: input.heading,
    paragraphs: input.paragraphs,
    rows: input.rows,
    cta: input.cta,
    notices: input.notices,
  });
