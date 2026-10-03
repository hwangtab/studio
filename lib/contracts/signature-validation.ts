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

/**
 * 요청 본문 한도와 맞춘다. 서명 API는 Next 기본 bodyParser(1MB)를 쓰는데, 예전 상한 2MB는 base64로 부풀면
 * 그 한도를 넘어 도달할 수 없는 숫자였다. 실제 서명 PNG는 수십 KB다(2026-10-02 코드리뷰).
 */
const MAX_BYTES = 700 * 1024;
const MIN_BYTES = 100;

/**
 * 서명 캔버스가 만들 수 있는 크기의 상한. 이보다 크면 캔버스에서 온 것이 아니다.
 *
 * 캔버스는 화면 폭 × 기기 픽셀비(sign.tsx, 배율은 최대 3으로 제한)라 실제로는 2천 픽셀 안쪽이다. 예전 상한 10000×10000은
 * 아주 작은 PNG가 그 크기를 선언해 PDF 렌더(Chromium)에서 큰 메모리를 쓰게 할 수 있었다.
 */
const MAX_DIMENSION = 4000;
const MAX_PIXELS = 6_000_000;

/**
 * 인쇄 경로에서 쓰는 형태 검사. 저장 때 통과한 값이라면 여기서도 반드시 통과한다.
 */
export const isSignatureDataUrl = (data: string): boolean => {
  if (!data.startsWith(SIGNATURE_DATA_URL_PREFIX)) return false;
  return BASE64.test(data.slice(SIGNATURE_DATA_URL_PREFIX.length));
};

/**
 * 고객 화면(서명 API 400 응답)에 그대로 나가는 문구라 한국어로 쓴다. 고객이 할 수 있는 일은 "다시 그리기"
 * 하나라 그것을 함께 적고, 원인은 괄호로 짧게 남겨 문의가 왔을 때 어느 검사에 걸렸는지 알 수 있게 한다.
 */
const REDRAW = '서명을 지우고 다시 그려 주세요.';
const unreadable = (reason: string) => `서명 이미지를 읽을 수 없습니다(${reason}). ${REDRAW}`;

export const validateSignatureData = (data: string): { ok: boolean; message?: string } => {
  if (!data.startsWith(SIGNATURE_DATA_URL_PREFIX)) {
    return { ok: false, message: unreadable('PNG 형식 아님') };
  }

  const base64 = data.slice(SIGNATURE_DATA_URL_PREFIX.length);
  if (!BASE64.test(base64)) {
    return { ok: false, message: unreadable('허용되지 않는 문자') };
  }
  // 표준 base64는 4자 단위로 인코딩된다. 어긋나면 디코더마다 결과가 갈린다.
  if (base64.length % 4 !== 0) {
    return { ok: false, message: unreadable('길이 오류') };
  }

  const decodedLength = Buffer.byteLength(base64, 'base64');
  if (decodedLength > MAX_BYTES) {
    return { ok: false, message: `서명 이미지가 너무 큽니다. ${REDRAW}` };
  }
  if (decodedLength < MIN_BYTES) {
    return { ok: false, message: `서명이 비어 있거나 너무 작습니다. 서명란에 다시 그려 주세요.` };
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, message: unreadable('해독 실패') };
  }

  if (decoded.length < 8 || !decoded.subarray(0, 8).equals(PNG_MAGIC)) {
    return { ok: false, message: unreadable('PNG 형식 아님') };
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
    return { ok: false, message: unreadable('PNG 머리글 없음') };
  }
  if (decoded.readUInt32BE(8) !== 13 || decoded.subarray(12, 16).toString('ascii') !== 'IHDR') {
    return { ok: false, message: unreadable('PNG 머리글 손상') };
  }

  const width = decoded.readUInt32BE(16);
  const height = decoded.readUInt32BE(20);
  if (
    width === 0 ||
    height === 0 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION ||
    width * height > MAX_PIXELS
  ) {
    return { ok: false, message: `서명 이미지 크기가 올바르지 않습니다. 브라우저 확대 배율을 100%로 되돌린 뒤 ${REDRAW}` };
  }

  // 정상적으로 끝나지 않은 PNG는 렌더러가 거부하거나 잘린 그림을 그린다.
  if (decoded.subarray(decoded.length - 8, decoded.length - 4).toString('ascii') !== 'IEND') {
    return { ok: false, message: unreadable('이미지가 잘림') };
  }

  return { ok: true };
};
