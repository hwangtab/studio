import Image from 'next/image';
import React from 'react';
import imageMetadata from '../../utils/imageMetadata.json';

const imageMetadataMap = imageMetadata as Record<string, { width: number; height: number }>;

export const getMarkdownImageAlt = (src: string, alt?: string): string => {
  if (typeof alt === 'string' && alt.trim().length > 0) {
    return alt;
  }
  return src.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || '';
};

export const MarkdownImage = ({
  alt,
  src,
}: {
  alt?: string;
  src?: string;
} & React.ImgHTMLAttributes<HTMLImageElement>) => {
  if (!src) return null;

  const metadata = imageMetadataMap[src];
  const hasDimensions = metadata?.width && metadata?.height;
  const altText = getMarkdownImageAlt(src, alt);

  // markdown-to-jsx가 <img>를 <p> 내부에 배치하므로 래퍼는 유효한 inline 태그여야 한다.
  if (hasDimensions) {
    return (
      <span className="block my-6">
        <Image
          src={src}
          alt={altText}
          width={Number(metadata.width)}
          height={Number(metadata.height)}
          sizes="(max-width: 768px) 100vw, 768px"
          className="w-full h-auto rounded-lg shadow-md"
        />
      </span>
    );
  }

  return (
    <span className="block my-6">
      <span className="relative w-full overflow-hidden rounded-lg shadow-md block" style={{ aspectRatio: '16 / 9' }}>
        <Image
          src={src}
          alt={altText}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-contain"
        />
      </span>
    </span>
  );
};
