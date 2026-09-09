import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

import { computeProjectState, type ProjectState } from './projectState';

export { computeProjectState };
export type { ProjectState };

export interface FundingReward {
  id: string; title: string; description: string; amount: number;
  totalQuantity: number | null; requiresShipping: boolean; estimatedDelivery: string; image: string | null;
}
export interface FundingProject {
  slug: string; title: string; summary: string; cover: string; ogImage: string | null;
  goalAmount: number; startAt: string; endAt: string; status: 'auto' | 'draft' | 'closed';
  hidden: boolean; lastmod: string; rewards: FundingReward[]; content: string;
}

export const FUNDING_DIR = path.join(process.cwd(), 'content', 'funding');

const str = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`funding frontmatter: ${name}은(는) 비어 있지 않은 문자열이어야 합니다`);
  return v;
};
const posInt = (v: unknown, name: string): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) throw new Error(`funding frontmatter: ${name}은(는) 양의 정수여야 합니다`);
  return v;
};
const isoDate = (v: unknown, name: string): string => {
  const s = v instanceof Date ? v.toISOString() : str(v, name);
  if (Number.isNaN(new Date(s).getTime())) throw new Error(`funding frontmatter: ${name}이(가) 날짜가 아닙니다`);
  return s;
};

const parseReward = (raw: unknown, index: number): FundingReward => {
  if (typeof raw !== 'object' || raw === null) throw new Error(`funding frontmatter: rewards[${index}] 형식 오류`);
  const r = raw as Record<string, unknown>;
  return {
    id: str(r.id, `rewards[${index}].id`),
    title: str(r.title, `rewards[${index}].title`),
    description: str(r.description, `rewards[${index}].description`),
    amount: posInt(r.amount, `rewards[${index}].amount`),
    totalQuantity: r.totalQuantity === undefined || r.totalQuantity === null ? null : posInt(r.totalQuantity, `rewards[${index}].totalQuantity`),
    requiresShipping: r.requiresShipping === true,
    estimatedDelivery: str(r.estimatedDelivery, `rewards[${index}].estimatedDelivery`),
    image: typeof r.image === 'string' && r.image !== '' ? r.image : null,
  };
};

export const parseFundingProject = (raw: string, slug: string): FundingProject => {
  const { data, content } = matter(raw);
  const d = data as Record<string, unknown>;
  if (str(d.slug, 'slug') !== slug) throw new Error(`funding frontmatter: slug(${d.slug})가 파일명(${slug})과 다릅니다`);
  const startAt = isoDate(d.startAt, 'startAt');
  const endAt = isoDate(d.endAt, 'endAt');
  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) throw new Error('funding frontmatter: endAt은 startAt보다 뒤여야 합니다');
  const rewardsRaw = Array.isArray(d.rewards) ? d.rewards : [];
  if (rewardsRaw.length === 0) throw new Error('funding frontmatter: rewards가 1개 이상이어야 합니다');
  const rewards = rewardsRaw.map(parseReward);
  const ids = new Set<string>();
  for (const r of rewards) {
    if (ids.has(r.id)) throw new Error(`funding frontmatter: 리워드 id 중복 — ${r.id}`);
    ids.add(r.id);
  }
  const status = d.status === 'draft' || d.status === 'closed' ? d.status : 'auto';
  return {
    slug,
    title: str(d.title, 'title'),
    summary: str(d.summary, 'summary'),
    cover: str(d.cover, 'cover'),
    ogImage: typeof d.ogImage === 'string' && d.ogImage !== '' ? d.ogImage : null,
    goalAmount: posInt(d.goalAmount, 'goalAmount'),
    startAt, endAt, status,
    hidden: d.hidden === true,
    lastmod: d.lastmod instanceof Date ? d.lastmod.toISOString().slice(0, 10) : typeof d.lastmod === 'string' ? d.lastmod : startAt.slice(0, 10),
    rewards, content,
  };
};

export const getFundingProject = (slug: string): FundingProject | null => {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  if (!fs.existsSync(FUNDING_DIR)) {
    console.error('[funding] content/funding 디렉터리 없음 — 배포 번들에 md가 포함되지 않았을 가능성');
    return null;
  }
  const file = path.join(FUNDING_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return parseFundingProject(fs.readFileSync(file, 'utf-8'), slug);
};

export const getAllFundingProjects = (): FundingProject[] => {
  if (!fs.existsSync(FUNDING_DIR)) {
    console.error('[funding] content/funding 디렉터리 없음 — 배포 번들에 md가 포함되지 않았을 가능성');
    return [];
  }
  return fs.readdirSync(FUNDING_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseFundingProject(fs.readFileSync(path.join(FUNDING_DIR, f), 'utf-8'), f.replace(/\.md$/, '')));
};

const STATE_ORDER: Record<ProjectState, number> = { live: 0, upcoming: 1, closed: 2, draft: 3 };

export const getListableFundingProjects = (now: Date = new Date()): FundingProject[] =>
  getAllFundingProjects()
    .filter((p) => !p.hidden && computeProjectState(p, now) !== 'draft')
    .sort((a, b) => STATE_ORDER[computeProjectState(a, now)] - STATE_ORDER[computeProjectState(b, now)]
      || new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

export const findReward = (project: FundingProject, rewardId: string): FundingReward | undefined =>
  project.rewards.find((r) => r.id === rewardId);
