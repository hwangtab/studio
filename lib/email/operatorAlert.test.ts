import { buildOperatorAlertHtml, escapeMultiline, formatKst, VERCEL_PROJECT_URL } from './operatorAlert';

describe('buildOperatorAlertHtml', () => {
  it('크론 이름·KST 시각·핵심 값과 Vercel 로그 버튼을 싣는다', () => {
    const html = buildOperatorAlertHtml({
      title: '정기결제 청구 작업이 실행되지 못했습니다',
      cron: 'cron/billing-charge',
      rows: [{ label: '실패', value: '3건' }],
      now: new Date('2026-10-07T00:00:00Z'),
    });
    expect(html).toContain('cron/billing-charge');
    expect(html).toContain('2026. 10. 7.');
    expect(html).toContain('(KST)');
    expect(html).toContain('3건');
    expect(html).toContain('Vercel 로그 보기');
    expect(html).toContain(VERCEL_PROJECT_URL);
    expect(html).toContain('운영 알림 · 긴급');
  });

  it('사유 원문과 요약은 escape하고 줄바꿈만 살린다', () => {
    const html = buildOperatorAlertHtml({
      title: 't',
      cron: 'c',
      summary: '<b>요약</b>',
      reason: '<script>alert(1)</script>\n두 번째 줄',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<b>요약</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br />두 번째 줄');
  });

  it('사용자 지정 버튼과 info 톤을 쓸 수 있다', () => {
    const html = buildOperatorAlertHtml({
      title: 'SEO 리포트',
      cron: 'cron/gsc-audit',
      tone: 'info',
      preformatted: 'a <i>b</i>\n  c',
      ctaLabel: '열기',
      ctaUrl: 'https://example.com/x?a=1&b=2',
    });
    expect(html).toContain('white-space: pre-wrap');
    expect(html).toContain('a &lt;i&gt;b&lt;/i&gt;\n  c');
    expect(html).toContain('https://example.com/x?a=1&amp;b=2');
    expect(html).not.toContain('운영 알림 · 긴급');
  });

  it('formatKst·escapeMultiline', () => {
    expect(formatKst(new Date('2026-10-07T15:30:00Z'))).toContain('2026. 10. 8.');
    expect(escapeMultiline('a&b\r\nc')).toBe('a&amp;b<br />c');
  });
});
