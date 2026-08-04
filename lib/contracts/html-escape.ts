/**
 * Escape user-controlled strings that are interpolated into HTML/Markdown output.
 */
export const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * 계약서 템플릿의 마크다운 표 셀에 들어가는 사용자 입력용.
 *
 * 막아야 하는 것은 두 가지다.
 *
 * 하나는 표 구조다. 파이프는 셀 구분자라, 이름에 `홍길동 | 보증금 면제 확정`을 넣으면
 * 계약서에 없던 칸과 문구가 생긴다(법적 문서에 임의 문구를 심는 경로). 개행도 표를 깨뜨린다.
 *
 * 다른 하나는 태그다. 이 문자열은 markdown-to-jsx를 거쳐 화면과 PDF에 렌더링되는데, 그
 * 렌더러는 인라인 HTML을 실제 태그로 살려낸다 — 표 셀에 넣은 `<script>`가 그대로 스크립트가 된다.
 *
 * 다만 HTML 이스케이프(`&` → `&amp;`, `'` → `&#039;`)를 쓰면 안 된다. 렌더러가 앰퍼샌드와
 * 따옴표를 이미 알아서 처리하므로 이중으로 처리돼, O'Brien이 계약서에 O&#039;Brien으로
 * 인쇄된다. 이름이 틀린 계약서는 그 자체로 분쟁거리다.
 *
 * 그래서 HTML 엔티티 대신 마크다운의 백슬래시 이스케이프를 쓴다. `\<`는 렌더러가 리터럴
 * 꺾쇠로 취급해 태그가 되지 않고, 화면에는 사용자가 입력한 그대로 보인다.
 */
export const escapeTableCell = (unsafe: string): string =>
  unsafe
    // 백슬래시를 먼저 — 나중에 하면 아래에서 붙인 이스케이프까지 다시 이스케이프한다.
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    // 개행은 셀 안 줄바꿈으로 바꾼다. 위의 꺾쇠 처리 뒤라야 이 태그가 살아남는다.
    .replace(/\n/g, '<br>');
