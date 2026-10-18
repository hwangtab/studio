import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

/** 점 하나만 찍고 제출하는 것을 막기 위한 최소 획 점 개수. */
const MIN_STROKE_POINTS = 12;

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
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { onSignedChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const pointCountRef = useRef(0);
  const signedRef = useRef(false);
  // 부모가 렌더마다 새 콜백을 넘겨도 캔버스를 다시 잡지 않도록 최신 값만 기억한다.
  const onSignedChangeRef = useRef(onSignedChange);
  onSignedChangeRef.current = onSignedChange;

  const setSigned = useCallback((signed: boolean) => {
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
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';

    pointCountRef.current = 0;
    setSigned(false);
  }, [setSigned]);

  useEffect(() => {
    setupCanvas();

    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;

    // 화면을 회전하면 표시 크기가 바뀐다. 그대로 두면 그 순간부터 다시 비율이 어긋나므로
    // 캔버스를 다시 잡는다(그리던 내용은 지워지고 사용자가 다시 서명한다).
    let lastWidth = canvas.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = canvas.getBoundingClientRect().width;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
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
    drawingRef.current = true;
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!drawingRef.current) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(event);
    ctx.lineTo(x, y);
    ctx.stroke();

    pointCountRef.current += 1;
    if (pointCountRef.current >= MIN_STROKE_POINTS) setSigned(true);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 컨텍스트가 dpr 배율로 확대돼 있어 CSS 픽셀 기준으로 지운다.
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    pointCountRef.current = 0;
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
            화면 비율과 어긋나 서명이 늘어난다. */}
        <canvas
          ref={canvasRef}
          className="block w-full h-[180px] md:h-[200px] touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <button
        type="button"
        onClick={clear}
        className="mt-3 text-sm text-gray-500 dark:text-gray-500 hover:text-gray-700 underline"
      >
        서명 지우기
      </button>
    </>
  );
});
