import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

import { computeProjectState, type ProjectState } from './projectState';
import { validateFundingProjectShape, type FundingProject, type FundingReward } from './shape';

export { computeProjectState, validateFundingProjectShape };
export type { ProjectState };
export {
  FUNDING_STATUSES,
  stripRewardDownloads,
} from './shape';
export type { FundingDownload, FundingProject, FundingReward, FundingStatus } from './shape';

export const FUNDING_DIR = path.join(process.cwd(), 'content', 'funding');

export const parseFundingProject = (raw: string, slug: string): FundingProject => {
  const { data, content } = matter(raw);
  return validateFundingProjectShape(data as Record<string, unknown>, slug, content);
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

/**
 * 공개 목록의 정렬 — live → upcoming → closed, 같은 상태면 시작일 내림차순.
 * md 목록과 DB 목록을 합친 뒤에도 같은 순서를 써야 하므로 밖으로 꺼냈다(repository.ts).
 */
export const sortListableProjects = (projects: FundingProject[], now: Date): FundingProject[] =>
  [...projects].sort((a, b) => STATE_ORDER[computeProjectState(a, now)] - STATE_ORDER[computeProjectState(b, now)]
    || new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

export const getListableFundingProjects = (now: Date = new Date()): FundingProject[] =>
  sortListableProjects(getAllFundingProjects().filter((p) => !p.hidden && computeProjectState(p, now) !== 'draft'), now);

export const findReward = (project: FundingProject, rewardId: string): FundingReward | undefined =>
  project.rewards.find((r) => r.id === rewardId);
