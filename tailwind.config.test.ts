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

// (bg|text|border|...)-kakao(-dark|-ink)? 형태만 카카오 계열로 본다.
const KAKAO_CLASS_RE =
  /(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|placeholder|caret|accent|shadow)-(kakao(?:-[\w]+)?)\b/g;

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
