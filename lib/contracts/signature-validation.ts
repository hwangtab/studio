/**
 * 서명 이미지 검증.
 *
 * 여기서 통과한 이미지는 나중에 서명본 PDF에 그대로 인쇄된다. 저장 때와 인쇄 때의
 * 기준이 조금이라도 다르면 저장은 됐는데 인쇄가 안 되는 값이 생긴다 — 그 결과는
 * "서명이 완료된 계약서인데 서명 그림 자리에 오류 문구가 박힌 PDF"다. 계약 당사자가
 * 나중에 서명을 부인할 근거가 되므로, 판정 기준은 이 파일 하나에 두고 인쇄 쪽
 * (pdf-html.ts)이 같은 것을 가져다 쓴다.
 */

export const SIGNATURE_DATA_URL_PREFIX = 'data:image/png;base64,';

/**
 * 표준 base64. 패딩(=)은 맨 끝에만 최대 2개 올 수 있다.
 *
 * `[A-Za-z0-9+/=]+` 처럼 패딩을 아무 데나 허용하면 `AAAA=BBBB` 같은 값이 통과한다.
 * Buffer.from은 이런 값도 조용히 디코드하지만 브라우저의 <img>는 거부한다.
 */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const MAX_BYTES = 2 * 1024 * 1024;
const MIN_BYTES = 100;

/** 서명 캔버스가 만들 수 있는 크기의 상한. 이보다 크면 캔버스에서 온 것이 아니다. */
const MAX_DIMENSION = 10000;

/**
 * 인쇄 경로에서 쓰는 형태 검사. 저장 때 통과한 값이라면 여기서도 반드시 통과한다.
 */
export const isSignatureDataUrl = (data: string): boolean => {
  if (!data.startsWith(SIGNATURE_DATA_URL_PREFIX)) return false;
  return BASE64.test(data.slice(SIGNATURE_DATA_URL_PREFIX.length));
};

export const validateSignatureData = (data: string): { ok: boolean; message?: string } => {
  if (!data.startsWith(SIGNATURE_DATA_URL_PREFIX)) {
    return { ok: false, message: 'Signature must be a base64 PNG data URL' };
  }

  const base64 = data.slice(SIGNATURE_DATA_URL_PREFIX.length);
  if (!BASE64.test(base64)) {
    return { ok: false, message: 'Invalid base64 characters' };
  }
  // 표준 base64는 4자 단위로 인코딩된다. 어긋나면 디코더마다 결과가 갈린다.
  if (base64.length % 4 !== 0) {
    return { ok: false, message: 'Invalid base64 length' };
  }

  const decodedLength = Buffer.byteLength(base64, 'base64');
  if (decodedLength > MAX_BYTES) {
    return { ok: false, message: 'Signature image exceeds 2MB' };
  }
  if (decodedLength < MIN_BYTES) {
    return { ok: false, message: 'Signature image is too small' };
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, message: 'Failed to decode signature image' };
  }

  if (decoded.length < 8 || !decoded.subarray(0, 8).equals(PNG_MAGIC)) {
    return { ok: false, message: 'Signature is not a valid PNG image' };
  }

  /**
   * 매직 8바이트만 보면 뒤가 전부 쓰레기여도 통과한다. 그런 값은 저장은 되지만
   * PDF에서 빈 칸으로 렌더링돼, 서명 그림이 없는 서명완료 계약서가 만들어진다.
   * 실제로 그림이 들어 있는지 보려면 최소한 헤더(IHDR)와 끝(IEND)은 확인해야 한다.
   *
   * PNG는 매직 8바이트 뒤에 곧바로 IHDR 청크가 온다:
   * 길이(4바이트, 항상 13) + 'IHDR'(4) + 폭(4) + 높이(4) + …
   */
  if (decoded.length < 33) {
    return { ok: false, message: 'Signature image is missing its header' };
  }
  if (decoded.readUInt32BE(8) !== 13 || decoded.subarray(12, 16).toString('ascii') !== 'IHDR') {
    return { ok: false, message: 'Signature image has a malformed PNG header' };
  }

  const width = decoded.readUInt32BE(16);
  const height = decoded.readUInt32BE(20);
  if (width === 0 || height === 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return { ok: false, message: 'Signature image has invalid dimensions' };
  }

  // 정상적으로 끝나지 않은 PNG는 렌더러가 거부하거나 잘린 그림을 그린다.
  if (decoded.subarray(decoded.length - 8, decoded.length - 4).toString('ascii') !== 'IEND') {
    return { ok: false, message: 'Signature image is truncated' };
  }

  return { ok: true };
};
