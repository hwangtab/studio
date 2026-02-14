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

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
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
        onClose?.();
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
  }, [containerRef, eventTarget, initialFocusRef, isOpen, onClose, restoreFocus, restoreOnCleanup]);

  return { restoreFocus };
};
