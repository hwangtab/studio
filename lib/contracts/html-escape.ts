import type { MarkdownToJSX } from 'markdown-to-jsx';

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

/**
 * 계약서 본문·이용수칙을 그리는 markdown-to-jsx 옵션. 화면(ContractContent·서명 페이지)과
 * PDF(renderMarkdown)가 같은 값을 써야 서명한 화면과 발급한 문서가 어긋나지 않는다.
 *
 * escapeTableCell은 표 구조와 태그를 막지만 마크다운의 링크·이미지 문법은 통과시킨다. 그래서
 * 서명자가 주소 칸에 `![](https://…)`를 적으면 PDF를 만드는 서버 크롬이 그 주소로 요청을
 * 보내고, 관리자 화면도 외부 이미지를 불러왔다. 불러온 그림은 문서 지문(본문 텍스트 해시)에
 * 묶이지 않으므로, 도장이 찍힌 PDF 안에 검토하지 않은 그림이 들어갈 수 있었다.
 *
 * 템플릿과 이용수칙에는 링크도 그림도 없다. 그래서 URL 속성을 전부 비운다 — sanitizer가
 * null을 돌려주면 href·src가 빠진다. 맨 URL이 링크로 바뀌지 않게 자동 링크도 끈다. 이 옵션은
 * 이미 저장된 본문에도 그대로 적용되므로 입력 쪽 이스케이프로는 못 막는 옛 값까지 막는다.
 */
export const CONTRACT_MARKDOWN_OPTIONS: MarkdownToJSX.Options = {
  disableAutoLink: true,
  sanitizer: () => null,
};
