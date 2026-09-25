#!/usr/bin/env node
/**
 * 스크린샷망 — 디자인 v2 전후를 같은 조건으로 찍고 픽셀 단위로 비교한다.
 *
 * 매트릭스: 핵심 5페이지 × 데스크톱(1440)/모바일(390) × 라이트/다크
 *         + th·vi·uz 홈 모바일(대형 제목·좌측정렬이 다문자에서 깨지는지 보는 자리).
 *
 * 사용:
 *   # 로컬 프로덕션 빌드를 띄운다 — VERCEL_ENV가 없으면 미들웨어가 프로덕션으로 308한다
 *   VERCEL_ENV=preview npx next start -p 3100
 *   node scripts/visual/screenshots.mjs capture --out .visual/shots/branch [--base http://localhost:3100]
 *   node scripts/visual/screenshots.mjs compare .visual/shots/main .visual/shots/branch
 *
 * 결정성: 모션은 prefers-reduced-motion으로 끈다(hero-zoom·전환 페이드가 찍는 순간마다
 * 다르다). 지연 로딩 이미지는 끝까지 천천히 스크롤해 불러온 뒤 맨 위로 돌아와 찍는다.
 * 후기 캐러셀·DB 채움 영역처럼 원래 흔들리는 구역이 있으니 compare의 임계값은 0이 아니다.
 *
 * Chrome 경로는 CHROME_PATH로 바꿀 수 있다(기본: macOS 설치 경로). puppeteer-core는
 * 계약 PDF 렌더용으로 이미 의존성에 있다 — 이 도구를 위해 새 브라우저를 받지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PAGES = [
  ['home', '/ko'],
  ['release', '/ko/release-project'],
  ['pricing', '/ko/pricing'],
  ['mixing', '/ko/mixing-mastering'],
  ['stories', '/ko/stories'],
];
const VIEWPORTS = { d: { width: 1440, height: 900, isMobile: false }, m: { width: 390, height: 844, isMobile: true } };
const THEMES = ['light', 'dark'];
const LOCALE_HOMES = ['th', 'vi', 'uz'];

function matrix() {
  const shots = [];
  for (const [name, route] of PAGES) {
    for (const vp of Object.keys(VIEWPORTS)) {
      for (const theme of THEMES) shots.push({ id: `${name}-${vp}-${theme}`, route, vp, theme });
    }
  }
  for (const loc of LOCALE_HOMES) shots.push({ id: `home-${loc}-m-light`, route: `/${loc}`, vp: 'm', theme: 'light' });
  return shots;
}

async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await Promise.all(
      [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); })),
    );
    await document.fonts.ready;
  });
  await new Promise((r) => setTimeout(r, 400));
}

async function capture(outDir, base) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  try {
    for (const shot of matrix()) {
      const page = await browser.newPage();
      const vp = VIEWPORTS[shot.vp];
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: shot.theme },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ]);
      // 테마는 media 에뮬레이션만으로는 부족하다. theme-init은 localStorage 'darkMode'를
      // 시스템 설정보다 먼저 보고, Layout은 마운트 때 현재 테마를 거기 저장한다 — 같은
      // 브라우저에서 라이트 샷을 먼저 찍으면 뒤의 "다크" 샷이 전부 라이트로 찍힌다(실제로 그랬다).
      await page.evaluateOnNewDocument((dark) => {
        try { localStorage.setItem('darkMode', dark ? 'true' : 'false'); } catch { /* 무시 */ }
      }, shot.theme === 'dark');
      const res = await page.goto(base + shot.route, { waitUntil: 'networkidle2', timeout: 90000 });
      const finalUrl = page.url();
      if (!finalUrl.startsWith(base)) {
        // 로컬 next start에 VERCEL_ENV를 안 주면 여기로 온다 — 내 빌드가 아니라 프로덕션을 찍게 된다.
        throw new Error(`${shot.route} → ${finalUrl} 로 리다이렉트됨. VERCEL_ENV=preview로 서버를 띄웠는지 확인`);
      }
      await settle(page);
      await page.screenshot({ path: path.join(outDir, `${shot.id}.png`), fullPage: true });
      console.log(`✓ ${shot.id} (${res?.status()})`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function diffPair(a, b, out) {
  const [ma, mb] = await Promise.all([sharp(a).metadata(), sharp(b).metadata()]);
  const width = Math.min(ma.width, mb.width);
  const height = Math.min(ma.height, mb.height);
  const raw = (f) => sharp(f).extract({ left: 0, top: 0, width, height }).ensureAlpha().raw().toBuffer();
  const [ra, rb] = await Promise.all([raw(a), raw(b)]);
  const mask = Buffer.alloc(width * height * 4);
  let diff = 0;
  for (let i = 0; i < ra.length; i += 4) {
    const d = Math.abs(ra[i] - rb[i]) + Math.abs(ra[i + 1] - rb[i + 1]) + Math.abs(ra[i + 2] - rb[i + 2]);
    if (d > 30) {
      diff++;
      mask[i] = 255; mask[i + 1] = 0; mask[i + 2] = 64; mask[i + 3] = 255;
    } else {
      // 바뀌지 않은 곳은 흐리게 — 차이가 눈에 띄도록
      mask[i] = rb[i]; mask[i + 1] = rb[i + 1]; mask[i + 2] = rb[i + 2]; mask[i + 3] = 60;
    }
  }
  if (diff) await sharp(mask, { raw: { width, height, channels: 4 } }).png().toFile(out);
  return { ratio: diff / (width * height), heightDelta: mb.height - ma.height };
}

async function compare(dirA, dirB, threshold) {
  const outDir = path.join(dirB, '_diff');
  fs.mkdirSync(outDir, { recursive: true });
  let over = 0;
  for (const f of fs.readdirSync(dirA).filter((x) => x.endsWith('.png')).sort()) {
    const b = path.join(dirB, f);
    if (!fs.existsSync(b)) { console.log(`? ${f} 비교 대상 없음`); continue; }
    const { ratio, heightDelta } = await diffPair(path.join(dirA, f), b, path.join(outDir, f));
    const flag = ratio > threshold || heightDelta !== 0;
    if (flag) over++;
    console.log(`${flag ? '✗' : '✓'} ${f.padEnd(28)} 픽셀 ${(ratio * 100).toFixed(2)}% · 높이 ${heightDelta >= 0 ? '+' : ''}${heightDelta}px`);
  }
  console.log(`\n임계 ${(threshold * 100).toFixed(2)}% 초과·높이 변화 ${over}건 — 차이 이미지: ${path.relative(process.cwd(), outDir)}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const opt = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : def;
};
if (cmd === 'capture') {
  await capture(path.resolve(opt('out', '.visual/shots/current')), opt('base', 'http://localhost:3100'));
} else if (cmd === 'compare') {
  const [a, b] = rest.filter((x, i) => !x.startsWith('--') && !(rest[i - 1] ?? '').startsWith('--'));
  await compare(path.resolve(a), path.resolve(b), Number(opt('threshold', '0.005')));
} else {
  console.error('사용: screenshots.mjs capture --out <dir> [--base URL] | compare <a> <b> [--threshold 0.005]');
  process.exit(2);
}
