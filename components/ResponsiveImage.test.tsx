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

/**
 * 폴백 상태는 "실패했다"는 boolean이 아니라 "무엇이 실패했는지"로 들고 있다.
 * boolean + useEffect 초기화 방식은 새 src로 한 번 렌더된 뒤에야 초기화되는
 * 한 프레임이 생기고, 이미지가 많은 화면에서 인스턴스마다 effect가 큐잉된다.
 */
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

  it('실패했던 src로 돌아오면 곧바로 폴백을 보여 준다 (깜빡임 없음)', async () => {
    const { rerender } = render(<ResponsiveImage src="/images/broken.webp" alt="sample" fill />);

    fireEvent.error(screen.getByAltText('sample'));
    await waitFor(() => {
      expect(screen.getByAltText('sample').getAttribute('src')).toContain('/logo512.png');
    });

    rerender(<ResponsiveImage src="/images/ok.webp" alt="sample" fill />);
    await waitFor(() => {
      expect(screen.getByAltText('sample').getAttribute('src')).toContain('/images/ok.webp');
    });

    // 다시 깨진 주소로. 예전 방식이면 원본을 한 번 시도한 뒤 다시 실패해야 폴백이 떴다.
    rerender(<ResponsiveImage src="/images/broken.webp" alt="sample" fill />);
    await waitFor(() => {
      expect(screen.getByAltText('sample').getAttribute('src')).toContain('/logo512.png');
    });
  });

  it('치수를 주면 fill이 아닌 경로에서도 폴백이 동작한다', async () => {
    render(<ResponsiveImage src="/images/broken.webp" alt="fixed" width={320} height={240} />);

    fireEvent.error(screen.getByAltText('fixed'));
    await waitFor(() => {
      expect(screen.getByAltText('fixed').getAttribute('src')).toContain('/logo512.png');
    });
  });

  it('src가 비어 있으면 아무것도 그리지 않는다', () => {
    const { container } = render(<ResponsiveImage src="" alt="empty" fill />);
    expect(container).toBeEmptyDOMElement();
  });
});
