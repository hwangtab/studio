import React from 'react';
import Image from 'next/image';

const normalizeSrc = (src = '') => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('/')) return src;
  return `/${src.replace(/^\/+/g, '')}`;
};

interface ResponsiveImageProps {
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
  [key: string]: any;
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

  if (!normalizedSrc) return null;

  const hasDimensions = Number.isFinite(width) && Number.isFinite(height);
  const useFill = Boolean(fill);
  const wrapperClass = pictureClassName || containerClassName;

  const fallbackSrc = '/logo512.png';

  if (useFill) {
    return (
      <div className={wrapperClass}>
        <div className={`relative w-full h-full ${error ? 'p-8 bg-gray-50 dark:bg-gray-800 flex items-center justify-center' : ''}`}>
          <picture className="block w-full h-full">
            <source srcSet={normalizedSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp')} type="image/webp" />
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
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <picture className="block w-full h-full">
        <source srcSet={normalizedSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp')} type="image/webp" />
        <Image
          src={error ? fallbackSrc : normalizedSrc}
          alt={alt}
          className={`${className} ${error ? 'object-contain opacity-50 bg-gray-50 dark:bg-gray-800 p-2' : ''}`}
          sizes={sizes}
          priority={priority}
          width={width!}
          height={height!}
          onError={() => setError(true)}
          {...rest}
        />
      </picture>
    </div>
  );
};

export default ResponsiveImage;
