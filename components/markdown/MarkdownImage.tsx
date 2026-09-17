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

/**
 * 주소 쿼리(`?w=`·`?h=`)로 실린 치수 힌트를 읽는다.
 *
 * 업로드 이미지(펀딩 개설자 등)는 `utils/imageMetadata.json`에 없다 — 그 파일은 저장소의
 * 정적 이미지만 안다. 쿼리 힌트가 없거나 값이 이상하면 기존 16:9 fill 폴백으로 떨어진다.
 */
const parseDimensionQueryHint = (src: string): { width: number; height: number } | null => {
  let url: URL;
  try {
    url = new URL(src, 'https://placeholder.invalid');
  } catch {
    return null;
  }
  const w = Number(url.searchParams.get('w'));
  const h = Number(url.searchParams.get('h'));
  if (!Number.isInteger(w) || w <= 0 || !Number.isInteger(h) || h <= 0) return null;
  return { width: w, height: h };
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

  // 로컬 메타데이터가 있으면 그쪽이 이긴다 — 스토리 1,000편이 그 경로로 렌더되므로
  // 쿼리 힌트가 기존 동작을 덮어쓰면 안 된다. 메타데이터 키는 쿼리가 없는 경로이므로
  // 조회 전에 쿼리를 떼어 낸다.
  const metadata = imageMetadataMap[src.split('?')[0]] ?? parseDimensionQueryHint(src);
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
