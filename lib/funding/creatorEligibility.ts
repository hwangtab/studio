import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingProjects, partnerPayouts, shopArtists, showSubmissions } from '../../db/schema';
import { isMissingTableError } from '../dbErrors';

/** 공연·상점 갈래의 읽기 — 실패는 그 갈래만 "없음"으로 본다(표가 각자 마이그레이션에 달려 있다). */
const softExists = async (label: string, query: () => Promise<unknown[]>): Promise<boolean> => {
  try {
    return (await query()).length > 0;
  } catch (error: unknown) {
    console.error(`[funding] 정산 자격 조회 실패(${label} 갈래는 없음으로 본다)`, error);
    return false;
  }
};

/**
 * 정산 정보를 받아도 되는 계정인가 — 승인된 펀딩 프로젝트, 승인된 공연 등록, 상점 아티스트 등록 중 하나라도.
 * 반려될 신청서에 계좌·주민번호를 미리 받지 않는다는 원칙(스펙 §6.2)을 세 갈래로 넓힌 것이다.
 * 상점 아티스트는 관리자가 계약·실물 인수 뒤에 `shop_artists` 행을 만드는 것 자체가 승인이다(lib/shop/CLAUDE.md).
 *
 * 공연·상점 표는 각자 마이그레이션(0055·0053)에 달려 있어, 읽기 실패는 그 갈래만 false로 본다 — 펀딩 갈래는 던진다
 * (예전 `hasApprovedProject`와 같은 동작).
 */
export const hasApprovedEngagement = async (creatorId: string): Promise<boolean> => {
  const db = getDb();
  const [project] = await db.select({ id: fundingProjects.id }).from(fundingProjects)
    .where(and(eq(fundingProjects.creatorId, creatorId), eq(fundingProjects.reviewStatus, 'approved'))).limit(1);
  if (project) return true;
  if (await softExists('공연', () => db.select({ id: showSubmissions.id }).from(showSubmissions)
    .where(and(eq(showSubmissions.creatorId, creatorId), eq(showSubmissions.reviewStatus, 'approved'))).limit(1))) {
    return true;
  }
  if (await softExists('상점', () => db.select({ id: shopArtists.creatorId }).from(shopArtists)
    .where(eq(shopArtists.creatorId, creatorId)).limit(1))) {
    return true;
  }
  // 상점·공연 정산 기록(`partner_payouts`)이 있는 개설자도 승인된 일이 있었던 계정이다 — 등록이 나중에 내려가도 이미 기록한 정산의
  // 계좌를 열어 이체할 수 있어야 한다(관리자 계좌 열람 라우트가 이 판정을 선으로 쓴다). 표가 없으면(0066 전) 이 갈래만 없음으로 본다.
  return softExists('상점·공연 정산 기록', () => db.select({ id: partnerPayouts.id }).from(partnerPayouts)
    .where(eq(partnerPayouts.creatorId, creatorId)).limit(1));
};

/**
 * 상점 아티스트로 등록돼 있는가 — 주민등록번호를 지워도 되는지의 판정에 쓴다(`savePayoutSection`).
 *
 * 상점 정산 기록(`partner_payouts`)은 이제 있지만, **기록을 시작하기 전에 이뤄진 상점 판매대금**은 원천징수를 이미 했는지 기록으로 가릴 수 없다
 * (처리방침 15항이 이 이유를 그대로 적었다). 그래서 상점 아티스트면 사업자로 바꿔도 번호를 남긴다 — 원천징수한 정산 기록이 있을 때
 * (`hasWithheldPayout`, 펀딩·상점·공연 기록 모두)와 같은 취급이다. 기록이 쌓인 뒤에도 이 판정을 좁히지 말 것 — 등록이 있는 한 남기는 것이 약속이다.
 * 지우는 쪽은 되돌릴 수 없으므로 판정이 흔들리면 남기는 쪽으로 기운다: 표가 없으면(0053 전) 등록도 없으니
 * 거짓, 그 밖의 읽기 실패는 참.
 */
export const isShopArtist = async (creatorId: string): Promise<boolean> => {
  try {
    const [row] = await getDb().select({ id: shopArtists.creatorId }).from(shopArtists)
      .where(eq(shopArtists.creatorId, creatorId)).limit(1);
    return Boolean(row);
  } catch (error: unknown) {
    if (isMissingTableError(error, 'shop_artists')) return false;
    console.error('[funding] 상점 아티스트 조회 실패 — 주민등록번호를 지우지 않고 남긴다', error);
    return true;
  }
};
