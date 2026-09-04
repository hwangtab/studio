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

  it('비-ko에서는 카카오 링크가 숏코드로 새지 않는다', () => {
    const { container } = render(
      <MarkdownRenderer locale="en" content={'%%vocal-mix-bridge%%\n\n%%online-request%%'} />,
    );
    expect(container.querySelector('a[href*="kakao"]')).toBeNull();
  });
});
