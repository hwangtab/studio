import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { occupiedBookingSql } from './service';

export interface BlockConflict {
  orderNo: string;
  startAt: Date;
}

/**
 * 예약 불가 블록을 걸 시간대와 겹치는, 그 자원을 점유한 예약 — 관리자 블록 등록(`/api/admin/blocks`)과 결제 링크의
 * "예약 불가로 막기"(`/api/admin/payment-links`)가 같은 판정을 쓴다. 블록은 새 예약만 막지 기존 예약은 그대로라, 겹침을 모른 채
 * 걸면 고객은 예약했는데 그 시간이 "휴무"가 된다. `roomNumber` NULL = 녹음실, 'R02' = 그 연습실 방.
 */
export const findBlockConflicts = async (range: { startAt: Date; endAt: Date; roomNumber: string | null }): Promise<BlockConflict[]> => {
  const rows = await getDb().all<{ order_no: string; start_at: number }>(sql`
    SELECT o.order_no, b.start_at
    FROM bookings b JOIN orders o ON o.id = b.order_id
    WHERE b.room_number IS ${range.roomNumber}
      AND b.start_at < ${Math.floor(range.endAt.getTime() / 1000)} AND b.end_at > ${Math.floor(range.startAt.getTime() / 1000)}
      AND ${occupiedBookingSql('b')}
    ORDER BY b.start_at
  `);
  return rows.map((r) => ({ orderNo: r.order_no, startAt: new Date(Number(r.start_at) * 1000) }));
};

/** 409 `conflicts` 응답 본문 — 두 API가 같은 모양·문구를 낸다(화면은 `code === 'conflicts'`로 확인 창을 띄운다). */
export const blockConflictsBody = (conflicts: BlockConflict[]) => ({
  ok: false as const,
  code: 'conflicts' as const,
  conflicts: conflicts.map((c) => ({ orderNo: c.orderNo, startAt: c.startAt.toISOString() })),
  message: `이 시간에 이미 잡힌 예약이 ${conflicts.length}건 있습니다(${conflicts.map((c) => c.orderNo).join(', ')}). 블록은 새 예약만 막고 이 예약은 그대로 남습니다.`,
});
