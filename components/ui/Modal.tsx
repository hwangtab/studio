import React, { useCallback, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { X } from '@/lib/lucide-icons';
import { useFocusTrapDialog } from '../../utils/useFocusTrapDialog';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollLock';
import { Button } from './Button';

/**
 * 모달 셸 — 배경·패널·머리(제목+닫기)·본문·바닥.
 *
 * `RewardModal`·`PortfolioDetailModal`이 각자 들고 있던 것(포커스 트랩·ESC·스크롤 잠금·
 * 바닥 시트)을 한 벌로. 모바일은 아래에서 올라오는 시트(`rounded-t-2xl`), sm부터 가운데
 * 카드(`rounded-2xl`). 패널은 솔리드 — 글래스 위에 폼·결제위젯을 올리지 않는다(§7).
 *
 * - 포커스 트랩은 `utils/useFocusTrapDialog`(iframe 포함 — 결제위젯 때문).
 * - ESC·배경 클릭이 `onClose`. 닫힐 때 포커스는 열었던 요소로 돌아간다.
 * - `aria-labelledby`는 `title`이 있으면 자동. 제목 없이 쓰면 `aria-label`을 줄 것.
 * - 포털을 쓰지 않는다 — 이 저장소의 모달은 전부 페이지 트리 끝에 렌더되고, `z-[60]`이면
 *   헤더(50)·FAB 위다.
 */
export type ModalSize = 'sm' | 'md' | 'lg';

const SIZE: Record<ModalSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** `title` 없이 쓸 때의 접근성 이름. */
  'aria-label'?: string;
  size?: ModalSize;
  /** 처음 포커스를 둘 요소. 기본은 닫기 버튼. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** 바닥 고정 영역(결제 바·확인 버튼). */
  footer?: React.ReactNode;
  closeLabel?: string;
  children: React.ReactNode;
  /** 본문 영역 className(기본 `p-6`). */
  bodyClassName?: string;
  className?: string;
}

export const Modal = ({
  open,
  onClose,
  title,
  'aria-label': ariaLabel,
  size = 'md',
  initialFocusRef,
  footer,
  closeLabel = '닫기',
  children,
  bodyClassName,
  className,
}: ModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = React.useId();

  const handleClose = useCallback(() => onClose(), [onClose]);

  useFocusTrapDialog({
    isOpen: open,
    containerRef: dialogRef,
    onClose: handleClose,
    initialFocusRef: initialFocusRef ?? closeRef,
  });

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-gray-900 sm:rounded-2xl',
          SIZE[size],
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
          {title ? (
            <h2 id={titleId} className="min-w-0 truncate typo-card-subtitle text-gray-900 dark:text-white">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <Button ref={closeRef} type="button" variant="ghost" size="icon" shape="pill" onClick={handleClose} aria-label={closeLabel}>
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain p-6', bodyClassName)}>{children}</div>
        {footer && <div className="border-t border-gray-100 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">{footer}</div>}
      </div>
    </div>
  );
};
