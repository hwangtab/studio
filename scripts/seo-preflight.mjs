#!/usr/bin/env node
/**
 * SEO 분석 프리플라이트 — GSC/GA4를 열기 전에 반드시 먼저 실행한다.
 *
 *   node scripts/seo-preflight.mjs [--days 45]
 *
 * 왜 있는가:
 *   2026-08-14~18 라운드에서 같은 유형의 오진이 네 번 났다. 전부 "데이터를 잘못 읽어서"가
 *   아니라 "데이터를 읽기 전에 확인했어야 할 것을 안 읽어서" 났다.
 *
 *   1. practice-room-transfer1이 의도적 noindex(8621b269da)인데 "고쳐야 할 문제"로 보고.
 *   2. 2026-08-04에 이미 고친 폼 오류(780a1631cb)를 "현재 문제"로 보고 — 90일 창에 수정 전
 *      기간이 대부분이었다.
 *   3. 7/26~8/4 전환 작업이 진행 중인데 같은 내용을 "남은 갭"으로 제안. 8/17 커밋
 *      (93b788596a)이 이미 처리한 것도 또 제안.
 *   4. 90일 롤링 스냅샷 두 개를 빼서 "증분"이라 부르고 "타이틀 수술 실패" 결론 — 기간지정으로
 *      다시 재니 5편이 +34~+546% 성공이었다.
 *
 *   공통 원인은 하나다: **커밋 이력과 열린 실험을 먼저 안 봤다.** 그래서 이 스크립트가
 *   그 둘을 강제로 먼저 보여준다.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const parsedDays = Number.parseInt(argOf('days', '45'), 10);
const DAYS = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 45;

// 실행일. --today로 고정 가능(테스트·재현용). ISO 형식이 아니면 무시하고 오늘로.
const todayArg = argOf('today');
const TODAY = /^\d{4}-\d{2}-\d{2}$/.test(todayArg || '') ? todayArg : new Date().toISOString().slice(0, 10);

const daysBetween = (a, b) =>
  Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 864e5);

// 셸을 거치지 않는다 — 인자를 배열로 넘겨 메타문자 해석 자체를 없앤다.
const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const H = (n, t) => console.log(`\n── ${n}. ${t}`);
const warn = (t) => console.log(`  ⚠ ${t}`);

console.log(`════ SEO 분석 프리플라이트 · ${TODAY}`);
console.log('GSC/GA4 데이터를 해석하기 전에 이 출력을 먼저 읽어라.');

// ─────────────────────────────────────────────────────────────────
H(1, `최근 ${DAYS}일 SEO·전환·콘텐츠 커밋 — "이미 한 일"`);

const log = git([
  'log', `--since=${DAYS} days ago`, '--date=short', '--format=%ad|%h|%s',
]).split('\n').filter(Boolean);

const RELEVANT = /seo|geo|aeo|ctr|conversion|전환|content|콘텐츠|cta|링크|link|pricing|가격|redirect|리다이렉트|schema|스키마|noindex|sitemap|사이트맵/i;
const hits = log.filter((l) => RELEVANT.test(l.split('|')[2] || ''));

if (!hits.length) {
  console.log('  (해당 커밋 없음)');
} else {
  for (const l of hits.slice(0, 25)) {
    const [d, h, s] = l.split('|');
    console.log(`  ${d}  ${h}  ${s.slice(0, 92)}`);
  }
  if (hits.length > 25) console.log(`  … 외 ${hits.length - 25}건`);
}
warn('여기 있는 작업을 "남은 갭"으로 다시 제안하지 마라. 문제를 발견하면 먼저');
warn('`git log --oneline -S"<키워드>"` 로 이미 처리됐는지 확인한 뒤 말할 것.');

// ─────────────────────────────────────────────────────────────────
H(2, '열린 실험 — 측정 중인 페이지 (건드리면 판정 불가)');

const logPath = path.join(ROOT, 'docs/ctr-surgery-log.md');
if (!fs.existsSync(logPath)) {
  console.log('  docs/ctr-surgery-log.md 없음');
} else {
  const rows = fs.readFileSync(logPath, 'utf8').split('\n')
    .filter((l) => l.startsWith('| ') && l.includes('🔒'));
  if (!rows.length) console.log('  (측정 중인 실험 없음)');
  for (const r of rows) {
    const cells = r.split('|').map((c) => c.trim());
    const slug = cells[1];
    // 리뷰일은 행 안의 마지막 ISO 날짜가 아니라 '리뷰일' 열(5번째 데이터 셀)에서 찾는다.
    const review = (cells[5] || '').match(/20\d{2}-\d{2}-\d{2}/)?.[0];
    if (!review) { console.log(`  ${slug.padEnd(30)} 리뷰일 파싱 실패 — 로그 표를 직접 볼 것`); continue; }
    const left = daysBetween(TODAY, review);
    const state = left > 0 ? `${left}일 남음` : left === 0 ? '오늘 도래' : `${-left}일 경과 — 판정하라`;
    console.log(`  ${slug.padEnd(30)} 리뷰일 ${review}  (${state})`);
  }
  warn('측정 중(🔒) 페이지의 타이틀·summary·본문을 수정하면 실험이 무효가 된다.');
  warn('판정은 반드시 scripts/ctr-verdict.mjs로 — 90일 CSV 스냅샷 차분은 판정을 뒤집는다.');
}

// ─────────────────────────────────────────────────────────────────
H(3, '관측창 — 최근 통합/리다이렉트 (효과 측정 진행 중)');

const RM = 'lib/regionRedirectMap.json';
// Google이 308을 처리하고 순위가 재배치되기까지 통상 2~4주.
const WINDOW_DAYS = 28;

// 창 안의 **모든** 커밋을 훑는다. 예전에는 `git log -1`로 마지막 커밋 하나만 봐서,
// 같은 날 등재된 다른 커밋이 통째로 누락됐다. 2026-08-19에 실제로 두 건을 놓쳤다
// — 8/14 같은 날 8edb2dfbf1(voice-acting-rate1 → voice-actor-hiring-quote-cost)과
// 1e26671388이 함께 있었는데 뒤엣것만 보고됐다.
const windowStart = new Date(`${TODAY}T00:00:00Z`);
windowStart.setUTCDate(windowStart.getUTCDate() - WINDOW_DAYS);
const since = windowStart.toISOString().slice(0, 10);

// 시각을 자정으로 못 박는다. git은 맨 날짜(`--since=2026-08-14`)를 "그날의 현재 시각"으로
// 해석해서, 같은 스크립트가 아침에 돌 때와 저녁에 돌 때 창 경계가 하루씩 달라졌다.
const rmLog = git(['log', `--since=${since}T00:00:00`, '--format=%h %ad', '--date=short', '--', RM]);
const rmCommits = rmLog ? rmLog.split('\n').map((l) => l.trim().split(/\s+/)) : [];

// diff 한 줄에서 "출발": "승자" 쌍을 뽑는다. 승자(목적지)를 같이 봐야 하는 이유는
// 수정을 피해야 할 페이지가 출발이 아니라 **승자**이기 때문이다. 출발은 308로
// 넘어가 아무도 안 고치지만, 승자의 본문·H2를 건드리면 통합 효과가 교락된다.
const pairsOf = (diff, sign) => {
  const out = new Map();
  for (const line of diff) {
    if (!line.startsWith(sign) || line.startsWith(`${sign}${sign}`)) continue;
    const m = line.slice(1).match(/^\s*"([^"]+)"\s*:\s*"([^"]+)"/);
    if (m) out.set(m[1], m[2]);
  }
  return out;
};

if (!rmCommits.length) {
  const lastDate = git(['log', '-1', '--format=%ad', '--date=short', '--', RM]);
  console.log(lastDate
    ? `  최근 ${WINDOW_DAYS}일 내 308 등재 없음 (마지막 변경 ${lastDate} — 관측창 종료)`
    : '  (regionRedirectMap 변경 이력 없음)');
} else {
  const winners = new Map(); // 승자 → 남은 일수 최댓값 (가장 늦게 등재된 건 기준)
  for (const [hash, date] of rmCommits) {
    const diff = git(['show', hash, '--', RM]).split('\n');
    const removed = pairsOf(diff, '-');
    // 쉼표만 바뀐 줄(마지막 항목 뒤 ',')은 신규 등재가 아니다. 값까지 같으면 제외.
    const added = [...pairsOf(diff, '+')].filter(([k, v]) => removed.get(k) !== v);
    const age = daysBetween(date, TODAY);
    const left = WINDOW_DAYS - age;
    if (!added.length) continue;
    console.log(`  ${date}  ${hash}  ${added.length}건 등재 (${age}일 경과${left > 0 ? `, ${left}일 남음` : ', 창 종료'})`);
    for (const [from, to] of added) {
      console.log(`      ${from}  →  ${to}`);
      if (left > 0 && (winners.get(to) ?? -Infinity) < left) winners.set(to, left);
    }
  }
  if (winners.size) {
    console.log('');
    console.log(`  🔒 수정 금지 — 관측 중인 승자 페이지 ${winners.size}건 (본문·H2·타이틀 전부):`);
    for (const [slug, left] of [...winners].sort((a, b) => b[1] - a[1])) {
      console.log(`      ${slug.padEnd(34)} ${left}일 남음`);
    }
    warn('Google 미처리 구간이다. 승자 페이지의 순위 변화를 지금 판정하지 말고,');
    warn('본문·H2도 수정하지 마라 — 통합 효과와 교락돼 둘 다 판정 불가가 된다.');
  } else {
    console.log('  → 창 안의 등재가 모두 28일을 넘겼다. 이제 승자 페이지 순위를 판정해도 된다.');
  }
}

// ─────────────────────────────────────────────────────────────────
H(4, '최근 진단 문서 — 같은 진단을 다시 쓰지 마라');

const docs = fs.readdirSync(path.join(ROOT, 'docs'))
  .filter((f) => /^diagnosis-|^near-duplicate-|-seo|-audit/.test(f) && f.endsWith('.md'))
  .sort().slice(-6);
for (const d of docs) console.log(`  docs/${d}`);

// ─────────────────────────────────────────────────────────────────
H(5, '데이터 판독 함정 — 전부 실제로 당한 것');

const traps = [
  ['앵커(#) 행', 'page-all/page-query의 "…slug#섹션" 행은 별개 페이지가 아니라 목차 점프링크다. '
    + '제외하지 않으면 노출이 ~13% 부풀고 CTR이 낮게 나온다(2.19% vs 실질 2.51%).'],
  ['로케일 중복', 'CSV를 slug로 키잡으면 /uz/·/en/ 행이 /ko/ 행을 덮어쓴다. '
    + 'mixing19가 9clk/2,440imp → 0clk/3imp로 뒤집힌 적 있다. 반드시 "/ko/stories/" 필터.'],
  ['90일 롤링 창', 'docs/gsc-raw·ga4-raw는 90일 누적 스냅샷이다. 최근 3주 작업의 효과는 거의 '
    + '안 보이고, 이미 고친 문제가 미해결로 보인다. 기간을 좁혀 직접 질의하라.'],
  ['스냅샷 차분', '두 스냅샷을 빼서 "증분"이라 부르지 마라. 창 뒤끝에서 빠져나간 기간이 섞인다. '
    + '기간지정 조회로 창 길이를 맞출 것(scripts/ctr-verdict.mjs).'],
  ['쿼리 단위만 보기', '타깃 쿼리 CTR이 그대로여도 페이지 전체 클릭은 3.5배가 될 수 있다. '
    + '타이틀 효과는 롱테일에 먼저 나타난다. 페이지 단위 클릭 절대량을 함께 보라.'],
  ['GA4 귀속', 'landing.csv 세션은 랜딩 기준, events.csv 리드는 클릭 발생 page_path 기준이다. '
    + '둘을 나눠 만든 "그룹별 전환율"은 트래픽 품질이 아니라 귀속 산출물이며, 그 동선은 '
    + '의도적으로 배선한 것이다(f549323537·9546332e18).'],
  ['쿼리 차원 총계', 'GSC 쿼리 차원 합계는 익명화로 과소집계된다(28일 1,112 vs 실제 5,385클릭). '
    + '헤드라인 총계는 차원 없는 조회나 device/searchType 합계를 쓸 것.'],
  ['의도적 설계를 버그로', 'noindex·통합 제외·낮은 CTR이 전부 결함은 아니다. practice-room-transfer1은 '
    + '"경쟁자 대상 콘텐츠"라 일부러 noindex다(8621b269da). 0클릭 상업 쿼리도 상품 불일치일 수 있다 '
    + '("아이돌 연습실"=댄스 연습실, "합주실 대여"=시간제 합주실 — 둘 다 우리 상품이 아니다).'],
];
for (const [k, v] of traps) console.log(`  • ${k} — ${v}`);

console.log('\n════ 프리플라이트 끝. 이제 데이터를 열어라.');

// 실행 스탬프 — .claude/settings.json의 PostToolUse 훅이 이 파일의 신선도(6시간)를 보고
// gsc-raw/ga4-raw를 읽을 때 프리플라이트 미실행 경고를 낼지 결정한다. .git/ 안이라 커밋 안 됨.
try {
  fs.writeFileSync(path.join(ROOT, '.git/seo-preflight-stamp'), `${TODAY}\n`);
} catch {
  // .git이 없는 환경(워크트리 아님 등)이면 스탬프 없이 진행 — 훅이 매번 경고할 뿐 동작엔 지장 없다.
}
