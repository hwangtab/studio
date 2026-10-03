/**
 * 서명 캔버스의 내부 해상도 배율(서명 화면 sign.tsx). 순수 함수 — 클라이언트가 값으로 가져간다.
 *
 * devicePixelRatio를 그대로 쓰면 브라우저를 크게 확대한 고해상도 화면(5K + 확대)에서 dpr이 6을 넘어
 * 캔버스가 서버 검증 한도(signature-validation.ts: 한 변 4000px, 600만 픽셀)를 넘고 서명이 거부된다.
 * 그래서 배율을 3으로 제한하고, 그래도 넓은 캔버스는 한도 안쪽으로 한 번 더 줄인다.
 *
 * 한도 값은 signature-validation.ts에서 가져오지 않는다 — 그 모듈은 최상위에서 Buffer를 써서
 * 클라이언트 번들에 넣을 수 없다. 반올림 여유를 두고 조금 안쪽 값을 쓴다.
 */
export const MAX_SIGNATURE_CANVAS_SCALE = 3;
const MAX_SIDE_PX = 3990;
const MAX_TOTAL_PX = 5_900_000;

export const signatureCanvasScale = (devicePixelRatio: number, cssWidth: number, cssHeight: number): number => {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  let scale = Math.min(dpr, MAX_SIGNATURE_CANVAS_SCALE);
  if (cssWidth > 0) scale = Math.min(scale, MAX_SIDE_PX / cssWidth);
  if (cssHeight > 0) scale = Math.min(scale, MAX_SIDE_PX / cssHeight);
  if (cssWidth > 0 && cssHeight > 0) scale = Math.min(scale, Math.sqrt(MAX_TOTAL_PX / (cssWidth * cssHeight)));
  return scale;
};
