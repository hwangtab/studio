import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'markdown-to-jsx';

/**
 * 계약 본문·이용수칙 마크다운을 HTML 문자열로 렌더링한다.
 *
 * PDF는 문자열 HTML을 Chromium에 넣어 인쇄하므로 마크다운을 직접 넣으면 표가
 * `| 구분 | 내용 |` 그대로 노출된다. 화면(관리자·서명 페이지)이 쓰는 markdown-to-jsx를
 * 서버에서 그대로 렌더링해 PDF와 화면의 결과를 일치시킨다.
 */
export const renderMarkdown = (markdown: string): string =>
  renderToStaticMarkup(createElement(Markdown, null, markdown));
