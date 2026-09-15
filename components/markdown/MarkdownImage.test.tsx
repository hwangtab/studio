import React from 'react';
import { render, screen } from '@testing-library/react';
import { MarkdownImage, getMarkdownImageAlt } from './MarkdownImage';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    alt,
    fill,
    width,
    height,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    width?: number;
    height?: number;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt || ''}
      data-fill={fill ? 'true' : 'false'}
      width={width}
      height={height}
      {...props}
    />
  ),
}));

describe('getMarkdownImageAlt', () => {
  it('uses explicit non-empty alt text first', () => {
    expect(getMarkdownImageAlt('/images/album1.jpg', ' Album cover ')).toBe(' Album cover ');
  });

  it('falls back to a readable file name', () => {
    expect(getMarkdownImageAlt('/images/my-cover_photo.webp')).toBe('my cover photo');
  });
});

describe('MarkdownImage', () => {
  it('renders known images with metadata dimensions', () => {
    render(<MarkdownImage src="/images/album1.jpg" alt="Album" />);

    const image = screen.getByRole('img', { name: 'Album' });
    expect(image.getAttribute('width')).toBe('512');
    expect(image.getAttribute('height')).toBe('512');
    expect(image.getAttribute('data-fill')).toBe('false');
  });

  it('uses fill layout for images without metadata', () => {
    render(<MarkdownImage src="/images/not-in-metadata.webp" />);

    const image = screen.getByRole('img', { name: 'not in metadata' });
    expect(image.getAttribute('data-fill')).toBe('true');
  });
});

/**
 * 본문 이미지는 기본이 전체 폭이다. 인물 사진처럼 정사각에 가까운 그림은 그러면 한 장이
 * 화면을 다 먹어 글의 흐름을 끊는다. 마크다운 표준 문법인 title 자리에 숫자를 써서
 * 폭(px)을 제한할 수 있게 했다 — `![알트](/x.webp "240")`.
 */
describe('title로 폭 제한', () => {
  it('숫자 title이면 그 폭으로 제한한다', () => {
    const { container } = render(<MarkdownImage src="/images/album1.webp" alt="a" title="240" />);
    const wrapper = container.querySelector('span.block');
    expect((wrapper as HTMLElement).style.maxWidth).toBe('240px');
  });

  it('숫자가 아니면 폭을 건드리지 않는다', () => {
    const { container } = render(<MarkdownImage src="/images/album1.webp" alt="a" title="앨범 표지" />);
    const wrapper = container.querySelector('span.block');
    expect((wrapper as HTMLElement).style.maxWidth).toBe('');
  });

  it('title이 없으면 폭을 건드리지 않는다', () => {
    const { container } = render(<MarkdownImage src="/images/album1.webp" alt="a" />);
    const wrapper = container.querySelector('span.block');
    expect((wrapper as HTMLElement).style.maxWidth).toBe('');
  });

  it('터무니없는 값은 무시한다 — 0·음수·상한 초과', () => {
    for (const bad of ['0', '-10', '5000', '12.5']) {
      const { container } = render(<MarkdownImage src="/images/album1.webp" alt="a" title={bad} />);
      expect((container.querySelector('span.block') as HTMLElement).style.maxWidth).toBe('');
    }
  });
});
