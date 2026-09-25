/**
 * 프로젝트 상태 판정 — fs를 import하지 않는 순수 모듈.
 *
 * projects.ts는 node:fs를 import하므로 클라이언트 번들에서 쓸 수 없다. 배지처럼 마운트 후
 * 브라우저 시계로 다시 계산해야 하는 곳이 있어(빌드 시각 고정 방지) 여기로 분리했다.
 *
 * FundingStatus는 shape.ts(FUNDING_STATUSES 배열이 정본)에서 **타입으로만** 끌어온다.
 * `import type`은 컴파일에서 완전히 지워지므로 런타임 import가 생기지 않는다 — 값으로
 * 가져오면 shape.ts ↔ projectState.ts 순환 import가 생길 수 있다. 예전엔 여기서
 * `'auto' | 'draft' | 'closed'`를 손으로 다시 적어 두 정의가 조용히 갈릴 수 있었다.
 */
import type { FundingStatus } from './shape';

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

/**
 * **날짜상** 모금이 끝났는가. `computeProjectState`와 달리 운영자가 누른
 * `status: 'closed'`·`'draft'`를 보지 않는다.
 *
 * 셀프 취소 판정이 이것을 쓴다(lib/funding/policy.ts). 두 종류의 "마감"을 한 값으로
 * 합치면, 운영자가 문제를 발견해 프로젝트를 종료한 순간 기존 후원자의 셀프 취소가 함께
 * 끊긴다 — 종료 버튼을 누르는 상황(가격 표기 오류 등)이 바로 환불이 필요한 상황이라
 * 환불이 전부 수작업으로 넘어간다. 운영자 종료로 **새 후원**은 막히되, 이미 후원한
 * 사람은 원래 마감일까지 스스로 취소할 수 있어야 한다.
 */
export const isPastFundingEnd = (project: { endAt: string }, now: Date): boolean =>
  now.getTime() >= new Date(project.endAt).getTime();
