#!/usr/bin/env node
/**
 * 스토리 본문의 서비스 수치가 정본과 어긋나는지 검사한다.
 *
 * 왜 필요한가:
 * factGuards(content/factGuards.test.ts)는 전화번호와 서비스 범위를 "스튜디오 1인칭 맥락"에서만
 * 본다. 그래서 표 안의 수치나 링크 라벨은 그대로 통과했고, 2026-08-29 감사에서 네 건이 나왔다.
 *   - 온라인 의뢰 납기를 "영업일 2~5일"로 약속한 스토리 122편 (정본 3~7영업일 — 짧게 약속)
 *   - 마스터링까지 "2라운드 수정"으로 읽히는 표기 14편 (정본 마스터링 1회 — 많게 약속)
 *   - "1:1 보컬·믹싱 레슨" 링크 라벨 22편 (보컬 레슨은 미운영)
 *   - "전주역은 KTX가 정차하지 않습니다" (사실 오류)
 * 앞의 둘은 고객이 보는 약속이라 어긋나면 그대로 분쟁 소재가 된다. 이 검사가 그 재발을 막는다.
 *
 * 설계:
 * 정본을 이 파일에 베끼지 않는다. 가격은 data/pricing.ts 상수에서, 납기·수정 횟수는
 * public/locales/ko/common.json 문구에서 읽는다. 정본이 바뀌면 스토리보다 먼저 여기서 드러난다.
 *
 * 시장 시세·경쟁사 비교는 잡지 않는다 — 금액 전수 검사는 오탐이 56건이었다(오디오북 업계표,
 * 레슨 시세 비교 등). 대신 "우리 서비스 조건"으로 못박힌 세 축만 좁게 본다.
 *
 * 사용: node scripts/check-fact-consistency.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const STORIES = 'content/stories';
const PRICING = 'data/pricing.ts';
const LOCALE = 'public/locales/ko/common.json';

const read = (p) => fs.readFileSync(p, 'utf8');
const violations = [];
const notes = [];

// ── 정본 로드 ────────────────────────────────────────────────────────────────
const pricingSrc = read(PRICING);
const constOf = (name) => {
  const m = pricingSrc.match(new RegExp(`export const ${name} = (\\d+);`));
  if (!m) throw new Error(`정본 상수 ${name}을 ${PRICING}에서 찾지 못했다 — 이름이 바뀌었으면 이 검사도 같이 고칠 것.`);
  return Number(m[1]);
};
const CANON = {
  lessonMonthly: constOf('LESSON_MONTHLY_PRICE'),
  practiceMonthly: constOf('PRACTICE_ROOM_MONTHLY_PRICE'),
  recordingHourly: constOf('RECORDING_HOURLY_PRICE'),
};

const localeSrc = read(LOCALE);
// 납기·수정 횟수는 믹싱·마스터링 페이지 문구가 정본이다.
const turnaround = localeSrc.match(/(\d+)~(\d+)영업일/);
const revision = localeSrc.match(/수정은 믹싱 (\d+)회, 마스터링 (\d+)회/);
if (!turnaround) throw new Error(`${LOCALE}에서 "N~M영업일" 정본 문구를 찾지 못했다.`);
if (!revision) throw new Error(`${LOCALE}에서 "수정은 믹싱 N회, 마스터링 M회" 정본 문구를 찾지 못했다.`);
CANON.turnaround = [Number(turnaround[1]), Number(turnaround[2])];
// 축가는 별도 상품이라 납기가 다르다 — 축가 페이지 문구가 정본이다.
const wedding = localeSrc.match(/최종 완성본은 보통 (\d+)~(\d+)일/);
if (!wedding) throw new Error(`${LOCALE}에서 축가 "최종 완성본은 보통 N~M일" 정본 문구를 찾지 못했다.`);
CANON.weddingTurnaround = [Number(wedding[1]), Number(wedding[2])];
CANON.mixRevisions = Number(revision[1]);
CANON.masterRevisions = Number(revision[2]);

// ── 스토리 검사 ──────────────────────────────────────────────────────────────
const files = fs.readdirSync(STORIES).filter((f) => f.endsWith('.md'));
const add = (f, msg, snippet) => violations.push({ f, msg, snippet: snippet.replace(/\s+/g, ' ').slice(0, 110) });

// 표 행·목록 항목 단위로 본다. 문맥을 ±150자로 잡으면 같은 표의 믹싱 행과 마스터링 행이
// 섞여 읽혀 오탐이 난다(실제로 첫 구현에서 42건 중 40건이 그 이유였다).
for (const f of files) {
  const raw = read(path.join(STORIES, f));
  const lines = raw.split('\n');

  // 후기 글은 고객이 실제로 겪은 일을 말한다("2~3일 만에 받았습니다"). 서비스 약속이 아니라
  // 경험담이라 정본과 다를 수 있고, 고쳐서도 안 된다.
  if (/^category:\s*(후기|리뷰)/m.test(raw)) continue;

  // 축가는 별도 상품(납기 정본이 다르다). 글 단위로 판정한다 — 문장에 "축가"가
  // 안 적힌 줄도 축가 글 안에서는 축가 기준이다.
  const weddingDoc = /축가|웨딩|결혼식|wedding/i.test(f)
    || /^title:.*(축가|웨딩|결혼식)/m.test(raw);

  for (const line of lines) {
    // 1) 납기 — 우리 믹싱·마스터링 납품을 말하는 줄만
    //    유통 플랫폼 심사(“검토 및 승인 1~5 영업일”) 같은 제3자 일정은 대상이 아니다.
    // 마스터링만 따로 의뢰하는 경우의 납기는 정본에 정의돼 있지 않다 — 비교 대상이 없으므로
    // "믹싱"이 함께 걸린 줄(=완성본 납품)만 본다.
    const ourDelivery = /믹싱/.test(line)
      && /(납품|완성|돌려드|드립니다|받아|의뢰)/.test(line)
      && !/(유통|플랫폼|검토 및 승인|심사|발매일)/.test(line);
    if (ourDelivery) {
      const isWedding = weddingDoc || /축가|웨딩|결혼식/.test(line);
      const [lo0, hi0] = isWedding ? CANON.weddingTurnaround : CANON.turnaround;
      const label = isWedding ? '축가 납기' : '납기';
      for (const m of line.matchAll(/(?:영업일\s*(?:기준\s*)?(\d+)~(\d+)\s*일|(\d+)~(\d+)\s*(?:영업)?일)/g)) {
        const lo = Number(m[1] ?? m[3]);
        const hi = Number(m[2] ?? m[4]);
        if (lo !== lo0 || hi !== hi0) {
          add(f, `${label} ${lo}~${hi} (정본 ${lo0}~${hi0})`, line);
        }
      }
    }

    // 2) 수정 횟수 — 같은 줄에 무엇이 걸려 있는지로 기대값을 정한다.
    //    믹싱만: 2회 / 마스터링만: 1회 / 둘 다인데 숫자가 하나면 어느 쪽 기준인지 알 수 없어
    //    과약속으로 읽히므로 잡는다("믹싱 2회·마스터링 1회"처럼 둘 다 적힌 줄은 통과).
    const revs = [...line.matchAll(/(\d+)\s*(?:라운드|회)\s*수정/g)];
    if (revs.length) {
      const hasMix = /믹싱/.test(line);
      const hasMaster = /마스터링/.test(line);
      const bothSpelled = /믹싱\s*\d+\s*회[^\n]{0,12}마스터링\s*\d+\s*회/.test(line);
      // "믹싱 2회 수정"처럼 어느 공정의 횟수인지 붙여 쓴 경우는 모호하지 않다.
      const mixSpelled = /믹싱\s*(\d+)\s*(?:라운드|회)\s*수정/.exec(line);
      const masterSpelled = /마스터링\s*(\d+)\s*(?:라운드|회)\s*수정/.exec(line);
      if (mixSpelled && Number(mixSpelled[1]) !== CANON.mixRevisions) {
        add(f, `믹싱 "${mixSpelled[1]}회 수정" (정본 ${CANON.mixRevisions}회)`, line);
      }
      if (masterSpelled && Number(masterSpelled[1]) !== CANON.masterRevisions) {
        add(f, `마스터링 "${masterSpelled[1]}회 수정" (정본 ${CANON.masterRevisions}회)`, line);
      }
      if (!bothSpelled && !mixSpelled && !masterSpelled) {
        for (const m of revs) {
          const n = Number(m[1]);
          if (hasMix && hasMaster) {
            add(f, `믹싱·마스터링을 함께 적고 "${n}회 수정" (정본 믹싱 ${CANON.mixRevisions}회·마스터링 ${CANON.masterRevisions}회)`, line);
          } else if (hasMaster && n !== CANON.masterRevisions) {
            add(f, `마스터링 "${n}회 수정" (정본 ${CANON.masterRevisions}회)`, line);
          } else if (hasMix && !hasMaster && n !== CANON.mixRevisions) {
            add(f, `믹싱 "${n}회 수정" (정본 ${CANON.mixRevisions}회)`, line);
          }
        }
      }
    }
  }

  // 3) 대표 가격 — 레슨 월·연습실 월·녹음 시간당
  const priceChecks = [
    { re: /레슨[^.\n]{0,20}?월\s*(\d+)만\s*원/g, canon: CANON.lessonMonthly, label: '레슨 월정액' },
    { re: /(?:연습실|입주)[^.\n]{0,25}?월\s*(\d+)만\s*원/g, canon: CANON.practiceMonthly, label: '연습실 월정액' },
  ];
  for (const { re, canon, label } of priceChecks) {
    for (const m of raw.matchAll(re)) {
      const won = Number(m[1]) * 10000;
      if (won !== canon) {
        const around = raw.slice(Math.max(0, m.index - 70), m.index + 70);
        // 시세 비교·타사 언급은 제외
        if (/시세|평균|일반적|타 스튜디오|보통 [0-9]|학원|숨고|탈잉|크몽/.test(around)) continue;
        add(f, `${label} ${m[1]}만원 (정본 ${(canon / 10000)}만원)`, around);
      }
    }
  }
}

// ── 출력 ─────────────────────────────────────────────────────────────────────
console.log(`사실 정합 검사 — 스토리 ${files.length}편`);
console.log(`  정본: 납기 ${CANON.turnaround.join('~')}영업일 / 수정 믹싱 ${CANON.mixRevisions}회·마스터링 ${CANON.masterRevisions}회`);
console.log(`        레슨 월 ${CANON.lessonMonthly.toLocaleString()}원 / 연습실 월 ${CANON.practiceMonthly.toLocaleString()}원 / 녹음 시간당 ${CANON.recordingHourly.toLocaleString()}원`);
notes.forEach((n) => console.log(`  · ${n}`));

if (violations.length) {
  console.error(`\n❌ 정본과 어긋나는 서비스 수치 ${violations.length}건:`);
  for (const v of violations.slice(0, 25)) console.error(`  - ${v.f}: ${v.msg}\n      …${v.snippet}…`);
  if (violations.length > 25) console.error(`  … 외 ${violations.length - 25}건`);
  console.error('\n스토리를 정본에 맞추거나, 정본이 바뀐 것이면 data/pricing.ts·믹싱 페이지 문구를 먼저 고칠 것.');
  process.exit(1);
}
console.log('✅ 정본과 어긋나는 서비스 수치 없음');
