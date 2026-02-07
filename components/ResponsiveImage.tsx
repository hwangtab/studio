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

const ResponsiveImage = ({
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
  const normalizedSrc = normalizeSrc(src);

  // Reset error state when src changes
  React.useEffect(() => {
    setError(false);
  }, [src]);

  if (!normalizedSrc) return null;

  const hasDimensions = typeof width === 'number' && typeof height === 'number';
  const useFill = Boolean(fill) || !hasDimensions;
  const wrapperClass = pictureClassName || containerClassName;

  const fallbackSrc = '/logo512.png';

  const isExternal = normalizedSrc.startsWith('http');
  // Only use webp source for local images (jpg/png will be converted to webp)
  const showWebpSource = !isExternal && /\.(jpg|jpeg|png)$/i.test(normalizedSrc);
  const webpSrc = showWebpSource ? normalizedSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp') : null;

  const renderImage = (isFill: boolean) => (
    <Image
      src={error ? fallbackSrc : normalizedSrc}
      alt={alt}
      className={`${className} ${error ? 'object-contain opacity-50 bg-gray-50 dark:bg-gray-800 p-2' : ''}`}
      sizes={sizes}
      priority={priority}
      fill={isFill}
      width={!isFill ? (width || 300) : undefined}
      height={!isFill ? (height || 300) : undefined}
      onError={() => setError(true)}
      {...rest}
    />
  );

  return (
    <div className={wrapperClass}>
      <div className={`relative w-full h-full ${error ? 'p-8 flex items-center justify-center' : ''}`}>
        {webpSrc && !error ? (
          <picture className="block w-full h-full">
            <source srcSet={webpSrc} type="image/webp" />
            {renderImage(useFill)}
          </picture>
        ) : (
          renderImage(useFill)
        )}
      </div>
    </div>
  );
};

export default ResponsiveImage;
