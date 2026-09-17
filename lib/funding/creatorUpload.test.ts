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
});

describe('buildFundingMediaUrl', () => {
  it('같은 출처 주소에 치수를 붙인다', () => {
    expect(buildFundingMediaUrl('abc.webp', 800, 600)).toBe('/api/funding/media/abc.webp?w=800&h=600');
  });
});
