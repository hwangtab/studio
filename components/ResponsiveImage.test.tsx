import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ResponsiveImage from './ResponsiveImage';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill: _fill, priority: _priority, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt || ''} {...props} />
  ),
}));

describe('ResponsiveImage', () => {
  it('resets fallback error state when src changes', async () => {
    const { rerender } = render(
      <ResponsiveImage
        src="/images/broken.webp"
        alt="sample"
        fill
      />
    );

    fireEvent.error(screen.getByAltText('sample'));

    await waitFor(() => {
      const fallbackImage = screen.getByAltText('sample') as HTMLImageElement;
      expect(fallbackImage.getAttribute('src')).toContain('/logo512.png');
    });

    rerender(
      <ResponsiveImage
        src="/images/recovered.webp"
        alt="sample"
        fill
      />
    );

    await waitFor(() => {
      const recoveredImage = screen.getByAltText('sample') as HTMLImageElement;
      expect(recoveredImage.getAttribute('src')).toContain('/images/recovered.webp');
    });
  });
});
