import { adminUrl, buildEmailLayout, escapeHtml, strong } from './layout';

describe('buildEmailLayout', () => {
  it('제목과 행 값의 태그는 마크업이 되지 않는다', () => {
    const html = buildEmailLayout({
      heading: '<script>x</script>',
      rows: [{ label: '<b>이름</b>', value: '<img src=x onerror=1>' }],
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=1&gt;');
  });

  it('paragraphs·notices는 호출부 escape 규칙 — HTML을 그대로 둔다', () => {
    const html = buildEmailLayout({
      heading: 'h',
      paragraphs: [`안녕 ${strong('굵게')}`],
      notices: ['유효 <strong>7일</strong>'],
    });
    expect(html).toContain('<strong style="color: #1a1a1a;">굵게</strong>');
    expect(html).toContain('<strong>7일</strong>');
  });

  it('operator 변형은 운영 알림 칩과 한 줄 푸터를 쓴다', () => {
    const html = buildEmailLayout({ audience: 'operator', heading: 'h' });
    expect(html).toContain('운영 알림');
    expect(html).toContain('스튜디오 놀 · 발송 전용');
    expect(html).not.toContain('753-74-00653');
    expect(html).not.toContain('음악연습실 · 녹음 스튜디오');
  });

  it('customer 푸터에 주소·전화·사업자등록번호가 있다', () => {
    const html = buildEmailLayout({ heading: 'h' });
    expect(html).toContain('서울특별시 은평구 통일로71길 2-1');
    expect(html).toContain('010-4255-7893');
    expect(html).toContain('사업자등록번호 753-74-00653');
    expect(html).toContain('본 메일은 발송 전용입니다');
    expect(html).toContain('음악연습실 · 녹음 스튜디오');
  });

  it('cta가 있으면 버튼과 URL 평문 안내가 나온다(고객), 없으면 없다', () => {
    const url = 'https://studionol.co.kr/a?x=1&y=2';
    const withCta = buildEmailLayout({ heading: 'h', cta: { label: '열기', url } });
    expect(withCta).toContain('bgcolor="#6d28d9"');
    expect(withCta).toContain('href="https://studionol.co.kr/a?x=1&amp;y=2"');
    expect(withCta).toContain('버튼이 눌리지 않으면');
    expect(buildEmailLayout({ heading: 'h' })).not.toContain('bgcolor="#6d28d9"');
  });

  it('operator cta에는 주소 복사 안내를 붙이지 않는다', () => {
    const html = buildEmailLayout({
      audience: 'operator',
      heading: 'h',
      cta: { label: '관리자에서 보기', url: adminUrl('/admin/x') },
    });
    expect(html).toContain('관리자에서 보기');
    expect(html).not.toContain('버튼이 눌리지 않으면');
  });

  it('rows의 href가 있으면 값이 링크가 된다', () => {
    const html = buildEmailLayout({
      heading: 'h',
      rows: [
        { label: '메일', value: 'a@b.com', href: 'mailto:a@b.com' },
        { label: '이름', value: '홍길동' },
      ],
    });
    expect(html).toContain('<a href="mailto:a@b.com"');
    expect((html.match(/<a href="mailto/g) ?? []).length).toBe(1);
  });

  it('noticeTone: info는 앰버, alert는 붉은 계열', () => {
    const info = buildEmailLayout({ heading: 'h', notices: ['n'] });
    const alert = buildEmailLayout({ heading: 'h', notices: ['n'], noticeTone: 'alert' });
    expect(info).toContain('#fffbeb');
    expect(info).not.toContain('#fef2f2');
    expect(alert).toContain('#fef2f2');
    expect(alert).not.toContain('#fffbeb');
  });

  it('preheader는 숨은 텍스트로 들어가고 escape된다', () => {
    const html = buildEmailLayout({ heading: 'h', preheader: '요약 <b>' });
    expect(html).toContain('display: none');
    expect(html).toContain('요약 &lt;b&gt;');
    expect(buildEmailLayout({ heading: 'h' })).not.toContain('display: none');
  });

  it('로고에 alt가 있고 밝은 배색만 쓴다고 알린다', () => {
    const html = buildEmailLayout({ heading: 'h' });
    expect(html).toMatch(/email-logo\.png" width="140" height="36" alt="스튜디오 놀"/);
    expect(html).toContain('color-scheme" content="light only"');
  });
});

describe('helpers', () => {
  it('adminUrl은 슬래시를 정규화한다', () => {
    expect(adminUrl('/admin/a')).toMatch(/^https?:\/\/[^/]+\/admin\/a$/);
    expect(adminUrl('admin/a')).toBe(adminUrl('/admin/a'));
  });
  it('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#039;');
  });
});
