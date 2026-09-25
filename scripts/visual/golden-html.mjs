#!/usr/bin/env node
/**
 * 골든 HTML — 디자인 v2 작업이 v1 페이지를 바꾸지 않았음을 증명하는 도구.
 *
 * 디자인 개편(v2)은 페이지 단위로 켠다. 공용 컴포넌트(SectionHeading·Section·Footer)에
 * v2 분기를 넣으면 "v1 경로는 그대로"라는 주장이 생기는데, 그걸 말이 아니라 빌드
 * 산출물로 확인한다. 시각 회귀를 잡는 테스트는 따로 없다 — tailwind.config.test.ts는
 * 클래스 정합성만 보고, 스냅샷은 SEO 하나뿐이라 섹션 제목 102곳이 바뀌어도 CI가 초록이다.
 *
 * 사용:
 *   # 1) 기준 커밋(main)에서 빌드한 뒤
 *   node scripts/visual/golden-html.mjs snapshot --out .visual/golden/main
 *   # 2) 작업 브랜치에서 빌드한 뒤
 *   node scripts/visual/golden-html.mjs snapshot --out .visual/golden/branch
 *   node scripts/visual/golden-html.mjs compare .visual/golden/main .visual/golden/branch \
 *        [--allow 'ko.html,en.html']   # 바뀌어도 되는 페이지(v2를 켠 페이지)
 *
 * compare는 허용 목록 밖의 HTML이 하나라도 다르면 exit 1.
 * CSS·_app 번들 gzip 크기 변화도 함께 출력한다(성능 게이트: CSS +3KB gz, _app ≤76KB gz).
 *
 * 정규화: 빌드마다 바뀌는 값(BUILD_ID, 청크·CSS 해시)만 지운다. 그 밖의 차이는
 * 전부 실제 차이로 본다 — 정규화를 넓히면 게이트가 무의미해진다.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const NEXT = path.join(ROOT, '.next');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function normalize(html, buildId) {
  let s = html;
  if (buildId) s = s.split(buildId).join('__BUILD_ID__');
  return s
    // JS 청크: 파일명 전체를 지운다. 해시뿐 아니라 공유 청크의 **번호**(8695.js → 8445.js)도
    // 청크 구성이 바뀌면 다시 매겨진다 — 공용 컴포넌트 하나만 고쳐도 무관한 페이지 수십 장의
    // <script src>가 달라져 게이트가 소음으로 선다. 어떤 스크립트를 싣는지는 콘텐츠가 아니다.
    .replace(/\/_next\/static\/chunks\/[^"'\s)]+\.js/g, '/_next/static/chunks/__CHUNK__.js')
    // 청크가 쪼개지거나 합쳐지면 <script> 개수도 바뀐다 — 연속된 청크 태그를 하나로 접는다.
    .replace(/(?:<script src="\/_next\/static\/chunks\/__CHUNK__\.js" defer=""><\/script>)+/g, '<script src="/_next/static/chunks/__CHUNK__.js" defer=""></script>')
    .replace(/(?:<link rel="preload" href="\/_next\/static\/chunks\/__CHUNK__\.js" as="script"\/>)+/g, '<link rel="preload" href="/_next/static/chunks/__CHUNK__.js" as="script"/>')
    // CSS·미디어 파일명의 콘텐츠 해시
    .replace(/(\/_next\/static\/(?:css|media)\/[^"'\s)]*?)[-.]?[0-9a-f]{8,20}(\.[a-z0-9]+)/g, '$1__HASH__$2');
}

function gzSize(file) {
  return zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
}

function bundleStats() {
  const css = walk(path.join(NEXT, 'static', 'css')).filter((f) => f.endsWith('.css'));
  const chunks = path.join(NEXT, 'static', 'chunks', 'pages');
  const app = fs.existsSync(chunks)
    ? fs.readdirSync(chunks).filter((f) => /^_app-.*\.js$/.test(f)).map((f) => path.join(chunks, f))
    : [];
  return {
    cssGz: css.reduce((a, f) => a + gzSize(f), 0),
    cssFiles: css.length,
    appGz: app.reduce((a, f) => a + gzSize(f), 0),
  };
}

function snapshot(outDir) {
  const pagesDir = path.join(NEXT, 'server', 'pages');
  if (!fs.existsSync(pagesDir)) {
    console.error('✗ .next/server/pages가 없습니다. 먼저 빌드하세요.');
    process.exit(2);
  }
  const buildId = fs.readFileSync(path.join(NEXT, 'BUILD_ID'), 'utf8').trim();
  const files = walk(pagesDir).filter((f) => f.endsWith('.html'));
  fs.rmSync(outDir, { recursive: true, force: true });
  const manifest = {};
  for (const f of files) {
    const rel = path.relative(pagesDir, f);
    const norm = normalize(fs.readFileSync(f, 'utf8'), buildId);
    manifest[rel] = crypto.createHash('sha256').update(norm).digest('hex');
    const dest = path.join(outDir, 'pages', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, norm);
  }
  const meta = { buildId, createdAt: new Date().toISOString(), pages: files.length, bundle: bundleStats() };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ meta, hashes: manifest }, null, 2));
  console.log(`✓ ${files.length}개 페이지 스냅샷 → ${path.relative(ROOT, outDir)}`);
  console.log(`  CSS ${(meta.bundle.cssGz / 1024).toFixed(1)}KB gz (${meta.bundle.cssFiles}개) · _app ${(meta.bundle.appGz / 1024).toFixed(1)}KB gz`);
}

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 80);
  return { at: i, before: a.slice(from, i + 120), after: b.slice(from, i + 120) };
}

function compare(dirA, dirB, allow) {
  const read = (d) => JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8'));
  const A = read(dirA);
  const B = read(dirB);
  // 스냅샷 당시의 정규화 규칙이 지금과 다를 수 있으니 저장본에 현재 규칙을 한 번 더 건다
  // (정규화는 멱등이다). 해시는 여기서 다시 계산한다.
  const rehash = (dir, M) => {
    for (const k of Object.keys(M.hashes)) {
      const norm = normalize(fs.readFileSync(path.join(dir, 'pages', k), 'utf8'), null);
      M.hashes[k] = crypto.createHash('sha256').update(norm).digest('hex');
    }
  };
  rehash(dirA, A);
  rehash(dirB, B);
  const keys = new Set([...Object.keys(A.hashes), ...Object.keys(B.hashes)]);
  const changed = [];
  const added = [];
  const removed = [];
  for (const k of [...keys].sort()) {
    if (!(k in A.hashes)) added.push(k);
    else if (!(k in B.hashes)) removed.push(k);
    else if (A.hashes[k] !== B.hashes[k]) changed.push(k);
  }
  const isAllowed = (k) => allow.some((pat) => (pat.endsWith('/') ? k.startsWith(pat) : k === pat));
  const violations = [...changed, ...added, ...removed].filter((k) => !isAllowed(k));

  console.log(`페이지 ${keys.size} · 변경 ${changed.length} · 추가 ${added.length} · 삭제 ${removed.length}`);
  const fmt = (n) => `${(n / 1024).toFixed(1)}KB`;
  const dCss = B.meta.bundle.cssGz - A.meta.bundle.cssGz;
  const dApp = B.meta.bundle.appGz - A.meta.bundle.appGz;
  console.log(`CSS gz ${fmt(A.meta.bundle.cssGz)} → ${fmt(B.meta.bundle.cssGz)} (${dCss >= 0 ? '+' : ''}${fmt(dCss)})`);
  console.log(`_app gz ${fmt(A.meta.bundle.appGz)} → ${fmt(B.meta.bundle.appGz)} (${dApp >= 0 ? '+' : ''}${fmt(dApp)})`);

  for (const k of changed.slice(0, 15)) {
    const a = normalize(fs.readFileSync(path.join(dirA, 'pages', k), 'utf8'), null);
    const b = normalize(fs.readFileSync(path.join(dirB, 'pages', k), 'utf8'), null);
    const d = firstDiff(a, b);
    console.log(`\n${isAllowed(k) ? '·' : '✗'} ${k} (첫 차이 @${d.at})\n  - ${d.before}\n  + ${d.after}`);
  }
  if (changed.length > 15) console.log(`\n… 외 ${changed.length - 15}개`);
  for (const k of added) console.log(`${isAllowed(k) ? '·' : '✗'} 추가: ${k}`);
  for (const k of removed) console.log(`${isAllowed(k) ? '·' : '✗'} 삭제: ${k}`);

  if (violations.length) {
    console.error(`\n✗ 허용 목록 밖 변경 ${violations.length}건 — v1 페이지가 바뀌었다.`);
    process.exit(1);
  }
  console.log('\n✓ 허용 목록 밖 변경 없음');
}

const [cmd, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
if (cmd === 'snapshot') {
  snapshot(path.resolve(opt('out') ?? '.visual/golden/current'));
} else if (cmd === 'compare') {
  const [a, b] = rest.filter((x, i) => !x.startsWith('--') && !(rest[i - 1] ?? '').startsWith('--'));
  const allow = (opt('allow') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!a || !b) {
    console.error('사용: compare <기준 디렉터리> <비교 디렉터리> [--allow a.html,b/]');
    process.exit(2);
  }
  compare(path.resolve(a), path.resolve(b), allow);
} else {
  console.error('사용: golden-html.mjs snapshot --out <dir> | compare <a> <b> [--allow ...]');
  process.exit(2);
}
