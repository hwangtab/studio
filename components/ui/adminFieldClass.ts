/**
 * 관리자 화면(pages/admin/**)과 계약 서명·완료 화면은 다크 모드를 지원하지 않는다 —
 * 두 화면 모두 `dark:`를 라이트 값으로 고정해 종이처럼 항상 밝게 보이도록 만들어져 있다.
 * 공용 컨트롤(`fieldControlClass`)의 다크 분기만 여기서 되돌린다. 반경·포커스·비활성
 * 규칙은 정본(`components/ui/Field.tsx`)을 그대로 따른다 — 값을 여기에 베끼지 않는다.
 */
export const lightOnlyControl =
  'dark:bg-white dark:text-gray-900 dark:border-gray-300 dark:placeholder:text-gray-400 dark:focus-visible:ring-offset-white';

/** `Field` 래퍼(레이블·필수 표시·힌트·에러)의 다크 분기를 같은 이유로 되돌린다. */
export const lightOnlyField =
  'dark:[&>label]:text-gray-700 dark:[&>label>span]:text-red-600 dark:[&>p]:text-gray-500 dark:[&>p[role=alert]]:text-red-600';
