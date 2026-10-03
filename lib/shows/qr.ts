import QRCode from 'qrcode';

/**
 * 티켓 QR — 페이로드는 티켓 코드 문자열(`SNT1:...`) 그대로다(lib/shows/shape.ts).
 * 정적 import라 서버리스 번들에 포함된다.
 */

/** 티켓 코드를 PNG data URL로. 오류 정정 M, 여백 2칸 — 현장 스캔용으로 충분하다. */
export const ticketQrDataUrl = (code: string): Promise<string> =>
  QRCode.toDataURL(code, { errorCorrectionLevel: 'M', margin: 2, width: 320 });

/** 메일 첨부용 base64(PNG 본문만, `data:` 접두사 없음). */
export const ticketQrPngBase64 = async (code: string): Promise<string> => {
  const url = await ticketQrDataUrl(code);
  const idx = url.indexOf('base64,');
  if (idx < 0) throw new Error('qr_unexpected_format');
  return url.slice(idx + 'base64,'.length);
};
