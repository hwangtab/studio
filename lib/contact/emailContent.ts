import type { SanitizedContactPayload } from './payload';
import { buildEmailLayout, escapeHtml } from '../email/layout';
import { BRAND_COLOR } from '../brandColor';

/**
 * 문의 접수 운영자 메일 HTML — 공용 레이아웃(operator). 사용자가 쓴 값은 전부 escape하고 메시지는 줄바꿈을 보존한다.
 * `replyTo`가 문의자라 운영자는 이 메일에 그대로 답장한다(발송 쪽은 pages/api/contact/send-email.ts).
 */
export const buildContactEmailHtml = (sanitized: SanitizedContactPayload): string => {
  const message = escapeHtml(sanitized.message).replace(/\r?\n/g, '<br />');

  const messageBlock = `
    <div style="margin: 24px 0 8px; color: #666666; font-size: 12px; font-weight: 700;">메시지</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 0 0 24px; background-color: #f9f9fb; border-left: 3px solid ${BRAND_COLOR.primary}; border-radius: 6px;">
      <tr><td style="padding: 16px 18px; color: #1a1a1a; font-size: 15px; line-height: 1.7; word-break: break-word;">${message}</td></tr>
    </table>`;

  const attributionLines: string[] = [];
  if (sanitized.utm_source) attributionLines.push(`utm_source: ${sanitized.utm_source}`);
  if (sanitized.utm_medium) attributionLines.push(`utm_medium: ${sanitized.utm_medium}`);
  if (sanitized.utm_campaign) attributionLines.push(`utm_campaign: ${sanitized.utm_campaign}`);
  if (sanitized.referrer) attributionLines.push(`referrer: ${sanitized.referrer}`);
  const attributionBlock = attributionLines.length
    ? `<p style="margin: 0 0 4px; color: #999999; font-size: 11px; line-height: 1.6; word-break: break-all;">유입 출처 · ${attributionLines.map(escapeHtml).join(' · ')}</p>`
    : '';

  return buildEmailLayout({
    audience: 'operator',
    preheader: `${sanitized.name}님의 새 문의가 도착했어요.`,
    heading: '새 문의가 도착했어요',
    rows: [
      { label: '이름', value: sanitized.name },
      { label: '이메일', value: sanitized.email, href: `mailto:${sanitized.email}` },
      { label: '전화', value: sanitized.phone, href: `tel:${sanitized.phone.replace(/[^\d+]/g, '')}` },
    ],
    blocks: [messageBlock, attributionBlock].filter(Boolean),
  });
};

export const buildContactEmailBody = (sanitized: SanitizedContactPayload): string => {
  const lines: string[] = [
    `이름: ${sanitized.name}`,
    `이메일: ${sanitized.email}`,
    `전화: ${sanitized.phone}`,
    '',
    '메시지:',
    sanitized.message,
  ];

  const attribution: string[] = [];
  if (sanitized.utm_source) attribution.push(`utm_source=${sanitized.utm_source}`);
  if (sanitized.utm_medium) attribution.push(`utm_medium=${sanitized.utm_medium}`);
  if (sanitized.utm_campaign) attribution.push(`utm_campaign=${sanitized.utm_campaign}`);
  if (sanitized.referrer) attribution.push(`referrer=${sanitized.referrer}`);

  if (attribution.length > 0) {
    lines.push('', '---', attribution.join('  |  '));
  }

  return lines.join('\n');
};
