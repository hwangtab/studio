/**
 * 앵커 이동 뒤 주소의 해시만 바꾼다 — **Next 라우터의 히스토리 상태를 지우지 않고.**
 *
 * `history.replaceState(null, '', '#id')`는 현재 항목에 Next가 넣어 둔 `{url, as, options, __N, key}`를 통째로 지운다.
 * 그 뒤 클라이언트 이동을 한 번 거쳐 뒤로가기를 누르면 Next onPopState가 `!state` 분기로 빠져 URL만 되돌리고 라우트
 * 전환을 하지 않는다 — 주소는 이전 페이지인데 화면은 그대로다(스토리 목차·가격표 앵커에서 실측 재현). 기존 state를
 * 그대로 넘기면 key가 남아 뒤로가기 복원과 스크롤 복원이 유지된다. `as`에 해시를 넣지 않는 이유: 넣으면 복귀 때
 * scrollToHash가 _app의 위치 복원을 덮는다.
 */
export const replaceHashPreservingState = (id: string): void => {
  if (typeof window === 'undefined' || typeof window.history === 'undefined') return;
  window.history.replaceState(window.history.state, '', `#${id}`);
};
