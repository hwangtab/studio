import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, type Booking, type Order, type Payment, type Refund, type WorkOrder } from '../../db/schema';
import { computeAmounts } from './amounts';
import { AWAITING_DEPOSIT, MAX_BANK_DEPOSIT_BOOKINGS_PER_RESOURCE_DAY, type CheckoutPaymentMethod } from '../payments/bankDeposit';
import { kstDateTime } from './kst';
import { computeMixingAmounts, getMixingProduct } from './mixing-products';
import { getProduct, occupancyConflictKeys, resourceKindOf } from './products';
import { generateManageToken, generateOrderNo } from './token';
import { MIXING_PENDING_TTL_SECONDS, PENDING_HOLD_SECONDS, type CreateBookingPayload, type CreateMixingOrderPayload } from './validation';

export { rangesOverlap } from './overlap';

// 클라이언트(예약 위저드 카운트다운)와 공유해야 해서 validation.ts가 정본이다.
export { MIXING_PENDING_TTL_SECONDS, PENDING_HOLD_SECONDS };

const toEpoch = (d: Date): number => Math.floor(d.getTime() / 1000);

/**
 * 이 예약 행(`b`)이 **시간대를 점유하는가** — 생성 가드(아래 INSERT)와 슬롯 조회(pages/api/bookings/slots.ts)가
 * 같은 집합을 본다. 확정(confirmed), 토스 결제창의 15분 홀드(pending + 900초 이내), 그리고 **계좌 입금 대기**
 * (pending + 주문이 `awaiting_deposit` — 기한 없이 잡는다, lib/payments/bankDeposit.ts). 셋 중 하나라도
 * 빠뜨리면 같은 시간에 두 사람이 예약된다.
 */
export const occupiedBookingSql = (alias: 'b' | 'bookings' = 'b') => sql`(
  ${sql.raw(alias)}.status = 'confirmed'
  OR (${sql.raw(alias)}.status = 'pending' AND (
    ${sql.raw(alias)}.created_at > unixepoch() - ${PENDING_HOLD_SECONDS}
    OR ${sql.raw(alias)}.order_id IN (SELECT id FROM orders WHERE status = ${AWAITING_DEPOSIT})
  ))
)`;

/** 계좌 입금 대기 주문의 id 집합 — 토스 홀드 만료가 그 하위 행(bookings·work_orders)을 건드리지 않게 뺀다. */
const AWAITING_DEPOSIT_ORDER_IDS = sql`(SELECT id FROM orders WHERE status = ${AWAITING_DEPOSIT})`;

/** `b.room_number`가 keys 중 하나(null = 녹음실)와 같은가 — occupancyConflictKeys와 짝. */
const roomMatch = (keys: Array<string | null>) =>
  sql.join(keys.map((k) => (k === null ? sql`b.room_number IS NULL` : sql`b.room_number = ${k}`)), sql` OR `);

export const createBookingOrder = async (
  payload: CreateBookingPayload,
  now: Date,
  options: {
    /** 캘린더 가드가 바쁘다고 판정한 방 — 배정 후보에서 뺀다(calendarGuard.ts). */
    excludeRooms?: readonly string[];
    /** 위저드가 돌려보낸 직전 주문번호 — 자기 홀드 해제의 소유 증명(아래 주석). */
    releaseOrderNo?: string | null;
    /**
     * `bank_transfer`면 주문을 계좌 입금 대기(`awaiting_deposit`)로 만든다 — 토스 홀드가 아니라 기한 없이
     * 시간대를 잡는다(occupiedBookingSql). 기본은 토스(`pending`, 15분 홀드).
     */
    paymentMethod?: CheckoutPaymentMethod;
  } = {},
): Promise<
  | { ok: true; orderNo: string; itemAmount: number; vatAmount: number; totalAmount: number; bookingId: string; roomNumber: string | null }
  | { ok: false; code: 'slot_taken' | 'day_bank_quota_full' }
> => {
  const db = getDb();
  const product = getProduct(payload.productId)!; // validation이 보장
  const hours = payload.hours!;
  const amounts = computeAmounts(product, hours);
  const startAt = kstDateTime(payload.date, payload.startHour);
  const endAt = kstDateTime(payload.date, payload.startHour + hours);
  const orderNo = generateOrderNo(now);
  const manageToken = generateManageToken();

  // 자가 선점 해제: 결제창을 닫거나 결제에 실패한 뒤 같은 슬롯을 다시 제출하면, 직전 제출로
  // 만든 자신의 pending 주문·예약이 PENDING_HOLD_SECONDS(900초) 동안 아래 겹침 검사에
  // "이미 점유"로 잡힌다 — 고객이 자기 자신에게 15분간 막히고 "다른 예약이 먼저
  // 잡혔습니다"라는 오해성 409를 본다. 새 주문을 만들기 전에 그 pending을 먼저 만료시킨다.
  //
  // **소유 증명(releaseOrderNo)이 없으면 아무것도 만료시키지 않는다.** 예전엔 조건이
  // `customer_email = ? AND customer_phone = ?`뿐이었다. 두 값은 요청 본문의 미검증 문자열이라,
  // 남의 이메일·전화를 아는 사람이 예약 요청 한 번으로 그 사람의 결제 대기 주문을 만료시킬 수
  // 있었다 — 피해자가 결제를 마치고 돌아오면 confirm이 '만료된 주문'으로 거절한다. 펀딩은 같은
  // 구멍을 먼저 막았다(lib/funding/service.ts의 releaseOrderNo). orderNo는 뒤 8자가
  // randomBytes(4)라 추측할 수 없고 생성 응답으로만 나가므로, 조건에 넣는 것만으로 이 경로가 남의
  // 주문에 닿지 못한다. 이메일·전화 조건은 방어 깊이로 함께 건다. 증명이 없으면 자기 홀드가
  // 자연 만료될 때까지 기다린다 — 남의 결제를 깨뜨릴 수 있는 편보다 낫다.
  //
  // 순서 주의: bookings를 먼저 cancelled로 바꾼다. orders를 먼저 expired로 바꾸면
  // 아래 IN 서브쿼리(status='pending'인 orders)가 비어 그 bookings가 갱신되지 않는다.
  //
  // 안전성: 여기서 해제되는 주문을 다른 탭이 그 사이 결제 중이었더라도, confirm()은
  // order.status !== 'pending'에서 토스 승인 호출 전에 멈추므로(confirm.ts) 과금은
  // 일어나지 않는다 — PENDING_HOLD_SECONDS 자연 만료(expireStaleOrders)와 같은 성질이다.
  //
  // type = 'session' 조건이 반드시 있어야 한다. 없으면 (email, phone)만으로 그 고객의 **모든**
  // pending 주문을 죽인다 — 같은 고객이 다른 탭에서 믹싱·펀딩 주문을 결제 중일 때 세션 예약을
  // 새로 만드는 것만으로 그 주문이 expired가 되어 결제가 통째로 무산되던 사고다. 자가 선점
  // 해제는 "내가 방금 만든 같은 종류의 주문"만 대상으로 한다(lib/funding/service.ts의
  // createFundingPledge가 type='funding'으로 같은 조건을 이미 걸어 둔 것과 같은 이유).
  const releaseOrderNo = options.releaseOrderNo ? options.releaseOrderNo.toUpperCase() : null;
  if (releaseOrderNo) {
    await db.run(sql`
      UPDATE bookings SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
      WHERE status = 'pending' AND order_id IN (
        SELECT id FROM orders
        WHERE status = 'pending' AND type = 'session' AND order_no = ${releaseOrderNo}
          AND customer_email = ${payload.customerEmail} AND customer_phone = ${payload.customerPhone}
      )
    `);
    await db.run(sql`
      UPDATE orders SET status = 'expired', updated_at = unixepoch()
      WHERE status = 'pending' AND type = 'session' AND order_no = ${releaseOrderNo}
        AND customer_email = ${payload.customerEmail} AND customer_phone = ${payload.customerPhone}
    `);
  }

  /**
   * 계좌 입금 대기 **하루 상한** — 같은 공간(이 상품이 쓰는 녹음실 또는 방 묶음)·같은 날(KST)에 이미 입금 대기
   * 예약이 `MAX_BANK_DEPOSIT_BOOKINGS_PER_RESOURCE_DAY`건이면 계좌 입금을 받지 않는다(카드는 된다). 대기는
   * 자동으로 풀리지 않아, 입금하지 않을 신청 몇 건이 하루를 통째로 막을 수 있다. 사전 조회라 동시 신청이 한 건
   * 넘칠 수는 있다 — 상한은 남용 억제용이고 이중 예약은 아래 겹침 가드가 막는다.
   */
  if (options.paymentMethod === 'bank_transfer') {
    const dayStart = kstDateTime(payload.date, 0);
    const dayEnd = kstDateTime(payload.date, 24);
    const resources: Array<string | null> = resourceKindOf(product) === 'rooms' ? [...(product.rooms ?? [])] : [null];
    const [row] = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM bookings b JOIN orders o ON o.id = b.order_id
      WHERE o.status = ${AWAITING_DEPOSIT} AND b.status = 'pending'
        AND b.start_at < ${toEpoch(dayEnd)} AND b.start_at >= ${toEpoch(dayStart)}
        AND (${roomMatch(resources)})
    `);
    if (Number(row?.n ?? 0) >= MAX_BANK_DEPOSIT_BOOKINGS_PER_RESOURCE_DAY) return { ok: false, code: 'day_bank_quota_full' };
  }

  const [order] = await db
    .insert(orders)
    .values({
      orderNo, type: 'session',
      customerName: payload.customerName, customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      itemAmount: amounts.itemAmount, vatAmount: amounts.vatAmount, totalAmount: amounts.totalAmount,
      manageToken,
      status: options.paymentMethod === 'bank_transfer' ? AWAITING_DEPOSIT : 'pending',
    })
    .returning({ id: orders.id });

  // 겹침 검사 + INSERT를 한 문장으로 — 동시 요청은 한쪽만 rowsAffected 1.
  //
  // **자원 단위로 겹침을 본다.** 예약은 occupancyConflictKeys로 — 녹음실(NULL)과 녹음실과 같은
  // 방(R02, products.ts STUDIO_SHARED_ROOMS)은 서로를 막고, 그 밖의 방은 자기 방끼리만 본다.
  // 관리자 블록은 `room_number IS ?`로 자원별 그대로다(녹음실 휴무가 무인 연습실을 닫지 않게). 방 자원 상품은
  // 후보 방을 순서대로 시도해 **처음 비는 방에 배정**한다(R02 → R05 …). 전부 차면 slot_taken.
  // 녹음실 상품은 후보가 [null] 하나라 예전 동작 그대로다.
  const excluded = new Set(options.excludeRooms ?? []);
  const candidates: Array<string | null> =
    resourceKindOf(product) === 'rooms' ? (product.rooms ?? []).filter((r) => !excluded.has(r)) : [null];
  const bookingId = randomUUID().replace(/-/g, '');
  let assignedRoom: string | null | undefined;
  for (const room of candidates) {
    const result = await db.run(sql`
      INSERT INTO bookings (id, order_id, product_id, service_type, room_number, start_at, end_at, duration_hours, status, customer_note)
      SELECT ${bookingId}, ${order.id}, ${product.id}, ${product.service}, ${room},
             ${toEpoch(startAt)}, ${toEpoch(endAt)}, ${hours}, 'pending', ${payload.customerNote ?? null}
      WHERE NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE (${roomMatch(occupancyConflictKeys(room))})
          AND b.start_at < ${toEpoch(endAt)} AND b.end_at > ${toEpoch(startAt)}
          AND ${occupiedBookingSql('b')}
      )
      AND NOT EXISTS (
        SELECT 1 FROM availability_blocks ab
        WHERE ab.room_number IS ${room}
          AND ab.start_at < ${toEpoch(endAt)} AND ab.end_at > ${toEpoch(startAt)}
      )
    `);
    if (Number(result.rowsAffected) > 0) { assignedRoom = room; break; }
  }

  if (assignedRoom === undefined) {
    await db.run(sql`UPDATE orders SET status = 'failed' WHERE id = ${order.id} AND status IN ('pending', ${AWAITING_DEPOSIT})`);
    return { ok: false, code: 'slot_taken' };
  }
  return {
    ok: true, orderNo, itemAmount: amounts.itemAmount, vatAmount: amounts.vatAmount, totalAmount: amounts.totalAmount,
    bookingId, roomNumber: assignedRoom,
  };
};

/**
 * 믹싱·마스터링 주문형 결제(Phase 2). bookings 대신 work_orders 1건을 만든다 — 슬롯 겹침
 * 검사가 없어 createBookingOrder보다 단순하지만, 자가 선점 해제는 같은 이유로 필요하다
 * (BookingWizard의 "← 정보 수정"과 같은 되돌아가기 패턴이 MixingOrderWizard에도 있다).
 */
export const createMixingOrder = async (
  payload: CreateMixingOrderPayload,
  now: Date,
  /** 위저드가 돌려보낸 직전 주문번호 — 자기 홀드 해제의 소유 증명(createBookingOrder 주석). */
  options: { releaseOrderNo?: string | null; /** `bank_transfer`면 계좌 입금 대기로 만든다(createBookingOrder와 같다). */ paymentMethod?: CheckoutPaymentMethod } = {},
): Promise<{ ok: true; orderNo: string; itemAmount: number; vatAmount: number; totalAmount: number; workOrderId: string }> => {
  const db = getDb();
  const product = getMixingProduct(payload.productId)!; // validation이 보장
  const amounts = computeMixingAmounts(product, payload.songCount, payload.vocalTuning);
  const orderNo = generateOrderNo(now);
  const manageToken = generateManageToken();

  // 자가 선점 해제 — 순서 주의: work_orders를 먼저 cancelled로 바꾼다(createBookingOrder와 같은 이유,
  // orders를 먼저 expired로 바꾸면 아래 IN 서브쿼리가 비어 work_orders가 갱신되지 않는다).
  //
  // type = 'mixing' 조건도 createBookingOrder와 같은 이유로 필수다 — 없으면 같은 고객이 다른
  // 타입(세션·펀딩) 주문을 결제 중일 때 그 주문을 죽인다. 소유 증명(releaseOrderNo)이 없으면
  // 아무것도 만료시키지 않는 것도 같다 — 믹싱은 잡는 자리가 없어 증명이 없어도 막히는 사람이 없다.
  const releaseOrderNo = options.releaseOrderNo ? options.releaseOrderNo.toUpperCase() : null;
  if (releaseOrderNo) {
    await db.run(sql`
      UPDATE work_orders SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
      WHERE status = 'pending' AND order_id IN (
        SELECT id FROM orders
        WHERE status = 'pending' AND type = 'mixing' AND order_no = ${releaseOrderNo}
          AND customer_email = ${payload.customerEmail} AND customer_phone = ${payload.customerPhone}
      )
    `);
    await db.run(sql`
      UPDATE orders SET status = 'expired', updated_at = unixepoch()
      WHERE status = 'pending' AND type = 'mixing' AND order_no = ${releaseOrderNo}
        AND customer_email = ${payload.customerEmail} AND customer_phone = ${payload.customerPhone}
    `);
  }

  const [order] = await db
    .insert(orders)
    .values({
      orderNo, type: 'mixing',
      customerName: payload.customerName, customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      itemAmount: amounts.itemAmount, vatAmount: amounts.vatAmount, totalAmount: amounts.totalAmount,
      manageToken,
      status: options.paymentMethod === 'bank_transfer' ? AWAITING_DEPOSIT : 'pending',
    })
    .returning({ id: orders.id });

  const workOrderId = randomUUID().replace(/-/g, '');
  await db.run(sql`
    INSERT INTO work_orders (id, order_id, product_id, service_type, song_count, vocal_tuning, status, customer_note)
    VALUES (${workOrderId}, ${order.id}, ${product.id}, ${product.serviceType},
            ${payload.songCount}, ${payload.vocalTuning ? 1 : 0}, 'pending', ${payload.customerNote ?? null})
  `);

  return { ok: true, orderNo, itemAmount: amounts.itemAmount, vatAmount: amounts.vatAmount, totalAmount: amounts.totalAmount, workOrderId };
};

/**
 * payments에 refunds까지 물고 온다 — cancel.ts가 "이미 환불된 금액"을 빼고 잔액을 상한으로
 * 잡아야 하기 때문이다(부분환불된 주문에 고객 셀프 취소가 다시 들어오면 티어 계산액이 잔액을
 * 넘어설 수 있다). 조인 1단 추가는 주문 1건 조회라 비용이 무시할 만하다.
 */
export const findOrderByOrderNo = async (
  orderNo: string,
): Promise<
  | (Order & { bookings: Booking[]; payments: (Payment & { refunds: Refund[] })[]; workOrders: WorkOrder[] })
  | undefined
> =>
  // middleware.ts가 대문자 포함 경로를 소문자로 308 리다이렉트하므로, URL에서 온
  // orderNo는 소문자로 도착할 수 있다(generateOrderNo는 항상 대문자만 생성) —
  // 대문자로 정규화해 비교한다. SQLite `=`는 대소문자 구분.
  getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.orderNo, orderNo.toUpperCase()),
    with: { bookings: true, payments: { with: { refunds: true } }, workOrders: true },
  });

/**
 * 결제가 오지 않은 선점을 정리한다. 슬롯 조회·관리자 목록에서 lazy 호출
 * (expireOverdueContracts 패턴). UPDATE들은 원자성이 필요 없다 — 겹침 검사가
 * 어차피 900초 지난 pending을 무시하므로, 이 정리는 표시용 상태 정합일 뿐이다.
 *
 * 만료 창은 타입마다 다르다. 세션은 슬롯을 잡아 두므로 PENDING_HOLD_SECONDS(900초)에
 * 풀어야 하지만, 믹싱은 잡아 둔 자원이 없고 토스 웹훅 재시도가 도착할 창을 열어 둬야 해서
 * MIXING_PENDING_TTL_SECONDS(24시간)를 쓴다 — 왜 그런지는 validation.ts의 상수 주석에.
 *
 * orders UPDATE에 type 조건이 붙은 것도 의도다. 예전엔 조건 없이 900초 지난 **모든** pending
 * 주문을 expired로 바꿔서, 무통장 입금 기한이 며칠인 펀딩 주문(lib/funding/service.ts의
 * expireStalePledges가 hold_expires_at으로 따로 관리한다)까지 예약 슬롯 조회 한 번에
 * 15분 만에 죽였다. 이 함수는 예약·믹싱 주문만 책임진다.
 *
 * **계좌 입금 대기는 만료하지 않는다**(자동 취소 없음, lib/payments/bankDeposit.ts). 주문은 `awaiting_deposit`이라
 * 아래 orders UPDATE(`status = 'pending'`)에 애초에 걸리지 않고, 그 하위 행(bookings·work_orders는 `pending`인
 * 채다)은 `AWAITING_DEPOSIT_ORDER_IDS`로 뺀다 — 빼지 않으면 15분 뒤 예약만 cancelled가 돼 시간대가 풀린다.
 */
export const expireStaleOrders = async (now: Date): Promise<void> => {
  const db = getDb();
  const sessionCutoff = toEpoch(now) - PENDING_HOLD_SECONDS;
  const mixingCutoff = toEpoch(now) - MIXING_PENDING_TTL_SECONDS;
  // 한 번에 보낸다 — 세 문장을 따로 await하면 Turso 왕복이 3회다. 이 정리는 슬롯 조회와
  // 관리자 목록이 열릴 때마다 돌아서, 그 왕복이 곧 두 화면의 대기 시간이 된다.
  // 원자성이 필요해서가 아니라(위 주석) 왕복을 줄이려는 것이고, batch가 덤으로 원자성도 준다.
  await db.batch([
    db.run(sql`
      UPDATE bookings SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
      WHERE status = 'pending' AND created_at < ${sessionCutoff}
        AND order_id NOT IN ${AWAITING_DEPOSIT_ORDER_IDS}
    `),
    db.run(sql`
      UPDATE work_orders SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
      WHERE status = 'pending' AND created_at < ${mixingCutoff}
        AND order_id NOT IN ${AWAITING_DEPOSIT_ORDER_IDS}
    `),
    db.run(sql`
      UPDATE orders SET status = 'expired', updated_at = unixepoch()
      WHERE status = 'pending'
        AND ((type = 'session' AND created_at < ${sessionCutoff})
             OR (type = 'mixing' AND created_at < ${mixingCutoff}))
    `),
  ]);
};
