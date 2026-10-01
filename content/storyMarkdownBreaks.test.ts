import fs from 'fs';
import path from 'path';

/**
 * 스토리 본문에서 마크다운이 조용히 깨지는 두 패턴을 CI에서 막는다(2026-10-01 전수 점검에서 45편).
 *
 * 1) 낱말 안의 `_`(파일명 `[곡명]_vocal.wav` 등)는 이탤릭 짝으로 읽혀 밑줄이 사라지고 사이 글자가 기울어진다.
 *    `\_`로 이스케이프하거나 `코드`로 감싼다.
 * 2) `**- 항목**`처럼 굵게 안에 목록 기호를 넣으면 목록이 되지 않고 굵은 글씨 한 줄이 된다.
 */
const DIR = path.join(process.cwd(), 'content/stories');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'));

const bodyLines = (file: string) => {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
  const head = raw.match(/^---\n[\s\S]*?\n---\n/);
  const body = head ? raw.slice(head[0].length) : raw;
  let inFence = false;
  const lines: Array<{ n: number; text: string }> = [];
  body.split('\n').forEach((text, i) => {
    if (/^\s*```/.test(text)) {
      inFence = !inFence;
      return;
    }
    if (!inFence) lines.push({ n: i + 1, text });
  });
  return lines;
};

describe('스토리 마크다운 깨짐 가드', () => {
  it('낱말 안의 밑줄은 이스케이프돼 있다', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const { n, text } of bodyLines(file)) {
        if (!text.includes('_')) continue;
        const parts = text.split(/(`[^`]*`|\]\([^)]*\)|https?:\/\/\S+)/);
        const hit = parts.some(
          (p, i) => i % 2 === 0 && /(?<![\\_])_(?!_)/.test(p) && /[\w가-힣\]\[](?<!\\)_[\w가-힣\[\]]/.test(p)
        );
        if (hit) offenders.push(`${file}:${n}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('굵게 안에 목록 기호를 넣지 않는다', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const { n, text } of bodyLines(file)) {
        // `**- 스튜디오 놀 드림 -**`처럼 양쪽을 대시로 감싼 서명은 장식이라 허용한다.
        if (/^\*\*[-•·]\s/.test(text) && !/\s-\*\*\s*$/.test(text)) offenders.push(`${file}:${n}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
