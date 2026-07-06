/** @jest-environment node */

/**
 * 로케일 키 패리티 가드 — 7로케일 common.json의 키 집합 동일성을 CI에서 강제.
 *
 * content/i18nKeys.test.ts는 "코드가 쓰는 키"의 존재만 검사하므로, 코드가 아직
 * 안 쓰는 키의 번역 누락·한쪽 로케일에만 추가된 고아 키는 통과했다(2026-06 한 달
 * 동안 i18n 값 노출 수정 4커밋의 배경). 이 테스트는 ko를 기준으로 나머지 6개
 * 로케일의 키 집합·리프 타입이 동일함을 통째로 단언한다.
 *
 * 의도적 로케일 전용 키는 LOCALE_ONLY_KEYS에 사유와 함께 등록할 것.
 */

import fs from 'fs';
import path from 'path';

import { locales, type Locale } from '../lib/i18n';

// 특정 로케일에만 존재하는 것이 의도된 키 (ko에 없어도 허용).
const LOCALE_ONLY_KEYS: Partial<Record<Locale, Set<string>>> = {
  // /en/contact AI 콜드 트래픽 CRO 전용 섹션 (2026-06-17 6067386847)
  en: new Set(['contact.whatToExpect.items', 'contact.faq']),
};

type LeafType = 'string' | 'array' | 'number' | 'boolean' | 'null' | 'empty-object';

const flattenLeaves = (obj: unknown, prefix = '', out = new Map<string, LeafType>()): Map<string, LeafType> => {
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    const entries = Object.entries(obj);
    // 빈 객체를 리프로 취급 — 자식이 전부 삭제된 {} 서브트리가 양쪽 검사에서
    // 보이지 않게 되는 사각(한쪽은 {}, 다른 쪽은 문자열인 불일치 미검출)을 막는다.
    if (entries.length === 0 && prefix) {
      out.set(prefix, 'empty-object');
      return out;
    }
    for (const [key, value] of entries) {
      flattenLeaves(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  const type: LeafType = Array.isArray(obj)
    ? 'array'
    : obj === null
      ? 'null'
      : (typeof obj as LeafType);
  out.set(prefix, type);
  return out;
};

const loadLeaves = (locale: Locale): Map<string, LeafType> => {
  const file = path.join(process.cwd(), 'public/locales', locale, 'common.json');
  return flattenLeaves(JSON.parse(fs.readFileSync(file, 'utf8')));
};

describe('locale key parity', () => {
  const ko = loadLeaves('ko');
  const others = (locales as readonly Locale[]).filter((l) => l !== 'ko');

  it.each(others)('%s has every ko key with the same leaf type', (locale) => {
    const leaves = loadLeaves(locale);
    const missing = [...ko.keys()].filter((key) => !leaves.has(key));
    const typeMismatch = [...ko.entries()]
      .filter(([key, type]) => leaves.has(key) && leaves.get(key) !== type)
      .map(([key, type]) => `${key} (ko:${type} ≠ ${locale}:${leaves.get(key)})`);

    expect(
      missing.length === 0 ? '' : `ko 키 ${missing.length}개가 ${locale}에 없음:\n  ${missing.join('\n  ')}`,
    ).toBe('');
    expect(
      typeMismatch.length === 0 ? '' : `리프 타입 불일치:\n  ${typeMismatch.join('\n  ')}`,
    ).toBe('');
  });

  it.each(others)('%s has no orphan keys missing from ko (unless allowlisted)', (locale) => {
    const leaves = loadLeaves(locale);
    const allowed = LOCALE_ONLY_KEYS[locale] ?? new Set<string>();
    const orphans = [...leaves.keys()].filter((key) => !ko.has(key) && !allowed.has(key));

    expect(
      orphans.length === 0
        ? ''
        : `${locale} 전용 고아 키 ${orphans.length}개 — 의도적이면 LOCALE_ONLY_KEYS에 사유와 함께 등록:\n  ${orphans.join('\n  ')}`,
    ).toBe('');
  });

  it('keeps the allowlist minimal — every allowlisted key must actually exist', () => {
    for (const [locale, keys] of Object.entries(LOCALE_ONLY_KEYS)) {
      const leaves = loadLeaves(locale as Locale);
      const stale = [...(keys ?? [])].filter((key) => !leaves.has(key));
      expect(
        stale.length === 0 ? '' : `${locale} allowlist에 실존하지 않는 키: ${stale.join(', ')}`,
      ).toBe('');
    }
  });
});
