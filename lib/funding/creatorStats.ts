import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingProjects } from '../../db/schema';
import { buildPublicStatus } from './publicStatus';
import { getFundingProjectAsync } from './repository';
import { aggregateRewardSales } from './service';

/** 리워드 한 줄의 판매 수량. 후원자 쪽 정보는 여기에 들어올 자리가 없다. */
export interface CreatorRewardSales {
  rewardId: string;
  title: string;
  /** 확정 판매 수량(결제 완료·부분환불). */
  quantity: number;
  /** 한정 수량. 무제한이면 null. */
  totalQuantity: number | null;
}

/**
 * 개설자가 보는 모금 현황 — **집계뿐이다.**
 *
 * 후원자 이름·응원 메시지·연락처·배송지는 이 타입에 **없고, 더해서도 안 된다.** 개설자
 * 약관 제8조(`pages/[locale]/funding/creator-terms.tsx`)가 "서포터의 개인정보는 스튜디오가
 * 보유하며, 개설자에게 제공하지 않습니다"라고 적고 있다. 약관이 하지 않겠다고 적은 일을
 * 코드가 하면 그 문장이 거짓말이 된다. 배송지 열람은 약관 개정과 함께 별도로 다룬다.
 *
 * `loadCreatorProjectStats`는 `buildPublicStatus`(공개 상세가 쓰는 바로 그 함수)를 지나면서도
 * `publicBackers`·`publicMessages`를 **스프레드하지 않고** 필요한 필드만 골라 담는다 —
 * 스프레드 한 번이면 이름과 메시지가 그대로 `__NEXT_DATA__`에 실린다.
 */
export interface CreatorProjectStats {
  raisedAmount: number;
  goalAmount: number;
  /** 목표 대비 달성률(%). 공개 상세와 같은 값 — `buildPublicStatus`가 내림으로 계산한다. */
  percent: number;
  /** 확정 후원 **건수**. 사람 수가 아니다(공개 상세의 'N건 후원'과 같은 수). */
  backerCount: number;
  rewards: CreatorRewardSales[];
}

/**
 * 본인 프로젝트 하나의 모금 현황.
 *
 * **집계 기준은 공개 상세와 같다 — 같은 함수를 지나기 때문이다.** `buildPublicStatus`는
 * `/api/funding/[slug]/status`와 상세 페이지가 쓰는 그 함수이고, 그 안의
 * `aggregateProjectStatus`가 정산 미리보기(`lib/funding/payout.ts`)와 같은
 * `orders ⋈ funding_pledges` 조인·같은 `liveFundingOrderStatusList()`·같은
 * `SUM(o.total_amount)`를 쓴다. 셋이 갈리면 개설자가 보는 금액과 공개 페이지 금액이
 * 달라진다. 정산만 환불을 추가로 차감하는데(실제로 나갈 돈을 정하는 자리라 감수할 수 없다),
 * 그 차이는 `buildFundingPayoutPreview`의 주석이 설명한다 — 여기서는 공개 페이지와 같은
 * 수를 보여주는 것이 맞다.
 *
 * **남의 프로젝트는 볼 수 없다.** 첫 질의가 `id = ? AND creator_id = ?`라 소유가 아니면
 * 그 자리에서 null이다(`listProjectsForCreator`와 같은 원칙 — 소유 조건 없이 부를 수 있는
 * 모양의 함수를 두지 않는다).
 *
 * **승인 전에는 null이다.** 승인 전 프로젝트는 공개된 적이 없어 후원이 존재할 수 없다.
 * 0원·0건을 보여주면 "모금이 열렸는데 아무도 후원하지 않았다"로 읽혀, 아직 심사 중인
 * 개설자에게 없는 실패를 알리게 된다. 화면은 이 null을 받아 구획 자체를 감춘다.
 */
export const loadCreatorProjectStats = async (
  creatorId: string,
  projectId: string,
  now: Date = new Date(),
): Promise<CreatorProjectStats | null> => {
  const [row] = await getDb()
    .select({ slug: fundingProjects.slug, reviewStatus: fundingProjects.reviewStatus })
    .from(fundingProjects)
    .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.creatorId, creatorId)))
    .limit(1);
  if (!row || row.reviewStatus !== 'approved') return null;

  // 읽는 입구는 repository 하나다(CLAUDE.md) — 같은 slug가 파일에도 있으면 파일이 이기고,
  // 공개 상세가 보는 것과 같은 프로젝트를 본다.
  const project = await getFundingProjectAsync(row.slug);
  if (!project) return null;

  const status = await buildPublicStatus(project, now);
  const sold = await aggregateRewardSales(row.slug);

  return {
    raisedAmount: status.raisedAmount,
    goalAmount: status.goalAmount,
    percent: status.percent,
    backerCount: status.backerCount,
    rewards: project.rewards.map((r) => ({
      rewardId: r.id,
      title: r.title,
      quantity: sold[r.id] ?? 0,
      totalQuantity: r.totalQuantity,
    })),
  };
};
