/**
 * `Field` 래퍼(레이블·필수 표시·힌트·에러)의 다크 분기를 라이트 값으로 되돌린다.
 * 관리자 화면(`pages/admin/**`)과 계약 서명·완료 화면은 종이처럼 항상 밝아야 하는데,
 * `theme-init.js`는 그 경로에도 `<html class="dark">`를 붙인다.
 *
 * 컨트롤 쪽 대응물은 여기 없다 — `TextInput`/`TextArea`/`Select`의 `light` prop을 쓴다.
 * 문자열로 `className`에 얹으면 twMerge 순서상 `dark:border-gray-300`이 `invalid`의
 * `dark:border-red-500`을 지운다(components/ui/Field.tsx 주석 참조).
 */
export const lightOnlyField =
  'dark:[&>label]:text-gray-700 dark:[&>label>span]:text-red-600 dark:[&>p]:text-gray-500 dark:[&>p[role=alert]]:text-red-600';
