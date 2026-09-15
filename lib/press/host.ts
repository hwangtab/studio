/**
 * 수신거부 링크 전용 호스트.
 *
 * 미들웨어(호스트 분기)와 당겨가기 엔드포인트(호스트 거부)가 같은 값을 봐야 한다.
 * 양쪽에 문자열을 따로 적어 두면 한쪽만 고쳐지는 날 격리가 조용히 풀린다.
 */
export const PRESS_HOST = 'press.studionol.co.kr';

/**
 * 미들웨어가 수신거부 핸들러에 토큰을 넘기는 통로.
 *
 * `press.studionol.co.kr/u/<token>`은 미들웨어가 `/api/press/unsubscribe/[token]`으로
 * rewrite하는데, **그때 Next가 목적지의 동적 세그먼트를 채우지 않고 쿼리도 전달하지
 * 않는다.** 핸들러에서 `req.query`가 통째로 `{}`였고 `req.url`은 원본 `/u/…` 그대로였다
 * (2026-09-15 로컬 재현 — 프로덕션에서는 유효한 토큰이 전부 400을 받고 있었다).
 * 그래서 문서화된 방식인 요청 헤더로 넘긴다.
 *
 * 이 헤더를 직접 요청에 끼워 넣어도 얻는 것이 없다 — 토큰은 어차피 HMAC으로 검증되므로
 * 위조 헤더는 "자기 토큰을 경로 대신 헤더에 넣은 것"과 같다.
 */
export const PRESS_UNSUB_TOKEN_HEADER = 'x-press-unsub-token';
