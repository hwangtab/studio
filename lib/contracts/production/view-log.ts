import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { productionContractSigners } from '../../../db/schema';

/**
 * 서명 링크가 열린 사실을 서명자 행에 남긴다. 규칙은 연습실 view-log.ts와 같다 — 최초 열람은 덮어쓰지 않고
 * (COALESCE), 토큰까지 조건에 넣어 id만 아는 사람이 남의 열람 기록을 만들지 못하게 하고, 실패해도 던지지 않는다.
 */
/**
 * 링크 미리보기 수집기 — 카카오톡에 링크를 붙여 넣는 순간 카카오 서버가 페이지를 가져가 "최초 열람"을 차지한다(링크 계약은
 * 카톡으로 건넨다, open-link.ts). 열람 기록은 서명자가 언제 처음 열었는가의 증거라 수집기는 세지 않는다.
 */
const PREVIEW_BOT = /kakaotalk-scrap|facebookexternalhit|slackbot|twitterbot|discordbot|telegrambot|whatsapp|bot\b|crawler|spider|preview/i;

export const isLinkPreviewBot = (userAgent: string | null | undefined): boolean => Boolean(userAgent && PREVIEW_BOT.test(userAgent));

export const recordProductionSignerView = async (
  signerId: string,
  signToken: string,
  ip: string | null,
  now: Date = new Date(),
  userAgent: string | null = null,
): Promise<void> => {
  if (isLinkPreviewBot(userAgent)) return;
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
