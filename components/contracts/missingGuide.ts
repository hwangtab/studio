/**
 * 서명 화면의 "빠진 항목" 안내 — 연습실·제작 계약 서명 화면이 함께 쓴다.
 *
 * 예전엔 필수 칸·체크가 하나라도 비면 맨 아래 서명 버튼이 흐려지고 눌리지 않았다. 안내는 버튼 아래 한 줄("모든 동의 항목에
 * 체크해 주세요")뿐이라, 휴대폰에서 16화면이 넘는 계약서를 다시 올라가며 무엇을 놓쳤는지 찾아야 했다(운영자 지적 2026-10-20).
 * 이제 버튼은 늘 눌리고, 빠진 게 있으면 첫 항목으로 화면을 옮기고(입력 칸이면 커서까지) 그 자리를 빨갛게 표시한다.
 */
export interface MissingItem {
  /** 화면 요소의 id — 입력 칸이면 그 칸, 체크박스면 그 label, 서명이면 서명 칸을 감싼 요소. */
  id: string;
  /** 남은 항목 목록에 보일 이름. */
  label: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** id의 요소로 화면을 옮긴다. 움직임 줄이기 설정이면 바로 옮긴다. 요소가 없으면 false. */
export const scrollToElementId = (id: string, block: ScrollLogicalPosition = 'start'): boolean => {
  if (typeof document === 'undefined') return false;
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block });
  return true;
};

/**
 * 포커스를 받을 요소를 고른다: 입력 칸이면 그 칸, 그 안에 입력 칸이 있으면(체크박스 label) 그것,
 * 없으면 `tabindex`를 가진 래퍼 자체(서명 칸 — 캔버스는 포커스를 받지 못한다), 마지막으로 안의 버튼.
 */
const pickFocusable = (target: HTMLElement): HTMLElement | null => {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target;
  const field = target.querySelector<HTMLElement>('input, textarea');
  if (field) return field;
  if (target.hasAttribute('tabindex')) return target;
  return target.querySelector<HTMLElement>('button');
};

/** 첫 빠진 항목으로 화면을 옮기고 포커스를 둔다. 움직임 줄이기 설정이면 바로 옮긴다. */
export const focusFirstMissing = (items: readonly MissingItem[]): void => {
  const first = items[0];
  if (!first || typeof document === 'undefined') return;
  const target = document.getElementById(first.id);
  if (!target) return;
  scrollToElementId(first.id, 'center');
  // 입력 칸·체크박스면 바로 고칠 수 있게 포커스를 준다(스크롤은 위에서 했다).
  pickFocusable(target)?.focus({ preventScroll: true });
};

/** 빠진 항목을 빨갛게 둘러 보이는 클래스 — 체크박스 label·서명 칸에 덧붙인다(입력 칸은 Field의 error가 맡는다). */
export const MISSING_RING = 'ring-2 ring-red-500 ring-offset-2';
