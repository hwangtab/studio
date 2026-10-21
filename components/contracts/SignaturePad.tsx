import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { Button } from '../ui/Button';
import { countPoints, fitStrokes, type SignatureSize, type SignatureStroke } from './signatureStrokes';

/** 점 하나만 찍고 제출하는 것을 막기 위한 최소 획 점 개수. */
const MIN_STROKE_POINTS = 12;

/** 그리다 만 것처럼 작게 그렸을 때(서명으로 보기엔 모자랄 때) 알리는 말. */
const TOO_SMALL_HINT = '조금 더 크게 서명해 주세요.';

const applyStrokeStyle = (ctx: CanvasRenderingContext2D) => {
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111827';
};

export interface SignaturePadHandle {
  /** 서명 이미지(PNG data URL). 캔버스가 없으면 null. */
  toDataURL: () => string | null;
  clear: () => void;
}

interface SignaturePadProps {
  /** 서명으로 볼 만큼 그렸는지가 바뀔 때 알린다(제출 버튼 활성화). */
  onSignedChange: (signed: boolean) => void;
}

/**
 * 계약서 전자서명 캔버스. 연습실·제작 계약 서명 화면이 함께 쓴다(원래 연습실 sign.tsx 안에 있던 코드).
 *
 * 캔버스 해상도는 화면에 보이는 크기에 맞춘다. 내부 해상도를 고정해 두고 CSS로 늘리면 가로세로 비율이
 * 어긋나, 모바일에서는 서명이 가로로 두 배가량 늘어난 채 저장된다. 서명은 필적이라 형태가 달라지면 안 된다.
 * 표시 크기 × devicePixelRatio로 잡고 컨텍스트를 같은 배율로 확대하면, 비율은 그대로면서 고해상도 화면에서도
 * 선이 또렷하다. 이후 그리기 좌표는 CSS 픽셀이다.
 *
 * 그린 획은 점 좌표로 들고 있다가(signatureStrokes.ts), 화면 크기가 바뀌면(가로·세로 회전, 주소창) 가로세로 비율을
 * 지킨 채 옮겨 다시 그린다 — 예전에는 캔버스를 다시 잡으며 서명이 통째로 지워졌다.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { onSignedChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  /** 지금까지 그린 획(그릴 때의 CSS 픽셀). 크기가 바뀌면 sizeRef를 기준으로 옮긴다. */
  const strokesRef = useRef<SignatureStroke[]>([]);
  const sizeRef = useRef<SignatureSize>({ width: 0, height: 0 });
  const signedRef = useRef(false);
  const [tooSmall, setTooSmall] = useState(false);
  // 부모가 렌더마다 새 콜백을 넘겨도 캔버스를 다시 잡지 않도록 최신 값만 기억한다.
  const onSignedChangeRef = useRef(onSignedChange);
  onSignedChangeRef.current = onSignedChange;

  const setSigned = useCallback((signed: boolean) => {
    if (signed) setTooSmall(false);
    if (signedRef.current === signed) return;
    signedRef.current = signed;
    onSignedChangeRef.current(signed);
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 해상도를 바꾸면 컨텍스트 상태가 초기화되므로 매번 다시 지정한다.
    ctx.scale(dpr, dpr);
    applyStrokeStyle(ctx);

    // 이미 그린 획은 새 크기로 옮겨 다시 그린다(비율 유지).
    const nextSize = { width: rect.width, height: rect.height };
    strokesRef.current = fitStrokes(strokesRef.current, sizeRef.current, nextSize);
    sizeRef.current = nextSize;
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    setSigned(countPoints(strokesRef.current) >= MIN_STROKE_POINTS);
  }, [setSigned]);

  useEffect(() => {
    setupCanvas();

    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;

    // 화면을 회전하면 표시 크기가 바뀐다. 그대로 두면 그 순간부터 다시 비율이 어긋나므로
    // 캔버스를 다시 잡고, 그리던 서명은 비율을 지켜 옮겨 그린다.
    const initial = canvas.getBoundingClientRect();
    let lastWidth = initial.width;
    let lastHeight = initial.height;
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      if (Math.abs(rect.width - lastWidth) < 1 && Math.abs(rect.height - lastHeight) < 1) return;
      lastWidth = rect.width;
      lastHeight = rect.height;
      setupCanvas();
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [setupCanvas]);

  /** 컨텍스트가 dpr 배율로 확대돼 있으므로 좌표는 CSS 픽셀 그대로 쓴다. */
  const getCoordinates = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in event ? event.touches[0] ?? event.changedTouches[0] : event;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    strokesRef.current.push([{ x, y }]);
    drawingRef.current = true;
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!drawingRef.current) return;

    const ctx = canvasRef.current?.getContext('2d');
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    if (!ctx || !stroke) return;

    const { x, y } = getCoordinates(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    stroke.push({ x, y });

    if (countPoints(strokesRef.current) >= MIN_STROKE_POINTS) setSigned(true);
  };

  const stopDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    // 손을 뗐는데도 서명으로 보기엔 모자라면(점 하나·짧은 선) 조용히 빈 칸으로 두지 않고 알린다.
    if (!signedRef.current && strokesRef.current.length > 0) setTooSmall(true);
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 컨텍스트가 dpr 배율로 확대돼 있어 CSS 픽셀 기준으로 지운다.
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    strokesRef.current = [];
    drawingRef.current = false;
    setTooSmall(false);
    setSigned(false);
  }, [setSigned]);

  useImperativeHandle(
    ref,
    () => ({
      toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? null,
      clear,
    }),
    [clear],
  );

  return (
    <>
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-300 rounded-xl overflow-hidden bg-white dark:bg-white">
        {/* 해상도는 마운트 후 표시 크기에 맞춰 잡는다(setupCanvas). 여기서 width/height를 고정하면
            화면 비율과 어긋나 서명이 늘어난다. 휴대폰에서는 손가락이 편하게 닿도록 조금 더 높다. */}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="서명 입력 칸. 손가락이나 마우스로 그려서 서명해요."
          className="block w-full h-[220px] md:h-[200px] touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="mt-2 flex items-start justify-between gap-3">
        <p role="status" className="min-h-[1.25rem] pt-3 text-sm font-medium text-amber-700 dark:text-amber-700">
          {tooSmall ? TOO_SMALL_HINT : ''}
        </p>
        <Button type="button" variant="secondary" size="sm" light onClick={clear} className="shrink-0">
          서명 지우기
        </Button>
      </div>
    </>
  );
});
