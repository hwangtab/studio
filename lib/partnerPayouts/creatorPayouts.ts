import { and, eq, gt, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { partnerPayouts } from '../../db/schema';
import { isMissingTableError } from '../dbErrors';

/**
 * 개설자 단위로 본 상점·공연 정산 기록(`partner_payouts`) — 주민등록번호·사업자 정보의 **보존·파기 판정**이 펀딩 정산 기록과 함께 쓴다.
 * 처리방침 14·15항이 "원천징수한 정산(펀딩·상점·공연)이 있으면 보관", "마지막 사업자 정산(펀딩·상점·공연)의 지급일부터 5년"이라고 약속했고,
 * 그 약속을 `hasWithheldPayout`(creatorProjectWrite.ts)·`hasInvoicePayout`(businessProfile.ts)·`retention.ts`가 이 파일을 통해 지킨다.
 *
 * **경계는 펀딩과 똑같다**(세 곳을 함께 바꿀 것): 원천징수 기록 = `withholding_amount > 0`, 사업자 기록 = `withholding_amount = 0`.
 * 이 표에는 `tax_type` 스냅샷이 있지만 일부러 쓰지 않는다 — 두 정산 기록이 같은 규칙으로 읽혀야 한 화면이 "지워진다"고 하고 크론이 안 지우는
 * 식의 어긋남이 없다(원천징수인데 세액 0원인 정산은 사업자 쪽으로 센다 = 남기는 쪽).
 *
 * **표가 없으면(마이그레이션 전) 기록도 없으니 거짓**이다. 그 밖의 읽기 실패는 **참**(= 남긴다) — 지우는 쪽은 되돌릴 수 없고 모르면 남겨야 한다.
 */

export const PARTNER_PAYOUTS_TABLE = 'partner_payouts';

/** 표가 있는가. 없으면 false, 그 밖의 오류는 던진다(파기 판정은 모르는 채 진행하지 않는다). */
export const partnerPayoutsTableExists = async (): Promise<boolean> => {
  try {
    await getDb().run(sql`SELECT 1 FROM partner_payouts LIMIT 1`);
    return true;
  } catch (error: unknown) {
    if (isMissingTableError(error, PARTNER_PAYOUTS_TABLE)) return false;
    throw error;
  }
};

const anyRow = async (creatorId: string, label: string, mode: 'withheld' | 'invoice'): Promise<boolean> => {
  try {
    const [row] = await getDb()
      .select({ id: partnerPayouts.id })
      .from(partnerPayouts)
      .where(and(
        eq(partnerPayouts.creatorId, creatorId),
        mode === 'withheld' ? gt(partnerPayouts.withholdingAmount, 0) : eq(partnerPayouts.withholdingAmount, 0),
      ))
      .limit(1);
    return Boolean(row);
  } catch (error: unknown) {
    if (isMissingTableError(error, PARTNER_PAYOUTS_TABLE)) return false;
    console.error(`[partner-payouts] ${label} 조회 실패 — 지우지 않고 남기는 쪽으로 본다`, error);
    return true;
  }
};

/** 이 개설자에게 원천징수해 기록한 상점·공연 정산이 있는가 — `hasWithheldPayout`의 상점·공연 갈래. */
export const hasPartnerWithheldPayout = (creatorId: string): Promise<boolean> => anyRow(creatorId, '원천징수 정산', 'withheld');

/** 이 개설자에게 사업자로 정산한 상점·공연 기록이 있는가 — `hasInvoicePayout`의 상점·공연 갈래. */
export const hasPartnerInvoicePayout = (creatorId: string): Promise<boolean> => anyRow(creatorId, '사업자 정산', 'invoice');
