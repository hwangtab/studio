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
  const [error, setError] = React.useState(false);
  const normalizedSrc = React.useMemo(() => normalizeSrc(src), [src]);

  React.useEffect(() => {
    setError(false);
  }, [normalizedSrc]);

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
            onError={() => setError(true)}
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
        onError={() => setError(true)}
        {...rest}
      />
    </div>
  );
});

ResponsiveImage.displayName = 'ResponsiveImage';

export default ResponsiveImage;
