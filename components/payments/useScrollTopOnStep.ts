import { useEffect, useRef } from 'react';

/**
 * 단계가 바뀌면 페이지 맨 위로 올린다(첫 렌더 제외).
 *
 * 다음 단계 버튼은 긴 폼의 맨 아래에 있어서, 눌러도 스크롤 위치가 그대로 남아 새 단계가
 * 푸터 근처에서 시작했다 — 모바일 고객이 단계가 바뀐 줄도 모르고 헤맸다(2026-10-15 운영자 지적).
 * 긴 페이지를 부드럽게 올리면 오히려 어지러우니 즉시 이동한다.
 */
export function useScrollTopOnStep(step: number) {
  const prev = useRef(step);
  useEffect(() => {
    if (prev.current === step) return;
    prev.current = step;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [step]);
}
