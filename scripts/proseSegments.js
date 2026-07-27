'use strict';

/**
 * 마크다운을 "산문 블록"과 "구조 블록"으로 나눠, 산문만 윤문 파이프라인에
 * 태우기 위한 유틸.
 *
 * 설계 원칙: 구조(프론트매터·표·목록·제목·디렉티브·코드·인용·이미지·링크줄)는
 * 애초에 추출되지 않으므로 윤문이 훼손할 수 없다. 구조 줄이 한 줄이라도 섞인
 * 블록은 통째로 제외한다 — 부분 추출은 병합 시 어긋날 위험이 크다.
 *
 * 근거 스펙: docs/superpowers/specs/2026-07-27-story-quality-pilot-design.md
 */

const MARKER_PREFIX = '<<<SEG:';
const MARKER_LINE_RE = /^<<<SEG:(\d{3})>>>$/;

/** 구조 줄 판정. inFence면 코드블록 내부이므로 무조건 구조. */
function isStructureLine(line, inFence) {
  if (inFence) return true;
  const s = line.trim();
  if (s.startsWith('```') || s.startsWith('~~~')) return true;
  if (s.startsWith('|')) return true;
  if (/^[-*+]\s/.test(s)) return true;
  if (/^\d+[.)]\s/.test(s)) return true;
  if (/^#{1,6}\s/.test(s)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(s)) return true;
  if (s.startsWith('![')) return true;
  if (/^%%[A-Za-z:_-]+%%$/.test(s)) return true;
  if (/^\[[^\]]+\]\([^)]+\)$/.test(s)) return true;
  if (s.startsWith('>')) return true;
  return false;
}

/** 프론트매터가 끝나는 줄 index를 반환. 없으면 -1. */
function frontmatterEndLine(lines) {
  if (lines.length === 0 || lines[0].trim() !== '---') return -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') return i;
  }
  return -1;
}

/** 본문을 빈 줄 기준 블록으로 나눈다. 각 블록은 {start, end, lines, hasStructure}. */
function toBlocks(lines, bodyStart) {
  const blocks = [];
  let cur = null;
  let inFence = false;

  for (let i = bodyStart; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    const isFenceDelim = trimmed.startsWith('```') || trimmed.startsWith('~~~');

    if (trimmed === '' && !inFence) {
      if (cur) {
        blocks.push(cur);
        cur = null;
      }
      continue;
    }

    const structure = isStructureLine(line, inFence);
    if (!cur) cur = { start: i, end: i, lines: [], hasStructure: false };
    cur.lines.push(line);
    cur.end = i;
    if (structure) cur.hasStructure = true;

    if (isFenceDelim) inFence = !inFence;
  }
  if (cur) blocks.push(cur);
  return blocks;
}

/**
 * 산문 블록을 추출한다.
 * @returns {{segments: Array<{id:string,startLine:number,endLine:number,text:string}>, marked:string}}
 */
function extractProse(markdown) {
  const lines = markdown.split('\n');
  const fmEnd = frontmatterEndLine(lines);
  const bodyStart = fmEnd === -1 ? 0 : fmEnd + 1;

  const segments = [];
  toBlocks(lines, bodyStart).forEach((block) => {
    if (block.hasStructure) return;
    const id = String(segments.length + 1).padStart(3, '0');
    segments.push({
      id,
      startLine: block.start,
      endLine: block.end,
      text: block.lines.join('\n'),
    });
  });

  const marked = segments.map((s) => `${MARKER_PREFIX}${s.id}>>>\n${s.text}`).join('\n\n');
  return { segments, marked };
}

/** 마커 텍스트를 {id: text} 맵으로 파싱한다. */
function parseMarked(marked) {
  const map = new Map();
  const order = [];
  let curId = null;
  let buf = [];

  const flush = () => {
    if (curId === null) return;
    map.set(curId, buf.join('\n').replace(/^\n+|\n+$/g, ''));
    buf = [];
  };

  marked.split('\n').forEach((line) => {
    const m = MARKER_LINE_RE.exec(line.trim());
    if (m) {
      flush();
      curId = m[1];
      order.push(curId);
      return;
    }
    if (curId !== null) buf.push(line);
  });
  flush();
  return { map, order };
}

/**
 * 윤문된 마커 텍스트를 원본 마크다운 제자리에 되돌린다.
 * 마커 집합이 원본과 다르거나 내용이 비면 throw — 조용한 어긋남을 허용하지 않는다.
 */
function mergeProse(markdown, rewrittenMarked) {
  const { segments } = extractProse(markdown);
  const { map, order } = parseMarked(rewrittenMarked);

  const expected = segments.map((s) => s.id);
  const missing = expected.filter((id) => !map.has(id));
  if (missing.length > 0) {
    throw new Error(`윤문 결과에 마커가 누락됐습니다: ${missing.join(', ')}`);
  }
  const extra = order.filter((id) => !expected.includes(id));
  if (extra.length > 0) {
    throw new Error(`윤문 결과에 없던 마커가 있습니다: ${extra.join(', ')}`);
  }
  if (order.length !== expected.length) {
    throw new Error(`마커 개수 불일치: 기대 ${expected.length}, 실제 ${order.length}`);
  }
  const empty = expected.filter((id) => map.get(id).trim() === '');
  if (empty.length > 0) {
    throw new Error(`윤문 결과 세그먼트가 비어 있습니다: ${empty.join(', ')}`);
  }

  const lines = markdown.split('\n');
  // 뒤에서부터 치환해야 앞쪽 인덱스가 밀리지 않는다
  [...segments].reverse().forEach((s) => {
    lines.splice(s.startLine, s.endLine - s.startLine + 1, ...map.get(s.id).split('\n'));
  });
  return lines.join('\n');
}

module.exports = { extractProse, mergeProse, isStructureLine };
