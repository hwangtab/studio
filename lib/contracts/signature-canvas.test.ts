import { MAX_SIGNATURE_CANVAS_SCALE, signatureCanvasScale } from './signature-canvas';

/** 서버 검증 한도(signature-validation.ts)와 같은 값. 캔버스가 이 안이어야 서명이 거부되지 않는다. */
const SERVER_MAX_SIDE = 4000;
const SERVER_MAX_PIXELS = 6_000_000;

const canvasSize = (dpr: number, w: number, h: number) => {
  const scale = signatureCanvasScale(dpr, w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale), scale };
};

describe('서명 캔버스 배율', () => {
  it('보통 화면에서는 기기 배율 그대로다', () => {
    expect(signatureCanvasScale(1, 600, 200)).toBe(1);
    expect(signatureCanvasScale(2, 600, 200)).toBe(2);
  });

  it('브라우저를 크게 확대해 dpr이 커져도 3배를 넘지 않는다', () => {
    expect(signatureCanvasScale(6, 600, 200)).toBe(MAX_SIGNATURE_CANVAS_SCALE);
  });

  it.each([
    [6, 1400, 300],
    [8, 2000, 400],
    [3, 1500, 1500],
    [2.5, 3000, 300],
  ])('dpr %p, %p×%p CSS px에서도 서버 한도 안이다', (dpr, w, h) => {
    const size = canvasSize(dpr, w, h);
    expect(size.width).toBeLessThanOrEqual(SERVER_MAX_SIDE);
    expect(size.height).toBeLessThanOrEqual(SERVER_MAX_SIDE);
    expect(size.width * size.height).toBeLessThanOrEqual(SERVER_MAX_PIXELS);
  });

  it('잘못된 dpr은 1로 본다', () => {
    expect(signatureCanvasScale(0, 600, 200)).toBe(1);
    expect(signatureCanvasScale(Number.NaN, 600, 200)).toBe(1);
  });
});
