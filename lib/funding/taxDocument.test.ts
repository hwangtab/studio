/** @jest-environment node */
import sharp from 'sharp';

import { detectTaxDocumentType, processTaxDocument, TaxDocumentError } from './taxDocument';
import { resolveFundingBlobPath } from './mediaPath';

const jpegWithExif = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#fff' } })
  .jpeg().withMetadata({ exif: { IFD0: { Copyright: 'secret-location' } } }).toBuffer();

test('매직 바이트로 판정 — 확장자를 보지 않는다', async () => {
  expect(detectTaxDocumentType(await jpegWithExif())).toBe('jpeg');
  expect(detectTaxDocumentType(Buffer.from('%PDF-1.7\n...'))).toBe('pdf');
  expect(detectTaxDocumentType(Buffer.from('<html><script>'))).toBeNull();
  expect(detectTaxDocumentType(Buffer.alloc(0))).toBeNull();
});

test('이미지는 webp로 다시 인코딩하고 EXIF를 떨군다', async () => {
  const out = await processTaxDocument(await jpegWithExif());
  expect(out.contentType).toBe('image/webp');
  const meta = await sharp(out.buffer).metadata();
  expect(meta.exif).toBeUndefined();
});

test('PDF는 그대로 두되 PDF 머리가 있어야 한다', async () => {
  const pdf = Buffer.from('%PDF-1.4\n%%EOF');
  expect(await processTaxDocument(pdf)).toEqual({ buffer: pdf, contentType: 'application/pdf', ext: 'pdf' });
});

test('판정 실패와 디코드 실패는 TaxDocumentError', async () => {
  await expect(processTaxDocument(Buffer.from('<html>'))).rejects.toBeInstanceOf(TaxDocumentError);
  const truncated = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(20)]);
  await expect(processTaxDocument(truncated)).rejects.toBeInstanceOf(TaxDocumentError);
});

test('미디어 라우트 판정은 tax-docs 경로를 내보내지 않는다', () => {
  expect(resolveFundingBlobPath('tax-docs')).toBeNull();
  expect(resolveFundingBlobPath(['tax-docs', 'abc', 'x.webp'])).toBeNull();
  expect(resolveFundingBlobPath('..%2Ftax-docs%2Fx.webp')).toBeNull();
  expect(resolveFundingBlobPath('tax-docs/abc/x.webp')).toBeNull();
});
