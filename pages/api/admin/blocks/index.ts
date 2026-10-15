import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { sql } from 'drizzle-orm';

import { availabilityBlocks } from '../../../../db/schema';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { serializeBlockForAdmin } from '../../../../lib/booking/admin-serialize';
import { kstDateTime } from '../../../../lib/booking/kst';
import { occupancyConflictKeys } from '../../../../lib/booking/products';
import { occupiedBookingSql } from '../../../../lib/booking/service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEMO_MAX_LENGTH = 200;

interface OverlappingBooking {
  orderNo: string;
  customerName: string;
  startAt: string;
  endAt: string;
}

/** 이 자원(null = 녹음실)의 시간대와 겹치는, 아직 유효한 예약(확정·결제 대기·계좌 입금 대기). */
const findOverlappingBookings = async (startAt: Date, endAt: Date, room: string | null): Promise<OverlappingBooking[]> => {
  const keys = occupancyConflictKeys(room);
  const roomClause = sql.join(
    keys.map((key) => (key === null ? sql`b.room_number IS NULL` : sql`b.room_number = ${key}`)),
    sql` OR `,
  );
  const rows = await getDb().all<{ order_no: string; customer_name: string; start_at: number; end_at: number }>(sql`
    SELECT o.order_no AS order_no, o.customer_name AS customer_name, b.start_at AS start_at, b.end_at AS end_at
    FROM bookings b JOIN orders o ON o.id = b.order_id
    WHERE (${roomClause})
      AND b.start_at < ${Math.floor(endAt.getTime() / 1000)} AND b.end_at > ${Math.floor(startAt.getTime() / 1000)}
      AND ${occupiedBookingSql('b')}
    ORDER BY b.start_at
  `);
  return rows.map((row) => ({
    orderNo: row.order_no,
    customerName: row.customer_name,
    startAt: new Date(Number(row.start_at) * 1000).toISOString(),
    endAt: new Date(Number(row.end_at) * 1000).toISOString(),
  }));
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const allBlocks = await getDb().query.availabilityBlocks.findMany({
        orderBy: (t, { asc }) => [asc(t.startAt)],
      });

      return res.status(200).json({ ok: true, blocks: allBlocks.map(serializeBlockForAdmin) });
    } catch (error: unknown) {
      console.error('[API/admin/blocks] Failed to list blocks:', error);
      return res.status(500).json({ ok: false, message: '블록 목록을 불러오지 못했습니다.' });
    }
  }

  if (req.method === 'POST') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }

    const { date, startHour, endHour, memo, roomNumber } = req.body as Record<string, unknown>;
    // 빈 값·비문자는 녹음실(NULL). 'R02' 같은 방 번호면 그 방만 막는다(db/schema.ts 주석).
    const roomText = typeof roomNumber === 'string' && /^[A-Z0-9-]{1,8}$/i.test(roomNumber.trim())
      ? roomNumber.trim().toUpperCase() : null;

    if (typeof date !== 'string' || !DATE_RE.test(date)) {
      return res.status(400).json({ ok: false, message: '날짜가 올바르지 않습니다.' });
    }
    if (typeof startHour !== 'number' || !Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
      return res.status(400).json({ ok: false, message: '시작 시간이 올바르지 않습니다.' });
    }
    // endHour는 자정을 24시로 표현할 수 있게 상한을 24로 둔다 (kstDateTime('...', 24)는
    // 다음날 00:00 KST와 같아 하루 끝까지 막는 블록을 만들 수 있다).
    if (typeof endHour !== 'number' || !Number.isInteger(endHour) || endHour <= startHour || endHour > 24) {
      return res.status(400).json({ ok: false, message: '종료 시간이 올바르지 않습니다.' });
    }

    const startAtDate = kstDateTime(date, startHour);
    if (Number.isNaN(startAtDate.getTime())) {
      return res.status(400).json({ ok: false, message: '날짜가 올바르지 않습니다.' });
    }
    const endAtDate = kstDateTime(date, endHour);

    const memoText = typeof memo === 'string' ? memo.trim().slice(0, MEMO_MAX_LENGTH) : undefined;

    try {
      const [block] = await getDb()
        .insert(availabilityBlocks)
        .values({ startAt: startAtDate, endAt: endAtDate, memo: memoText || null, roomNumber: roomText })
        .returning();

      /**
       * 블록은 **새 예약만** 막는다 — 그 시간대에 이미 잡힌 예약은 그대로 남는다. 겹침을 말하지 않으면 운영자가
       * "점검 때문에 막았다"고 믿는데 고객은 예약대로 찾아온다. 막는 건 아니고(점검과 겹쳐도 등록은 돼야 한다)
       * 겹친 예약을 응답에 실어 화면이 알리게 한다. 조회가 실패해도 등록은 성공이다.
       */
      const overlapping = await findOverlappingBookings(startAtDate, endAtDate, roomText).catch((error: unknown) => {
        console.error('[API/admin/blocks] 겹치는 예약 조회 실패:', error);
        return [];
      });

      return res.status(201).json({ ok: true, block: serializeBlockForAdmin(block), overlapping });
    } catch (error: unknown) {
      console.error('[API/admin/blocks] Failed to create block:', error);
      return res.status(500).json({ ok: false, message: '블록 생성에 실패했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
