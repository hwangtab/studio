import { useEffect, useRef } from 'react';

/**
 * 단계가 바뀌면 페이지 맨 위로 올리고, 새 단계 제목으로 포커스를 옮긴다(첫 렌더 제외).
 *
 * 다음 단계 버튼은 긴 폼의 맨 아래에 있어서, 눌러도 스크롤 위치가 그대로 남아 새 단계가
 * 푸터 근처에서 시작했다 — 모바일 고객이 단계가 바뀐 줄도 모르고 헤맸다(2026-10-15 운영자 지적).
 * 긴 페이지를 부드럽게 올리면 오히려 어지러우니 즉시 이동한다.
 *
 * 스크롤만 올리면 누른 "다음" 버튼이 사라지며 포커스가 body로 떨어져, 키보드 사용자는 처음부터 다시
 * 탭해야 하고 스크린리더에는 새 단계가 알려지지 않았다(2026-10-22 리뷰). 그래서 `headingIdFor`가 주는
 * 제목(h2, tabIndex=-1)으로 포커스를 옮긴다 — 스크린리더는 제목을 읽는다. 스크롤은 위에서 이미 했으니 다시 하지 않는다.
 */
export function useScrollTopOnStep(step: number, headingIdFor?: (step: number) => string) {
  const prev = useRef(step);
  useEffect(() => {
    if (prev.current === step) return;
    prev.current = step;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    if (!headingIdFor) return;
    document.getElementById(headingIdFor(step))?.focus({ preventScroll: true });
  }, [step, headingIdFor]);
}
