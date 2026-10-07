import React from 'react';

/**
 * 파형 모티프 — 절 사이의 구분선, 빈 상태, 404(라이너 노트 §3-6 d).
 *
 * 정적 SVG 한 path(≈1KB)다. 움직이지 않는다 — 모션 예산은 제목 등장 하나로 끝(design-system §6·§10). 실제 파형이
 * 아니라 "소리를 만드는 곳"이라는 말을 그림이 대신하는 장식이라 `aria-hidden`이고, 색은 currentColor라 호출부가
 * 텍스트색으로 정한다(기본 gray-300 / 다크 gray-700).
 */
const WIDTH = 1200;
const BARS = 96;

/** 결정적 막대 높이 — 가운데가 높고 양끝이 낮은 봉우리 모양에 작은 요철. */
const path = (() => {
  const step = WIDTH / BARS;
  const parts: string[] = [];
  for (let i = 0; i < BARS; i++) {
    const t = i / (BARS - 1);
    const envelope = Math.sin(Math.PI * t) ** 0.8;
    const wobble = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + Math.cos(i * 0.9)));
    const h = Math.max(2, Math.round(26 * envelope * wobble));
    const x = Math.round(i * step + step / 2);
    parts.push(`M${x} ${16 - h / 2}v${h}`);
  }
  return parts.join('');
})();

interface WaveRuleProps {
  className?: string;
}

export const WaveRule = ({ className = 'text-gray-300 dark:text-gray-700' }: WaveRuleProps) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox={`0 0 ${WIDTH} 32`}
    preserveAspectRatio="none"
    className={`block h-8 w-full ${className}`}
  >
    <path d={path} stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
  </svg>
);

export default WaveRule;
