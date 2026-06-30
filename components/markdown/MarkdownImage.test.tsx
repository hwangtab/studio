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
