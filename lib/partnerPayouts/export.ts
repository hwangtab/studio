import { and, asc, eq, gte, inArray, lt, or } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { partnerPayouts, type PartnerPayout } from '../../db/schema';
import { kstDateString } from '../booking/kst';
import { kstMonthRange } from '../shop/artistPayout';
import type { PartnerPayoutKind } from './adjustments';

/**
 * 상점·공연 정산 CSV — 세무사에게 넘기는 정산 내역 (docs/settlement-record-design-2026-10.md §8 P3).
 *
 * **싣는 것은 금액과 수취인 이름뿐이다.** 주민등록번호·계좌번호·이메일·연락처는 이 표의 어느 칸에서도 나오지 않고
 * (`partner_payouts`에 그런 칸이 없다) 열 목록도 아래 상수 하나로 고정돼 있어 `select *`로 새로 생긴 칸이 흘러들 수 없다.
 * 지급명세서에 필요한 번호는 세무사가 필요할 때 운영자가 기존 열람 경로(접속기록 남음)로 따로 확인한다.
 *
 * 기준월: 상점은 정산 단위 달(`period`), 공연은 `period`가 'all'이라 **정산을 기록한 달(KST)**. 한 파일에서 둘을 같은 축으로 자르려는 선택이다.
 */

export type PartnerPayoutExportKind = PartnerPayoutKind | 'all';

export const PARTNER_PAYOUT_EXPORT_COLUMNS = [
  '정산 단위', '구분', '수취인', '세금 구분',
  '판매액', '환불', '배송비', '플랫폼 수수료', '결제 수수료', '스튜디오 몫', '부가세 상당 공제',
  '정산 기준액', '원천징수액', '이월 조정', '차액', '실지급액',
  '상태', '지급일', '기록일', '메모',
] as const;

export type PartnerPayoutExportColumn = (typeof PARTNER_PAYOUT_EXPORT_COLUMNS)[number];
export type PartnerPayoutExportRow = Record<PartnerPayoutExportColumn, string | number | null>;

export const MAX_EXPORT_MONTHS = 24;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const parseExportKind = (raw: unknown): PartnerPayoutExportKind | null =>
  raw === undefined || raw === '' ? 'all' : raw === 'shop' || raw === 'show' || raw === 'all' ? raw : null;

const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

/** 기간 검증(KST 'YYYY-MM') — 형식·순서·길이. 실패하면 사람이 읽는 문구를 돌려준다. `validateLedgerRange`와 같은 틀(최대 24개월). */
export const validatePartnerPayoutRange = (range: { from: string; to: string }): string | null => {
  if (!MONTH_PATTERN.test(range.from) || !MONTH_PATTERN.test(range.to)) return '기간은 YYYY-MM 형식이어야 합니다.';
  if (monthIndex(range.to) < monthIndex(range.from)) return '종료월이 시작월보다 앞설 수 없습니다.';
  if (monthIndex(range.to) - monthIndex(range.from) + 1 > MAX_EXPORT_MONTHS) return `한 번에 ${MAX_EXPORT_MONTHS}개월까지만 내려받을 수 있습니다.`;
  return null;
};

const TAX_LABEL: Record<PartnerPayout['taxType'], string> = { withholding: '개인(원천징수)', invoice: '사업자(세금계산서)' };
const KIND_LABEL: Record<PartnerPayout['kind'], string> = { shop: '상점', show: '공연' };

/** 표 행 → CSV 행. 열 목록에 없는 칸은 버린다. 순수 함수라 열 구성을 테스트가 직접 고정한다. */
export const toExportRow = (p: PartnerPayout): PartnerPayoutExportRow => ({
  '정산 단위': p.kind === 'shop' ? p.period : `공연 ${p.subjectKey}`,
  '구분': KIND_LABEL[p.kind],
  '수취인': p.payeeName,
  '세금 구분': TAX_LABEL[p.taxType],
  '판매액': p.grossAmount,
  '환불': p.refundAmount,
  '배송비': p.shippingAmount,
  '플랫폼 수수료': p.platformFeeAmount,
  '결제 수수료': p.paymentFeeAmount,
  '스튜디오 몫': p.studioAmount,
  '부가세 상당 공제': p.vatDeductionAmount,
  '정산 기준액': p.shareAmount,
  '원천징수액': p.withholdingAmount,
  '이월 조정': p.adjustmentAmount,
  '차액': p.shortfallAmount,
  '실지급액': p.netAmount,
  '상태': p.status === 'paid' ? '지급 완료' : '이체 대기',
  '지급일': p.paidAt ? kstDateString(p.paidAt) : null,
  '기록일': kstDateString(p.createdAt),
  '메모': p.memo,
});

/** 기간 안의 정산 기록. 표(0067)가 없으면 던진다 — 호출부가 500으로 알리고 접속기록에 error를 남긴다. */
export const listPartnerPayoutExportRows = async (opts: { kind: PartnerPayoutExportKind; from: string; to: string }): Promise<PartnerPayoutExportRow[]> => {
  const start = kstMonthRange(opts.from);
  const end = kstMonthRange(opts.to);
  if (!start || !end) return [];
  const kinds: PartnerPayoutKind[] = opts.kind === 'all' ? ['shop', 'show'] : [opts.kind];
  // 상점 = period가 [from, to] (문자열 비교가 달 순서와 같다), 공연 = 기록 시각이 그 기간의 KST 달 경계 안.
  const shopWindow = and(eq(partnerPayouts.kind, 'shop'), gte(partnerPayouts.period, opts.from), lt(partnerPayouts.period, nextMonth(opts.to)));
  const showWindow = and(eq(partnerPayouts.kind, 'show'), gte(partnerPayouts.createdAt, new Date(start.from * 1000)), lt(partnerPayouts.createdAt, new Date(end.to * 1000)));
  const rows = await getDb()
    .select()
    .from(partnerPayouts)
    .where(and(inArray(partnerPayouts.kind, kinds), or(shopWindow, showWindow)))
    .orderBy(asc(partnerPayouts.kind), asc(partnerPayouts.period), asc(partnerPayouts.payeeName), asc(partnerPayouts.createdAt));
  return rows.map(toExportRow);
};

const nextMonth = (m: string): string => {
  const idx = monthIndex(m) + 1;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
};
