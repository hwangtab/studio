import fs from 'node:fs';
import path from 'node:path';

import { getFundingProject } from './projects';
import { FUNDING_TRANSLATED_SLUGS, hasFundingTranslation } from './translatedSlugs';
import { applyFundingTranslation, FUNDING_TRANSLATION_DIR, readFundingTranslation } from './translations';
import { isKoOnlyRoutePath, isTranslatedKoOnlyPath } from '../koOnlyRoutes';

const translationFiles = (): string[] =>
  fs.readdirSync(FUNDING_TRANSLATION_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => fs.readdirSync(path.join(FUNDING_TRANSLATION_DIR, d.name))
      .filter((f) => f.endsWith('.md'))
      .map((f) => `${d.name}/${f.replace(/\.md$/, '')}`));

describe('펀딩 번역본', () => {
  it('목록(translatedSlugs)과 파일이 정확히 같다 — 한쪽만 있으면 404이거나 전환기가 없는 페이지로 보낸다', () => {
    const listed = Object.entries(FUNDING_TRANSLATED_SLUGS).flatMap(([slug, ls]) => ls.map((l) => `${l}/${slug}`)).sort();
    expect(translationFiles().sort()).toEqual(listed);
  });

  it.each(Object.entries(FUNDING_TRANSLATED_SLUGS).flatMap(([slug, ls]) => ls.map((l) => [slug, l] as const)))(
    '%s (%s): 정본의 모든 리워드에 번역이 있고, 금액·id·한정은 정본 그대로다',
    (slug, locale) => {
      const original = getFundingProject(slug);
      expect(original).not.toBeNull();
      const tr = readFundingTranslation(slug, locale);
      expect(tr).not.toBeNull();
      const translated = applyFundingTranslation(original!, tr!);
      expect(translated.rewards.map((r) => [r.id, r.amount, r.totalQuantity ?? null]))
        .toEqual(original!.rewards.map((r) => [r.id, r.amount, r.totalQuantity ?? null]));
      // 번역에만 있는(정본에서 사라진) 리워드 id가 남아 있지 않다.
      expect(Object.keys(tr!.rewards).sort()).toEqual(original!.rewards.map((r) => r.id).sort());
      // 영문 화면에 한글이 새지 않는다(가사 인용 喝 같은 한자는 허용).
      expect(`${translated.title}${translated.summary}${translated.rewards.map((r) => r.title + r.description).join('')}`).not.toMatch(/[가-힣]/);
    },
  );

  it('번역본이 있는 조합만 언어 전환기가 같은 페이지로 보낸다', () => {
    expect(hasFundingTranslation('sabbaha-slung', 'en')).toBe(true);
    expect(isKoOnlyRoutePath('/funding/sabbaha-slung')).toBe(true);
    expect(isTranslatedKoOnlyPath('/funding/sabbaha-slung', 'en')).toBe(true);
    expect(isTranslatedKoOnlyPath('/funding/sabbaha-slung', 'zh')).toBe(false);
    expect(isTranslatedKoOnlyPath('/funding/keep-singing-for-palestine', 'en')).toBe(false);
    expect(isTranslatedKoOnlyPath('/funding', 'en')).toBe(false);
  });
});
