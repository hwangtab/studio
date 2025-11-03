import React from 'react';
import { DEFAULT_IMAGE_WIDTHS, getOptimizedImageSources } from '../utils/imageUtils';

const ResponsiveImage = ({
  src,
  alt,
  widths = DEFAULT_IMAGE_WIDTHS,
  sizes = '100vw',
  className,
  pictureClassName,
  loading = 'lazy',
  decoding = 'async',
  ...imgProps
}) => {
  const { src: fallbackSrc, webpSrcSet, fallbackSrcSet, fallbackType, hasOptimized } =
    getOptimizedImageSources(src, widths);

  if (!fallbackSrc) {
    return null;
  }

  return (
    <picture className={pictureClassName}>
      {hasOptimized && webpSrcSet && (
        <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
      )}
      {hasOptimized && fallbackSrcSet && (
        <source type={fallbackType} srcSet={fallbackSrcSet} sizes={sizes} />
      )}
      <img
        src={fallbackSrc}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
        {...imgProps}
      />
    </picture>
  );
};

export default ResponsiveImage;
