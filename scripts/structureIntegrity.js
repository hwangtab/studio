'use strict';

/**
 * 마크다운의 "구조 지문"을 떠서 편집 전후를 비교한다.
 *
 * 윤문·심화가 프론트매터·제목·표·링크·디렉티브를 건드리지 않았음을 기계적으로
 * 증명하는 게 목적. 산문 텍스트 변화는 지문에 잡히지 않는다(그게 정상이다).
 *
 * 근거 스펙: docs/superpowers/specs/2026-07-27-story-quality-pilot-design.md 게이트 3
 */

const matter = require('gray-matter');

const LINK_RE = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g;
const DIRECTIVE_RE = /%%[A-Za-z0-9:_-]+%%/g;

function fingerprint(markdown) {
  const parsed = matter(markdown);
  const body = parsed.content;
  const lines = body.split('\n');

  const headings = [];
  const tableShape = [];
  let images = 0;
  let codeFences = 0;
  let inFence = false;

  lines.forEach((line) => {
    const s = line.trim();
    if (s.startsWith('```') || s.startsWith('~~~')) {
      codeFences += 1;
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const h = /^(#{1,6})\s+(.*)$/.exec(s);
    if (h) {
      const level = h[1].length;
      headings.push(`${level}:${h[2].trim()}`);
      return;
    }
    if (s.startsWith('|')) {
      const colCount = s.split('|').length - 1;
      tableShape.push(colCount);
    }
    if (/!\[[^\]]*\]\([^)]+\)/.test(s)) images += 1;
  });

  return {
    frontmatterKeys: Object.keys(parsed.data),
    frontmatter: parsed.data,
    tableRows: tableShape.length,
    tableShape,
    headings,
    links: [...body.matchAll(LINK_RE)].map((m) => m[1]),
    directives: body.match(DIRECTIVE_RE) || [],
    images,
    codeFences,
  };
}

function diffFingerprint(before, after) {
  const diffs = [];
  const cmp = (key) => {
    const a = JSON.stringify(before[key]);
    const b = JSON.stringify(after[key]);
    if (a !== b) diffs.push(`${key}: ${a} → ${b}`);
  };
  ['frontmatterKeys', 'frontmatter', 'headings', 'links', 'directives', 'tableShape'].forEach(cmp);
  ['tableRows', 'images', 'codeFences'].forEach((key) => {
    if (before[key] !== after[key]) diffs.push(`${key}: ${before[key]} → ${after[key]}`);
  });
  return diffs;
}

module.exports = { fingerprint, diffFingerprint };
