/**
 * 테스트 전용 — 리워드 하나짜리 후원을 만든다.
 *
 * 한 주문에 여러 리워드를 담게 되면서(2026-09-28) `createFundingPledge`는 `items`와 검증된
 * 줄 목록을 받는다. 그 전에 쓰인 수백 개 테스트는 "payload의 rewardId·quantity + 리워드 하나"
 * 모양으로 후원을 만든다. 그 모양을 새 인터페이스로 옮기는 일을 여기 한 곳에 둔다 —
 * 테스트마다 옮기면 옮기는 코드가 테스트 수만큼 생긴다.
 *
 * 세 번째 인자로 받은 리워드가 이긴다(옛 동작과 같다 — payload의 rewardId는 기본값일 뿐이었다).
 */
import { createFundingPledge } from '../lib/funding/service';
import type { FundingProject, FundingReward } from '../lib/funding/projects';
import type { CreatePledgePayload } from '../lib/funding/validation';

export type LegacyPledgePayload = Omit<CreatePledgePayload, 'items'> & { rewardId: string; quantity: number };

export const createSingleRewardPledge = (
  payload: LegacyPledgePayload,
  project: FundingProject,
  reward: FundingReward,
  now: Date,
  options?: Parameters<typeof createFundingPledge>[4],
) => {
  const { rewardId: _ignored, quantity, ...rest } = payload;
  return createFundingPledge({ ...rest, items: [{ rewardId: reward.id, quantity }] }, project, [{ reward, quantity }], now, options);
};
