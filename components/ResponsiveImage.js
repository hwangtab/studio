import Image from 'next/image';

const normalizeSrc = (src = '') => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('/')) return src;
  return `/${src.replace(/^\/+/g, '')}`;
};

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
}) => {
  const normalizedSrc = normalizeSrc(src);
  if (!normalizedSrc) return null;

  const hasDimensions = Number.isFinite(width) && Number.isFinite(height);
  const useFill = Boolean(fill);
  const wrapperClass = pictureClassName || containerClassName;

  if (!useFill && !hasDimensions) {
    return (
      <div className={wrapperClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normalizedSrc}
          alt={alt}
          className={className}
          loading="lazy"
          {...rest}
        />
      </div>
    );
  }

  if (useFill) {
    return (
      <div className={wrapperClass}>
        <div className="relative w-full h-full">
          <Image
            src={normalizedSrc}
            alt={alt}
            className={className}
            sizes={sizes}
            priority={priority}
            fill
            {...rest}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <Image
        src={normalizedSrc}
        alt={alt}
        className={className}
        sizes={sizes}
        priority={priority}
        width={width}
        height={height}
        {...rest}
      />
    </div>
  );
};

export default ResponsiveImage;
