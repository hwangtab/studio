/**
 * 카카오 CTA 색 토큰 회귀 테스트 (2026-08-13 사고 재발 방지).
 *
 * 49d2f079f4가 카카오 CTA 12개 컴포넌트에 `bg-kakao`·`text-kakao-ink`·`bg-kakao-dark`
 * 클래스를 붙이면서 tailwind.config.ts에 색 토큰을 추가하지 않았다. Tailwind는 정의되지
 * 않은 클래스는 그냥 빌드 CSS에서 조용히 빠뜨리므로, 유일하게 검증된 전환 채널인 카카오
 * 버튼이 배경·글자색 없이 약 20시간 렌더됐다 — 그런데도 CI는 통과했다(타입체크·lint 모두
 * 문자열이라 못 잡는다).
 *
 * 범위를 kakao 계열로 한정하는 이유: 전 색상으로 넓히면 Tailwind 기본 팔레트(gray-500 등
 * config에 없어도 유효한 이름)까지 오탐으로 걸려 이 테스트가 무의미해진다. 실제 사고가
 * 난 자리가 여기이고, "우리가 직접 정의한 브랜드 색 토큰이 실제로 존재하는가"만 본다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import config from './tailwind.config';

const ROOT = path.resolve(__dirname);

const definedColorNames = (): Set<string> => {
  const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
  const names = new Set<string>();
  for (const [name, value] of Object.entries(colors)) {
    names.add(name);
    if (value && typeof value === 'object') {
      for (const shade of Object.keys(value as Record<string, unknown>)) {
        // DEFAULT는 접미사 없이 `kakao`처럼 쓰이므로 별도로 추가하지 않는다.
        if (shade !== 'DEFAULT') names.add(`${name}-${shade}`);
      }
    }
  }
  return names;
};

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

const SCAN_DIRS = ['components', 'pages', 'data', 'lib', 'utils'];

/**
 * 색을 받는 Tailwind 유틸리티 접두사. 카카오 토큰 검사와 yellow-* 금지 검사가 **같은**
 * 목록을 써야 한다 — 예전엔 yellow 가드가 더 좁아서(bg|text|border|ring|from|to|via|
 * fill|stroke) `shadow-yellow-400`·`placeholder-yellow-500` 같은 표기가 그냥 빠져나갔다.
 */
const COLOR_UTILITY_PREFIXES =
  'bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|placeholder|caret|accent|shadow|divide';

// (bg|text|border|...)-kakao(-dark|-ink)? 형태만 카카오 계열로 본다.
const KAKAO_CLASS_RE = new RegExp(`(?:${COLOR_UTILITY_PREFIXES})-(kakao(?:-[\\w]+)?)\\b`, 'g');

describe('카카오 CTA 색 토큰', () => {
  it('kakao 계열 유틸리티 클래스가 쓰는 색 이름은 전부 tailwind.config.ts에 존재해야 한다', () => {
    const defined = definedColorNames();
    const missing: string[] = [];

    for (const dir of SCAN_DIRS) {
      const dirPath = path.join(ROOT, dir);
      let files: string[] = [];
      try {
        files = walk(dirPath);
      } catch {
        continue; // 디렉터리가 없으면 건너뛴다.
      }

      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        let match: RegExpExecArray | null;
        KAKAO_CLASS_RE.lastIndex = 0;
        while ((match = KAKAO_CLASS_RE.exec(content))) {
          const colorName = match[1]; // e.g. kakao, kakao-dark, kakao-ink
          if (!defined.has(colorName)) {
            missing.push(`${path.relative(ROOT, file)}: -${colorName} (class: ${match[0]})`);
          }
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `tailwind.config.ts에 정의되지 않은 kakao 색 토큰을 쓰는 클래스가 있습니다:\n` +
          missing.join('\n'),
      );
    }
  });

  it('kakao 색 토큰 자체가 최소 구성(DEFAULT·dark·ink)으로 존재한다', () => {
    const defined = definedColorNames();
    expect(defined.has('kakao')).toBe(true);
    expect(defined.has('kakao-dark')).toBe(true);
    expect(defined.has('kakao-ink')).toBe(true);
  });
});

// `.typo-*` 컴포넌트 클래스도 같은 사고를 냈다(2026-09-11): typo-button·typo-caption·
// typo-body가 정의 없이 6곳에서 쓰여 404/500 버튼과 연습실 캡션이 스타일 없이 렌더됐다.
// 색 토큰과 달리 Tailwind 기본 팔레트 같은 "정의 없이도 유효한 이름"이 없으므로
// typo- 접두사 전체를 검사해도 오탐이 생기지 않는다.
const definedTypoClasses = (): Set<string> => {
  const source = readFileSync(path.join(ROOT, 'tailwind.config.ts'), 'utf-8');
  const names = new Set<string>();
  for (const match of source.matchAll(/'\.(typo-[\w-]+)'\s*:/g)) names.add(match[1]);
  return names;
};

describe('typo 컴포넌트 클래스', () => {
  it('쓰이는 .typo-* 클래스는 전부 tailwind.config.ts에 정의돼 있어야 한다', () => {
    const defined = definedTypoClasses();
    const missing: string[] = [];

    for (const dir of SCAN_DIRS) {
      let files: string[] = [];
      try {
        files = walk(path.join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        for (const match of content.matchAll(/\btypo-[\w-]+/g)) {
          if (!defined.has(match[0])) {
            missing.push(`${path.relative(ROOT, file)}: ${match[0]}`);
          }
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        'tailwind.config.ts에 정의되지 않은 .typo-* 클래스를 쓰는 곳이 있습니다:\n' +
          missing.join('\n'),
      );
    }
  });

  it('역할 클래스 최소 구성이 존재한다', () => {
    const defined = definedTypoClasses();
    for (const name of [
      'typo-section-title', 'typo-section-lead', 'typo-page-title',
      'typo-card-title', 'typo-card-subtitle', 'typo-card-body', 'typo-card-meta',
      'typo-card-cta', 'typo-body', 'typo-caption', 'typo-button',
    ]) {
      expect(defined.has(name)).toBe(true);
    }
  });
});

// "노란 건 카카오톡"이라는 학습이 성립하려면 카카오 토큰 밖의 옐로가 없어야 한다.
// 경고·주의는 amber, 별점도 amber를 쓴다(docs/design-system.md §1).
describe('옐로 사용 제한', () => {
  it('kakao 토큰 밖에서 yellow-* 유틸리티를 쓰지 않는다', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      let files: string[] = [];
      try {
        files = walk(path.join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        const yellowRe = new RegExp(`\\b(?:${COLOR_UTILITY_PREFIXES})-yellow-\\d+\\b`, 'g');
        for (const match of content.matchAll(yellowRe)) {
          offenders.push(`${path.relative(ROOT, file)}: ${match[0]}`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        'yellow-*는 카카오 옐로와 충돌합니다. 경고·주의·별점은 amber-*를 쓰세요:\n' +
          offenders.join('\n'),
      );
    }
  });
});

// 브랜드색 텍스트의 다크모드 대비 가드 (2026-09-11).
//
// primary·secondary·accent의 DEFAULT는 **흰 배경에서 AA를 통과하도록** 고른 값이다
// (secondary·accent는 그 때문에 -700 계열로 승격돼 있다). 그래서 다크 배경
// (gray-900 #030712) 위에서는 반대로 너무 어둡다 — 실측 primary 2.83:1 ·
// secondary 3.33:1 · accent 3.67:1로 전부 AA(4.5) 미달이다. 2026-09-11 실측에서
// 8개 페이지 1,273개 인터랙티브 요소 중 41건이 이 이유로 미달했다.
//
// 해결은 새 토큰이 아니라 기존 변형이다: primary-lighter(7.40:1) ·
// secondary-light(5.71:1) · accent-light(7.94:1). primary-light(#7c3aed)는
// 3.53:1로 여전히 미달이라 다크 짝으로 쓸 수 없다.
//
// 라이트 고정 화면(pages/admin/**, contracts/{sign,complete})은 제외한다 —
// theme-init.js가 모든 라우트에 .dark를 붙이므로, 흰 카드 위에 밝은 보라가 뜨면
// 오히려 대비가 깨진다(docs/design-system.md §1 다크모드).
// 알파 접미사(`text-primary/60`)도 토큰의 일부로 본다. 예전 `(?![-\w/])`는 `/`를 만나면
// 매치를 통째로 버려서 알파 표기가 가드를 그냥 지나갔다 — release-project의 STEP 라벨
// `text-primary/60`(흰 배경 3.09:1)이 그렇게 빠져나가 있었다.
// 주석 줄. JSX 주석(`{/* … */`로 시작하는 줄)도 코드가 아니므로 스캔에서 뺀다.
const isCommentLine = (trimmed: string) =>
  trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('{/*');

const BRAND_TEXT_RE = /(?<![-\w])((?:[a-z-]+:)*)text-(primary|secondary|accent)(\/\d+)?(?![-\w/])/g;

/**
 * 라이트 고정 화면. 정본(docs/design-system.md §1 다크모드)이 면제하는 계약 라우트는
 * 서명·완료 **두 장뿐**이다. 예전엔 `rel.includes('/contracts/')`로 계약 경로 전체를
 * 면제해서, 앞으로 생길 일반 다크 테마 라우트(예: contracts/index.tsx)까지 조용히
 * 가드 밖으로 나갈 판이었다.
 */
const LIGHT_FIXED = (rel: string) =>
  rel.startsWith('pages/admin/') ||
  rel.startsWith('components/admin/') ||
  rel.startsWith('components/contracts/') ||
  /^pages\/\[locale\]\/contracts\/\[id\]\/(sign|complete)\.tsx$/.test(rel);

/**
 * 한 줄 안에서 **문제 토큰이 들어 있는 문자열 리터럴 구간**만 돌려준다.
 *
 * 짝 검사를 줄 전체로 하면 삼항 분기를 서로의 짝으로 오인한다 — AudioPlayer/Playlist의
 * `isActive ? 'text-primary' : 'text-gray-900 dark:text-white'`가 실제로 그렇게 통과했다
 * (활성 트랙 제목이 #121212 패널 위에서 2.64:1). 템플릿 리터럴 안의 `${...}` 식은
 * 별개 구간으로 쪼개므로 위 예에서 두 분기가 서로 섞이지 않는다.
 */
const quotedSegments = (line: string): [number, number][] => {
  const segs: [number, number][] = [];

  const readQuoted = (start: number): number => {
    const quote = line[start];
    let i = start + 1;
    let chunkStart = i;
    while (i < line.length) {
      const c = line[i];
      if (c === '\\') { i += 2; continue; }
      if (c === quote) { segs.push([chunkStart, i]); return i + 1; }
      if (quote === '`' && c === '$' && line[i + 1] === '{') {
        segs.push([chunkStart, i]);
        i = readExpr(i + 2);
        chunkStart = i;
        continue;
      }
      i += 1;
    }
    segs.push([chunkStart, line.length]); // 여러 줄에 걸친 리터럴 — 줄 끝까지를 한 구간으로
    return line.length;
  };

  const readExpr = (start: number): number => {
    let i = start;
    let depth = 1;
    while (i < line.length) {
      const c = line[i];
      if (c === '{') { depth += 1; i += 1; }
      else if (c === '}') { depth -= 1; i += 1; if (depth === 0) return i; }
      else if (c === "'" || c === '"' || c === '`') { i = readQuoted(i); }
      else i += 1;
    }
    return i;
  };

  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === "'" || c === '"' || c === '`') i = readQuoted(i);
    else i += 1;
  }
  return segs;
};

/** 토큰이 놓인 문자열 구간. 어느 구간에도 없으면(따옴표 밖) 줄 전체로 되돌린다. */
const scopeOf = (line: string, index: number): string => {
  for (const [start, end] of quotedSegments(line)) {
    if (index >= start && index < end) return line.slice(start, end);
  }
  return line;
};

/**
 * 텍스트 색이 아니라서 다크 짝이 필요 없는 자리. 파일 + 줄 안에 들어 있는 고정 문자열로
 * 지정한다(줄 번호는 금방 어긋난다). 새로 추가할 땐 **왜 텍스트가 아닌지**를 적을 것 —
 * 이유 없이 넣으면 가드가 무의미해진다.
 */
const BRAND_TEXT_ALLOW: { file: string; snippet: string; reason: string }[] = [
  { file: 'components/booking/BookingWizard.tsx', snippet: 'h-4 w-4 text-primary', reason: '라디오 버튼 채움색(폼 컨트롤)' },
  { file: 'components/booking/BookingWizard.tsx', snippet: 'rounded border-gray-300 dark:border-gray-600 text-primary', reason: '체크박스 체크표시 채움색' },
  { file: 'components/booking/MixingOrderWizard.tsx', snippet: 'h-4 w-4 text-primary', reason: '라디오 버튼 채움색(폼 컨트롤)' },
  { file: 'components/booking/MixingOrderWizard.tsx', snippet: 'rounded border-gray-300 dark:border-gray-600 text-primary', reason: '체크박스 체크표시 채움색' },
  { file: 'components/contact/ContactFormCard.tsx', snippet: 'rounded border-gray-300 dark:border-gray-600 text-primary', reason: '체크박스 체크표시 채움색' },
  { file: 'components/lesson/CurriculumCard.tsx', snippet: 'opacity-10 font-bold text-6xl text-primary', reason: 'opacity-10 장식 워터마크 — 읽는 텍스트가 아니다' },
  { file: 'components/ui/ReviewSection.tsx', snippet: 'text-primary/10 group-hover:text-primary/20', reason: 'aria-hidden 장식 인용부호(알파 10~20%) — 읽는 텍스트가 아니다' },
];

describe('브랜드색 텍스트의 다크 짝', () => {
  it('text-{primary,secondary,accent}에는 같은 variant의 dark: 짝이 있어야 한다', () => {
    const offenders: string[] = [];

    for (const dir of ['components', 'pages']) {
      let files: string[] = [];
      try {
        files = walk(path.join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        if (!rel.endsWith('.tsx') || rel.endsWith('.test.tsx') || LIGHT_FIXED(rel)) continue;

        readFileSync(file, 'utf-8').split('\n').forEach((line, index) => {
          const trimmed = line.trim();
          if (isCommentLine(trimmed)) return;

          BRAND_TEXT_RE.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = BRAND_TEXT_RE.exec(line))) {
            const [full, variantPrefix] = match;
            if (variantPrefix.includes('dark:')) continue; // 이미 다크 전용 유틸리티
            const scope = scopeOf(line, match.index); // 같은 문자열 리터럴 안에서만 짝을 찾는다
            if (new RegExp(`dark:${variantPrefix}text-`).test(scope)) continue; // 같은 variant의 다크 짝 있음
            if (BRAND_TEXT_ALLOW.some((a) => a.file === rel && line.includes(a.snippet))) continue;
            offenders.push(`${rel}:${index + 1}: ${full} — ${trimmed.slice(0, 100)}`);
          }
        });
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        '브랜드색 텍스트에 다크 짝이 없습니다. 다크 배경(#030712)에서 AA 미달이 됩니다.\n' +
          'text-primary→dark:text-primary-lighter · text-secondary→dark:text-secondary-light · ' +
          'text-accent→dark:text-accent-light (primary-light는 3.53:1로 미달이라 쓰지 말 것).\n' +
          '텍스트가 아닌 자리(폼 컨트롤 채움색·장식)라면 BRAND_TEXT_ALLOW에 이유와 함께 등재하세요.\n' +
          offenders.join('\n'),
      );
    }
  });

  it('다크 짝으로 쓰는 세 토큰이 tailwind.config.ts에 존재한다', () => {
    const defined = definedColorNames();
    expect(defined.has('primary-lighter')).toBe(true);
    expect(defined.has('secondary-light')).toBe(true);
    expect(defined.has('accent-light')).toBe(true);
  });
});

// 다크 짝이 "있는지"가 아니라 "충분한지" 보는 가드 (2026-09-11, 2라운드).
//
// 1라운드 가드는 `dark:text-` 짝의 **존재**만 봤다. 그래서 `text-primary
// dark:text-primary-light`가 그대로 통과했는데, primary-light(#7c3aed)는 다크 배경에서
// 3.53:1로 AA(4.5) 미달이다 — 자물쇠는 걸었는데 열쇠를 옆에 걸어 둔 셈이었다.
// 2라운드 실측(텍스트 노드를 직접 가진 모든 엘리먼트로 범위를 넓힘)에서 8개 페이지
// 71건이 이 구멍으로 빠져나가 있었다: pricing 가격 `500,000원`(16px/700),
// FAQ 배지 `Q 1`(12px/600), practice-room `월 6만원 상당`(12px/600) 등.
//
// 다크 배경(gray-900 #030712) 실측 — docs/design-system.md §1 표와 같은 값:
//   primary 2.83 · primary-dark 1.96 · primary-light 3.53 · secondary 3.33 ·
//   secondary-dark 2.25 · accent 3.67 · accent-dark 2.21  → 전부 AA 미달
//   primary-lighter 7.40 · secondary-light 5.71 · accent-light 7.94 → 통과
//
// 대형 텍스트(24px↑ 또는 18.66px↑ bold)는 완화 기준 3:1이라 primary-light가 산술적으로는
// 통과하지만, 클래스 문자열만 보고는 그 자리가 대형인지 알 수 없고 같은 컴포넌트가
// 작은 자리에 재사용되면 조용히 깨진다. 그래서 크기와 무관하게 일괄 금지한다.
const DARK_UNSAFE_RE =
  /(?<![-\w])((?:[a-z-]+:)*dark:(?:[a-z-]+:)*)text-(primary-light|primary-dark|secondary-dark|accent-dark|primary|secondary|accent)(?![-\w])(\/\d+)?/g;

/**
 * 다크 분기인데 **일부러** 라이트 값을 써야 하는 자리. 파일 + 줄 안의 고정 문자열로 지정한다.
 * 새로 넣을 땐 **왜 밝은 배경 위에 뜨는지**를 적을 것 — 이유 없이 넣으면 가드가 무의미해진다.
 */
const DARK_BRAND_ALLOW: { file: string; snippet: string; reason: string }[] = [
  {
    file: 'components/ui/Button.tsx',
    snippet: 'dark:text-primary dark:border-primary/20',
    reason:
      'Button의 light 옵트인 compoundVariant. theme-init.js가 라이트 고정 화면에도 .dark를 ' +
      '붙이므로 거기서는 다크 분기를 라이트 값으로 되돌려야 한다(흰 카드 위 primary-lighter = 2.72:1).',
  },
];

describe('다크 짝의 대비가 충분한가', () => {
  it('dark:text-*에 다크 배경용으로 부족한 브랜드 토큰이 오면 안 된다', () => {
    const offenders: string[] = [];

    for (const dir of ['components', 'pages']) {
      let files: string[] = [];
      try {
        files = walk(path.join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        if (!rel.endsWith('.tsx') || rel.endsWith('.test.tsx') || LIGHT_FIXED(rel)) continue;

        readFileSync(file, 'utf-8').split('\n').forEach((line, index) => {
          const trimmed = line.trim();
          if (isCommentLine(trimmed)) return;

          DARK_UNSAFE_RE.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = DARK_UNSAFE_RE.exec(line))) {
            if (DARK_BRAND_ALLOW.some((a) => a.file === rel && line.includes(a.snippet))) continue;
            offenders.push(`${rel}:${index + 1}: ${match[0]} — ${trimmed.slice(0, 100)}`);
          }
        });
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        '다크 배경에서 AA에 못 미치는 브랜드 토큰이 dark: 분기에 쓰였습니다.\n' +
          '허용되는 다크 짝은 셋뿐입니다 — primary-lighter(7.40:1) · secondary-light(5.71:1) · ' +
          'accent-light(7.94:1). (회색·white 계열은 이 가드의 대상이 아닙니다.)\n' +
          '라이트 고정 화면 때문에 어쩔 수 없다면 DARK_BRAND_ALLOW에 이유와 함께 등재하세요.\n' +
          offenders.join('\n'),
      );
    }
  });

  it('금지 토큰이 실제로 tailwind.config.ts에 정의돼 있다(오탈자로 가드가 비는 것을 막는다)', () => {
    const defined = definedColorNames();
    for (const name of ['primary-light', 'primary-dark', 'secondary-dark', 'accent-dark']) {
      expect(defined.has(name)).toBe(true);
    }
  });
});

// variant 그림자 가드 (2026-09-11, 3라운드).
//
// 앞의 두 가드는 "다크 짝이 있는가 / 충분한가"만 봤다. 그래서 다크 짝을 **추가하는 행위
// 자체가** hover 색을 죽이는 회귀를 초록 CI로 통과시켰다 — 53곳.
//
// 원인은 명시도다. Tailwind가 내는 `.dark\:text-x:is(.dark *)`와 `.hover\:text-white:hover`는
// 둘 다 (0,2,0)으로 **같고**, `dark:` 규칙이 CSS에서 뒤에 나온다. 따라서 다크모드에서는
// hover 색이 지고 기본 색이 그대로 남는다. 아웃라인 pill(`border-2 border-primary
// text-primary dark:text-primary-lighter hover:bg-primary hover:text-white`)에서 실측:
//   primary 2.61:1 · secondary 1.71:1 · accent 2.16:1  ← 전부 AA 미달
// 이 브랜치 이전(다크 짝이 없던 상태)에는 7.10 / 5.48 / 6.04:1이었다.
//
// 해결은 `dark:hover:text-white`처럼 **같은 variant의 다크 짝**을 함께 두는 것이다
// (명시도 (0,3,0)으로 둘 다 이긴다). 정본 §1이 요구하는 규칙과 같다.
const PLAIN_DARK_TEXT_RE = /(?<![-\w:])dark:text-[a-z0-9-]+(?:\/\d+)?(?![-\w])/;
const SHADOWED_VARIANTS = ['hover', 'focus-visible', 'focus', 'group-hover', 'group-focus-visible'];
const SHADOWED_VARIANT_RE = new RegExp(
  `(?<![-\\w:])(${SHADOWED_VARIANTS.join('|')}):text-[a-z0-9-]+(?:\\/\\d+)?(?![-\\w])`,
  'g',
);

describe('다크 짝이 variant 색을 덮어쓰지 않는가', () => {
  it('variant 없는 dark:text-*와 같은 줄의 hover/focus 계열 text-*는 대응하는 dark: 짝이 있어야 한다', () => {
    const offenders: string[] = [];

    for (const dir of ['components', 'pages']) {
      let files: string[] = [];
      try {
        files = walk(path.join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        if (!rel.endsWith('.tsx') || rel.endsWith('.test.tsx') || LIGHT_FIXED(rel)) continue;

        readFileSync(file, 'utf-8').split('\n').forEach((line, index) => {
          const trimmed = line.trim();
          if (isCommentLine(trimmed)) return;
          if (!PLAIN_DARK_TEXT_RE.test(line)) return;

          SHADOWED_VARIANT_RE.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = SHADOWED_VARIANT_RE.exec(line))) {
            const variant = match[1];
            if (new RegExp(`(?<![-\\w:])dark:${variant}:text-`).test(line)) continue;
            offenders.push(`${rel}:${index + 1}: ${match[0]} — ${trimmed.slice(0, 100)}`);
          }
        });
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        '다크 짝(dark:text-*)이 같은 줄의 hover/focus 색을 명시도로 덮어씁니다 — 다크모드에서 ' +
          '그 hover 색이 적용되지 않습니다.\n' +
          '같은 variant의 다크 짝을 함께 두세요: hover:text-white → dark:hover:text-white, ' +
          'group-hover:text-primary-dark → dark:group-hover:text-primary-lighter.\n' +
          offenders.join('\n'),
      );
    }
  });
});

// 아웃라인 pill 재복붙 가드 (2026-09-12).
//
// 위 세 가드는 "이미 심어진 클래스 문자열이 규칙에 맞는가"만 본다. 그런데 이 저장소에서
// 실제로 일어난 일은 **같은 pill을 손으로 다시 짜는 것**이었다 — 같은 className이 9개
// 파일에 45번 복붙됐고, 위 세 가드가 잡은 회귀가 전부 그 45곳에서 났다. 게다가 45곳
// 전부 `focus-visible` 링이 빠져 있었는데, 그건 "틀린 클래스"가 아니라 "없는 클래스"라
// 어떤 가드도 볼 수 없었다.
//
// 그래서 재료가 아니라 **조합**을 본다: 브랜드 보더 + 같은 브랜드 텍스트 + 같은 브랜드
// `hover:bg-`는 아웃라인 pill이고, 그건 components/ui/ServiceLinkPill.tsx가 소유한다.
//
// **`border-2`를 조건에 넣지 않는 이유**(2026-09-12 리뷰): 이번에 흡수한 셸 두 개가 정확히
// 그 반대 형태였다 — `border-2`는 셸의 JSX 템플릿에 있고 색은 별도 상수에 있었다
// (`ServiceQuickLinksSection`의 옛 `COLOR_CLASS`, 연습실 `ServiceLinksSection`의 per-link
// className). `border-2`를 같은 리터럴에서 요구하면 그 두 형태를 되돌려도 가드가 초록이다.
// 대신 pill의 정체를 이루는 `hover:bg-{같은 brand}`를 요구한다 — 실측 결과 이 교체로
// 새로 걸리는 것은 pill 본체(skip)와 allowlist된 공유 버튼뿐이라 오탐 증가는 0이다.
//
// 오탐이 적은 이유: 알파가 붙은 보더(`border-primary/20` — Button의 outline variant)는
// 제외하고, 브랜드 **텍스트**가 같은 문자열에 없으면(BuyerIntentHubPage의 채워진 히어로
// CTA `bg-primary … text-white`) 걸리지 않는다. 전환 직후 실측 예외는 1건뿐이다.
//
// 스캔 범위는 카카오 토큰 가드와 같은 SCAN_DIRS(`data`·`lib`·`utils`의 `.ts` 포함)다 —
// pill 클래스가 상수 파일로 옮겨가면 components/pages만 훑어서는 안 보인다.
const PILL_BRAND_BORDER_RE = /(?<![-\w:])border-(primary|secondary|accent)(?![-\w/])/;
const PILL_BRAND_TEXT_RE = /(?<![-\w:])text-(primary|secondary|accent)(?![-\w/])/;
const pillBrandHoverBgRe = (brand: string) =>
  new RegExp(`(?<![-\\w:])hover:bg-${brand}(?![-\\w/])`);

/** ServiceLinkPill로 표현할 수 없는 자리만 등재한다. 이유 없이 넣지 말 것. */
const PILL_ALLOW: { file: string; snippet: string; reason: string }[] = [
  {
    file: 'pages/[locale]/portfolio/[id].tsx',
    snippet: 'flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] border-2 border-primary',
    reason:
      'sharePortfolio를 부르는 공유 <button>이다 — 링크가 아니라 ServiceLinkPill(next/link ' +
      '래퍼)로 표현할 수 없다. 포커스 링·다크 짝·44px 타깃은 이미 갖추고 있다.',
  },
];

describe('아웃라인 pill은 손으로 다시 짜지 않는다', () => {
  it('border-{brand} + text-{brand} + hover:bg-{brand} 조합은 ServiceLinkPill을 쓴다', () => {
    const offenders: string[] = [];

    for (const dir of SCAN_DIRS) {
      let files: string[] = [];
      try {
        files = walk(path.join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        if (!/\.tsx?$/.test(rel) || /\.test\.tsx?$/.test(rel)) continue;
        // 라이트 고정 화면은 다른 가드와 같게 면제한다 — 강제하면 admin·계약 서명 화면에
        // `dark:` 클래스를 심게 되어 정본 §1의 면제와 정면으로 부딪힌다.
        if (LIGHT_FIXED(rel)) continue;
        // pill 본체는 당연히 이 조합을 가진다.
        if (rel === 'components/ui/ServiceLinkPill.tsx') continue;

        readFileSync(file, 'utf-8').split('\n').forEach((line, index) => {
          const trimmed = line.trim();
          if (isCommentLine(trimmed)) return;

          const match = PILL_BRAND_BORDER_RE.exec(line);
          if (!match) return;
          // 같은 **문자열 리터럴** 안에서만 본다 — 다른 분기의 클래스와 섞이지 않게.
          const scope = scopeOf(line, match.index);
          if (!PILL_BRAND_TEXT_RE.test(scope)) return;
          if (!pillBrandHoverBgRe(match[1]).test(scope)) return;
          if (PILL_ALLOW.some((a) => a.file === rel && line.includes(a.snippet))) return;

          offenders.push(`${rel}:${index + 1}: ${trimmed.slice(0, 120)}`);
        });
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        '아웃라인 서비스 pill을 손으로 다시 짰습니다 — components/ui/ServiceLinkPill을 쓰세요.\n' +
          '이 조합을 복붙하면 다크 텍스트 대비·dark:hover 짝·focus-visible 링을 매번 다시 ' +
          '맞춰야 하고, 실제로 그 세 가지가 45곳에서 한꺼번에 틀어진 적이 있습니다.\n' +
          '링크가 아니라서 pill로 표현할 수 없다면 PILL_ALLOW에 이유와 함께 등재하세요.\n' +
          offenders.join('\n'),
      );
    }
  });
});

/* ------------------------------------------------------------------------- *
 * 포커스 링은 "있으면 통과"가 아니라 **보이면** 통과다 (정본 §5)
 * ------------------------------------------------------------------------- */

/**
 * 포커스 표시기는 텍스트가 아니라 WCAG 2.2 SC 1.4.11(비텍스트 대비) 대상이고 기준은
 * **3:1**이다. 그리고 링은 표면색 위에 알파로 그려지므로 재는 대상은 토큰 원색이 아니라
 * "링 합성색 vs 표면색"이다. 이 저장소가 오랫동안 표준으로 써 온 `ring-primary/40`은
 * 라이트 2.04:1 · 다크 1.33:1로, **있지만 보이지 않는** 링이었다(2026-09-14 실측 75곳).
 *
 * 기존 가드들은 "focus-visible 클래스가 있는가"만 봤기 때문에 이 상태를 전부 통과시켰다.
 * 그래서 여기서는 두 가지를 본다.
 *
 *   1. 알파가 `/40` 이하면 실패. 어떤 표면에서도 3:1을 넘지 못한다.
 *   2. 표면이 테마에 따라 변하는데 다크 짝이 없으면 실패. 다크 배경 위 원색은
 *      `/70`에서도 1.91~2.32:1이라 밝은 짝(`primary-lighter`·`white`·`kakao`)이 필요하다.
 *
 * 표면이 **한 테마로 고정된 자리**(오프셋 색이 하나뿐이고 `dark:` 오프셋 짝이 없는 줄,
 * 예: 어두운 히어로 위 `ring-white/70 + ring-offset-black/20`)는 면제한다 — 그런 자리에
 * 다크 짝을 강제하면 오히려 대비가 떨어진다(흰 카드 위 `primary-lighter/70` = 1.96:1).
 */
/**
 * `dark:` 접두사를 **매치 안에** 넣는다(1번 캡처). 예전엔 앞이 `:`면 거부하는 lookbehind
 * 때문에 `dark:focus-visible:ring-...`이 스캔 자체에서 빠져, 이 파일이 막으려던 낮은 알파가
 * 다크 쪽으로는 그냥 통과했다 — 실측: `'focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/20'`
 * 에서 뒤쪽 `/20`(약 1.5:1)이 한 건도 안 걸렸다. 알파 기준(`MIN_RING_ALPHA`)은 라이트·다크
 * 구분 없이 같게 적용한다.
 */
const FOCUS_RING_COLOR_RE =
  /(?<![-\w:])(dark:)?focus-visible:ring-(?!offset-|inset(?![-\w])|\d)([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?:\/(\d+))?(?![-\w])/g;
/** `dark:focus-visible:ring-<색>` — 오프셋·굵기·inset은 링 색이 아니다. */
const DARK_FOCUS_RING_COLOR_RE =
  /(?<![-\w:])dark:focus-visible:ring-(?!offset-|inset(?![-\w])|\d)[a-z]/;
/** 링 오프셋 **색**(굵기 `ring-offset-2`는 색이 아니다). */
const FOCUS_RING_OFFSET_COLOR_RE =
  /(?<![-\w:])focus-visible:ring-offset-(?!\d+(?![-\w]))([a-z[][^\s`'"]*)/;
const DARK_FOCUS_RING_OFFSET_COLOR_RE =
  /(?<![-\w:])dark:focus-visible:ring-offset-(?!\d+(?![-\w]))([a-z[][^\s`'"]*)/;

/**
 * 링이 닿는 표면이 테마에 따라 실제로 바뀌는가. 오프셋 색이 라이트·다크 **같은 값**이면
 * (히어로 오버레이의 `ring-offset-black/20 dark:ring-offset-black/20`처럼) 표면은 고정이다 —
 * 이런 줄에 다크 짝을 강제하면 어두운 사진 위 흰 링을 보라로 바꾸라는 말이 된다.
 */
const surfaceVariesByTheme = (scope: string): boolean => {
  const light = FOCUS_RING_OFFSET_COLOR_RE.exec(scope)?.[1];
  const dark = DARK_FOCUS_RING_OFFSET_COLOR_RE.exec(scope)?.[1];
  if (!light) return true; // 오프셋 색이 없으면 페이지 배경 = 테마를 탄다
  if (!dark) return false; // 한 색으로 고정
  return light !== dark;
};

/** 최소 알파. `/40`은 라이트 2.04 · 다크 1.33으로 어디서도 3:1을 못 넘는다. */
const MIN_RING_ALPHA = 50;

/**
 * 다크 짝 없이 단색 링을 쓰는 자리. **왜 그 표면에서 3:1을 넘는지**를 실측값과 함께 적을 것 —
 * 이유 없이 넣으면 이 가드는 예전 가드와 똑같이 "클래스가 있으면 통과"로 되돌아간다.
 */
const FOCUS_RING_ALLOW: { file: string; snippet: string; reason: string }[] = [
  {
    file: 'components/contact/KoreanFastContactActions.tsx',
    snippet: 'focus-visible:ring-green-700',
    reason:
      '네이버(green-700 #15803d)는 브랜드색 그대로 써야 하는 자리이고, 실측이 양쪽 다 ' +
      '통과한다 — 흰 배경 5.02:1 · gray-900 4.01:1.',
  },
];

describe('포커스 링이 실제로 보이는가', () => {
  it('알파는 /50 이상이고, 테마에 따라 표면이 바뀌면 다크 짝이 있어야 한다', () => {
    const offenders: string[] = [];

    for (const dir of SCAN_DIRS) {
      let files: string[] = [];
      try {
        files = walk(path.join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        // pill 가드(SCAN_DIRS)와 같은 파일집합 — `.ts`의 클래스 상수도 본다.
        if (/\.test\.tsx?$/.test(rel)) continue;

        readFileSync(file, 'utf-8').split('\n').forEach((line, index) => {
          const trimmed = line.trim();
          if (isCommentLine(trimmed)) return;

          FOCUS_RING_COLOR_RE.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = FOCUS_RING_COLOR_RE.exec(line))) {
            const [full, darkPrefix, , alphaRaw] = match;
            // 같은 **문자열 리터럴** 안에서만 짝을 찾는다 — 삼항 분기를 서로의 짝으로 오인하지 않게.
            const scope = scopeOf(line, match.index);
            const allowed = FOCUS_RING_ALLOW.some((a) => a.file === rel && scope.includes(a.snippet));

            if (alphaRaw !== undefined && Number(alphaRaw) < MIN_RING_ALPHA) {
              offenders.push(
                `${rel}:${index + 1}: ${full} — 알파가 낮아 3:1을 못 넘습니다(/40 = 라이트 2.04 · 다크 1.33)`,
              );
              continue;
            }

            if (allowed) continue;
            // `dark:` 링 자체는 이미 다크 짝이다 — 알파만 보고 짝 검사는 건너뛴다.
            if (darkPrefix) continue;
            // 라이트 고정 화면은 다른 가드와 같게 면제한다(정본 §1).
            if (LIGHT_FIXED(rel)) continue;
            if (DARK_FOCUS_RING_COLOR_RE.test(scope)) continue;

            // 표면이 한 테마로 고정된 자리(오프셋 색이 하나뿐)는 다크 짝이 필요 없다.
            if (!surfaceVariesByTheme(scope)) continue;

            offenders.push(
              `${rel}:${index + 1}: ${full} — 표면이 테마에 따라 바뀌는데 다크 짝이 없습니다`,
            );
          }
        });
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        '포커스 링이 "있지만 보이지 않는" 상태입니다 — docs/design-system.md §5를 보세요.\n' +
          '· 알파는 `/70`(라이트 3.84 · 다크 밝은 짝 4.06). `/40`은 어디서도 3:1을 못 넘습니다.\n' +
          '· 다크 표면에는 원색이 아니라 밝은 짝을 씁니다: ' +
          '`focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70`.\n' +
          '· 표면이 한 테마로 고정된 자리라면 오프셋 색을 그 테마 하나로만 두면 면제됩니다.\n' +
          '· 그래도 예외라면 FOCUS_RING_ALLOW에 **실측 대비값과 함께** 등재하세요.\n' +
          offenders.join('\n'),
      );
    }
  });
});

/**
 * 포커스 링을 **보이지 않게** 만드는 두 번째 경로: transition.
 *
 * 2026-09-14에 드러난 결함이다. `focus-visible:ring-2`도, `--tw-ring-color`도, 생성된
 * `.focus-visible\:ring-2` 규칙도 전부 정상인데 헤더 카카오 CTA에 링이 안 보였다.
 * 원인은 Tailwind가 `ring-*`를 outline이 아니라 **box-shadow로** 그린다는 데 있다 —
 * 같은 요소가 box-shadow를 보간하면(`transition-all`·`transition-shadow`·
 * `transition-[...box-shadow...]`·prefix 없는 `transition`) 링이 0px·투명에서 시작해
 * duration에 걸쳐 서서히 나타난다. 실측: t=0ms 0px → t=150ms 3.3px → t=300ms 4px.
 * Tab으로 빠르게 넘기는 키보드 사용자는 링을 온전히 보지 못하고, 포커스가 지금 어디에
 * 있는지 읽어내지 못한다.
 *
 * 알파 가드(위)는 이 형태를 통과시킨다 — 클래스도 색도 다 맞기 때문이다. 그래서 별도 규칙:
 * **포커스 링을 가진 요소는 box-shadow를 transition 목록에 넣지 않는다.**
 *
 * 검사 단위가 "한 줄"이 아니라 "이어 붙는 문자열 리터럴 묶음"인 이유: `cn(...)`·`cva(...)`는
 * 클래스를 여러 인자로 쪼개 두므로(`Field.tsx`가 그렇다) 줄 단위로 보면 transition과 ring이
 * 서로 다른 줄에 있어 놓친다.
 */
/**
 * 알려진 한계: 묶음은 **이어 붙는 문자열 리터럴**만 합치므로, `cn('x', cond && 'y')`처럼
 * 식이 끼어드는 형태·`cva` variants의 서로 다른 슬롯·`${...}` 보간으로 끊긴 템플릿 리터럴에서
 * transition과 ring이 갈라져 있으면 못 잡는다. 현재 저장소에 그런 구멍은 0건이라 그대로 둔다 —
 * 새로 생기면 클래스를 한 묶음으로 붙여 쓰거나 여기를 확장할 것.
 */
const RING_TOKEN_RE = /(?:^|[\s])(?:[a-z-]+:)*focus(?:-visible)?:ring-\d/;
const SHADOW_TRANSITION_RE =
  /(?:^|\s)(transition-all|transition-shadow|transition)(?=\s|$)|transition-\[[^\]]*\bbox-shadow\b[^\]]*\]/;

/**
 * 파일을 훑어 문자열 리터럴을 뽑되, **공백·쉼표·`+`·주석만으로 이어지는** 리터럴들은
 * 한 묶음으로 합친다(= 같은 className으로 합성될 것들). 템플릿 리터럴의 `${...}` 식은
 * 경계로 삼아 삼항 분기가 서로 섞이지 않게 한다.
 */
const classGroups = (src: string): string[] => {
  const groups: string[] = [];
  let cur: string[] = [];
  let gap = '';
  const flush = () => {
    if (cur.length) groups.push(cur.join(' '));
    cur = [];
  };
  const push = (lit: string) => {
    // 리터럴 사이가 공백/쉼표/`+`뿐이면 같은 묶음으로 이어 붙인다.
    if (cur.length && !/^[\s,+]*$/.test(gap)) flush();
    cur.push(lit);
    gap = '';
  };

  let i = 0;
  const readString = (quote: string) => {
    i += 1;
    let buf = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { buf += src[i + 1] ?? ''; i += 2; continue; }
      if (c === quote) { i += 1; push(buf); return; }
      if (quote === '`' && c === '$' && src[i + 1] === '{') {
        push(buf);
        flush();           // 보간식은 경계다
        buf = '';
        i += 2;
        let depth = 1;
        while (i < src.length && depth > 0) {
          const d = src[i];
          if (d === '{') depth += 1;
          else if (d === '}') depth -= 1;
          else if (d === "'" || d === '"' || d === '`') { readString(d); continue; }
          i += 1;
        }
        gap = '';
        continue;
      }
      buf += c;
      i += 1;
    }
    push(buf);
  };

  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1; i += 2; continue; }
    if (c === "'" || c === '"' || c === '`') { readString(c); continue; }
    gap += c;
    i += 1;
  }
  flush();
  return groups;
};

/**
 * 예외는 **왜 링이 box-shadow로 안 그려지는지**를 적을 것(예: outline 기반 표시기).
 * "보기에 괜찮아서"는 이유가 아니다 — 이 결함은 눈이 아니라 타이밍의 문제다.
 */
const RING_TRANSITION_ALLOW: { file: string; snippet: string; reason: string }[] = [];

describe('포커스 링이 늦게 나타나지 않는가', () => {
  it('focus ring이 있는 요소는 box-shadow를 transition 하지 않는다', () => {
    const offenders: string[] = [];

    for (const dir of SCAN_DIRS) {
      let files: string[] = [];
      try {
        files = walk(path.join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        if (/\.test\.tsx?$/.test(rel)) continue;

        for (const group of classGroups(readFileSync(file, 'utf-8'))) {
          if (!RING_TOKEN_RE.test(group)) continue;
          const bad = SHADOW_TRANSITION_RE.exec(group);
          if (!bad) continue;
          if (RING_TRANSITION_ALLOW.some((a) => a.file === rel && group.includes(a.snippet))) continue;
          offenders.push(`${rel}: ${bad[0].trim()} — ${group.trim().slice(0, 90)}…`);
        }
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        'Tailwind의 ring은 box-shadow로 그려집니다 — box-shadow를 보간하면 포커스 링이 ' +
          'duration만큼 늦게 떠올라 Tab으로 넘기는 사용자에게는 사실상 안 보입니다.\n' +
          '· transition 목록에서 box-shadow를 빼세요(`transition-all`·`transition-shadow`·' +
          '접두사 없는 `transition` 포함). 필요한 속성만 명시하면 됩니다.\n' +
          '· hover shadow가 즉시 바뀌는 것은 허용된 비용입니다. 포커스 표시기가 우선입니다.\n' +
          '· 근거와 측정 방법은 docs/design-system.md §5.\n' +
          offenders.join('\n'),
      );
    }
  });
});
