#!/usr/bin/env node
/**
 * 제작 문서에서 낭독선만 뽑아 성우용 대본을 만든다.
 *
 *   node scripts/soundtherapy-extract.mjs <script-NN.md> <read-NN.md> [--tone "..."]
 *
 * 손으로 옮기지 말 것 — 오타가 난다. 추출 후 원문과 글자 단위로 대조 검증한다.
 * 검증 실패 시 종료 코드 1.
 */
import fs from 'node:fs';
import path from 'node:path';

const [src, dst] = process.argv.slice(2);
if (!src || !dst) {
  console.error('사용: node scripts/soundtherapy-extract.mjs <제작문서.md> <낭독본.md> [--tone "톤 지시"]');
  process.exit(1);
}
const tone = (() => { const i = process.argv.indexOf('--tone'); return i > 0 ? process.argv[i + 1] : ''; })();

const raw = fs.readFileSync(src, 'utf8');
const meta = {
  title: (raw.match(/^##\s+(.+)$/m) || [, '제목 없음'])[1].trim(),
  sub: (raw.match(/^>\s*(발주.+)$/m) || [, ''])[1].trim(),
  len: (raw.match(/\|\s*재생 시간\s*\|\s*(.+?)\s*\|/) || [, ''])[1].replace(/\*/g, '').trim(),
};

const body = raw.split('## 4. 타임코드 대본')[1].split(/^## 5\./m)[0];
const out = [
  `# ${meta.title}`, '',
  `> 낭독용 대본${meta.len ? ` · 재생 시간 ${meta.len}` : ''} · Studio NOL`, '',
];
if (tone) out.push(`**톤** ${tone.replace(/\n/g, '  \n')}`, '');
out.push('`[N초]`는 **성우가 쉬는 시간이 아니라 청취자가 동작을 수행하는 시간**입니다. 임의로 줄이지 마세요.', '', '---', '');

let skipSpec = false;
for (const line of body.split('\n')) {
  const t = line.trimEnd();

  if (t.startsWith('### ')) { skipSpec = false; out.push('', `## ${t.slice(4).trim()}`, ''); continue; }
  if (t.startsWith('**연출**')) { out.push(`*${t.replace('**연출**', '연출 —').trim()}*`, ''); continue; }

  const pm = t.match(/^\*⏸\s*(\d+)초(.*?)\*$/);
  if (pm) {
    const note = pm[2].replace(/[—-]/g, '').trim();
    const skip = /실제 수행|BGM|사운드만/.test(note);
    out.push('', `\`[${pm[1]}초]\`${note && !skip ? ` *${note}*` : ''}`, '');
    continue;
  }

  if (t.startsWith('> ')) {
    const s = t.slice(2).trim();
    if (!s) continue;
    if (/^\*\*\[카운트 타이밍/.test(s)) { skipSpec = true; continue; }
    if (skipSpec) continue;
    if (s.startsWith('|') || /^`|^\[/.test(s)) continue;
    if (/^\*\*\[\d라운드\]\*\*/.test(s)) { out.push(`**${s.replace(/[*\[\]]/g, '')}**`, ''); continue; }
    if (s.startsWith('**') || /^(이 구조는|카운트 구간은|두 가지 길이)/.test(s)) continue;
    out.push(s + '  ');
    continue;
  }
  if (t.trim() === '---') skipSpec = false;
}

let txt = out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/ {2}\n\n/g, '\n\n');
txt += '\n\n---\n\nStudio NOL · 황경하 · 010-4255-7893\n';
fs.writeFileSync(dst, txt, 'utf8');

// ─── 원문 대조 검증 ─────────────────────────────────────────────────────────
const norm = (x) => x.replace(/\s/g, '');
const origLines = [];
skipSpec = false;
for (const line of body.split('\n')) {
  const t = line.trimEnd();
  if (t.startsWith('> ')) {
    const s = t.slice(2).trim();
    if (!s) continue;
    if (/^\*\*\[카운트 타이밍/.test(s)) { skipSpec = true; continue; }
    if (skipSpec) continue;
    if (s.startsWith('|') || /^`|^\[/.test(s) || s.startsWith('**')) continue;
    if (/^(이 구조는|카운트 구간은|두 가지 길이)/.test(s)) continue;
    origLines.push(norm(s));
  }
  if (t.trim() === '---') skipSpec = false;
}
const readLines = txt.split('\n---\n')[1].split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#') && !l.startsWith('*') && !l.startsWith('`') && !(l.startsWith('**') && l.endsWith('**')))
  .map(norm);

const a = origLines.join(''), b = readLines.join('');
const ok = a === b;
console.log(`${path.basename(dst)} 생성 — 원본 ${a.length}자 / 추출 ${b.length}자 · ${ok ? '\x1b[32m완전 일치 ✓\x1b[0m' : '\x1b[31m불일치 ✗\x1b[0m'}`);
if (!ok) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) { console.log(`  최초 차이 @${i}\n  원본: ${a.slice(Math.max(0, i - 40), i + 40)}\n  추출: ${b.slice(Math.max(0, i - 40), i + 40)}`); break; }
  }
  process.exit(1);
}
