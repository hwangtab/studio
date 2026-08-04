/** @jest-environment node */

import { isSignatureDataUrl, validateSignatureData } from './signature-validation';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 길이(4) + 'IHDR'(4) + 폭(4) + 높이(4) + 비트깊이·컬러타입·압축·필터·인터레이스(5) + CRC(4) */
const ihdr = (width: number, height: number): Buffer => {
  const chunk = Buffer.alloc(25);
  chunk.writeUInt32BE(13, 0);
  chunk.write('IHDR', 4, 'ascii');
  chunk.writeUInt32BE(width, 8);
  chunk.writeUInt32BE(height, 12);
  chunk[16] = 8; // bit depth
  chunk[17] = 6; // color type: RGBA
  return chunk;
};

/** 길이(4, 항상 0) + 'IEND'(4) + CRC(4) */
const iend = (): Buffer => {
  const chunk = Buffer.alloc(12);
  chunk.write('IEND', 4, 'ascii');
  return chunk;
};

const toDataUrl = (buffer: Buffer): string =>
  `data:image/png;base64,${buffer.toString('base64')}`;

/** 서명 캔버스가 내보내는 것과 같은 구조의 PNG. */
const pngDataUrl = (byteLength = 1024, width = 300, height = 100): string => {
  const header = Buffer.concat([PNG_MAGIC, ihdr(width, height)]);
  const tail = iend();
  const fill = Buffer.alloc(Math.max(0, byteLength - header.length - tail.length), 0x42);
  return toDataUrl(Buffer.concat([header, fill, tail]));
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
    expect(validateSignatureData('https://studionol.co.kr/signature.png').ok).toBe(false);
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

  /**
   * 아래는 모두 "저장은 되는데 PDF에는 안 찍히는" 값들이다. 그런 값이 통과하면
   * 서명 그림 자리에 오류 문구가 박힌 서명완료 계약서가 만들어져, 당사자가 나중에
   * 서명을 부인할 근거가 된다.
   */
  describe('저장은 되고 인쇄는 안 되는 값을 막는다', () => {
    it('매직 바이트만 맞고 내용이 쓰레기면 거부한다', () => {
      const magicOnly = Buffer.concat([PNG_MAGIC, Buffer.alloc(1016, 0x42)]);
      const result = validateSignatureData(toDataUrl(magicOnly));

      expect(result.ok).toBe(false);
      expect(result.message).toContain('header');
    });

    it('IEND 없이 잘린 PNG를 거부한다', () => {
      const truncated = Buffer.concat([PNG_MAGIC, ihdr(300, 100), Buffer.alloc(512, 0x42)]);
      const result = validateSignatureData(toDataUrl(truncated));

      expect(result.ok).toBe(false);
      expect(result.message).toContain('truncated');
    });

    it('폭이나 높이가 0인 PNG를 거부한다', () => {
      expect(validateSignatureData(pngDataUrl(1024, 0, 100)).ok).toBe(false);
      expect(validateSignatureData(pngDataUrl(1024, 300, 0)).ok).toBe(false);
    });

    it('패딩(=)이 중간에 낀 base64를 거부한다', () => {
      const valid = pngDataUrl();
      const base64 = valid.slice('data:image/png;base64,'.length);
      const tampered = `${base64.slice(0, 100)}=${base64.slice(101)}`;

      expect(validateSignatureData(`data:image/png;base64,${tampered}`).ok).toBe(false);
    });

    it('길이가 4의 배수가 아닌 base64를 거부한다', () => {
      const base64 = pngDataUrl().slice('data:image/png;base64,'.length);

      expect(validateSignatureData(`data:image/png;base64,${base64.slice(0, -1)}`).ok).toBe(false);
    });
  });

  /**
   * 이 시스템이 실제로 무너졌던 방식 — 저장 쪽과 인쇄 쪽이 서로 다른 정규식을 들고 있어서
   * 한쪽만 통과하는 값이 존재했다. 두 판정은 같은 규칙을 봐야 한다.
   */
  describe('저장 판정과 인쇄 판정이 어긋나지 않는다', () => {
    const candidates = [
      pngDataUrl(),
      pngDataUrl(4096, 800, 200),
      'data:image/png;base64,<script>',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'https://studionol.co.kr/signature.png',
      `data:image/png;base64,${Buffer.alloc(512, 1).toString('base64')}`,
      toDataUrl(Buffer.concat([PNG_MAGIC, Buffer.alloc(1016, 0x42)])),
    ];

    it.each(candidates.map((c, i) => [i, c]))(
      '후보 %i — 저장에서 통과하면 인쇄에서도 통과한다',
      (_index, candidate) => {
        if (validateSignatureData(candidate as string).ok) {
          expect(isSignatureDataUrl(candidate as string)).toBe(true);
        }
      },
    );

    it('중간 패딩 값은 양쪽 모두 거부한다', () => {
      const base64 = pngDataUrl().slice('data:image/png;base64,'.length);
      const tampered = `data:image/png;base64,${base64.slice(0, 100)}=${base64.slice(101)}`;

      expect(validateSignatureData(tampered).ok).toBe(false);
      expect(isSignatureDataUrl(tampered)).toBe(false);
    });
  });
});
