import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { contracts } from '../../db/schema';

/**
 * 서명 링크가 열린 사실을 남긴다.
 *
 * 발송(sentAt)과 서명(signedAt) 사이가 비어 있으면 감사추적의 사슬이 한 칸 끊긴다.
 * 해외 판례가 전자서명 부인을 기각한 근거가 정확히 이 구간이었다 — Obi v. Exeter Health
 * (D.N.H. 2019)는 열람·서명 기록을, Moton v. Maplebear(S.D.N.Y.)는 "수령·열람·실행"을 잇는
 * 타임스탬프 추적을 들었다.
 *
 * 최초 열람은 덮어쓰지 않는다(COALESCE). 처음 열린 시각이 증거이고, 나중 접속으로 그것이
 * 밀려나면 "받자마자 열었다"는 사실이 사라진다. 마지막 열람과 횟수는 매번 갱신한다.
 *
 * 서명 대기 상태에서만 부른다. 서명이 끝난 계약은 완료 페이지로 넘어가므로 이 경로를 타지
 * 않고, 만료·취소된 계약의 접속까지 세면 "몇 번 열어 봤는가"의 의미가 흐려진다.
 *
 * 실패해도 던지지 않는다. 열람 기록을 남기지 못하는 것과 계약서를 못 보여주는 것은
 * 무게가 다르다 — 뒤쪽이 훨씬 무겁다.
 */
export const recordContractView = async (
  contractId: string,
  signToken: string,
  ip: string | null,
  now: Date = new Date(),
): Promise<void> => {
  // DB의 타임스탬프는 초 단위다. COALESCE로 직접 넣을 때는 그 단위에 맞춰야 한다.
  const seconds = Math.floor(now.getTime() / 1000);

  try {
    await getDb()
      .update(contracts)
      .set({
        firstViewedAt: sql`COALESCE(${contracts.firstViewedAt}, ${seconds})`,
        lastViewedAt: now,
        viewCount: sql`${contracts.viewCount} + 1`,
        firstViewedIp: sql`COALESCE(${contracts.firstViewedIp}, ${ip})`,
      })
      /**
       * 토큰까지 조건에 넣는다. id만으로 갱신하면 계약 id를 아는 사람이 남의 계약에
       * 열람 기록을 만들 수 있다 — 증거로 쓸 값이므로 아무나 못 쓰게 막는다.
       */
      .where(and(eq(contracts.id, contractId), eq(contracts.signToken, signToken)));
  } catch (error: unknown) {
    console.error(`[contracts/view-log] Failed to record view for ${contractId}:`, error);
  }
};
