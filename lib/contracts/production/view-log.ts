import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { productionContractSigners } from '../../../db/schema';

/**
 * 서명 링크가 열린 사실을 서명자 행에 남긴다. 규칙은 연습실 view-log.ts와 같다 — 최초 열람은 덮어쓰지 않고
 * (COALESCE), 토큰까지 조건에 넣어 id만 아는 사람이 남의 열람 기록을 만들지 못하게 하고, 실패해도 던지지 않는다.
 */
export const recordProductionSignerView = async (
  signerId: string,
  signToken: string,
  ip: string | null,
  now: Date = new Date(),
): Promise<void> => {
  const seconds = Math.floor(now.getTime() / 1000);
  try {
    await getDb()
      .update(productionContractSigners)
      .set({
        firstViewedAt: sql`COALESCE(${productionContractSigners.firstViewedAt}, ${seconds})`,
        lastViewedAt: now,
        viewCount: sql`${productionContractSigners.viewCount} + 1`,
        firstViewedIp: sql`COALESCE(${productionContractSigners.firstViewedIp}, ${ip})`,
      })
      .where(and(eq(productionContractSigners.id, signerId), eq(productionContractSigners.signToken, signToken)));
  } catch (error: unknown) {
    console.error(`[contracts/production/view-log] Failed to record view for signer ${signerId}:`, error);
  }
};
