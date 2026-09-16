import imageMetadata from '../../utils/imageMetadata.json';

const metadata = imageMetadata as Record<string, { width: number; height: number }>;

/**
 * 이미지의 **실제 비율**을 CSS `aspect-ratio` 값으로 돌려준다.
 *
 * 리워드 썸네일을 16:9 틀에 `object-cover`로 넣던 시절의 문제: 이 프로젝트의 리워드는
 * 정사각 앨범 표지인데, 16:9로 자르면 위아래가 잘려 나가 그림이 무엇인지 알 수 없게 된다.
 * 틀을 고정하는 대신 **그림의 비율을 그대로 쓴다** — saf-2026의 리워드 카드도 같은 판단이다.
 *
 * 메타데이터에 없는 이미지는 `null`을 돌려주고, 호출부가 예전처럼 고정 비율로 떨어진다.
 */
export const imageAspectRatio = (src: string | null | undefined): string | null => {
  if (!src) return null;
  const m = metadata[src];
  if (!m?.width || !m?.height) return null;
  return `${m.width} / ${m.height}`;
};
