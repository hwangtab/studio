import sharp from 'sharp';

export const UPLOAD_LIMITS = {
  /** 장당 8MB. 휴대폰 사진 한 장이 넉넉히 들어온다. */
  maxBytes: 8 * 1024 * 1024,
  /** 재인코딩 후 가로 상한. 본문 폭이 768px이라 2배수면 충분하다. */
  maxWidth: 1600,
  /** 프로젝트당 누적 장수. */
  maxPerProject: 30,
} as const;

/** 대표 이미지는 목록 카드·OG가 함께 쓰는 16:9다(lib/funding/imageAspect.ts와 같은 전제). */
const COVER_SIZE = { width: 1200, height: 675 } as const;

/**
 * 받은 바이트를 **다시 인코딩해서** 저장한다.
 *
 * 원본을 그대로 두지 않는 이유가 둘이다. 하나, sharp가 디코드하지 못하면 그림이 아니므로
 * 여기서 던진다 — 확장자나 Content-Type을 믿지 않는다. 둘, 재인코딩이 EXIF와 그 안에
 * 딸려 오는 것들(촬영 위치 포함)을 떨군다. 개설자가 자기 작업실에서 찍은 사진의 좌표가
 * 공개 페이지에 실려 나가면 안 된다.
 */
export const processCreatorImage = async (
  input: Buffer,
  kind: 'cover' | 'body',
): Promise<{ buffer: Buffer; width: number; height: number }> => {
  const pipeline = sharp(input, { failOn: 'error' }).rotate();
  const resized = kind === 'cover'
    ? pipeline.resize(COVER_SIZE.width, COVER_SIZE.height, { fit: 'cover' })
    : pipeline.resize({ width: UPLOAD_LIMITS.maxWidth, withoutEnlargement: true });
  const { data, info } = await resized.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
};

/**
 * 이미지 주소. Blob 주소가 아니라 **우리 도메인의 프록시 경로**다.
 *
 * Blob 저장소는 계약서 PDF와 같은 곳이라 private이고 공개 업로드를 섞을 수 없다
 * (pages/api/social/media/[...path].ts의 주석). 그래서 private으로 올리고 접두사가 맞는
 * 것만 이 경로가 내보낸다.
 *
 * 치수를 쿼리로 붙이는 이유: `MarkdownImage`는 `utils/imageMetadata.json`에서 치수를 찾는데
 * 그 파일은 저장소의 정적 이미지만 안다. 업로드 이미지는 거기 없어 16:9 상자에 갇히고,
 * 세로 포스터가 작게 박힌다.
 */
export const buildFundingMediaUrl = (filename: string, width: number, height: number): string =>
  `/api/funding/media/${filename}?w=${width}&h=${height}`;
