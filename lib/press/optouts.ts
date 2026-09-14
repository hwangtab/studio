/**
 * press_optouts 읽기·쓰기.
 *
 * 라우트가 Drizzle을 직접 부르지 않게 한 겹 둔다 — 쓰기 쪽의 "충돌이면 그대로 둔다"와
 * 읽기 쪽의 "since 이후"가 이 기능의 규칙이고, 라우트 두 개에 흩어지면 한쪽만 고쳐진다.
 */
import { asc, gt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { pressOptouts } from '../../db/schema';

export type PressOptoutRow = {
  emailHash: string;
  campaignSlug: string;
  createdAt: number;
};

/**
 * 같은 해시가 다시 와도 성공으로 끝낸다.
 *
 * 두 번 눌렀다고 실패를 돌려주면 수신자는 거부가 안 된 줄 안다. 그리고 덮어쓰지도
 * 않는다 — campaign_slug·created_at은 처음 거부한 시점이라 기록으로서 의미가 있다.
 */
export const recordPressOptout = async (input: {
  emailHash: string;
  campaignSlug: string;
  source: 'one-click' | 'page';
}): Promise<void> => {
  await getDb()
    .insert(pressOptouts)
    .values({
      emailHash: input.emailHash,
      campaignSlug: input.campaignSlug,
      source: input.source,
    })
    .onConflictDoNothing({ target: pressOptouts.emailHash });
};

/**
 * since **초과**(이상이 아니라)로 읽는다.
 *
 * 호출부는 직전 응답의 now를 다음 since로 쓴다. 이상으로 읽으면 경계에 걸친 행을
 * 매번 다시 받아 오고, 그 자체로는 무해하지만 "새로 들어온 건수"가 늘 부풀어 보인다.
 */
/**
 * 한 번에 돌려주는 최대 행 수.
 *
 * 호출부가 이 값과 rows.length를 비교해 "더 남았는가"를 판정하므로 상수로 내보낸다.
 * 숫자를 라우트에 따로 적어 두면 한쪽만 바뀌는 날 초과분이 조용히 사라진다.
 */
export const PRESS_OPTOUT_PAGE_SIZE = 1000;

export const listPressOptouts = async (
  sinceEpoch: number,
  limit = PRESS_OPTOUT_PAGE_SIZE,
): Promise<PressOptoutRow[]> => {
  const rows = await getDb()
    .select({
      emailHash: pressOptouts.emailHash,
      campaignSlug: pressOptouts.campaignSlug,
      createdAt: pressOptouts.createdAt,
    })
    .from(pressOptouts)
    .where(gt(pressOptouts.createdAt, new Date(sinceEpoch * 1000)))
    .orderBy(asc(pressOptouts.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    emailHash: row.emailHash,
    campaignSlug: row.campaignSlug,
    createdAt: Math.floor((row.createdAt?.getTime() ?? 0) / 1000),
  }));
};
