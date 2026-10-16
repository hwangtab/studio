import type { PartnerPayout } from '../../db/schema';
import { serializeAdjustment, type AdjustmentView } from './shopView';
import type { RecordedShowDelta, ShowCancelFeeInfo, ShowPayoutBlocker, ShowPayoutPreview, ShowPayoutTaxType, ShowPayoutWarning } from './show';

/**
 * 관리자 `/admin/shows/[id]` 정산 절이 받는 직렬화 판 — **순수**(db를 import하지 않는다. 클라이언트 컴포넌트가 타입만 가져간다).
 * 계좌·주민등록번호는 존재 여부(blockers/warnings)로만 나가고 값은 어디에도 없다 — 계좌는 운영자가 버튼을 누를 때 개설자 단위 열람 라우트에서 받는다.
 */

export interface ShowPayoutRecordView {
  id: string;
  taxType: ShowPayoutTaxType;
  status: 'pending' | 'paid';
  grossAmount: number;
  refundAmount: number;
  platformFeeAmount: number;
  paymentFeeAmount: number;
  vatDeductionAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  adjustmentAmount: number;
  shortfallAmount: number;
  netAmount: number;
  itemCount: number;
  paidAt: string | null;
  memo: string | null;
  createdAt: string;
}

export interface ShowPayoutView {
  settleable: boolean;
  notSettleableReason: 'studio_direct' | null;
  creatorId: string | null;
  payeeName: string;
  taxType: ShowPayoutTaxType | null;
  ended: boolean;
  /** epoch 초 — 화면이 KST 날짜로 바꿔 보인다. */
  lastEndAt: number | null;
  dueBy: number | null;
  itemCount: number;
  grossAmount: number;
  refundAmount: number;
  netSalesAmount: number;
  platformFeeAmount: number;
  paymentFeeAmount: number;
  vatDeductionAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  adjustments: AdjustmentView[];
  adjustmentAmount: number;
  adjustmentOffsetAmount: number;
  shortfallAmount: number;
  netAmount: number;
  cancelFees: ShowCancelFeeInfo[];
  refundAccountPendingCount: number;
  refundDueCancelledOrderCount: number;
  blockers: ShowPayoutBlocker[];
  warnings: ShowPayoutWarning[];
  recorded: ShowPayoutRecordView | null;
  appliedAdjustments: AdjustmentView[];
  /** 기록 뒤 판매·환불이 바뀌었는가(기록의 판매액·환불액 ≠ 지금 집계). 기록이 없으면 false. */
  drift: boolean;
  /** 기록이 있을 때: 지금 계산한 실지급액과 초과·부족 지급(지급 뒤 환불 → 회수). 기록이 없으면 null. */
  recordedDelta: RecordedShowDelta | null;
}

export const serializeShowPayoutRecord = (p: PartnerPayout): ShowPayoutRecordView => ({
  id: p.id,
  taxType: p.taxType,
  status: p.status,
  grossAmount: p.grossAmount,
  refundAmount: p.refundAmount,
  platformFeeAmount: p.platformFeeAmount,
  paymentFeeAmount: p.paymentFeeAmount,
  vatDeductionAmount: p.vatDeductionAmount,
  shareAmount: p.shareAmount,
  withholdingAmount: p.withholdingAmount,
  adjustmentAmount: p.adjustmentAmount,
  shortfallAmount: p.shortfallAmount,
  netAmount: p.netAmount,
  itemCount: p.itemCount,
  paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  memo: p.memo,
  createdAt: p.createdAt.toISOString(),
});

export const serializeShowPayoutPreview = (p: ShowPayoutPreview): ShowPayoutView => ({
  settleable: p.settleable,
  notSettleableReason: p.notSettleableReason,
  creatorId: p.creatorId,
  payeeName: p.payeeName,
  taxType: p.taxType,
  ended: p.ended,
  lastEndAt: p.lastEndAt,
  dueBy: p.dueBy,
  itemCount: p.itemCount,
  grossAmount: p.grossAmount,
  refundAmount: p.refundAmount,
  netSalesAmount: p.netSalesAmount,
  platformFeeAmount: p.platformFeeAmount,
  paymentFeeAmount: p.paymentFeeAmount,
  vatDeductionAmount: p.vatDeductionAmount,
  shareAmount: p.shareAmount,
  withholdingAmount: p.withholdingAmount,
  adjustments: p.adjustments.map(serializeAdjustment),
  adjustmentAmount: p.adjustmentAmount,
  adjustmentOffsetAmount: p.adjustmentOffsetAmount,
  shortfallAmount: p.shortfallAmount,
  netAmount: p.netAmount,
  cancelFees: p.cancelFees,
  refundAccountPendingCount: p.refundAccountPendingCount,
  refundDueCancelledOrderCount: p.refundDueCancelledOrderCount,
  blockers: p.blockers,
  warnings: p.warnings,
  recorded: p.recorded ? serializeShowPayoutRecord(p.recorded) : null,
  appliedAdjustments: p.appliedAdjustments.map(serializeAdjustment),
  drift: p.recorded ? p.recorded.grossAmount !== p.grossAmount || p.recorded.refundAmount !== p.refundAmount : false,
  recordedDelta: p.recordedDelta,
});

/** 페이지가 정산 절에 넘기는 상태 — 표(0067)가 없으면 나머지 화면은 그대로 열리고 이 절만 안내를 보인다. */
export type ShowPayoutPanelState =
  | { state: 'ok'; view: ShowPayoutView }
  | { state: 'migration' }
  | { state: 'error' };
