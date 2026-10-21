import { countPoints, fitStrokes } from './signatureStrokes';

describe('fitStrokes', () => {
  const strokes = [
    [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ],
  ];

  it('크기가 같으면 좌표를 바꾸지 않는다', () => {
    expect(fitStrokes(strokes, { width: 200, height: 100 }, { width: 200, height: 100 })).toEqual(strokes);
  });

  it('가로가 줄면 작은 쪽 배율로 균일하게 줄이고 세로 가운데로 맞춘다(비율을 지킨다)', () => {
    const [stroke] = fitStrokes(strokes, { width: 200, height: 100 }, { width: 100, height: 100 });
    // 배율 0.5 → (0,0)→(0,0)+(0,25), (100,50)→(50,25)+(0,25)
    expect(stroke).toEqual([
      { x: 0, y: 25 },
      { x: 50, y: 50 },
    ]);
    // 두 점 사이의 가로세로 비율(2:1)이 그대로다.
    expect((stroke[1].x - stroke[0].x) / (stroke[1].y - stroke[0].y)).toBeCloseTo(2);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const copy = JSON.parse(JSON.stringify(strokes));
    fitStrokes(strokes, { width: 200, height: 100 }, { width: 400, height: 300 });
    expect(strokes).toEqual(copy);
  });

  it('크기가 0이면 그대로 돌려준다', () => {
    expect(fitStrokes(strokes, { width: 0, height: 0 }, { width: 100, height: 100 })).toEqual(strokes);
  });
});

describe('countPoints', () => {
  it('모든 획의 점을 센다', () => {
    expect(countPoints([[{ x: 0, y: 0 }], [{ x: 1, y: 1 }, { x: 2, y: 2 }]])).toBe(3);
    expect(countPoints([])).toBe(0);
  });
});
