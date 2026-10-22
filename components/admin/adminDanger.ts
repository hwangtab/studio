/**
 * 관리자 화면의 되돌릴 수 없는 동작(삭제·취소·해지·환불·퇴실) 모양 — 한 곳에서만 정한다.
 *
 * 예전에는 같은 성격의 버튼이 화면마다 달랐다: 계약 '삭제'만 빨강, '계약 취소'·'해지 처리'는 회색 ghost,
 * 지출 '삭제'·회차 취소·환불은 파랑 weak, 상점 '전액 환불'은 파랑 solid(2026-10-22 점검). 파랑은 이 관리자에서
 * "다음 단계로 가는 동작"이라, 되돌릴 수 없는 동작이 같은 색이면 손이 먼저 나간다.
 *
 * - 동작 줄 안의 보조 버튼: `<Button variant="ghost" className={DANGER_GHOST_CLASS}>`
 * - 그 동작만을 위한 폼의 제출 버튼(해지 사유·환불 금액을 적고 누르는 것): `<Button variant="weak" className={DANGER_WEAK_CLASS}>`
 * - 글자 링크 모양: `DANGER_TEXT_CLASS`
 *
 * 확인창(window.confirm·prompt)은 각 동작이 그대로 띄운다 — 모양만 바꾼다.
 */
export const DANGER_GHOST_CLASS = 'text-red-700 hover:bg-red-50 hover:text-red-800 focus-visible:ring-red-600/70';
export const DANGER_WEAK_CLASS = 'bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-600/70';
export const DANGER_TEXT_CLASS = 'text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/70';

/**
 * 동작 줄의 끝에 되돌릴 수 없는 동작을 모으는 묶음 — 넓은 화면에서는 오른쪽 끝으로 밀고 세로 구분선으로 가른다(2026-10-22 운영자 결정).
 * 예전엔 '계약 취소 → 복제해서 새 계약 → 삭제'처럼 위험 동작이 평범한 동작 사이에 끼어 있어 손이 잘못 갔다.
 * 좁은 화면에서는 줄바꿈되어 맨 아래 줄에 선다(구분선 없음).
 */
export const DANGER_GROUP_CLASS = 'flex flex-wrap gap-2 sm:ml-auto sm:border-l sm:border-gray-200 sm:pl-3';
