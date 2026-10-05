/**
 * 중간 계층 UI 패턴 기준선 가드 (docs/design-ui-refinement-plan-2026-10.md §4).
 *
 * 2026-10-04 조사에서 "같은 역할, 다른 모양"이 흐름마다 쌓여 있었다 — 안내 박스 반경 4종,
 * 체크박스 틴트 3계열, 배지 규격 준수 0곳, 손으로 짠 `<a>` 버튼 11곳. 전부 "공용 컴포넌트가
 * 없어서 손으로 짠" 자리다. 이제 `components/ui/`에 그 컴포넌트가 있으니(Choice·Checkbox·
 * Notice·Panel·Badge·PageHeader·Stepper·PriceSummary·ResultCard·Modal·EmptyState·Disclosure),
 * 같은 모양을 **다시** 손으로 짜는 것을 막는다.
 *
 * 기존 위반을 한 번에 다 고칠 수는 없으므로(동결 파일·측정 중 LP) **기준선 대비**로 판정한다 —
 * `check-duplicate-sections`와 같은 방식이다. 파일별 위반 수가 기준선보다 **늘면 실패**, 줄면
 * 통과, 새 파일에 생기면 실패. 0단계가 끝나 기준선이 비면 그때부터는 "있으면 실패"다.
 *
 * 갱신: 의도한 변경(위반을 줄인 뒤 기준선을 내릴 때)에만
 *   UPDATE_UI_PATTERN_BASELINE=1 npx jest components/ui/uiPatterns.baseline.test.ts
 * 갱신 경로는 **늘어나는 방향을 거부한다** — 기준선을 올려서 가드를 통과시키는 것은 가드를 끄는
 * 것과 같다. 정말 늘려야 하면 그 규칙의 ALLOW에 이유와 함께 등재한다.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_PATH = path.join(__dirname, 'ui-patterns.baseline.json');
const SCAN_DIRS = ['components', 'pages'];

/** 이 규칙들의 **정본 구현**이라 스캔에서 뺀다. 여기 늘릴 때는 그 파일이 왜 정본인지 적을 것. */
const PRIMITIVE_FILES = new Set([
  'components/ui/Choice.tsx',
  'components/ui/Checkbox.tsx',
  'components/ui/Notice.tsx',
  'components/ui/Panel.tsx',
  'components/ui/Badge.tsx',
  'components/ui/PageHeader.tsx',
  'components/ui/Stepper.tsx',
  'components/ui/PriceSummary.tsx',
  'components/ui/ResultCard.tsx',
  'components/ui/Modal.tsx',
  'components/ui/EmptyState.tsx',
  'components/ui/Disclosure.tsx',
  'components/ui/focusRing.ts',
  // 1단계(10/14 이후) 전까지 동결된 공용 파일. 모션 규칙의 정본이기도 하다.
  'components/ui/Button.tsx',
  'components/ui/BaseCard.tsx',
]);

const walk = (dir: string, out: string[] = []): string[] => {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full); // className 상수를 .ts로 빼도 보인다
  }
  return out;
};

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

const isScanned = (r: string): boolean => {
  if (/\.test\.tsx?$/.test(r)) return false;
  if (r.startsWith('pages/admin/') || r.startsWith('components/admin/')) return false; // 운영자 백오피스는 범위 밖
  if (PRIMITIVE_FILES.has(r)) return false;
  return true;
};

const isCommentLine = (t: string) => t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*');

type Hit = { line: number; text: string };
type Rule = {
  id: string;
  /** 실패 메시지 — 무엇으로 바꾸라는 말까지. */
  advice: string;
  /** 파일 전체를 받아 위반 위치를 돌려준다. */
  find: (src: string, file: string) => Hit[];
};

const lineHits = (src: string, test: (line: string) => number): Hit[] => {
  const hits: Hit[] = [];
  src.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (isCommentLine(t)) return;
    const n = test(line);
    for (let k = 0; k < n; k += 1) hits.push({ line: i + 1, text: t.slice(0, 110) });
  });
  return hits;
};

const countAll = (re: RegExp, s: string) => (s.match(re) ?? []).length;

/** `<tag ... >` 블록을 줄바꿈 포함해 잡는다. className이 다음 줄에 있어도 본다. */
const elementBlocks = (src: string, tag: string): { start: number; text: string }[] => {
  const out: { start: number; text: string }[] = [];
  // `>`에서 끝내되 `=>`(화살표 함수)는 건너뛴다 — onChange={() => …} 때문에 className 앞에서
  // 블록이 끊기면 accent-primary가 보이지 않아 오탐이 난다.
  const re = new RegExp(`<${tag}(?=[\\s/>])(?:=>|[^>])*?>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out.push({ start: src.slice(0, m.index).split('\n').length, text: m[0] });
  }
  return out;
};

const ROUNDED_MD_RE = /(?<![-\w:])(?:[a-z-]+:)*rounded-md(?![-\w])/g;
// variant 없는 배경만 본다 — `hover:bg-primary/10`은 버튼 hover지 안내 박스가 아니다.
const TONE_BG_RE = /(?<![-\w:])bg-(?:(?:red|green|amber|blue)-(?:50|100)|primary\/(?:5|10))(?![-\w/])/;
// 고정 크기(h-fit·h-12·w-10…)가 함께 있으면 아이콘 타일이다 — 안내 박스가 아니다.
const SIZED_TILE_RE = /(?<![-\w:])(?:h-fit|[hw]-\d+(?:\.\d+)?)(?![-\w])/;
const PILL_SIZE_RE = /(?<![-\w:])(?:text-xs|text-\[10px\]|typo-caption)(?![-\w])/;
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const MOTION_RE = /(?<![-\w:])(?:hover:-translate-y-[\d.]+|hover:scale-[\d[\]. ]+|group-hover:scale-[\d[\]. ]+)/g;

const RULES: Rule[] = [
  {
    id: 'rounded-md',
    advice:
      '반경은 네 단뿐이다 — 컨트롤 rounded-lg · 카드/선택 항목/알림 rounded-xl · 패널/모달/결과 rounded-2xl · 알약/배지 rounded-full. ' +
      '`rounded-md`는 어느 역할에도 없다(design-system.md §3). 안내 박스면 Notice/Panel, 고르는 항목이면 ChoiceCard로.',
    find: (src) => lineHits(src, (l) => countAll(ROUNDED_MD_RE, l)),
  },
  {
    id: 'notice-handroll',
    advice:
      '상태색 박스(bg-red/green/amber/blue-50, bg-primary/5)를 손으로 조립하지 않는다 — tone 값은 components/ui/Notice.tsx에만 있다. ' +
      '중립 요약 박스는 Panel.',
    // rounded-full은 뺀다 — 아이콘 원·배지는 안내 박스가 아니다(배지는 아래 규칙이 본다).
    find: (src) =>
      lineHits(src, (l) =>
        TONE_BG_RE.test(l) && !SIZED_TILE_RE.test(l) && /(?<![-\w:])(?:[a-z-]+:)*rounded-(?:md|lg|xl|2xl|3xl)(?![-\w])/.test(l) && /(?<![-\w])p[xy]?-\d/.test(l) ? 1 : 0,
      ),
  },
  {
    id: 'badge-handroll',
    advice: '배지·칩(rounded-full + 작은 글자 + 패딩)은 components/ui/Badge.tsx — tone·size 두 축만 고른다.',
    find: (src) => lineHits(src, (l) => (/(?<![-\w:])rounded-full(?![-\w])/.test(l) && PILL_SIZE_RE.test(l) && /(?<![-\w])px-/.test(l) ? 1 : 0)),
  },
  {
    id: 'input-tint',
    advice:
      '눈에 보이는 radio/checkbox에는 `accent-primary`를 준다. `text-primary`는 forms 플러그인이 없어 네이티브 입력에 무효라 ' +
      '크롬 기본 파랑이 뜬다. 단독이면 Checkbox/Radio, 목록이면 ChoiceCard.',
    find: (src) =>
      elementBlocks(src, 'input')
        .filter((b) => /type=["'](?:radio|checkbox)["']/.test(b.text))
        // className이 변수 하나(`className={radioClass}`)면 여기서는 판정하지 못한다 — 그 상수는
        // 사람이 본다. 문자열 리터럴·템플릿이 보이는 경우만 판정한다.
        .filter((b) => !/className=\{[A-Za-z_$][\w$.]*\}/.test(b.text))
        .filter((b) => !/sr-only/.test(b.text) && !/accent-primary/.test(b.text))
        .map((b) => ({ line: b.start, text: b.text.replace(/\s+/g, ' ').slice(0, 110) })),
  },
  {
    id: 'raw-page-title',
    advice: '페이지 h1은 `typo-page-title`(거래·결과) 또는 `typo-section-title`이다. `text-2xl font-bold` 같은 원시 조합을 쓰지 않는다(§2).',
    find: (src, file) =>
      file.startsWith('pages/')
        ? elementBlocks(src, 'h1')
            .filter((b) => /(?<![-\w:])text-(?:xl|2xl|3xl|4xl|5xl)(?![-\w])/.test(b.text) && !/typo-/.test(b.text))
            .map((b) => ({ line: b.start, text: b.text.replace(/\s+/g, ' ').slice(0, 110) }))
        : [],
  },
  {
    id: 'emoji-icon',
    advice: 'UI 아이콘은 lucide(@/lib/lucide-icons)다. 이모지·✓ 글리프는 플랫폼마다 다르게 그려진다. 빈 상태는 EmptyState.',
    find: (src) => lineHits(src, (l) => countAll(EMOJI_RE, l)),
  },
  {
    id: 'motion-copy',
    advice:
      'hover 리프트·스케일은 Button·BaseCard가 소유한다. 카드가 떠야 하면 BaseCard를, 버튼이면 Button을 쓴다 — ' +
      'CSS translate/scale 복제는 네 가지 다른 움직임을 만들었다.',
    find: (src) => lineHits(src, (l) => countAll(MOTION_RE, l)),
  },
];

/**
 * 규칙별 허용 목록. **이유 필수.** 파일 + 줄에 포함된 문자열로 맞춘다.
 */
const ALLOW: { rule: string; file: string; snippet: string; reason: string }[] = [
  {
    rule: 'notice-handroll',
    file: 'components/service/ServiceComparison.tsx',
    snippet: "isUs ? 'bg-primary/10 dark:bg-primary/20'",
    reason: '비교표의 "우리" 열 강조 틴트 — 안내 박스가 아니라 표 셀이다. Notice로 바꾸면 표가 깨진다.',
  },
];

type Counts = Record<string, Record<string, number>>;

const scan = (): { counts: Counts; hits: Record<string, Record<string, Hit[]>> } => {
  const counts: Counts = {};
  const hits: Record<string, Record<string, Hit[]>> = {};
  for (const rule of RULES) {
    counts[rule.id] = {};
    hits[rule.id] = {};
  }
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const r = rel(file);
      if (!isScanned(r)) continue;
      const src = readFileSync(file, 'utf-8');
      for (const rule of RULES) {
        const found = rule
          .find(src, r)
          .filter((h) => !ALLOW.some((a) => a.rule === rule.id && a.file === r && h.text.includes(a.snippet)));
        if (found.length === 0) continue;
        counts[rule.id][r] = found.length;
        hits[rule.id][r] = found;
      }
    }
  }
  return { counts, hits };
};

const readBaseline = (): Counts | null => {
  if (!existsSync(BASELINE_PATH)) return null;
  return (JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as { rules: Counts }).rules;
};

const total = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);

describe('UI 패턴 기준선 — 같은 모양을 손으로 다시 짜지 않는다', () => {
  const { counts, hits } = scan();

  if (process.env.UPDATE_UI_PATTERN_BASELINE === '1') {
    it('기준선을 갱신한다 (UPDATE_UI_PATTERN_BASELINE=1) — 줄어드는 방향만', () => {
      const prev = readBaseline();
      if (prev) {
        const grew: string[] = [];
        for (const rule of RULES) {
          for (const [file, n] of Object.entries(counts[rule.id])) {
            if (n > (prev[rule.id]?.[file] ?? 0)) grew.push(`${rule.id} ${file}: ${prev[rule.id]?.[file] ?? 0} → ${n}`);
          }
        }
        if (grew.length > 0) {
          throw new Error(
            '기준선을 **올리는** 갱신은 거부합니다 — 가드를 끄는 것과 같습니다. 위반을 고치거나 ALLOW에 이유와 함께 등재하세요.\n' +
              grew.join('\n'),
          );
        }
      }
      writeFileSync(
        BASELINE_PATH,
        JSON.stringify(
          {
            note: '파일별 위반 수. 늘면 CI 실패, 줄면 통과. 줄인 뒤 UPDATE_UI_PATTERN_BASELINE=1 로 갱신(올리는 갱신은 거부된다).',
            updatedAt: new Date().toISOString().slice(0, 10),
            rules: counts,
          },
          null,
          2,
        ) + '\n',
      );
      expect(true).toBe(true);
    });
    return;
  }

  const baseline = readBaseline();

  it('기준선 파일이 있다', () => {
    if (!baseline) {
      throw new Error(
        `${path.relative(ROOT, BASELINE_PATH)} 가 없습니다. ALLOW_BASELINE_CREATE 없이 처음 만들 때는 ` +
          'UPDATE_UI_PATTERN_BASELINE=1 npx jest components/ui/uiPatterns.baseline.test.ts',
      );
    }
  });

  it.each(RULES.map((r) => [r.id, r] as const))('%s — 기준선보다 늘지 않았다', (_id, rule) => {
    if (!baseline) return;
    const before = baseline[rule.id] ?? {};
    const after = counts[rule.id];
    const offenders: string[] = [];
    for (const [file, n] of Object.entries(after)) {
      const b = before[file] ?? 0;
      if (n <= b) continue;
      const lines = (hits[rule.id][file] ?? []).map((h) => `    ${file}:${h.line}: ${h.text}`).join('\n');
      offenders.push(`  ${file}: ${b} → ${n}\n${lines}`);
    }
    if (offenders.length > 0) {
      throw new Error(
        `[${rule.id}] 위반이 늘었습니다 (기준선 ${total(before)} → 현재 ${total(after)}).\n${rule.advice}\n` +
          offenders.join('\n'),
      );
    }
  });

  it('기준선 요약(참고) — 0단계가 끝나면 전부 0이어야 한다', () => {
    if (!baseline) return;
    const summary = RULES.map((r) => `${r.id}: ${total(counts[r.id])}/${total(baseline[r.id] ?? {})}`).join(' · ');
    // 실패시키지 않는다. 진행 상황을 테스트 이름이 아니라 메시지로 남긴다.
    expect(typeof summary).toBe('string');
  });
});
