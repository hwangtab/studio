import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import {
  partnerPayoutAdjustments,
  type PartnerPayoutAdjustment,
  type partnerPayoutAdjustmentReasonEnum,
  type partnerPayoutKindEnum,
} from '../../db/schema';

export type PartnerPayoutKind = (typeof partnerPayoutKindEnum)[number];
export type PartnerPayoutAdjustmentReason = (typeof partnerPayoutAdjustmentReasonEnum)[number];

/**
 * 조정 한 건을 쌓는다 — (kind, payee_key, reason, source_ref)가 UNIQUE라 같은 사건은 한 번만 들어간다(멱등).
 * 이미 있으면 `'exists'`. 금액 0은 쌓지 않는다. 표가 없으면 던진다(호출부가 `isMissingTableError`로 가른다).
 */
export const insertAdjustmentIfAbsent = async (input: {
  kind: PartnerPayoutKind;
  payeeKey: string;
  amount: number;
  reason: PartnerPayoutAdjustmentReason;
  /** 주문번호·회차 id 같은 사건 식별자. 같은 사건의 중복을 막는 키라 `late_refund`·`showtime_cancel_fee`는 반드시 넣는다. */
  sourceRef: string | null;
  memo?: string | null;
  /** 이 조정이 바로잡는 정산 id(그 정산의 스냅샷에 들어 있던 사건일 때). */
  originPayoutId?: string | null;
}): Promise<'inserted' | 'exists' | 'zero'> => {
  const amount = Math.trunc(input.amount);
  if (amount === 0) return 'zero';
  const inserted = await getDb()
    .insert(partnerPayoutAdjustments)
    .values({
      kind: input.kind,
      payeeKey: input.payeeKey,
      amount,
      reason: input.reason,
      sourceRef: input.sourceRef,
      memo: input.memo ?? null,
      originPayoutId: input.originPayoutId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: partnerPayoutAdjustments.id });
  return inserted.length > 0 ? 'inserted' : 'exists';
};

/** 아직 어느 정산에도 안 실린 조정 — 다음 기록이 싣는다. 오래된 것부터. */
export const listUnappliedAdjustments = async (kind: PartnerPayoutKind, payeeKey: string): Promise<PartnerPayoutAdjustment[]> =>
  getDb()
    .select()
    .from(partnerPayoutAdjustments)
    .where(and(eq(partnerPayoutAdjustments.kind, kind), eq(partnerPayoutAdjustments.payeeKey, payeeKey), isNull(partnerPayoutAdjustments.appliedPayoutId)))
    .orderBy(asc(partnerPayoutAdjustments.createdAt), asc(partnerPayoutAdjustments.id));

/** 한 종류 전체의 미적용 조정(수취인 무관) — 관리자 화면의 "다음 정산에 실릴 조정" 목록. */
export const listAllUnappliedAdjustments = async (kind: PartnerPayoutKind): Promise<PartnerPayoutAdjustment[]> =>
  getDb()
    .select()
    .from(partnerPayoutAdjustments)
    .where(and(eq(partnerPayoutAdjustments.kind, kind), isNull(partnerPayoutAdjustments.appliedPayoutId)))
    .orderBy(asc(partnerPayoutAdjustments.payeeKey), asc(partnerPayoutAdjustments.createdAt));

/** 어느 정산에 실린 조정 — 기록 행 아래에 "이 정산에 반영된 조정"으로 보인다. */
export const listAppliedAdjustments = async (payoutId: string): Promise<PartnerPayoutAdjustment[]> =>
  getDb()
    .select()
    .from(partnerPayoutAdjustments)
    .where(eq(partnerPayoutAdjustments.appliedPayoutId, payoutId))
    .orderBy(asc(partnerPayoutAdjustments.createdAt), asc(partnerPayoutAdjustments.id));

/**
 * 운영자가 손으로 적는 조정(`manual`) — 시스템이 모르는 정산 밖의 차감·가산(예: 이미 받아 간 선지급, 잘못 자동 생성된 환불 조정의 상쇄).
 * 금액은 아티스트 몫(VAT 포함) 기준 부호 있는 정수다. 사유(memo)는 필수 — 나중에 왜 있는지 읽을 길이 이것뿐이다.
 */
export const addManualAdjustment = async (input: { kind: PartnerPayoutKind; payeeKey: string; amount: number; memo: string }): Promise<'ok' | 'invalid'> => {
  const memo = input.memo.trim().slice(0, 300);
  if (!Number.isSafeInteger(input.amount) || input.amount === 0 || !memo) return 'invalid';
  await getDb().insert(partnerPayoutAdjustments).values({
    kind: input.kind, payeeKey: input.payeeKey, amount: input.amount, reason: 'manual', sourceRef: null, memo,
  });
  return 'ok';
};

/**
 * 아직 안 실린 `manual` 조정만 지운다. **시스템이 만든 조정(환불·회차 취소·이월)은 지우지 않는다** — 지워도 다음 기록 때 같은 사건에서
 * 다시 만들어지고, 지운 이력도 남지 않는다. 잘못 생긴 것은 반대 부호의 수기 조정으로 상쇄한다.
 */
export const deleteUnappliedManualAdjustment = async (id: string): Promise<boolean> => {
  const deleted = await getDb().run(sql`
    DELETE FROM partner_payout_adjustments WHERE id = ${id} AND reason = 'manual' AND applied_payout_id IS NULL
      AND (source_ref IS NULL OR source_ref NOT LIKE 'carryover:%')
  `);
  return (deleted.rowsAffected ?? 0) > 0;
};
