/** @jest-environment node */

import { validateSignatureData } from './signature-validation';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 헤더가 유효한 PNG 바이트열. 검증이 보는 것은 시그니처와 바이트 길이뿐이다. */
const pngDataUrl = (byteLength = 1024): string => {
  const padding = Buffer.alloc(Math.max(0, byteLength - PNG_MAGIC.length), 0x42);
  const buffer = Buffer.concat([PNG_MAGIC, padding]);
  return `data:image/png;base64,${buffer.toString('base64')}`;
};

describe('전자서명 이미지 검증', () => {
  it('정상적인 PNG 데이터 URL을 통과시킨다', () => {
    expect(validateSignatureData(pngDataUrl())).toEqual({ ok: true });
  });

  it('PNG가 아닌 데이터 URL을 거부한다', () => {
    const result = validateSignatureData('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect(result.ok).toBe(false);
  });

  it('데이터 URL이 아닌 문자열을 거부한다', () => {
    expect(validateSignatureData('https://example.com/signature.png').ok).toBe(false);
  });

  it('base64가 아닌 문자가 섞이면 거부한다', () => {
    expect(validateSignatureData('data:image/png;base64,<script>').ok).toBe(false);
  });

  it('PNG 시그니처가 없으면 거부한다 (확장자만 위장한 경우)', () => {
    const fake = Buffer.alloc(512, 1).toString('base64');
    const result = validateSignatureData(`data:image/png;base64,${fake}`);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('PNG');
  });

  it('너무 작은 이미지를 거부한다', () => {
    const tiny = PNG_MAGIC.toString('base64');
    expect(validateSignatureData(`data:image/png;base64,${tiny}`).ok).toBe(false);
  });

  it('2MB를 넘는 이미지를 거부한다', () => {
    const oversized = Buffer.concat([PNG_MAGIC, Buffer.alloc(2 * 1024 * 1024)]);
    const result = validateSignatureData(`data:image/png;base64,${oversized.toString('base64')}`);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('2MB');
  });
});
