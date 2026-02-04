# 애니메이션 코드 리뷰 및 개선 보고서

**날짜:** 2026년 2월 4일
**검토자:** Gemini CLI Agent

## 1. 개요
본 보고서는 `framer-motion`을 중심으로 프로젝트 전반의 애니메이션 구현 상태, 잠재적 충돌, 성능 문제 및 버그를 검토한 결과를 요약합니다.

## 2. 주요 검토 사항

### 2.1. 라이브러리 사용 및 호환성
*   **`framer-motion` 사용:** 프로젝트 전반(`pages`, `components`)에서 `framer-motion`이 광범위하게 사용되고 있습니다.
*   **`AnimatePresence` 래퍼:** `components/ui/AnimatePresence.tsx`에 커스텀 래퍼 컴포넌트가 구현되어 있습니다.
    *   **목적:** `framer-motion`과 React 18+ 환경에서의 타입 호환성(`PropsWithChildren`) 문제를 해결하기 위함으로 보입니다.
    *   **상태:** 구현 자체는 `AnimatePresenceOrig`를 캐스팅하여 내보내는 형태로, 기능상 문제는 없으나 유지보수 측면에서 최신 `framer-motion` 버전이 해당 이슈를 해결했다면 제거를 고려해볼 수 있습니다.

### 2.2. 페이지 및 컴포넌트별 애니메이션
*   **`pages/_app.tsx`:** `AnimatePresence`를 사용하여 페이지 전환 애니메이션(`mode="wait"`)을 처리하고 있습니다. 이는 페이지 간 부드러운 전환을 제공합니다.
*   **`components/Layout.tsx`:**
    *   모바일 메뉴에 `AnimatePresence`와 `motion.nav`를 사용하여 부드러운 열기/닫기 애니메이션을 구현했습니다 (`height`, `opacity`).
    *   스크롤 이벤트 리스너(`scroll`)를 사용하여 헤더 스타일을 변경하고 있으며, `requestAnimationFrame`을 통해 성능 최적화가 적용되어 있습니다.
    *   **잠재적 이슈:** 스크롤 이벤트와 CSS 트랜지션이 동시에 발생할 때 미세한 버벅임이 있을 수 있으나, 현재 코드는 최적화 패턴을 잘 따르고 있습니다.

### 2.3. 충돌 및 버그 가능성
*   **`AnimatePresence` 중첩:** `pages/_app.tsx`에서 페이지 전체를 감싸고, 내부 컴포넌트(예: `Layout`의 모바일 메뉴, `FAQSection` 등)에서도 `AnimatePresence`를 사용하고 있습니다.
    *   **분석:** `framer-motion`은 중첩된 `AnimatePresence`를 잘 처리하지만, `exit` 애니메이션이 의도치 않게 전파되거나 차단되지 않도록 주의해야 합니다. 현재 코드 구조상 명확한 충돌은 보이지 않습니다.
*   **키(Key) 관리:** `AnimatePresence`의 직계 자식은 고유한 `key` prop을 가져야 정상적으로 `exit` 애니메이션이 작동합니다.
    *   `_app.tsx`에서는 `router.route`를 키로 사용하여 페이지 전환 시 정상 작동할 것으로 예상됩니다.
    *   `Layout.tsx`의 모바일 메뉴는 조건부 렌더링(`isMenuOpen && ...`)으로 처리되어 `AnimatePresence`가 정상 작동합니다.

## 3. 권고 사항

1.  **`AnimatePresence` 래퍼 재고:** `framer-motion` 라이브러리를 최신 버전으로 업데이트하고, 타입 정의 문제가 해결되었다면 `components/ui/AnimatePresence.tsx` 래퍼를 제거하고 라이브러리를 직접 사용하는 것이 코드를 단순화하는 데 도움이 됩니다.
2.  **`Layout` 리렌더링 최적화:** `useMemo`와 `React.memo`가 적절히 사용되고 있으나, 스크롤 이벤트 핸들러가 빈번하게 상태(`isScrolled`)를 업데이트할 수 있습니다. 헤더 스타일 변경을 위한 상태 업데이트는 필요한 시점(threshold 통과 시)에만 발생하도록 조건문을 강화하는 것이 좋습니다. (현재 코드도 `ticking`을 사용하여 최적화되어 있습니다.)
3.  **접근성(Accessibility):** 애니메이션이 많은 사이트이므로, `prefers-reduced-motion` 미디어 쿼리를 존중하여 애니메이션을 줄이거나 끄는 옵션을 고려해야 합니다. `framer-motion`은 `useReducedMotion` 훅을 제공합니다.

## 4. 결론
전반적으로 애니메이션 구현은 모범 사례(Best Practices)를 따르고 있으며, 심각한 버그나 충돌은 발견되지 않았습니다. 성능 최적화(스크롤 처리, 컴포넌트 메모이제이션)도 고려된 상태입니다.
