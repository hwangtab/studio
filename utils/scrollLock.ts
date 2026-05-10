// iOS Safari·Android Chrome에서 단순 `body { overflow: hidden }`은 touch scroll을
// 차단하지 못한다 — 모바일 브라우저가 viewport scroll을 별도로 다뤄 body overflow를
// 무시한다. 모바일 메뉴/모달 열림 상태에서 손가락 스크롤이 background로 전파되어
// `window.scrollY`가 변하고, MobileNav의 scroll 감지 onClose가 잘못 발동되던 버그.
//
// 표준 모바일 scroll lock 패턴: body를 position:fixed로 lift하고 top:-scrollY로
// 시각적 위치를 보존. 잠금 해제 시 원래 scroll 위치로 복원해 jump 없음.

let lockCount = 0;
let snapshot: {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  scrollY: number;
} | null = null;

export const lockBodyScroll = (): void => {
  if (typeof document === 'undefined') return;

  if (lockCount === 0) {
    const body = document.body;
    const scrollY = window.scrollY;
    snapshot = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      scrollY,
    };
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }

  lockCount += 1;
};

export const unlockBodyScroll = (): void => {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) return;

  lockCount -= 1;

  if (lockCount === 0 && snapshot !== null) {
    const body = document.body;
    body.style.overflow = snapshot.overflow;
    body.style.position = snapshot.position;
    body.style.top = snapshot.top;
    body.style.left = snapshot.left;
    body.style.right = snapshot.right;
    body.style.width = snapshot.width;
    // 잠금 해제 후 원래 scroll 위치 복원 — position:fixed 풀린 직후 jump 방지.
    window.scrollTo(0, snapshot.scrollY);
    snapshot = null;
  }
};
