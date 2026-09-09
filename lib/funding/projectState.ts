/**
 * 프로젝트 상태 판정 — fs를 import하지 않는 순수 모듈.
 *
 * projects.ts는 node:fs를 import하므로 클라이언트 번들에서 쓸 수 없다. 배지처럼 마운트 후
 * 브라우저 시계로 다시 계산해야 하는 곳이 있어(빌드 시각 고정 방지) 여기로 분리했다.
 */
export type ProjectState = 'draft' | 'upcoming' | 'live' | 'closed';

export const computeProjectState = (
  project: { status: 'auto' | 'draft' | 'closed'; startAt: string; endAt: string },
  now: Date,
): ProjectState => {
  if (project.status === 'draft') return 'draft';
  if (project.status === 'closed') return 'closed';
  const t = now.getTime();
  if (t < new Date(project.startAt).getTime()) return 'upcoming';
  if (t < new Date(project.endAt).getTime()) return 'live';
  return 'closed';
};
