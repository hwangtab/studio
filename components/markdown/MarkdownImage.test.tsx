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

/**
 * 업로드 이미지(펀딩 개설자 등)는 utils/imageMetadata.json에 없다 — 그 파일은 저장소의
 * 정적 이미지만 안다. 주소 쿼리(?w=·?h=)로 치수를 실어 보내면 16:9 fill 폴백 대신 실제
 * 치수로 렌더한다.
 */
describe('MarkdownImage 치수 힌트', () => {
  it('src의 w·h 쿼리를 치수로 쓴다', () => {
    render(<MarkdownImage src="/api/funding/media/a.webp?w=800&h=1200" alt="포스터" />);
    const img = screen.getByAltText('포스터');
    expect(img).toHaveAttribute('width', '800');
    expect(img).toHaveAttribute('height', '1200');
  });

  it('치수가 양의 정수가 아니면 무시한다', () => {
    render(<MarkdownImage src="/api/funding/media/b.webp?w=0&h=-5" alt="이상한값" />);
    expect(screen.getByAltText('이상한값')).toHaveAttribute('data-fill', 'true');
  });

  it('치수 쿼리가 없으면 기존 폴백 그대로다', () => {
    render(<MarkdownImage src="/api/funding/media/c.webp" alt="무치수" />);
    expect(screen.getByAltText('무치수')).toHaveAttribute('data-fill', 'true');
  });

  it('로컬 메타데이터가 있으면 그쪽이 이긴다', () => {
    // utils/imageMetadata.json에 실제로 있는 /images/album1.jpg(512x512)로 확인한다.
    // 쿼리 힌트가 기존 동작을 덮어쓰면 안 된다 — 스토리 1,000편이 그 경로로 렌더된다.
    render(<MarkdownImage src="/images/album1.jpg?w=800&h=1200" alt="앨범아트" />);
    const img = screen.getByAltText('앨범아트');
    expect(img).toHaveAttribute('width', '512');
    expect(img).toHaveAttribute('height', '512');
  });
});
