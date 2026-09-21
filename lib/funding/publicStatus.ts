import { computeProjectState, type ProjectState } from './projectState';
import { aggregateProjectStatus } from './service';
import type { FundingProject } from './shape';

/**
 * 공개 화면이 보는 모금 현황. `/api/funding/[slug]/status`의 응답이자, 목록·상세가 정적
 * 생성 시점에 실어 보내는 초기값이다.
 *
 * 클라이언트도 이 모양을 쓰므로 타입은 여기가 아니라 순수 모듈에 두어야 하지만, 이 파일은
 * `service`(DB)를 물고 있다. 그래서 값은 여기서 만들고 타입은 `components/funding/
 * useFundingStatus.ts`가 구조적으로 같게 선언한다 — 어긋나면 아래 테스트가 잡는다.
 */
export interface FundingPublicStatus {
  state: ProjectState;
  goalAmount: number;
  endAt: string;
  raisedAmount: number;
  backerCount: number;
  percent: number;
  remaining: Record<string, number | null>;
  publicBackers: string[];
  publicMessages: Array<{ name: string; message: string; at: number }>;
}

/**
 * 조립을 한 곳에 모은다.
 *
 * 예전에는 상태 API 핸들러 안에만 있었다. 정적 생성 쪽에서 같은 응답을 만들려면 percent
 * 계산까지 그대로 베껴야 하는데, 그러면 한쪽만 고쳤을 때 화면과 API가 조용히 갈린다.
 */
export const buildPublicStatus = async (
  project: FundingProject,
  now: Date,
): Promise<FundingPublicStatus> => {
  const s = await aggregateProjectStatus(project, now);
  return {
    state: computeProjectState(project, now),
    goalAmount: project.goalAmount,
    endAt: project.endAt,
    raisedAmount: s.raisedAmount,
    backerCount: s.backerCount,
    // 내림이다. 99.9%를 100%로 올리면 아직 목표에 못 미친 프로젝트가 달성한 것처럼 보인다.
    percent: Math.floor((s.raisedAmount / project.goalAmount) * 100),
    remaining: s.remaining,
    publicBackers: s.publicBackers,
    publicMessages: s.publicMessages,
  };
};

/**
 * 정적 생성에서 부르는 판. 두 가지가 다르다.
 *
 * 1. **실패하면 null.** 빌드는 DB 없이도 성공해야 한다(CLAUDE.md) — 그때 화면은 예전처럼
 *    폴링이 채운다. 빌드에 DB가 없는 CI에서는 늘 이 경로다.
 * 2. **후원자 이름과 응원 메시지를 비운다.** 이 둘은 지금까지 폴링 응답으로만 왔다 — JS를
 *    실행하지 않는 크롤러에게는 보이지 않았다는 뜻이다. 정적 HTML에 실으면 검색엔진이
 *    후원자 명단을 색인한다. 이 저장소가 여는 펀딩은 파병 반대·팔레스타인 연대처럼 정치적
 *    사안이라, 누가 후원했는지가 검색에 남는 것은 모금액이 보이는 것과 무게가 다르다.
 *    공개 철회도 같은 문제다 — 후원자가 관리 페이지에서 공개를 끄면 폴링은 즉시 반영하지만
 *    정적 HTML은 ISR이 다시 만들 때까지 옛 이름을 들고 있다.
 *
 *    모금액·건수·달성률만 실어도 "얼마 모였나"는 첫 화면에서 보인다. 이름과 메시지는
 *    마운트 직후의 첫 폴링이 채운다.
 */
export const buildPublicStatusOrNull = async (
  project: FundingProject,
  now: Date,
): Promise<FundingPublicStatus | null> => {
  try {
    const s = await buildPublicStatus(project, now);
    return { ...s, publicBackers: [], publicMessages: [] };
  } catch {
    return null;
  }
};
