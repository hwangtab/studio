import sharp from 'sharp';

import { buildFundingMediaUrl, processCreatorImage, UPLOAD_LIMITS } from './creatorUpload';

const makePng = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();

describe('processCreatorImage', () => {
  it('webp로 다시 인코딩하고 치수를 돌려준다', async () => {
    const out = await processCreatorImage(await makePng(800, 600), 'body');
    expect(out.width).toBe(800);
    expect(out.height).toBe(600);
    expect((await sharp(out.buffer).metadata()).format).toBe('webp');
  });

  it('가로 상한을 넘으면 줄인다', async () => {
    const out = await processCreatorImage(await makePng(4000, 2000), 'body');
    expect(out.width).toBe(UPLOAD_LIMITS.maxWidth);
    expect(out.height).toBe(UPLOAD_LIMITS.maxWidth / 2);
  });

  it('작은 그림을 억지로 키우지 않는다', async () => {
    const out = await processCreatorImage(await makePng(400, 300), 'body');
    expect(out.width).toBe(400);
  });

  it('대표 이미지는 16:9로 맞춘다', async () => {
    const out = await processCreatorImage(await makePng(1000, 1000), 'cover');
    expect(out.width / out.height).toBeCloseTo(16 / 9, 2);
  });

  it('그림이 아니면 던진다', async () => {
    await expect(processCreatorImage(Buffer.from('이건 그림이 아니다'), 'body')).rejects.toThrow();
  });

  // 단색에 가까운 PNG는 파일 크기(8MB 상한)와 무관하게 가로세로를 크게 만들 수 있다.
  // 디코드하면 그 픽셀 수만큼 메모리를 잡아먹으므로, limitInputPixels가 없으면 서버리스
  // 함수가 죽는다 — 4천만 픽셀 상한(8000×5000)을 넘는 입력은 디코드 전에 거부돼야 한다.
  it('픽셀 수가 상한을 넘으면 던진다(디컴프레션 폭탄 방지)', async () => {
    const huge = await makePng(7001, 6001); // 42,012,001 픽셀 > 40,000,000
    await expect(processCreatorImage(huge, 'body')).rejects.toThrow();
  });
});

describe('buildFundingMediaUrl', () => {
  it('같은 출처 주소에 치수를 붙인다', () => {
    expect(buildFundingMediaUrl('abc.webp', 800, 600)).toBe('/api/funding/media/abc.webp?w=800&h=600');
  });
});
