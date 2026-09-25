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

/**
 * `getFundingProjectAsync`와 같은 조회이되 **부재와 조회 실패를 구분한다.**
 *
 * 위 함수가 오류를 삼키는 것은 공개 페이지를 위한 설계다 — DB가 흔들려도 파일로 열린
 * 캠페인은 계속 열려 있어야 한다. 그런데 후원자의 권리를 판정하는 두 자리
 * (후원 확인 화면·셀프 취소 API)는 `null`을 곧바로 "마감"으로 읽는 바람에, 조회가 한 번
 * 흔들리면 모금 중인 프로젝트의 후원자가 "펀딩 마감 후에는 온라인 취소가 불가합니다"를
 * 보고 리워드 내려받기까지 잃었다. 거기서는 "없다"와 "모르겠다"가 달라야 한다.
 *
 * `lookupFailed: true`면 프로젝트의 부재를 단정하지 말 것 — 일시 오류로 다뤄야 한다.
 */
export const getFundingProjectOrFailure = async (
  slug: string,
): Promise<{ project: FundingProject | null; lookupFailed: boolean }> => {
  const fromFile = getFundingProject(slug);
  if (fromFile) return { project: fromFile, lookupFailed: false };
  try {
    return { project: await getDbFundingProject(slug), lookupFailed: false };
  } catch (error: unknown) {
    console.error(`[funding] DB 조회 실패(slug=${slug}) — 부재로 단정하지 않는다:`, error);
    return { project: null, lookupFailed: true };
  }
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
