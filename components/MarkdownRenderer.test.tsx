import React from 'react';
import { render, screen } from '@testing-library/react';
import MarkdownRenderer from './MarkdownRenderer';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt || ''} {...props} />,
}));

describe('MarkdownRenderer link protocol filtering', () => {
  it('renders allowed protocols and relative links', () => {
    render(<MarkdownRenderer locale="ko" content={'[Safe](https://example.com) [Local](/stories/story-1) [Mail](mailto:test@example.com)'} />);

    expect(screen.getByRole('link', { name: 'Safe' }).getAttribute('href')).toBe('https://example.com');
    expect(screen.getByRole('link', { name: 'Mail' }).getAttribute('href')).toBe('mailto:test@example.com');
    expect(screen.getByRole('link', { name: 'Local' }).getAttribute('href')).toBe('/ko/stories/story-1');
  });

  it('blocks dangerous protocols and keeps plain text', () => {
    render(<MarkdownRenderer locale="ko" content={'[JS](javascript:alert(1)) [Data](data:text/html;base64,abc) [VB](vbscript:msgbox(1))'} />);

    expect(screen.queryByRole('link', { name: 'JS' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Data' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'VB' })).toBeNull();
    expect(screen.getByText('JS')).toBeTruthy();
    expect(screen.getByText('Data')).toBeTruthy();
    expect(screen.getByText('VB')).toBeTruthy();
  });

  /**
   * markdown-to-jsx는 마크다운 링크를 override 컴포넌트로 넘길 때도 `className: undefined`를
   * 명시적으로 함께 보낸다(내부 tr() 헬퍼가 항상 이 키를 채운다). a 컴포넌트가 이 값을
   * `...props`에 묻어 둔 채 자기 className **뒤**에 펼치면, 이 undefined가 text-primary를
   * 덮어써 모든 마크다운 링크가 본문 글자와 같은 색(클릭 가능해 보이지 않는 상태)으로
   * 렌더된다. 2026-09-30에 실제로 이 상태로 배포돼 있었다.
   */
  it('외부·내부·tel 링크가 본문과 같은 색으로 뭉개지지 않는다', () => {
    render(
      <MarkdownRenderer
        locale="ko"
        content={'[외부](https://example.com) [내부](/pricing) [전화](tel:010-4255-7893)'}
      />
    );

    expect(screen.getByRole('link', { name: '외부' }).className).toContain('text-primary');
    expect(screen.getByRole('link', { name: '내부' }).className).toContain('text-primary');
    expect(screen.getByRole('link', { name: '전화' }).className).toContain('text-primary');
  });

});

describe('MarkdownRenderer funding-lineup 숏코드', () => {
  it('%%funding-lineup:id%%가 출연진 카드로 바뀐다', () => {
    render(<MarkdownRenderer locale="ko" content={'%%funding-lineup:mok-jareugi-yangchaae%%'} />);
    expect(screen.getByText('양차애')).toBeTruthy();
  });

  it('인자가 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<MarkdownRenderer locale="ko" content={'%%funding-lineup%%'} />);
    expect(container.querySelector('.markdown-content')?.textContent?.trim()).toBe('');
  });
});

/**
 * ko 전용 숏코드가 다른 locale에 새지 않는지.
 *
 * 일곱 숏코드는 카피가 한국어 하드코딩이고(locale은 링크·GA4에만 쓰인다),
 * vocal-mix-bridge·online-request는 카카오 옐로와 한국어 오픈채팅 직링크까지 낸다.
 * 언어 스위처는 번역 유무와 무관하게 전환하므로 비-ko 폴백 페이지에서 실제로 도달한다.
 * inline directive는 같은 이유로 이미 막혀 있었는데 숏코드 분기만 빠져 있었다.
 */
describe('MarkdownRenderer 숏코드 로케일 가드', () => {
  const SHORTCODES = [
    'session-checklist',
    'studio-more',
    'studio-services',
    'online-request',
    'online-fallback',
    'vocal-mix-bridge',
    'practice-room-terms',
  ];

  it.each(SHORTCODES)('%s는 ko에서 렌더된다', (name) => {
    const { container } = render(<MarkdownRenderer locale="ko" content={`%%${name}%%`} />);
    expect(container.textContent).not.toContain(`%%${name}%%`);
    expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it.each(SHORTCODES)('%s는 비-ko에서 렌더되지 않는다', (name) => {
    for (const locale of ['en', 'zh', 'es'] as const) {
      const { container } = render(<MarkdownRenderer locale={locale} content={`%%${name}%%`} />);
      // 원문 토큰이 그대로 보여서도 안 된다.
      expect(container.textContent).not.toContain(`%%${name}%%`);
      expect(container.textContent?.trim()).toBe('');
    }
  });

  // 펀딩 숏코드는 반대다 — 번역본이 있는 펀딩의 영문 화면에서 그대로 그려져야 한다(2026-10-08 회귀: ko 전용 가드 뒤에
  // 있어서 /en/funding 세 페이지의 출연진 카드·사진·미리듣기·영상이 통째로 빠졌다).
  it('펀딩 숏코드는 영문 화면에서도 영어로 렌더된다', () => {
    const { container } = render(
      <MarkdownRenderer
        locale="en"
        content={'%%funding-lineup:mok-jareugi-yangchaae%%\n\n%%funding-audio:sabbaha-kalpa%%\n\n%%funding-video:sabbaha-debt-shroud-live%%\n\n%%funding-gallery:keep-singing-for-palestine%%'}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).not.toContain('%%funding-');
    expect(text).toContain('Yang Cha-ae');
    expect(text).toContain('Preview');
    expect(text).toContain('Filmed by the Gyeonggi Art Collective');
    expect(container.querySelector('button[aria-label^="Enlarge: The 19 September street rally"]')).not.toBeNull();
    expect(text).not.toMatch(/미리듣기|사랑노래를/);
  });

  it('비-ko에서는 카카오 링크가 숏코드로 새지 않는다', () => {
    const { container } = render(
      <MarkdownRenderer locale="en" content={'%%vocal-mix-bridge%%\n\n%%online-request%%'} />,
    );
    expect(container.querySelector('a[href*="kakao"]')).toBeNull();
  });
});
