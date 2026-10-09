import fs from 'fs';
import path from 'path';

/**
 * 버튼 모서리 체계는 하나다(2026-10-09 TDS 대조) — 글자 버튼은 shape="block"(rounded-xl), 원형 pill은 아이콘만 있는 버튼
 * (size="icon") 전용. 히어로는 알약, 카드는 사각처럼 자리마다 모양이 갈리던 것(35 vs 15)을 다시 만들지 않는다.
 */
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : walk(p);
    return /\.tsx$/.test(d.name) && !/\.test\.tsx$/.test(d.name) ? [p] : [];
  });

describe('버튼 모서리 — 글자 버튼에 pill을 쓰지 않는다', () => {
  it('shape="pill"인 <Button>은 모두 size="icon"이다', () => {
    const offenders: string[] = [];
    for (const file of [...walk(path.join(process.cwd(), 'components')), ...walk(path.join(process.cwd(), 'pages'))]) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/<Button\b[^>]*?shape="pill"[^>]*?>/gs)) {
        if (!/size="icon"/.test(m[0])) offenders.push(`${path.relative(process.cwd(), file)}: ${m[0].replace(/\s+/g, ' ').slice(0, 100)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
