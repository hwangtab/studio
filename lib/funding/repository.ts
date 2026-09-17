import { computeProjectState } from './projectState';
import { getAllFundingProjects, getFundingProject, sortListableProjects } from './projects';
import { getDbFundingProject, listDbFundingProjects } from './dbProjects';

import type { FundingProject } from './shape';

/**
 * 프로젝트를 읽는 **유일한 입구**.
 *
 * 순서는 md 먼저, 그다음 DB다. 진행 중인 프로젝트가 파일로 남아 있는 동안(스펙 D5) 두 곳에
 * 같은 slug가 있으면 파일이 이긴다 — 파일은 배포에 실려 있어 어느 인스턴스에서 읽어도 같지만,
 * DB는 그 사이 누군가 고쳤을 수 있다. 공존 기간에는 "이미 열려 있는 캠페인은 절대 안 바뀐다"가
 * 더 중요하다.
 *
 * **DB 오류를 삼킨다.** 빌드는 TURSO_* 없이도 성공해야 하고(CI·로컬), 런타임에 DB가 잠깐
 * 흔들려도 파일로 열린 캠페인의 후원까지 멈출 이유는 없다. 대신 기록은 남긴다.
 */
const safeDb = async <T>(run: () => Promise<T>, fallback: T, where: string): Promise<T> => {
  try {
    return await run();
  } catch (error: unknown) {
    console.error(`[funding] DB 조회 실패(${where}) — 파일 기준으로만 응답합니다:`, error);
    return fallback;
  }
};

export const getFundingProjectAsync = async (slug: string): Promise<FundingProject | null> => {
  const fromFile = getFundingProject(slug);
  if (fromFile) return fromFile;
  return safeDb(() => getDbFundingProject(slug), null, `slug=${slug}`);
};

export const getAllFundingProjectsAsync = async (): Promise<FundingProject[]> => {
  const fromFile = getAllFundingProjects();
  const seen = new Set(fromFile.map((p) => p.slug));
  const fromDb = await safeDb(() => listDbFundingProjects(), [], 'list');
  return [...fromFile, ...fromDb.filter((p) => !seen.has(p.slug))];
};

export const getListableFundingProjectsAsync = async (now: Date = new Date()): Promise<FundingProject[]> => {
  const all = await getAllFundingProjectsAsync();
  return sortListableProjects(all.filter((p) => !p.hidden && computeProjectState(p, now) !== 'draft'), now);
};
