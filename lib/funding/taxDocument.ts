import sharp from 'sharp';

export const TAX_DOCUMENT_MAX_BYTES = 4 * 1024 * 1024; // Vercel 함수 본문 한도(4.5MB) 안 — 이보다 크면 함수에 닿기 전에 막힌다
/** 글자가 읽혀야 하므로 본문 이미지(1600)보다 크게 둔다. */
const MAX_WIDTH = 2400;
const MAX_INPUT_PIXELS = 40_000_000; // creatorUpload.ts와 같은 이유

export class TaxDocumentError extends Error {}

export const detectTaxDocumentType = (b: Buffer): 'jpeg' | 'png' | 'webp' | 'pdf' | null => {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.length >= 5 && b.toString('ascii', 0, 5) === '%PDF-') return 'pdf';
  return null;
};

/**
 * 이미지는 sharp로 다시 인코딩한다 — 그림이 아니면 여기서 던지고, EXIF(촬영 위치 포함)가 떨어진다(creatorUpload.ts와 같은 이유).
 * PDF는 정화할 수단이 없어 바이트 그대로 둔다. 대신 관리자 열람 라우트가 `Content-Security-Policy: sandbox`로 내보낸다(Task 7).
 * HEIC는 받지 않는다(서버 sharp가 디코드를 보장하지 않는다) — 화면이 JPG·PNG·PDF로 안내한다.
 */
export const processTaxDocument = async (buf: Buffer) => {
  const type = detectTaxDocumentType(buf);
  if (!type) throw new TaxDocumentError('unsupported');
  if (type === 'pdf') return { buffer: buf, contentType: 'application/pdf' as const, ext: 'pdf' as const };
  try {
    const out = await sharp(buf, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
      .rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    return { buffer: out, contentType: 'image/webp' as const, ext: 'webp' as const };
  } catch {
    throw new TaxDocumentError('decode_failed');
  }
};
