import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

import type { FundingProject } from './shape';
import { hasFundingTranslation, type FundingTranslationLocale } from './translatedSlugs';

/**
 * 펀딩 상세의 번역본을 읽어 정본 프로젝트에 **글자만** 덮는다.
 *
 * 파일: `content/funding/<locale>/<slug>.md` — frontmatter의 title·summary·rewards.<id>.title/description과 본문.
 * 리워드 id·금액·한정 수량·일정·이미지·상태는 정본(`content/funding/<slug>.md`)에서만 온다. 번역 파일이 그 값을
 * 들고 있으면 한쪽만 고쳐져 화면마다 금액이 갈리므로 아예 받지 않는다.
 *
 * 서버 전용(node:fs) — getStaticProps 안에서만 부른다. 하위 폴더라 `getAllFundingProjects`(최상위 *.md만 읽음)와
 * 사이트맵(lib/sitemap/fundingMeta.js)은 번역 파일을 프로젝트로 착각하지 않는다.
 */
export const FUNDING_TRANSLATION_DIR = path.join(process.cwd(), 'content', 'funding');

interface FundingTranslation {
  title: string;
  summary: string;
  content: string;
  rewards: Record<string, { title: string; description: string }>;
}

const requireString = (value: unknown, where: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`[funding-translation] ${where}이(가) 비어 있다`);
  return value;
};

export const parseFundingTranslation = (raw: string, where: string): FundingTranslation => {
  const { data, content } = matter(raw);
  const rewards: FundingTranslation['rewards'] = {};
  const rawRewards = (data.rewards ?? {}) as Record<string, Record<string, unknown>>;
  for (const [id, r] of Object.entries(rawRewards)) {
    rewards[id] = {
      title: requireString(r?.title, `${where} rewards.${id}.title`),
      description: requireString(r?.description, `${where} rewards.${id}.description`),
    };
  }
  return {
    title: requireString(data.title, `${where} title`),
    summary: requireString(data.summary, `${where} summary`),
    content: requireString(content, `${where} 본문`),
    rewards,
  };
};

export const readFundingTranslation = (slug: string, locale: FundingTranslationLocale): FundingTranslation | null => {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = path.join(FUNDING_TRANSLATION_DIR, locale, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return parseFundingTranslation(fs.readFileSync(file, 'utf-8'), `${locale}/${slug}.md`);
};

/**
 * 정본에 번역을 덮는다. 번역에 없는 리워드가 있으면 **던진다** — 한국어 리워드가 영문 화면에 섞여
 * 나가는 것보다 빌드가 서는 편이 낫다(새 리워드를 정본에만 추가했을 때 여기서 드러난다).
 */
export const applyFundingTranslation = (project: FundingProject, tr: FundingTranslation): FundingProject => ({
  ...project,
  title: tr.title,
  summary: tr.summary,
  content: tr.content,
  rewards: project.rewards.map((r) => {
    const t = tr.rewards[r.id];
    if (!t) throw new Error(`[funding-translation] ${project.slug}: 리워드 ${r.id}의 번역이 없다`);
    return { ...r, title: t.title, description: t.description };
  }),
});

export const getTranslatedFundingProject = (project: FundingProject, locale: string): FundingProject | null => {
  if (!hasFundingTranslation(project.slug, locale)) return null;
  const tr = readFundingTranslation(project.slug, locale);
  return tr ? applyFundingTranslation(project, tr) : null;
};
