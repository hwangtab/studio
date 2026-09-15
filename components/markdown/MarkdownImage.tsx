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

/**
 * 마크다운 이미지의 `title` 자리에 숫자를 쓰면 그 폭(px)으로 제한한다 — `![알트](/x.webp "240")`.
 *
 * 본문 이미지는 기본이 전체 폭인데, 인물 사진처럼 정사각에 가까운 그림은 그러면 한 장이
 * 화면 하나를 차지해 글의 흐름을 끊는다. 실제로 출연자 다섯 명의 사진을 각자 소개 위에
 * 두려다 이 제약 때문에 한 장으로 합쳤던 적이 있다.
 *
 * 숫자가 아니면 평범한 title로 두고 폭은 건드리지 않는다.
 */
const parseWidthHint = (title?: string): number | null => {
  if (!title) return null;
  const n = Number(title.trim());
  return Number.isInteger(n) && n > 0 && n <= 1200 ? n : null;
};

export const MarkdownImage = ({
  alt,
  src,
  title,
}: {
  alt?: string;
  src?: string;
  title?: string;
} & React.ImgHTMLAttributes<HTMLImageElement>) => {
  if (!src) return null;

  const metadata = imageMetadataMap[src];
  const hasDimensions = metadata?.width && metadata?.height;
  const altText = getMarkdownImageAlt(src, alt);
  const widthHint = parseWidthHint(title);

  // markdown-to-jsx가 <img>를 <p> 내부에 배치하므로 래퍼는 유효한 inline 태그여야 한다.
  if (hasDimensions) {
    return (
      <span className="block my-6" style={widthHint ? { maxWidth: `${widthHint}px` } : undefined}>
        <Image
          src={src}
          alt={altText}
          width={Number(metadata.width)}
          height={Number(metadata.height)}
          sizes={widthHint ? `${widthHint}px` : '(max-width: 768px) 100vw, 768px'}
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
