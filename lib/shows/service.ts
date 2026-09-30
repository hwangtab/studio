import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { splitInclusiveAmount } from '../booking/amounts';
import { generateManageToken } from '../booking/token';
import { zoneCapacityCondition, ticketTypeQuotaCondition, showtimeSalesWindowCondition } from './conditions';
import { generateShowOrderNo, generateTicketCode } from './shape';

/**
 * libSQL batch 결과의 rowsAffected. lib/funding/service.ts·tests/helpers/showsDb.ts와 같은
 * 이름의 로컬 헬퍼 — 모듈 그래프를 섞지 않으려는 의도적 복제(기존 관행, Global Constraints 참고).
 * 이 파일이 SSOT다 — 뒤 태스크는 이 함수를 여기서 import한다.
 */
export function rowsAffectedOf(result: unknown): number {
  const r = result as { rowsAffected?: number } | undefined;
  return r?.rowsAffected ?? 0;
}

const HOLD_SECONDS = 600;

export type CreateShowOrderResult =
  | { ok: true; orderNo: string }
  | { ok: false; code: 'sold_out' | 'sales_closed' };

/**
 * 원자적 재고 판정 배치. lib/funding/service.ts의 createFundingPledge와 같은 패턴:
 * 사전 SELECT 후 개별 INSERT가 아니라, INSERT ... SELECT ... WHERE 게이트 하나로
 * 재고 확정까지 끝낸다(Global Constraints: "사전 SELECT 후 개별 INSERT 금지").
 *
 * 판매창(showtimeSalesWindowCondition) · 구역 정원(zoneCapacityCondition) · 티켓타입
 * 한도(ticketTypeQuotaCondition) 세 게이트를 모두 같은 batch의 첫 INSERT WHERE절에
 * 걸고, 뒤따르는 show_orders·show_tickets INSERT는 "그 주문이 실제로 만들어졌는가"만
 * (exists 서브쿼리로) 확인한다 — 게이트가 0행이면 나머지도 전부 0행으로 끝나
 * 사후 정리가 필요 없다.
 */
export async function createShowOrder(
  input: { showtimeId: string; ticketTypeId: string; quantity: number; buyerName: string; buyerContact: string },
  now: Date
): Promise<CreateShowOrderResult> {
  const db = getDb();
  const orderNo = generateShowOrderNo(now, false);
  const manageToken = generateManageToken();

  // 재고 게이트 SQL이 zone_id를 파라미터로 받으므로 티켓타입에서 먼저 알아낸다.
  const ticketType = await db.query.showTicketTypes.findFirst({
    where: (t, { eq }) => eq(t.id, input.ticketTypeId),
  });
  if (!ticketType) return { ok: false, code: 'sold_out' };

  const totalAmount = ticketType.price * input.quantity;
  // 티켓 가격은 VAT 포함 표기(아티스트 구독과 같은 관례) — lib/booking/amounts.ts의
  // splitInclusiveAmount로 공급가·VAT를 분리해 저장한다. 후속 정산 태스크가
  // orders.itemAmount/vatAmount를 실제 분리값으로 전제한다.
  const { itemAmount, vatAmount } = splitInclusiveAmount(totalAmount);

  const windowGate = showtimeSalesWindowCondition(input.showtimeId, now);
  const zoneGate = zoneCapacityCondition(input.showtimeId, ticketType.zoneId, input.quantity, now);
  const quotaGate = ticketTypeQuotaCondition(input.showtimeId, input.ticketTypeId, input.quantity, now);

  const statements = [];
  statements.push(
    db.run(sql`
      INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
                          item_amount, vat_amount, total_amount, manage_token)
      SELECT lower(hex(randomblob(16))), ${orderNo}, 'ticket', 'pending', ${input.buyerName}, ${input.buyerContact}, '',
             ${itemAmount}, ${vatAmount}, ${totalAmount}, ${manageToken}
      WHERE ${windowGate} AND ${zoneGate} AND ${quotaGate}
    `)
  );
  statements.push(
    db.run(sql`
      INSERT INTO show_orders (order_no, showtime_id, buyer_name, buyer_contact, hold_expires_at)
      SELECT ${orderNo}, ${input.showtimeId}, ${input.buyerName}, ${input.buyerContact}, ${Math.floor(now.getTime() / 1000) + HOLD_SECONDS}
      WHERE EXISTS (SELECT 1 FROM orders WHERE order_no = ${orderNo})
    `)
  );
  for (let i = 0; i < input.quantity; i++) {
    statements.push(
      db.run(sql`
        INSERT INTO show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, unit_amount)
        SELECT lower(hex(randomblob(16))), ${orderNo}, ${input.showtimeId}, ${input.ticketTypeId}, ${generateTicketCode()}, 'held', ${ticketType.price}
        WHERE EXISTS (SELECT 1 FROM show_orders WHERE order_no = ${orderNo})
      `)
    );
  }

  const results = await db.batch(statements as [typeof statements[number], ...typeof statements]);

  if (rowsAffectedOf(results[results.length - 1]) === 0) {
    // 어느 게이트가 막았는지 구분 — 판매창 문제인지 재고 문제인지 별도 조회로 확인.
    const showtime = await db.query.showtimes.findFirst({ where: (s, { eq }) => eq(s.id, input.showtimeId) });
    const nowSec = Math.floor(now.getTime() / 1000);
    if (!showtime || showtime.status !== 'scheduled' || showtime.salesCloseAt <= nowSec) {
      return { ok: false, code: 'sales_closed' };
    }
    return { ok: false, code: 'sold_out' };
  }
  return { ok: true, orderNo };
}

/** 보류만료 + 30분 유예 지난 pending 주문을 expired로 되돌린다(스펙 §7.13). */
export async function expireStaleShowOrders(now: Date): Promise<number> {
  const db = getDb();
  const nowSec = Math.floor(now.getTime() / 1000);
  const GRACE_SECONDS = 1800;
  const staleOrders = await db.all(sql`
    SELECT so.order_no as orderNo FROM show_orders so
    JOIN orders o ON o.order_no = so.order_no
    WHERE o.status = 'pending'
    GROUP BY so.order_no
    HAVING MAX(so.hold_expires_at) + ${GRACE_SECONDS} < ${nowSec}
  `);
  let count = 0;
  for (const row of staleOrders as Array<{ orderNo: string }>) {
    const result = await db.run(sql`
      UPDATE orders SET status = 'expired', updated_at = unixepoch() WHERE order_no = ${row.orderNo} AND status = 'pending'
    `);
    if (rowsAffectedOf(result) > 0) {
      await db.run(sql`UPDATE show_tickets SET status = 'void' WHERE order_no = ${row.orderNo} AND status = 'held'`);
      count++;
    }
  }
  return count;
}

/**
 * 초대권 발급 — 결제 없이 issued 상태로 바로 발권한다(스펙 §7.6).
 * comp_quota는 구역/티켓타입 정원과 별개 한도이며, 세 게이트(판매창·구역 정원·
 * 티켓타입 한도) 모두 통과해야 하고 comp 전용 한도까지 추가로 걸린다.
 */
export async function issueCompTickets(
  input: { showtimeId: string; ticketTypeId: string; quantity: number; note: string },
  now: Date
): Promise<CreateShowOrderResult> {
  const db = getDb();
  const orderNo = generateShowOrderNo(now, true);
  const manageToken = generateManageToken();

  const ticketType = await db.query.showTicketTypes.findFirst({ where: (t, { eq }) => eq(t.id, input.ticketTypeId) });
  if (!ticketType) return { ok: false, code: 'sold_out' };

  // 초대권은 결제 없이 발급되지만 금액 계산 경로는 다른 주문과 동일하게 splitInclusiveAmount를
  // 거친다(itemAmount/vatAmount가 항상 이 함수의 결과값이라는 저장소 전체 관례를 유지) — 0원을
  // 넣으면 {itemAmount:0, vatAmount:0}을 그대로 돌려준다.
  const { itemAmount, vatAmount } = splitInclusiveAmount(0);

  const windowGate = showtimeSalesWindowCondition(input.showtimeId, now);
  const zoneGate = zoneCapacityCondition(input.showtimeId, ticketType.zoneId, input.quantity, now);
  const quotaGate = ticketTypeQuotaCondition(input.showtimeId, input.ticketTypeId, input.quantity, now);
  // comp_quota는 구역/티켓타입 정원과 별개의 한도다 — 지금까지 발급된(void가 아닌)
  // organizer_comp 티켓 수를 빼고 남은 여유가 요청 수량 이상이어야 한다.
  const compGate = sql`(
    select tt.comp_quota - coalesce((
      select count(*) from show_tickets st
      where st.ticket_type_id = tt.id and st.issued_by = 'organizer_comp' and st.status != 'void'
    ), 0)
    from show_ticket_types tt where tt.id = ${input.ticketTypeId}
  ) >= ${input.quantity}`;

  const statements = [];
  statements.push(
    db.run(sql`
      INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
                          item_amount, vat_amount, total_amount, manage_token)
      SELECT lower(hex(randomblob(16))), ${orderNo}, 'ticket', 'paid', '초대권', '', '',
             ${itemAmount}, ${vatAmount}, 0, ${manageToken}
      WHERE ${windowGate} AND ${zoneGate} AND ${quotaGate} AND ${compGate}
    `)
  );
  statements.push(
    // buyer_contact에 'comp'를 넣는 것은 실제 구매자가 없는 초대권이라 문자 그대로 표식일
    // 뿐이다 — buyer_name 칸에 note(발급 사유)를 대신 넣는다. show_orders에 comp 전용
    // note 컬럼이 없어서 쓰는 임시방편이다(스펙 §7.6, 이 단계에는 새 컬럼을 추가하지 않는다).
    db.run(sql`
      INSERT INTO show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      SELECT ${orderNo}, ${input.showtimeId}, ${input.note}, 'comp'
      WHERE EXISTS (SELECT 1 FROM orders WHERE order_no = ${orderNo})
    `)
  );
  for (let i = 0; i < input.quantity; i++) {
    statements.push(
      db.run(sql`
        INSERT INTO show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, issued_by, unit_amount)
        SELECT lower(hex(randomblob(16))), ${orderNo}, ${input.showtimeId}, ${input.ticketTypeId}, ${generateTicketCode()}, 'issued', 'organizer_comp', 0
        WHERE EXISTS (SELECT 1 FROM show_orders WHERE order_no = ${orderNo})
      `)
    );
  }

  const results = await db.batch(statements as [typeof statements[number], ...typeof statements]);

  if (rowsAffectedOf(results[0]) === 0) {
    const showtime = await db.query.showtimes.findFirst({ where: (s, { eq }) => eq(s.id, input.showtimeId) });
    const nowSec = Math.floor(now.getTime() / 1000);
    if (!showtime || showtime.status !== 'scheduled' || showtime.salesCloseAt <= nowSec) {
      return { ok: false, code: 'sales_closed' };
    }
    return { ok: false, code: 'sold_out' };
  }
  return { ok: true, orderNo };
}

/** 초대권을 취소한다 — 이미 체크인된 티켓은 취소할 수 없다(현장에서 이미 입장 처리된 이력을 지우지 않는다). */
export async function revokeCompTicket(ticketId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.run(sql`
    UPDATE show_tickets SET status = 'void'
    WHERE id = ${ticketId} AND issued_by = 'organizer_comp' AND checked_in_at IS NULL
  `);
  return rowsAffectedOf(result) > 0;
}

/** 주문번호로 티켓 주문을 조회한다(확인·환불·관리자 화면 공통 진입점). */
export async function findShowOrderByOrderNo(orderNo: string) {
  const db = getDb();
  return db.query.orders.findFirst({
    where: (o, { eq }) => eq(o.orderNo, orderNo),
    with: { showOrder: { with: { tickets: true } }, payments: { with: { refunds: true } } },
  });
}
