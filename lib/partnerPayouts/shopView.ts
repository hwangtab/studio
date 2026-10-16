import type { PartnerPayout, PartnerPayoutAdjustment } from '../../db/schema';
import type { ShopPayoutBlocker, ShopPayoutPreview, ShopPayoutTaxType, ShopPayoutWarning } from './shop';

/**
 * 관리자 `/admin/shop` 정산 표가 받는 직렬화 판 — **순수**(db를 import하지 않는다. 클라이언트 컴포넌트가 타입만 가져간다).
 * Date는 ISO 문자열로, 그리고 화면이 쓰지 않는 것은 싣지 않는다. 계좌·주민등록번호는 존재 여부(blockers/warnings)로만 나가고 값은 어디에도 없다 —
 * 계좌는 운영자가 버튼을 누를 때 개설자 단위 열람 라우트에서 받아 컴포넌트 state에만 둔다.
 */

export interface PayoutRecordView {
  id: string;
  taxType: ShopPayoutTaxType;
  status: 'pending' | 'paid';
  grossAmount: number;
  shippingAmount: number;
  studioAmount: number;
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

export interface AdjustmentView {
  id: string;
  payeeKey: string;
  amount: number;
  reason: 'late_refund' | 'showtime_cancel_fee' | 'manual';
  sourceRef: string | null;
  memo: string | null;
  /** 시스템이 만든 것(환불·이월)이면 false — 지울 수 없고 반대 부호로 상쇄한다. */
  deletable: boolean;
  createdAt: string;
}

export interface ShopPayoutRowView {
  subjectKey: string;
  period: string;
  payeeName: string;
  creatorId: string | null;
  taxType: ShopPayoutTaxType | null;
  itemCount: number;
  salesAmount: number;
  shippingAmount: number;
  shippingOrderCount: number;
  storeAmount: number;
  vatDeductionAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  adjustments: AdjustmentView[];
  adjustmentAmount: number;
  carryOverAmount: number;
  netAmount: number;
  needsReviewOrderNos: string[];
  withdrawableOrderCount: number;
  blockers: ShopPayoutBlocker[];
  warnings: ShopPayoutWarning[];
  recorded: PayoutRecordView | null;
  appliedAdjustments: AdjustmentView[];
  /** 기록 뒤 판매가 바뀌었는가(기록의 판매액·배송비 ≠ 지금 집계) — 뒤늦은 환불일 수 있다. 기록이 없으면 false. */
  drift: boolean;
}

export const serializeAdjustment = (a: PartnerPayoutAdjustment): AdjustmentView => ({
  id: a.id,
  payeeKey: a.payeeKey,
  amount: a.amount,
  reason: a.reason,
  sourceRef: a.sourceRef,
  memo: a.memo,
  deletable: a.reason === 'manual' && !(a.sourceRef ?? '').startsWith('carryover:'),
  createdAt: a.createdAt.toISOString(),
});

export const serializePayoutRecord = (p: PartnerPayout): PayoutRecordView => ({
  id: p.id,
  taxType: p.taxType,
  status: p.status,
  grossAmount: p.grossAmount,
  shippingAmount: p.shippingAmount,
  studioAmount: p.studioAmount,
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

export const serializeShopPayoutPreview = (p: ShopPayoutPreview): ShopPayoutRowView => ({
  subjectKey: p.subjectKey,
  period: p.period,
  payeeName: p.payeeName,
  creatorId: p.creatorId,
  taxType: p.taxType,
  itemCount: p.itemCount,
  salesAmount: p.salesAmount,
  shippingAmount: p.shippingAmount,
  shippingOrderCount: p.shippingOrderCount,
  storeAmount: p.storeAmount,
  vatDeductionAmount: p.vatDeductionAmount,
  shareAmount: p.shareAmount,
  withholdingAmount: p.withholdingAmount,
  adjustments: p.adjustments.map(serializeAdjustment),
  adjustmentAmount: p.adjustmentAmount,
  carryOverAmount: p.carryOverAmount,
  netAmount: p.netAmount,
  needsReviewOrderNos: p.needsReviewOrderNos,
  withdrawableOrderCount: p.withdrawableOrderCount,
  blockers: p.blockers,
  warnings: p.warnings,
  recorded: p.recorded ? serializePayoutRecord(p.recorded) : null,
  appliedAdjustments: p.appliedAdjustments.map(serializeAdjustment),
  drift: p.recorded ? p.recorded.grossAmount !== p.salesAmount || p.recorded.shippingAmount !== p.shippingAmount : false,
});
