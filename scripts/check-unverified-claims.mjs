#!/usr/bin/env node
/**
 * 검증되지 않은 외부 사실 주장 검사 — 스토리 본문에 날조 후보 서술이 "늘어나는" 것을 막는다.
 *
 * 왜 필요한가:
 * 2026-10 표본 점검에서 서비스 노출 스토리의 90% 넘는 글이 틀린 연대·인명·장비, 출처 없는 인용문,
 * "최초" 주장, "한국에서 표준이 됐다" 같은 서술을 담고 있었다(#503·#504·#518·#519로 약 190편 정정).
 * AI가 쓴 글에서 이 유형이 반복되므로, 새 글이 같은 패턴을 들여오지 못하게 막는 것이 이 검사다.
 *
 * 판정 방식 (check-duplicate-sections와 같다):
 * 기존 글에 남은 후보 때문에 CI가 계속 빨갛지 않도록 기준선(baseline) 대비로 본다.
 * 파일×규칙별 후보 수가 기준선보다 늘거나 새 글에 후보가 있으면 실패, 줄어드는 것은 통과.
 * 후보를 지우거나 근거를 확인해 서술을 고쳤다면 `--update`로 기준선을 낮춰 고정한다.
 *
 * 이 검사는 "틀렸다"를 판정하지 않는다 — 사람이 확인해야 할 후보를 가리킬 뿐이다. 후보에 걸리면
 * ① 근거(공식 페이지·위키 등)를 확인하고 서술을 사실에 맞춘다 ② 확인되지 않으면 그 문장을 뺀다.
 * 확인했는데도 패턴에 계속 걸리면 문장을 풀어 쓰거나, 정말 정당한 서술이면 `--update`와 함께
 * 커밋 메시지에 "무엇을 어디서 확인했는지"를 남긴다.
 *
 * 사용:
 *   node scripts/check-unverified-claims.mjs            # 검사 (CI)
 *   node scripts/check-unverified-claims.mjs --update   # 기준선 갱신
 *   node scripts/check-unverified-claims.mjs --show     # 후보 문장 전체 출력
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'content/stories';
const BASELINE = 'content/unverified-claims.baseline.json';

/** 규칙은 정밀도 우선이다. 후보 문장 전체를 보고 사람이 판정한다. */
export const RULES = [
  {
    id: 'attributed-quote',
    label: '인물이 한 말로 제시한 인용문',
    // 이름 + (조사) + 인용부호 + 8자 이상 + 말했다/밝혔다 류
    pattern:
      /[A-Za-z가-힣][A-Za-z가-힣.' ]{1,30}(?:은|는|이|가|의)?\s*["“「'‘][^"”」'’\n]{8,90}["”」'’]\s*(?:라고|고|며)?\s*(?:말했|말한|밝혔|밝힌|했습니다|했다|했듯|이야기했|강조했|표현했)/g,
  },
  {
    id: 'first-claim',
    label: '"최초·처음으로·발명" 주장',
    pattern: /최초(?:로|의|\s|였|입니다|다\b|는)|처음으로\s*(?:사용|도입|구현|개발|만들|적용|상용화)|(?:을|를)\s*발명했/g,
  },
  {
    id: 'korea-standard',
    label: '"한국·국내에서 표준·대세·보편화" 서술',
    pattern: /(?:한국|국내|K-?POP|케이팝)[^.\n]{0,30}(?:표준(?:이|으로|화)|대세|보편화|주류|사실상의 표준)/g,
  },
  {
    id: 'unsourced-ratio',
    label: '출처 없는 비율·배율 단정 ("~의 70% 이상", "N배 빠르다")',
    pattern: /(?:의|중)\s*[0-9]{2,3}\s*%\s*(?:이상|가량|정도)?\s*(?:가|이|를|을|는|은)?\s*[가-힣 ]{0,12}(?:입니다|이다|차지|해당)|[0-9]{1,2}배\s*(?:빠르|높|많|커|좋|효율)/g,
  },
];

const koStories = () =>
  fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.md') && !/\.(en|zh|es|vi|th|uz)\.md$/.test(f))
    .sort();

const bodyOf = (file) => {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
  return raw
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/<!--\s*AUTO-EXPAND-V1\s*-->[\s\S]*?<!--\s*\/AUTO-EXPAND-V1\s*-->/g, '')
    .replace(/```[\s\S]*?```/g, '');
};

/** 후기(category: 후기)는 고객이 겪은 일을 적은 글이라 외부 사실 점검 대상이 아니다. */
const isReview = (file) =>
  /^category:\s*후기\s*$/m.test(
    fs.readFileSync(path.join(DIR, file), 'utf8').slice(0, 1500),
  );

export const scan = (body) => {
  const hits = {};
  for (const rule of RULES) {
    const found = [];
    for (const m of body.matchAll(rule.pattern)) {
      const start = body.lastIndexOf('\n', m.index) + 1;
      const end = body.indexOf('\n', m.index);
      found.push(body.slice(start, end === -1 ? undefined : end).trim().slice(0, 140));
    }
    if (found.length) hits[rule.id] = found;
  }
  return hits;
};

const collect = () => {
  const files = {};
  for (const f of koStories()) {
    if (isReview(f)) continue;
    const hits = scan(bodyOf(f));
    if (Object.keys(hits).length) files[f.replace(/\.md$/, '')] = hits;
  }
  return files;
};

const counts = (files) =>
  Object.fromEntries(
    Object.entries(files).map(([slug, hits]) => [
      slug,
      Object.fromEntries(Object.entries(hits).map(([id, arr]) => [id, arr.length])),
    ]),
  );

const main = () => {
  const update = process.argv.includes('--update');
  const show = process.argv.includes('--show');
  const files = collect();
  const now = counts(files);
  const total = Object.values(now).reduce((s, h) => s + Object.values(h).reduce((a, b) => a + b, 0), 0);

  if (show) {
    for (const [slug, hits] of Object.entries(files)) {
      for (const [id, arr] of Object.entries(hits)) for (const s of arr) console.log(`${slug} [${id}] ${s}`);
    }
  }

  if (update) {
    fs.writeFileSync(BASELINE, JSON.stringify({ files: now }, null, 2) + '\n');
    console.log(`기준선 갱신: ${Object.keys(now).length}편 / 후보 ${total}건`);
    return;
  }

  const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')).files : {};
  const labels = Object.fromEntries(RULES.map((r) => [r.id, r.label]));
  const problems = [];
  for (const [slug, hits] of Object.entries(now)) {
    for (const [id, n] of Object.entries(hits)) {
      const was = base[slug]?.[id] ?? 0;
      if (n > was) problems.push({ slug, id, was, n, samples: files[slug][id] });
    }
  }

  console.log(`검증 필요 후보 검사 — ${Object.keys(now).length}편 / 후보 ${total}건 (기준선 ${Object.keys(base).length}편)`);
  if (problems.length === 0) {
    console.log('✅ 신규·증가한 후보 없음');
    return;
  }
  console.error(`\n❌ 새로 들어온 검증 후보 ${problems.length}곳 — 근거를 확인해 사실에 맞추거나 빼 주세요:`);
  for (const p of problems) {
    console.error(`\n  ${p.slug}.md · ${labels[p.id]} (${p.was} → ${p.n})`);
    for (const s of p.samples.slice(p.was)) console.error(`    - ${s}`);
  }
  console.error(
    '\n확인한 서술이 정당하면 `node scripts/check-unverified-claims.mjs --update` 후 커밋 메시지에 무엇을 어디서 확인했는지 적으세요.',
  );
  process.exit(1);
};

if (import.meta.url === new URL(process.argv[1], 'file://').href || process.argv[1]?.endsWith('check-unverified-claims.mjs')) {
  main();
}
