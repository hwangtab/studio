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
  ...rest
}: ResponsiveImageProps) => {
  const [error, setError] = React.useState(false);
  const normalizedSrc = React.useMemo(() => normalizeSrc(src), [src]);

  const isExternal = React.useMemo(() => normalizedSrc.startsWith('http'), [normalizedSrc]);
  // Only use webp source for local images (jpg/png will be converted to webp)
  const showWebpSource = React.useMemo(() => !isExternal && /\.(jpg|jpeg|png)$/i.test(normalizedSrc), [isExternal, normalizedSrc]);

  const webpSrc = React.useMemo(() => {
    if (!showWebpSource) return null;
    return normalizedSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }, [normalizedSrc, showWebpSource]);

  if (!normalizedSrc) return null;

  const hasDimensions = typeof width === 'number' && typeof height === 'number';
  const useFill = Boolean(fill) || !hasDimensions;
  const wrapperClass = pictureClassName || containerClassName;

  const fallbackSrc = '/logo512.png';

  // If already webp/avif, use it directly without picture wrapper
  const isModernFormat = /\.(webp|avif)$/i.test(normalizedSrc);

  if (useFill) {
    return (
      <div className={wrapperClass}>
        <div className={`relative w-full h-full ${error ? 'p-8 bg-gray-50 dark:bg-gray-800 flex items-center justify-center' : ''}`}>
          {isModernFormat ? (
            <Image
              src={error ? fallbackSrc : normalizedSrc}
              alt={alt}
              className={`${className} ${error ? 'object-contain opacity-50' : ''}`}
              sizes={sizes}
              priority={priority}
              fill
              onError={() => setError(true)}
              {...rest}
            />
          ) : (
            <picture className="block w-full h-full">
              {webpSrc && (
                <source srcSet={webpSrc} type="image/webp" />
              )}
              <Image
                src={error ? fallbackSrc : normalizedSrc}
                alt={alt}
                className={`${className} ${error ? 'object-contain opacity-50' : ''}`}
                sizes={sizes}
                priority={priority}
                fill
                onError={() => setError(true)}
                {...rest}
              />
            </picture>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {isModernFormat ? (
        <Image
          src={error ? fallbackSrc : normalizedSrc}
          alt={alt}
          className={`${className} ${error ? 'object-contain opacity-50 bg-gray-50 dark:bg-gray-800 p-2' : ''}`}
          sizes={sizes}
          priority={priority}
          width={width || 300}
          height={height || 300}
          onError={() => setError(true)}
          {...rest}
        />
      ) : (
        <picture className="block w-full h-full">
          {webpSrc && (
            <source srcSet={webpSrc} type="image/webp" />
          )}
          <Image
            src={error ? fallbackSrc : normalizedSrc}
            alt={alt}
            className={`${className} ${error ? 'object-contain opacity-50 bg-gray-50 dark:bg-gray-800 p-2' : ''}`}
            sizes={sizes}
            priority={priority}
            width={width || 300}
            height={height || 300}
            onError={() => setError(true)}
            {...rest}
          />
        </picture>
      )}
    </div>
  );
});

ResponsiveImage.displayName = 'ResponsiveImage';

export default ResponsiveImage;
