import Image from 'next/image';
import React from 'react';

import { ALLOWED_REMOTE_IMAGE_HOSTS } from '../../lib/markdown/allowedRemoteImageHosts';
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
 * 치수 힌트 상한. 실제 업로드 이미지의 가로 상한은 1600px(대표 이미지는 1200px)이라
 * 정상 값은 여기 한참 못 미친다 — `parseWidthHint`가 title에 `<= 1200` 상한을 두는 것과
 * 같은 이유로, 주소를 손으로 조작해 극단적인 width/height를 넣는 경우를 막는다.
 */
const MAX_DIMENSION_HINT = 10_000;

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
  if (!Number.isInteger(w) || w <= 0 || w > MAX_DIMENSION_HINT) return null;
  if (!Number.isInteger(h) || h <= 0 || h > MAX_DIMENSION_HINT) return null;
  return { width: w, height: h };
};

/**
 * `next/image`에 넘겨도 안전한 주소인지 본다.
 *
 * `/`로 시작하는 경로는 우리 도메인이라 항상 안전하다. 절대 URL은 `next.config.mjs`의
 * `images.remotePatterns`에 등록된 호스트일 때만 안전하다 — 등록되지 않은 호스트를
 * `next/image`에 넘기면 렌더 중간에 throw한다.
 *
 * 펀딩 개설자가 본문 마크다운에 `![](https://외부/x.jpg)`처럼 등록 안 된 호스트를 붙여
 * 넣을 수 있는 경로가 생겼다. 저장 시점에 막기엔 마크다운 본문이라 과하므로(사진 한 장
 * 때문에 저장 자체가 막히면 나머지 본문도 못 지킨다), 여기 렌더 쪽에서 등록 안 된 호스트만
 * 골라 평범한 `<img>`로 강등한다 — 스토리 1,000편이 쓰는 로컬 이미지·등록된 호스트 경로는
 * 이 함수를 그대로 통과해 지금까지의 `next/image` 동작이 하나도 바뀌지 않는다.
 */
const isSafeForNextImage = (src: string): boolean => {
  if (src.startsWith('/')) return true;
  try {
    return ALLOWED_REMOTE_IMAGE_HOSTS.includes(new URL(src).hostname);
  } catch {
    return false;
  }
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
  const useNextImage = isSafeForNextImage(src);

  // markdown-to-jsx가 <img>를 <p> 내부에 배치하므로 래퍼는 유효한 inline 태그여야 한다.
  if (hasDimensions) {
    return (
      <span className="block my-6" style={widthHint ? { maxWidth: `${widthHint}px` } : undefined}>
        {useNextImage ? (
          <Image
            src={src}
            alt={altText}
            width={Number(metadata.width)}
            height={Number(metadata.height)}
            sizes={widthHint ? `${widthHint}px` : '(max-width: 768px) 100vw, 768px'}
            className="w-full h-auto rounded-lg shadow-md"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- 등록 안 된 원격 호스트라 next/image가 렌더 중 throw한다.
          <img
            src={src}
            alt={altText}
            width={Number(metadata.width)}
            height={Number(metadata.height)}
            loading="lazy"
            decoding="async"
            className="w-full h-auto rounded-lg shadow-md"
          />
        )}
      </span>
    );
  }

  return (
    <span className="block my-6">
      <span className="relative w-full overflow-hidden rounded-lg shadow-md block" style={{ aspectRatio: '16 / 9' }}>
        {useNextImage ? (
          <Image
            src={src}
            alt={altText}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- 등록 안 된 원격 호스트라 next/image가 렌더 중 throw한다.
          <img
            src={src}
            alt={altText}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
      </span>
    </span>
  );
};
