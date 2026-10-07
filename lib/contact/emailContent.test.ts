import { buildContactEmailBody, buildContactEmailHtml } from './emailContent';
import type { SanitizedContactPayload } from './payload';

const payload = (over: Partial<SanitizedContactPayload> = {}): SanitizedContactPayload => ({
  name: '김문의',
  email: 'asker@example.org',
  phone: '010-1234-5678',
  message: '첫 줄입니다.\n둘째 줄입니다.',
  ...over,
});

describe('buildContactEmailHtml', () => {
  it('공용 레이아웃(운영 알림)이고 이름·이메일·전화 행에 mailto:/tel: 링크가 있다', () => {
    const html = buildContactEmailHtml(payload());
    expect(html).toContain('운영 알림');
    expect(html).not.toContain('linear-gradient');
    expect(html).toContain('href="mailto:asker@example.org"');
    expect(html).toContain('href="tel:01012345678"');
    expect(html).toContain('김문의');
  });

  it('메시지는 줄바꿈을 보존한다', () => {
    const html = buildContactEmailHtml(payload());
    expect(html).toContain('첫 줄입니다.<br />둘째 줄입니다.');
  });

  it('사용자가 쓴 값은 전부 escape된다 — 이름·메시지·유입 출처의 태그가 마크업이 되지 않는다', () => {
    const html = buildContactEmailHtml(
      payload({
        name: '<img src=x onerror=1>',
        message: '<script>alert(1)</script>\n"따옴표" & \'작은\'',
        utm_source: '<b>x</b>',
        referrer: 'https://a.test/?q=1&r="2"',
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br />&quot;따옴표&quot; &amp; &#039;작은&#039;');
    expect(html).toContain('&lt;img src=x onerror=1&gt;');
    expect(html).toContain('utm_source: &lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('q=1&amp;r=&quot;2&quot;');
  });

  it('유입 출처가 없으면 그 줄이 없다', () => {
    expect(buildContactEmailHtml(payload())).not.toContain('유입 출처');
    expect(buildContactEmailHtml(payload({ utm_medium: 'cpc' }))).toContain('유입 출처 · utm_medium: cpc');
  });

  it('text 본문은 그대로다', () => {
    expect(buildContactEmailBody(payload())).toContain('이름: 김문의');
  });
});
