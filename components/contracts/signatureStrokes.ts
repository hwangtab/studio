/**
 * 서명 획 보관·변환 — SignaturePad가 화면 크기가 바뀔 때(가로·세로 회전, 키보드, 주소창) 서명을 지우지 않고
 * 다시 그리려고 획을 점 좌표로 들고 있다.
 *
 * 좌표는 그릴 때의 CSS 픽셀이고, 어떤 크기의 캔버스에서 그렸는지(`SignatureSize`)를 함께 기억한다.
 * 크기가 바뀌면 **가로세로 비율을 지킨 채**(작은 쪽 배율로 균일하게) 가운데 맞춰 옮긴다 — 서명은 필적이라
 * 가로로만 늘어나면 안 된다(SignaturePad 머리 주석).
 *
 * **이 모듈은 아무것도 import하지 않는다.**
 */

export interface SignaturePoint {
  x: number;
  y: number;
}

export type SignatureStroke = SignaturePoint[];

export interface SignatureSize {
  width: number;
  height: number;
}

/** 획 전체를 `from` 크기 캔버스에서 `to` 크기 캔버스로 옮긴다. 크기가 같거나 한쪽이 0이면 그대로 돌려준다. */
export const fitStrokes = (strokes: readonly SignatureStroke[], from: SignatureSize, to: SignatureSize): SignatureStroke[] => {
  if (from.width <= 0 || from.height <= 0 || to.width <= 0 || to.height <= 0) return strokes.map((stroke) => [...stroke]);
  if (from.width === to.width && from.height === to.height) return strokes.map((stroke) => [...stroke]);
  const scale = Math.min(to.width / from.width, to.height / from.height);
  const offsetX = (to.width - from.width * scale) / 2;
  const offsetY = (to.height - from.height * scale) / 2;
  return strokes.map((stroke) => stroke.map((point) => ({ x: point.x * scale + offsetX, y: point.y * scale + offsetY })));
};

/** 획에 담긴 점의 총 개수. */
export const countPoints = (strokes: readonly SignatureStroke[]): number => strokes.reduce((sum, stroke) => sum + stroke.length, 0);
