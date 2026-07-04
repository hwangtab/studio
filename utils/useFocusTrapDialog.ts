import { useCallback, useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapDialogOptions {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  eventTarget?: 'window' | 'document';
  restoreOnCleanup?: boolean;
}

interface UseFocusTrapDialogResult {
  restoreFocus: () => void;
}

// display:none 등으로 렌더되지 않는 요소는 focus()가 무효 → 트랩 경계·초기 포커스에서 제외.
// (예: 태블릿 폭에서 sm:hidden으로 숨긴 MobileNav의 첫 버튼이 firstElement로 잡혀 트랩이 깨짐.)
// offsetParent는 position:fixed 요소에서 null이 되므로 getClientRects()로 보강한다.
const isElementVisible = (element: HTMLElement): boolean =>
  element.offsetParent !== null || element.getClientRects().length > 0;

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(isElementVisible);
};

const focusInitialElement = (
  container: HTMLElement | null,
  initialFocusElement: HTMLElement | null | undefined
) => {
  if (initialFocusElement) {
    initialFocusElement.focus();
    return;
  }

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
  }
};

export const useFocusTrapDialog = ({
  isOpen,
  containerRef,
  onClose,
  initialFocusRef,
  eventTarget = 'document',
  restoreOnCleanup = true,
}: UseFocusTrapDialogOptions): UseFocusTrapDialogResult => {
  const triggerRef = useRef<HTMLElement | null>(null);

  // onClose는 호출부에서 미메모이즈로 넘어와 매 렌더 새 참조가 된다. effect 의존성에 직접
  // 넣으면 트리거 요소 재캡처·초기 포커스 재실행이 반복되므로 ref에 보관해 최신값만 읽는다.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const restoreFocus = useCallback(() => {
    if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
      triggerRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    const keyboardTarget: Document | Window = eventTarget === 'window' ? window : document;
    const handleKeyDown = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return;

      if (event.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === firstElement || !containerRef.current?.contains(activeElement)) {
          lastElement.focus();
          event.preventDefault();
        }
        return;
      }

      if (activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    };

    keyboardTarget.addEventListener('keydown', handleKeyDown);
    focusInitialElement(containerRef.current, initialFocusRef?.current);

    return () => {
      keyboardTarget.removeEventListener('keydown', handleKeyDown);
      if (restoreOnCleanup) {
        restoreFocus();
      }
    };
  }, [containerRef, eventTarget, initialFocusRef, isOpen, restoreFocus, restoreOnCleanup]);

  return { restoreFocus };
};
