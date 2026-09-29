import { renderToStaticMarkup } from 'react-dom/server';
import { compiler } from 'markdown-to-jsx';

import { CONTRACT_MARKDOWN_OPTIONS } from './html-escape';

/**
 * 계약 본문·이용수칙 마크다운을 HTML 문자열로 렌더링한다.
 *
 * PDF는 문자열 HTML을 Chromium에 넣어 인쇄하므로 마크다운을 직접 넣으면 표가
 * `| 구분 | 내용 |` 그대로 노출된다. 화면(관리자·서명 페이지)이 쓰는 markdown-to-jsx를
 * 서버에서 그대로 렌더링해 PDF와 화면의 결과를 일치시킨다. 옵션도 화면과 같은 것을 쓴다
 * (CONTRACT_MARKDOWN_OPTIONS — 계약서에는 URL을 싣지 않는다).
 */
export const renderMarkdown = (markdown: string): string =>
  // <Markdown> 컴포넌트도 내부에서 이 compiler를 부른다 — 화면과 같은 결과가 나온다.
  renderToStaticMarkup(compiler(markdown, CONTRACT_MARKDOWN_OPTIONS));
