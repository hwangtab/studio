import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { kstDateString } from '../booking/kst';
import type { RevenueRow } from './revenueReport';

/**
 * 연습실 월 입주 수납(`room_tenancy_payments`)을 매출 행으로 — 월세는 결제 행(`payments`)을 남기지 않아 매출 현황에서 통째로 빠져 있었다
 * (2026-10 월 입주 수납 12건 378만 원이 대시보드 매출에 없었다. 운영자 지적 2026-10-21).
 *
 * - 기준 시각은 입금일(`paid_on`, KST 0시). 한 입금 기록이 한 행이다.
 * - 부가세는 0으로 둔다 — 입주 수납 금액이 부가세를 포함하는지 이 표에 기록이 없다(월 이용료는 부가세 별도 표기). 세무 구분이 필요하면 장부(세금계산서)로 본다.
 * - 환불 칸이 없다(퇴실 정산은 입금 기록을 고치는 쪽). 이름·연락처는 읽지도 싣지도 않는다 — 방 번호만.
 * 표가 없는 DB(0066 전)에서는 읽기가 던진다 — 호출부가 잡아 "월 입주 수입을 못 읽었다"고 알린다.
 */
export const loadTenancyRevenueRows = async (range: { from: Date; toExclusive: Date }): Promise<RevenueRow[]> => {
  const from = kstDateString(range.from);
  const to = kstDateString(range.toExclusive);
  const rows = await getDb().all<{ id: string; paid_on: string; amount: number; room_number: string | null; kind: string | null }>(sql`
    SELECT p.id AS id, p.paid_on AS paid_on, p.amount AS amount, t.room_number AS room_number, t.kind AS kind
    FROM room_tenancy_payments p
    JOIN room_tenancies t ON t.id = p.tenancy_id
    WHERE p.paid_on >= ${from} AND p.paid_on < ${to} AND p.amount > 0
    ORDER BY p.paid_on
  `);
  return rows.map((r) => ({
    at: new Date(new Date(`${r.paid_on}T00:00:00Z`).getTime() - 9 * 60 * 60 * 1000),
    orderNo: `${r.kind === 'virtual' ? '비상주' : (r.room_number ?? '방')} 월 입주`,
    type: 'tenancy',
    projectSlug: null,
    method: '계좌 입금',
    gross: Number(r.amount),
    vat: 0,
    refunded: 0,
    offline: true,
  }));
};
