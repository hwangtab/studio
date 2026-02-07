import React from 'react';
import Image from 'next/image';

const normalizeSrc = (src = '') => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('/')) return src;
  return `/${src.replace(/^\/+/g, '')}`;
};

// Convert jpg/png paths to webp for local images
const toWebpSrc = (src: string) => {
  if (src.startsWith('http')) return src;
  if (/\.(webp|avif)$/i.test(src)) return src;
  return src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
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

  // Use webp version for local images (they exist alongside originals)
  const imageSrc = error ? fallbackSrc : toWebpSrc(normalizedSrc);

  return (
    <div className={wrapperClass}>
      <div className={`relative w-full h-full ${error ? 'p-8 flex items-center justify-center bg-gray-50 dark:bg-gray-800' : ''}`}>
        <Image
          src={imageSrc}
          alt={alt}
          className={`${className} ${error ? 'object-contain opacity-50' : ''}`}
          sizes={sizes}
          priority={priority}
          fill={useFill}
          width={!useFill ? (width || 300) : undefined}
          height={!useFill ? (height || 300) : undefined}
          onError={() => setError(true)}
          {...rest}
        />
      </div>
    </div>
  );
};

export default ResponsiveImage;
