import { escapeHtml } from './html-escape';

/**
 * 계약 메일 템플릿.
 *
 * 계약서 서명을 요청하는 메일은 피싱과 구별되어야 한다. 받는 사람이 "이게 정말 스튜디오에서
 * 온 것인가"를 판단할 근거 — 보내는 곳이 분명히 드러나고, 계약 조건이 본문에 그대로 적혀
 * 있고, 문의할 전화번호가 있는 것 — 을 갖추는 것이 디자인의 목적이다.
 *
 * 메일 클라이언트는 CSS 지원이 제각각이라 웹과 같은 방식으로 만들 수 없다. table 레이아웃과
 * 인라인 스타일만 쓰고, flex·grid·외부 스타일시트는 쓰지 않는다. 배경색은 명시한다 —
 * 지정하지 않으면 다크 모드에서 배경이 뒤집혀 검은 바탕에 검은 글씨가 된다.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr';

const BRAND = {
  primary: '#6d28d9',
  primaryDark: '#5b21b6',
  ink: '#1a1a1a',
  muted: '#666666',
  faint: '#999999',
  line: '#e5e5e5',
  panel: '#f9f9fb',
  notice: '#fffbeb',
  noticeLine: '#fcd34d',
  noticeInk: '#78350f',
} as const;

const STUDIO = {
  name: '스튜디오 놀',
  address: '서울특별시 은평구 대조동 84-3, 대조빌딩 3층',
  phone: '010-4255-7893',
} as const;

export interface ContractEmailRow {
  label: string;
  value: string;
  /** 강조할 값(금액 등). 눈이 먼저 가야 하는 정보에만 쓴다. */
  emphasis?: boolean;
}

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

const renderRows = (rows: ContractEmailRow[]): string => {
  if (rows.length === 0) return '';

  const cells = rows
    .map(
      (row, index) => `
      <tr>
        <td style="padding: 11px 16px; ${index > 0 ? `border-top: 1px solid ${BRAND.line};` : ''} color: ${BRAND.muted}; font-size: 14px; white-space: nowrap;">${escapeHtml(row.label)}</td>
        <td style="padding: 11px 16px; ${index > 0 ? `border-top: 1px solid ${BRAND.line};` : ''} color: ${BRAND.ink}; font-size: 14px; ${row.emphasis ? 'font-weight: 700;' : ''} text-align: right;">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 24px 0; background-color: ${BRAND.panel}; border: 1px solid ${BRAND.line}; border-radius: 10px; border-collapse: separate;">
      ${cells}
    </table>`;
};

const renderCta = (cta: ContractEmailCta): string => {
  const url = escapeHtml(cta.url);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
      <tr>
        <td align="center" bgcolor="${BRAND.primary}" style="border-radius: 8px;">
          <a href="${url}"
             style="display: inline-block; padding: 15px 34px; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px;">
            ${escapeHtml(cta.label)}
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 4px; color: ${BRAND.faint}; font-size: 12px;">버튼이 눌리지 않으면 아래 주소를 복사해 주세요.</p>
    <p style="margin: 0; color: ${BRAND.muted}; font-size: 12px; word-break: break-all;">${url}</p>`;
};

const renderNotices = (notices: string[]): string => {
  if (notices.length === 0) return '';

  const items = notices
    .map(
      (notice) =>
        `<tr><td style="padding: 2px 0; color: ${BRAND.noticeInk}; font-size: 13px; line-height: 1.7;">· ${notice}</td></tr>`,
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 24px 0 0; background-color: ${BRAND.notice}; border-left: 3px solid ${BRAND.noticeLine}; border-radius: 6px;">
      <tr><td style="padding: 14px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>
      </td></tr>
    </table>`;
};

export const buildContractEmailHtml = (input: ContractEmailInput): string => {
  const paragraphs = input.paragraphs
    .map(
      (text) =>
        `<p style="margin: 0 0 14px; color: ${BRAND.ink}; font-size: 15px; line-height: 1.75;">${text}</p>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- 다크 모드에서 배경·글자가 임의로 반전되지 않도록 밝은 배색만 쓴다고 알린다. -->
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f7">
    <tr>
      <td align="center" style="padding: 28px 12px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid ${BRAND.line}; border-radius: 14px; overflow: hidden;">

          <!-- 보내는 곳을 먼저 밝힌다. 계약 메일은 피싱과 구별되어야 한다. -->
          <tr>
            <td style="padding: 22px 28px; border-bottom: 1px solid ${BRAND.line};">
              <img src="${SITE_URL}/images/email-logo.png" width="140" height="36" alt="${STUDIO.name}"
                   style="display: block; border: 0; margin-bottom: 6px;" />
              <div style="color: ${BRAND.faint}; font-size: 12px;">음악연습실 · 녹음 스튜디오</div>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px;">
              <h1 style="margin: 0 0 18px; color: ${BRAND.ink}; font-size: 20px; font-weight: 700; line-height: 1.4;">
                ${escapeHtml(input.heading)}
              </h1>
              ${paragraphs}
              ${input.rows ? renderRows(input.rows) : ''}
              ${input.cta ? renderCta(input.cta) : ''}
              ${input.notices ? renderNotices(input.notices) : ''}
            </td>
          </tr>

          <tr>
            <td style="padding: 18px 28px; background-color: ${BRAND.panel}; border-top: 1px solid ${BRAND.line};">
              <div style="color: ${BRAND.ink}; font-size: 13px; font-weight: 600; margin-bottom: 4px;">${STUDIO.name}</div>
              <div style="color: ${BRAND.muted}; font-size: 12px; line-height: 1.7;">
                ${STUDIO.address}<br />
                문의 ${STUDIO.phone}
              </div>
              <div style="margin-top: 10px; color: ${BRAND.faint}; font-size: 11px;">
                본 메일은 발송 전용입니다. 회신 대신 위 번호로 연락해 주세요.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/** 본문 안에서 값을 강조할 때 — 문단 문자열을 만들 때 함께 쓴다. */
export const strong = (text: string): string =>
  `<strong style="color: ${BRAND.ink};">${escapeHtml(text)}</strong>`;
