import { getSiteConfig } from '../../data/siteConfig';

/**
 * 메일 공용 레이아웃 — 이 사이트가 보내는 HTML 메일의 단일 골격.
 *
 * 기준은 계약 메일이다. 계약 서명 요청은 피싱과 구별되어야 해서, 보내는 곳(로고·상호·주소·
 * 사업자등록번호)과 문의 전화가 분명히 드러나게 설계했다. 다른 메일도 같은 골격을 쓰면
 * 받는 사람이 "스튜디오 놀에서 온 메일"을 한눈에 알아본다.
 *
 * 메일 클라이언트는 CSS 지원이 제각각이다. table 레이아웃과 인라인 스타일만 쓰고
 * flex·grid·외부 스타일시트는 쓰지 않는다. 배경색은 명시한다 — 지정하지 않으면 다크 모드에서
 * 배경이 뒤집혀 검은 바탕에 검은 글씨가 된다.
 *
 * **escape 규칙**: `heading`·`rows`·`cta.label`·`cta.url`은 이 파일이 escape한다. `paragraphs`와
 * `notices`는 HTML을 허용하므로 **호출부가 값을 escape**한다(`escapeHtml`, 강조는 `strong`).
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

/** 사이트 안 경로를 절대 URL로. 운영자 알림의 '관리자에서 보기' 버튼 등에 쓴다. */
export const adminUrl = (path: string): string => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const BRAND = {
  primary: '#6d28d9',
  ink: '#1a1a1a',
  muted: '#666666',
  faint: '#999999',
  line: '#e5e5e5',
  panel: '#f9f9fb',
  notice: '#fffbeb',
  noticeLine: '#fcd34d',
  noticeInk: '#78350f',
  alert: '#fef2f2',
  alertLine: '#f87171',
  alertInk: '#7f1d1d',
} as const;

const STUDIO_NAME = '스튜디오 놀';

/** 본문 안에서 값을 강조할 때 — 문단 문자열을 만들 때 함께 쓴다. */
export const strong = (text: string): string =>
  `<strong style="color: ${BRAND.ink};">${escapeHtml(text)}</strong>`;

export interface EmailLayoutRow {
  label: string;
  value: string;
  /** 강조할 값(금액 등). 눈이 먼저 가야 하는 정보에만 쓴다. */
  emphasis?: boolean;
  /** 있으면 값이 링크가 된다(mailto:/tel:/URL). */
  href?: string;
}

export interface EmailLayoutInput {
  /** customer(기본): 고객 메일. operator: 운영자 알림 — '운영 알림' 칩, 한 줄 푸터, 값이 큰 정보 표. */
  audience?: 'customer' | 'operator';
  /** 받은편지함 목록에 제목 옆으로 보이는 미리보기 줄(본문에는 보이지 않는다) */
  preheader?: string;
  /** 메일 제목과 별개로 본문 맨 위에 오는 제목 */
  heading: string;
  /** 인사말·상황 설명 (각 항목이 한 단락, HTML 허용 — 호출부가 escape) */
  paragraphs?: string[];
  rows?: EmailLayoutRow[];
  /** 운영자 알림이면 호출부가 '관리자에서 보기'를 넘긴다 */
  cta?: { label: string; url: string };
  /** 링크 유효기간·본인 확인처럼 미리 알아야 하는 것 (HTML 허용 — 호출부가 escape) */
  notices?: string[];
  /** info=앰버(기본), alert=붉은 계열(긴급) */
  noticeTone?: 'info' | 'alert';
  /** 제목 위에 놓는 대표 이미지(공연 포스터 등). 주소·alt는 레이아웃이 escape한다. 절대 URL을 넘긴다. */
  hero?: { imageUrl: string; alt: string };
  /**
   * 정보 표(rows)와 버튼(cta) 사이에 그대로 들어가는 HTML 조각들(티켓 카드·문의 메시지 등).
   * **호출부가 값을 escape한다.** 레이아웃은 조각을 감싸지 않으므로 table 레이아웃·인라인 스타일로 만들 것.
   */
  blocks?: string[];
  /**
   * 고객 메일의 머리·꼬리말·버튼 안내 언어. 기본 ko — 영어는 공연 영어 화면(/en/shows)으로 예매한 주문의 메일뿐이다.
   * 운영자 알림은 언제나 한국어다.
   */
  locale?: 'ko' | 'en';
}

const renderRows = (rows: EmailLayoutRow[], operator: boolean): string => {
  if (rows.length === 0) return '';

  const pad = operator ? '12px 16px' : '11px 16px';
  const labelSize = operator ? '12px' : '14px';
  const valueSize = operator ? '16px' : '14px';

  const cells = rows
    .map((row, index) => {
      const border = index > 0 ? `border-top: 1px solid ${BRAND.line};` : '';
      const text = escapeHtml(row.value);
      const value = row.href
        ? `<a href="${escapeHtml(row.href)}" style="color: ${BRAND.primary}; text-decoration: underline;">${text}</a>`
        : text;
      const weight = row.emphasis || operator ? 'font-weight: 700;' : '';
      return `
      <tr>
        <td style="padding: ${pad}; ${border} color: ${BRAND.muted}; font-size: ${labelSize}; white-space: nowrap;">${escapeHtml(row.label)}</td>
        <td style="padding: ${pad}; ${border} color: ${BRAND.ink}; font-size: ${valueSize}; ${weight} text-align: right;">${value}</td>
      </tr>`;
    })
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 24px 0; background-color: ${BRAND.panel}; border: 1px solid ${BRAND.line}; border-radius: 10px; border-collapse: separate;">
      ${cells}
    </table>`;
};

const renderCta = (cta: { label: string; url: string }, operator: boolean, en = false): string => {
  const url = escapeHtml(cta.url);
  const button = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: ${operator ? '0 0 20px' : '28px 0'};">
      <tr>
        <td align="center" bgcolor="${BRAND.primary}" style="border-radius: 8px;">
          <a href="${url}"
             style="display: inline-block; padding: 15px 34px; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px;">
            ${escapeHtml(cta.label)}
          </a>
        </td>
      </tr>
    </table>`;
  // 운영자는 받은편지함에서 바로 누른다. 주소 복사 안내는 고객 메일에만 둔다.
  if (operator) return button;
  return `${button}
    <p style="margin: 0 0 4px; color: ${BRAND.faint}; font-size: 12px;">${en ? 'If the button does not work, copy the address below.' : '버튼이 눌리지 않으면 아래 주소를 복사해 주세요.'}</p>
    <p style="margin: 0; color: ${BRAND.muted}; font-size: 12px; word-break: break-all;">${url}</p>`;
};

const renderNotices = (notices: string[], tone: 'info' | 'alert'): string => {
  if (notices.length === 0) return '';

  const ink = tone === 'alert' ? BRAND.alertInk : BRAND.noticeInk;
  const bg = tone === 'alert' ? BRAND.alert : BRAND.notice;
  const line = tone === 'alert' ? BRAND.alertLine : BRAND.noticeLine;

  const items = notices
    .map(
      (notice) =>
        `<tr><td style="padding: 2px 0; color: ${ink}; font-size: 13px; line-height: 1.7;">· ${notice}</td></tr>`,
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 24px 0 0; background-color: ${bg}; border-left: 3px solid ${line}; border-radius: 6px;">
      <tr><td style="padding: 14px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>
      </td></tr>
    </table>`;
};

export const buildEmailLayout = (input: EmailLayoutInput): string => {
  const operator = input.audience === 'operator';
  const en = !operator && input.locale === 'en';
  const tone = input.noticeTone ?? 'info';
  const site = getSiteConfig(en ? 'en' : 'ko');

  const paragraphs = (input.paragraphs ?? [])
    .map(
      (text) =>
        `<p style="margin: 0 0 14px; color: ${BRAND.ink}; font-size: 15px; line-height: 1.75;">${text}</p>`,
    )
    .join('');

  const preheader = input.preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #f4f4f7; opacity: 0;">${escapeHtml(input.preheader)}</div>`
    : '';

  const chip = operator
    ? `<span style="display: inline-block; padding: 3px 10px; border-radius: 999px; background-color: ${tone === 'alert' ? BRAND.alert : '#ede9fe'}; color: ${tone === 'alert' ? BRAND.alertInk : BRAND.primary}; font-size: 12px; font-weight: 700;">${tone === 'alert' ? '운영 알림 · 긴급' : '운영 알림'}</span>`
    : `<div style="color: ${BRAND.faint}; font-size: 12px;">${en ? 'Rehearsal rooms · Recording studio · Seoul' : '음악연습실 · 녹음 스튜디오'}</div>`;

  const footer = operator
    ? `<div style="color: ${BRAND.faint}; font-size: 12px;">${STUDIO_NAME} · 발송 전용</div>`
    : en
      ? `<div style="color: ${BRAND.ink}; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Studio NOL (${STUDIO_NAME})</div>
              <div style="color: ${BRAND.muted}; font-size: 12px; line-height: 1.7;">
                ${escapeHtml(site.contact.address)}<br />
                Contact +82 ${escapeHtml(site.contact.phone.replace(/^0/, ''))} · Business registration no. ${escapeHtml(site.businessRegistrationNumber ?? '')}
              </div>
              <div style="margin-top: 10px; color: ${BRAND.faint}; font-size: 11px;">
                This is a send-only email. Please contact us by phone or at hello@studionol.co.kr instead of replying.
              </div>`
      : `<div style="color: ${BRAND.ink}; font-size: 13px; font-weight: 600; margin-bottom: 4px;">${STUDIO_NAME}</div>
              <div style="color: ${BRAND.muted}; font-size: 12px; line-height: 1.7;">
                ${escapeHtml(site.contact.address)}<br />
                문의 ${escapeHtml(site.contact.phone)} · 사업자등록번호 ${escapeHtml(site.businessRegistrationNumber ?? '')}
              </div>
              <div style="margin-top: 10px; color: ${BRAND.faint}; font-size: 11px;">
                본 메일은 발송 전용입니다. 회신 대신 위 번호로 연락해 주세요.
              </div>`;

  const hero = input.hero
    ? `<div style="margin: 0 0 20px; text-align: center;"><img src="${escapeHtml(input.hero.imageUrl)}" alt="${escapeHtml(input.hero.alt)}" width="200"
                   style="display: inline-block; width: 200px; max-width: 60%; height: auto; border: 0; border-radius: 8px;" /></div>`
    : '';

  const blocks = input.blocks?.length ? `\n              ${input.blocks.join('\n')}` : '';

  const body = `${paragraphs}
              ${input.rows ? renderRows(input.rows, operator) : ''}${blocks}
              ${input.cta ? renderCta(input.cta, operator, en) : ''}
              ${input.notices ? renderNotices(input.notices, tone) : ''}`;

  return `<!DOCTYPE html>
<html lang="${en ? 'en' : 'ko'}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- 다크 모드에서 배경·글자가 임의로 반전되지 않도록 밝은 배색만 쓴다고 알린다. -->
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f7">
    <tr>
      <td align="center" style="padding: 28px 12px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid ${BRAND.line}; border-radius: 14px; overflow: hidden;">

          <!-- 보내는 곳을 먼저 밝힌다. 계약 메일은 피싱과 구별되어야 한다. -->
          <tr>
            <td style="padding: 22px 28px; border-bottom: 1px solid ${BRAND.line};">
              <img src="${SITE_URL}/images/email-logo.png" width="140" height="36" alt="${STUDIO_NAME}"
                   style="display: block; border: 0; margin-bottom: 6px;" />
              ${chip}
            </td>
          </tr>

          <tr>
            <td style="padding: 28px;">
              ${hero}<h1 style="margin: 0 0 18px; color: ${BRAND.ink}; font-size: 20px; font-weight: 700; line-height: 1.4;">
                ${escapeHtml(input.heading)}
              </h1>
              ${body}
            </td>
          </tr>

          <tr>
            <td style="padding: 18px 28px; background-color: ${BRAND.panel}; border-top: 1px solid ${BRAND.line};">
              ${footer}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
