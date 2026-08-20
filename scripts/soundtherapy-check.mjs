#!/usr/bin/env node
/**
 * 사운드테라피 대본 검증 — 타이밍 계산 + 금지 표현 스캔 + 조건부 점검
 *
 *   node scripts/soundtherapy-check.mjs docs/deliverables/dain-pilot/script-01-*.md
 *   node scripts/soundtherapy-check.mjs <파일> --target 600      # 목표 길이(초) 지정
 *
 * 왜 이 도구가 있는가 — 파일럿(다인 2026-08)에서 손으로 계산한 타임코드가 세 번 다 틀렸다.
 * ① 문장 간 쉼을 아예 안 셌고 ② 카운트 구간을 자수 환산해 22초를 잃었으며
 * ③ 그래서 "9분 44초"라고 보고한 것이 실제로는 11분 09초였다.
 * 금지 표현도 눈으로 훑어서는 무헤지 단정문 6건과 2인칭을 놓쳤다.
 *
 * 판정 원칙: 이 도구는 **틀린 것을 잡는 게 아니라 봐야 할 곳을 가리킨다.**
 * ERROR는 거의 확실한 위반, WARN은 사람이 판단할 것. WARN을 0으로 만들려 하지 말 것.
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── 타이밍 모델 ────────────────────────────────────────────────────────────
// 조음속도(쉼 제외) 분당 180자 = 초당 3.0자. 명상 낭독은 평상 낭독의 약 55~60%다.
let CPS = 3.0;   // --cps 로 덮어쓴다. 취침용은 170자/분(2.83) 등 콘텐츠마다 다르다
// 블록(인용 단락) 내부 줄 사이 호흡. 실측 불가 구간이라 범위로 본다 —
// 오디오 감수에서 "이 값 하나로 총 길이가 90초 흔들린다"는 지적을 받았다.
const GAP_MIN = 0.5, GAP_MID = 0.8, GAP_MAX = 1.5;
// 카운트 호흡 1라운드: 프리롤 2.0 + 들숨 4 + 멈춤 7 + 날숨 8 = 21.0초 (절대값, 자수 환산 아님)
const ROUND_SEC = 21.0;

// ─── 금지·주의 패턴 ─────────────────────────────────────────────────────────
const RULES = [
  { id: '2인칭', level: 'ERROR', re: /\b(당신|여러분)\b/,
    why: '유튜브 실측 ×0.78, 6채널 중 5채널 음수. 트로스트 히트작에도 2인칭 없음' },
  { id: '의문형', level: 'ERROR', re: /\?/,
    why: '실측 ×0.60, 8채널 8개 전부 음수. 청취자는 질문이 아니라 처방을 받으러 온다' },
  { id: '자해암시', level: 'ERROR', re: /죽고\s?싶|사라지고\s?싶|놓아버리고\s?싶|끝내고\s?싶|없어지고\s?싶/,
    why: '위기개입 영역. 오디오는 실시간 판단 불가' },
  { id: '회사비방', level: 'ERROR', re: /때려치우|불지르|그만두고\s?싶다는\s?말/,
    why: 'B2B 납품물이 발주사 고객사(기업)와 정면 충돌' },
  { id: '밈·비하', level: 'ERROR', re: /월급루팡|지옥철|틀딱|꼰대/,
    why: '비하 뉘앙스 + 밈은 수명이 짧다' },
  { id: '의료단정', level: 'ERROR', re: /(우울증|공황장애|불안장애|번아웃\s?증후군)(입니다|이에요|이니까|라서|때문)/,
    why: '진단 선언. 사용자 본인도 "이게 ~인지 모르겠다"고 쓴다' },
  { id: '효능보장', level: 'ERROR', re: /(충분히|확실히|반드시|틀림없이)\s?[^\s]{0,6}(달라|나아|좋아|풀립|사라)/,
    why: '표시광고법 실증 대상. 실증 자료가 없다' },
  { id: '효능어', level: 'WARN', re: /(스트레스\s?해소|불안\s?완화|마음\s?치유|숙면\s?유도|번아웃\s?극복)/,
    why: '효능 주장 + 트로스트 히트작 어법 위반. 상황어로 바꿀 것' },
  // '명령형'은 제목·소개문구 전용 규칙이라 여기서 뺐다. 이 스캐너는 '> ' 나레이션 줄만 읽으므로
  // 규칙이 절대 닿지 않는 자리에서 통과만 하고 있었다 — 죽은 규칙은 없는 규칙보다 나쁘다.
  // 제목·소개문구·태그 검사는 G4 수동 항목(00-제작절차)에 있다.
  { id: '무헤지단정', level: 'WARN',
    // 한국어 축약형 주의: '편해지'는 '편해집니다'에 substring으로 없다(지→집). 어간 8개가 죽어 있었다.
    // 종결 마침표 때문에 $ 앵커도 못 물었다 — 두 버그가 겹쳐 이 규칙은 한 번도 발화한 적이 없다.
    re: /(편해[지집져]|느려[지집져]|가벼워[지집져]|사라[지집져]|나아[지집져]|달라[지집져]|멀어[지집져]|괜찮아[지집져]|풀[리립려]|내려[가갑]|올라[가갑])[^\n]{0,6}(니다|어요|아요)[.]?\s*$/,
    skipIf: /일지도|수도\s?있|겁니다|것입니다|라면|다면|곤\s?합니다|을\s?수\s?있|모르겠|모릅니다|대개|보통|흔히/,
    // 오탐 주의: "내쉬면 손이 내려갑니다"류 물리적 사실은 이 규칙이 못 가른다(02-집필규칙 §2 예외).
    // WARN이므로 사람이 판정한다 — 0으로 만들려 하지 말 것.
    why: '청취자 상태 단정. 파일럿에서 "전 구간 헤지"라 써놓고 6건이 남아 있었다' },
  // 위 규칙은 '청취자 상태'만 본다. 신체 신호에서 생리 기제를 확정 추론하는 문장은
  // 어휘가 달라 그대로 통과했다 — 4·5·6편에서 4건. 진단성 추론에 가까워 별도 규칙으로 둔다.
  { id: '인과단정', level: 'WARN',
    re: /(뜻입니다|때문입니다|봐서입니다|탓입니다|고정됩니다|증거입니다)[.]?\s*$/,
    skipIf: /일지도|수도\s?있|겁니다|것입니다|모릅니다|쉽습니다|편입니다|흔[한합]/,
    why: '신체 신호 → 생리 기제를 확정 진술. "귀가 뜨겁다=심박 상승"류는 관찰이 아니라 추론이다' },
];

// 조건부 점검: 본문에 A가 있으면 B도 있어야 한다
const CONDITIONS = [
  { id: '숨참기→금기고지', when: /멈춥니다|숨을\s?참|잠깐\s?멈추/, need: /임신|호흡기|심장|어지러/,
    why: '숨 참기는 임신·호흡기·심혈관 주의 대상. 기립 허용 시 실신 경로가 된다' },
  { id: '기립허용→안전조건', when: /서\s?계셔도|서\s?계신다면/, need: /벽|난간|기대/,
    why: '기립 + 호흡 정지는 이 납품물의 유일한 물리적 부상 경로' },
  { id: '이동중→운전배제', when: /지하철|버스|이동\s?중|걷고\s?계시/, need: /운전\s?중.{0,12}(마|않|말)/,
    why: '"퇴근길" 제목에 자차 통근자 배제가 없으면 예견 가능한 위험' },
  // 과거 기억 인출만 걸린다. 미래 심상("끝나고 앉는 순간을 떠올려보세요")은 실패 경로가
  // 다르므로 제외 — 임상 감수에서 지적된 것은 과일반화 자전적 기억 손상이고, 이는
  // 과거의 구체적 사건을 떠올릴 때만 발생한다.
  { id: '과거인출→안전망',
    when: /(오늘|있었던|남아\s?있는|지나간|아까)[^\n]{0,24}떠올려\s?보세요/,
    need: /떠오르지\s?않|안\s?떠오|여러\s?개가|아무거나/,
    why: '우울 상태에서는 구체적 긍정 기억 인출이 체계적으로 손상된다. 안전망 없는 인출 + 침묵은 이완이 아니라 실패 확인 시간이 된다' },
  { id: '카운트→온셋명세', when: /하나,\s?둘,\s?셋,\s?넷/, need: /온셋|BPM|박1|프리롤/,
    why: '"하나~넷"은 온셋 기준 3초다. 앵커를 명시 안 하면 4-7-8이 3-6-7이 된다' },
];

// 지시어 — 여러 곳에 흩어지면 청취자가 다른 대상으로 파싱한다
const DEICTIC = /그\s(사람|것|자리|순간|문|말|일)/g;

// ─── 파싱 ───────────────────────────────────────────────────────────────────
const isCountLine = (s) => /둘,\s?셋,\s?넷/.test(s);
const isSpecBlock = (s) =>
  s.startsWith('|') || s.startsWith('**') || /^`|^\[|^\d\./.test(s) ||
  /타이밍 설계|카운트 타이밍|두 가지 길이|이 구조는|카운트 구간은/.test(s);

function parse(raw) {
  const body = raw.includes('## 4. 타임코드 대본')
    ? raw.split('## 4. 타임코드 대본')[1].split(/^## 5\./m)[0]
    : raw;
  const sections = [];
  let cur = null, skipSpec = false;

  for (const line of body.split('\n')) {
    const t = line.trimEnd();

    if (t.startsWith('### ')) {
      cur = { title: t.slice(4).trim(), lines: [], pauses: [], rounds: 0 };
      sections.push(cur); skipSpec = false; continue;
    }
    if (!cur) continue;

    const pm = t.match(/^\*⏸\s*(\d+)초/);
    if (pm) { cur.pauses.push(+pm[1]); continue; }

    if (t.startsWith('> ')) {
      const s = t.slice(2).trim();
      if (!s) continue;
      if (/^\*\*\[카운트 타이밍/.test(s)) { skipSpec = true; continue; }
      if (skipSpec || isSpecBlock(s)) continue;
      if (isCountLine(s)) { cur.rounds += 1 / 3; continue; }
      cur.lines.push(s);
    }
    if (t === '---') skipSpec = false;
  }
  return sections;
}

// ─── 실행 ───────────────────────────────────────────────────────────────────
const file = process.argv[2];
if (!file) { console.error('사용: node scripts/soundtherapy-check.mjs <대본.md> [--target 초]'); process.exit(1); }
const ti = process.argv.indexOf('--target');
const TARGET = ti > 0 ? +process.argv[ti + 1] : 600;
const ci = process.argv.indexOf('--cps');
if (ci > 0) CPS = +process.argv[ci + 1] / 60;   // 분당 자수로 받는다

const raw = fs.readFileSync(file, 'utf8');
const sections = parse(raw);
const R = (n) => Math.round(n);
// 초를 먼저 반올림한 뒤 분/초로 쪼갠다. 나눠서 각각 반올림하면 59.6초가 "6:60"으로 찍힌다.
const mmss = (t) => { const s = R(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

console.log(`\n\x1b[1m${path.basename(file)}\x1b[0m`);

// 1) 타이밍
console.log(`\n\x1b[1m── 타이밍\x1b[0m  (조음 ${Math.round(CPS * 60)}자/분, 카운트 라운드 ${ROUND_SEC}초 고정)`);
let lo = 0, mid = 0, hi = 0;
for (const s of sections) {
  const chars = s.lines.join('').replace(/\s/g, '').length;
  const speak = chars / CPS;
  const pause = s.pauses.reduce((a, b) => a + b, 0);
  const gaps = Math.max(0, s.lines.length - 1);
  const rounds = Math.round(s.rounds) * ROUND_SEC;
  const m = speak + pause + gaps * GAP_MID + rounds;
  lo += speak + pause + gaps * GAP_MIN + rounds;
  mid += m; hi += speak + pause + gaps * GAP_MAX + rounds;
  const tc = s.title.match(/(\d+:\d+)\s*[–-]\s*(\d+:\d+)/);
  let flag = '';
  if (tc) {
    const toS = (x) => { const [a, b] = x.split(':').map(Number); return a * 60 + b; };
    const declared = toS(tc[2]) - toS(tc[1]);
    if (Math.abs(declared - m) > 15) flag = `  \x1b[33m← 표기 ${R(declared)}s와 ${R(Math.abs(declared - m))}s 차이\x1b[0m`;
  }
  console.log(`  ${s.title.padEnd(32)} 낭독 ${R(speak).toString().padStart(3)}s + 쉼 ${pause.toString().padStart(3)}s + 간격 ${R(gaps * GAP_MID).toString().padStart(2)}s${rounds ? ` + 카운트 ${rounds}s` : ''} = ${R(m).toString().padStart(3)}s → ${mmss(mid)}${flag}`);
}
console.log(`\n  총계  \x1b[1m${mmss(mid)}\x1b[0m   (범위 ${mmss(lo)} ~ ${mmss(hi)} — 블록 내 줄 간격 0.5~1.5초 가정)`);
const diff = mid - TARGET;
console.log(`  목표  ${mmss(TARGET)}   ${Math.abs(diff) <= 30 ? '\x1b[32m✓ 범위 내\x1b[0m' : `\x1b[31m✗ ${diff > 0 ? '+' : ''}${R(diff)}초\x1b[0m`}`);

// 2) 금지 표현 (낭독선만)
console.log(`\n\x1b[1m── 표현 스캔\x1b[0m`);
const hits = [];
sections.forEach((s) => s.lines.forEach((line) => {
  for (const r of RULES) {
    if (!r.re.test(line)) continue;
    if (r.skipIf && r.skipIf.test(line)) continue;
    hits.push({ ...r, sec: s.title, line });
  }
}));
if (!hits.length) console.log('  \x1b[32m위반 0건\x1b[0m');
else for (const h of hits) {
  const c = h.level === 'ERROR' ? '\x1b[31m' : '\x1b[33m';
  console.log(`  ${c}[${h.level}] ${h.id}\x1b[0m  ${h.sec.split('·')[0].trim()}`);
  console.log(`      "${h.line}"`);
  console.log(`      \x1b[90m${h.why}\x1b[0m`);
}

// 3) 조건부
console.log(`\n\x1b[1m── 조건부 점검\x1b[0m`);
const all = sections.flatMap((s) => s.lines).join('\n');
const full = raw;
let condFail = 0;
for (const c of CONDITIONS) {
  if (!c.when.test(all)) continue;
  if (c.need.test(full)) console.log(`  \x1b[32m✓\x1b[0m ${c.id}`);
  else { condFail++; console.log(`  \x1b[31m✗ ${c.id}\x1b[0m\n      \x1b[90m${c.why}\x1b[0m`); }
}
if (!condFail && !CONDITIONS.some((c) => c.when.test(all))) console.log('  해당 조건 없음');

// 4) 지시어 충돌
console.log(`\n\x1b[1m── 지시어\x1b[0m`);
const dmap = new Map();
sections.forEach((s) => s.lines.forEach((line, i) => {
  for (const m of line.matchAll(DEICTIC)) {
    const k = m[0].replace(/\s+/g, ' ');
    if (!dmap.has(k)) dmap.set(k, []);
    dmap.get(k).push(`${s.title.split('·')[0].trim()}: ${line}`);
  }
}));
const collide = [...dmap].filter(([, v]) => v.length > 1);
if (!collide.length) console.log('  중복 지시어 없음');
else for (const [k, v] of collide) {
  console.log(`  \x1b[33m"${k}" ${v.length}회 — 청취자가 다른 대상으로 파싱할 수 있다\x1b[0m`);
  v.forEach((x) => console.log(`      ${x}`));
}

// 종합
const errs = hits.filter((h) => h.level === 'ERROR').length + condFail;
console.log(`\n${errs ? `\x1b[31m✗ ERROR ${errs}건 — 수정 후 재실행\x1b[0m` : '\x1b[32m✓ ERROR 없음\x1b[0m'}  ` +
  `\x1b[33mWARN ${hits.filter((h) => h.level === 'WARN').length}건\x1b[0m ` +
  `\x1b[90m(WARN은 판단 대상이지 0으로 만들 목표가 아님)\x1b[0m\n`);
process.exit(errs ? 1 : 0);
