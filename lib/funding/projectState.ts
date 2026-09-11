/**
 * 프로젝트 상태 판정 — fs를 import하지 않는 순수 모듈.
 *
 * projects.ts는 node:fs를 import하므로 클라이언트 번들에서 쓸 수 없다. 배지처럼 마운트 후
 * 브라우저 시계로 다시 계산해야 하는 곳이 있어(빌드 시각 고정 방지) 여기로 분리했다.
 *
 * FundingStatus는 projects.ts(FUNDING_STATUSES 배열이 정본)에서 **타입으로만** 끌어온다.
 * `import type`은 컴파일에서 완전히 지워지므로 런타임 import가 생기지 않는다 — 값으로
 * 가져오면 projects.ts ↔ projectState.ts 순환 import가 생기고 node:fs가 클라이언트
 * 번들에 딸려 들어간다. 예전엔 여기서 `'auto' | 'draft' | 'closed'`를 손으로 다시 적어
 * 두 정의가 조용히 갈릴 수 있었다.
 */
import type { FundingStatus } from './projects';

export type ProjectState = 'draft' | 'upcoming' | 'live' | 'closed';

export const computeProjectState = (
  project: { status: FundingStatus; startAt: string; endAt: string },
  now: Date,
): ProjectState => {
  if (project.status === 'draft') return 'draft';
  if (project.status === 'closed') return 'closed';
  const t = now.getTime();
  if (t < new Date(project.startAt).getTime()) return 'upcoming';
  if (t < new Date(project.endAt).getTime()) return 'live';
  return 'closed';
};
