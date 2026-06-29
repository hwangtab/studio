import type { SanitizedContactPayload } from './payload';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildContactEmailHtml = (sanitized: SanitizedContactPayload): string => {
  const name = escapeHtml(sanitized.name);
  const email = escapeHtml(sanitized.email);
  const phone = escapeHtml(sanitized.phone);
  const message = escapeHtml(sanitized.message).replace(/\n/g, '<br>');

  const fieldRow = (label: string, value: string, link?: string) => `
        <tr>
          <td style="padding:6px 0 2px;font-size:11px;font-weight:600;letter-spacing:.06em;
                     text-transform:uppercase;color:#6b7280;">
            ${label}
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 18px;font-size:15px;color:#1f2937;">
            ${link ? `<a href="${link}" style="color:#6d28d9;text-decoration:none;">${value}</a>` : value}
          </td>
        </tr>`;

  const attributionLines: string[] = [];
  if (sanitized.utm_source) attributionLines.push(`utm_source: ${escapeHtml(sanitized.utm_source)}`);
  if (sanitized.utm_medium) attributionLines.push(`utm_medium: ${escapeHtml(sanitized.utm_medium)}`);
  if (sanitized.utm_campaign) attributionLines.push(`utm_campaign: ${escapeHtml(sanitized.utm_campaign)}`);
  if (sanitized.referrer) attributionLines.push(`referrer: ${escapeHtml(sanitized.referrer)}`);

  const attributionBlock = attributionLines.length > 0 ? `
        <tr>
          <td style="padding:18px 0 0;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
              ${attributionLines.join(' &nbsp;·&nbsp; ')}
            </p>
          </td>
        </tr>` : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">

  <!-- 프리헤더 (받은편지함 미리보기) -->
  <div style="display:none;max-height:0;overflow:hidden;color:#f9fafb;">
    ${name}님의 새 문의가 도착했습니다.&nbsp;‌&zwnj;​&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#ffffff;
                      border-radius:12px;border:1px solid #e5e7eb;
                      overflow:hidden;">

          <!-- 헤더 -->
          <tr>
            <td bgcolor="#6d28d9"
                style="background-image:linear-gradient(135deg,#6d28d9 0%,#be185d 100%);
                       padding:36px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;
                        letter-spacing:-.01em;">
                스튜디오 놀
              </p>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,.8);letter-spacing:.02em;">
                새 문의가 도착했습니다
              </p>
            </td>
          </tr>

          <!-- 본문 -->
          <tr>
            <td style="padding:32px 32px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${fieldRow('이름', name)}
                ${fieldRow('이메일', email, `mailto:${encodeURIComponent(sanitized.email)}`)}
                ${fieldRow('전화', phone, `tel:${encodeURIComponent(sanitized.phone)}`)}
                <tr>
                  <td style="padding:6px 0 8px;font-size:11px;font-weight:600;letter-spacing:.06em;
                             text-transform:uppercase;color:#6b7280;">
                    메시지
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 8px;">
                    <div style="background:#f9fafb;border-left:3px solid #6d28d9;
                                border-radius:6px;padding:16px 18px;
                                font-size:15px;line-height:1.7;color:#1f2937;
                                white-space:pre-wrap;word-break:break-word;">
                      ${message}
                    </div>
                  </td>
                </tr>
                ${attributionBlock}
              </table>
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;
                       padding:20px 32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;line-height:1.6;">
                <strong style="color:#6b7280;">스튜디오 놀</strong>
                &nbsp;·&nbsp; 서울특별시 은평구 대조동 84-3 3층
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                <a href="tel:01042557893" style="color:#9ca3af;text-decoration:none;">
                  010-4255-7893
                </a>
                &nbsp;·&nbsp;
                <a href="https://studionol.co.kr" style="color:#6d28d9;text-decoration:none;">
                  studionol.co.kr
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
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
