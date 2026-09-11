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
const BRAND_TEXT_RE = /(?<![-\w])((?:[a-z-]+:)*)text-(primary|secondary|accent)(?![-\w/])/g;

const LIGHT_FIXED = (rel: string) =>
  rel.startsWith('pages/admin/') || rel.startsWith('components/admin/') || rel.includes('/contracts/');

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
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

          BRAND_TEXT_RE.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = BRAND_TEXT_RE.exec(line))) {
            const [full, variantPrefix] = match;
            if (variantPrefix.includes('dark:')) continue; // 이미 다크 전용 유틸리티
            if (new RegExp(`dark:${variantPrefix}text-`).test(line)) continue; // 같은 variant의 다크 짝 있음
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
