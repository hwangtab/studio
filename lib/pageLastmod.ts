// 정적 페이지의 "최종 수정" 정본 — lib/sitemap/pageLastmod.json (git 마지막 커밋 시각).
//
// 사이트맵 <lastmod>와 같은 소스를 쓴다. 파일 mtime을 쓰면 Vercel 얕은 클론 때문에 배포마다
// 전 페이지가 "방금 수정됨"이 되므로(CLAUDE.md "lastmod 정책"), 화면 표기·JSON-LD dateModified도
// 반드시 여기서 읽는다. 항목이 없으면 null — 호출부는 표기를 생략한다(가짜 날짜 금지).
//
// 갱신은 `npm run generate:page-lastmod` 후 실제로 바뀐 라우트만 남겨 커밋한다.

import pageLastmod from './sitemap/pageLastmod.json';

const TABLE = pageLastmod as Record<string, string>;

/** 페이지 파일 키(예: 'pages/[locale]/recording.tsx')로 ISO 시각을 얻는다. */
export function getPageLastmod(pageFile: string): string | null {
  const iso = TABLE[pageFile];
  return typeof iso === 'string' && iso.length > 0 ? iso : null;
}

/**
 * 로케일을 뺀 라우트('/recording', '/', '/mixing-mastering')로 ISO 시각을 얻는다.
 * 라우트와 페이지 파일의 대응은 pages/[locale]/<route>.tsx 관례를 따른다.
 */
export function getRouteLastmod(route: string): string | null {
  const trimmed = route.replace(/^\/+|\/+$/g, '');
  const file = trimmed === '' ? 'pages/[locale]/index.tsx' : `pages/[locale]/${trimmed}.tsx`;
  return getPageLastmod(file);
}

/** 화면 표기용 YYYY-MM-DD. 항목이 없으면 null. */
export function formatLastmodDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
