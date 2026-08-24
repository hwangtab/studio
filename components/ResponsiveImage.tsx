import React from 'react';
import Image from 'next/image';

const normalizeSrc = (src = '') => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('/')) return src;
  return `/${src.replace(/^\/+/g, '')}`;
};

interface ResponsiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  pictureClassName?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  /** next/image quality (1-100). 미지정 시 75 (Next.js default). */
  quality?: number;
}

const ResponsiveImage = React.memo(({
  src,
  alt,
  className = '',
  containerClassName = 'relative block w-full h-full',
  pictureClassName,
  fill = false,
  width,
  height,
  sizes = '100vw',
  priority = false,
  loading,
  quality,
  ...rest
}: ResponsiveImageProps) => {
  const normalizedSrc = React.useMemo(() => normalizeSrc(src), [src]);

  /**
   * 실패한 src 자체를 들고 있는다.
   *
   * 예전에는 boolean 하나를 두고 src가 바뀔 때마다 useEffect로 되돌렸다. 그러면
   * 이미지가 많은 화면(스토리 카드 그리드 등)에서 인스턴스마다 effect가 큐잉되고,
   * 무엇보다 "새 src로 한 번 렌더된 뒤에야 초기화되는" 한 프레임이 생긴다.
   * 실패한 주소를 저장해 두면 현재 src와 비교만 하면 되므로 effect가 필요 없다.
   */
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const error = failedSrc !== null && failedSrc === normalizedSrc;

  if (!normalizedSrc) return null;

  const hasDimensions = typeof width === 'number' && typeof height === 'number';
  const useFill = Boolean(fill) || !hasDimensions;
  const wrapperClass = pictureClassName || containerClassName;

  const fallbackSrc = '/logo512.png';

  if (useFill) {
    return (
      <div className={wrapperClass}>
        <div className={`relative w-full h-full ${error ? 'p-8 bg-gray-50 dark:bg-gray-800 flex items-center justify-center' : ''}`}>
          <Image
            src={error ? fallbackSrc : normalizedSrc}
            alt={alt}
            className={`${className} ${error ? 'object-contain opacity-50' : ''}`}
            sizes={sizes}
            priority={priority}
            fill
            loading={loading}
            quality={quality}
            onError={() => setFailedSrc(normalizedSrc)}
            {...rest}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <Image
        src={error ? fallbackSrc : normalizedSrc}
        alt={alt}
        className={`${className} ${error ? 'object-contain opacity-50 bg-gray-50 dark:bg-gray-800 p-2' : ''}`}
        sizes={sizes}
        priority={priority}
        width={width || 300}
        height={height || 300}
        loading={loading}
        quality={quality}
        onError={() => setFailedSrc(normalizedSrc)}
        {...rest}
      />
    </div>
  );
});

ResponsiveImage.displayName = 'ResponsiveImage';

export default ResponsiveImage;
