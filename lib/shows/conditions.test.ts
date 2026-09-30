/** @jest-environment node */

import { sql } from 'drizzle-orm';
import { createTestDb, rowsAffectedOf } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';
import {
  zoneCapacityCondition,
  ticketTypeQuotaCondition,
  showtimeSalesWindowCondition,
  liveShowtimeCondition,
} from './conditions';

type TestDb = Awaited<ReturnType<typeof createTestDb>>['db'];

const DAY = 86400;

interface SeedOverrides {
  capacity?: number;
  quota?: number | null;
  startsAt?: number;
  salesCloseAt?: number;
  showtimeStatus?: 'scheduled' | 'cancelled' | 'ended';
}

/** show 1개 + zone 1개(capacity 지정) + showtime 1개 + ticket_type 1개(quota 지정)를 만든다. */
async function seedShow(db: TestDb, overrides: SeedOverrides = {}) {
  const showId = 'show-1';
  const nowSec = Math.floor(Date.now() / 1000);
  const startsAt = overrides.startsAt ?? nowSec + DAY * 10;
  const salesCloseAt = overrides.salesCloseAt ?? startsAt - DAY;

  await db.insert(shows).values({
    id: showId,
    slug: 's1',
    title: 't',
    presenterName: 'p',
    performers: 'a',
    ageRating: '전체',
    runningMinutes: 60,
    venueName: 'v',
    venueAddress: 'addr',
    description: 'd',
    status: 'published',
  });
  await db.insert(showZones).values({
    id: 'zone-1',
    showId,
    code: 'A',
    label: 'A구역',
    capacity: overrides.capacity ?? 2,
  });
  const showtimeId = 'showtime-1';
  await db.insert(showtimes).values({
    id: showtimeId,
    showId,
    startsAt,
    salesCloseAt,
    status: overrides.showtimeStatus ?? 'scheduled',
  });
  await db.insert(showTicketTypes).values({
    id: 'type-1',
    showId,
    zoneId: 'zone-1',
    name: '일반',
    price: 10000,
    quota: overrides.quota === undefined ? 2 : overrides.quota,
  });
  return { showId, showtimeId };
}

/**
 * orders 행 하나를 만든다(NOT NULL 컬럼 전부 채움).
 *
 * `id`는 drizzle 스키마의 `$defaultFn`이지만 그건 drizzle 쿼리빌더 경유일 때만 동작한다 —
 * 여기처럼 raw `sql` INSERT를 쓰면 SQLite 테이블 자체에는 DEFAULT가 없어 값을 직접 줘야 한다.
 */
async function insertOrder(db: TestDb, orderNo: string, status: 'pending' | 'paid' = 'pending') {
  await db.run(sql`
    insert into orders (id, order_no, type, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, status, manage_token)
    values (${`id-${orderNo}`}, ${orderNo}, 'ticket', '홍길동', '010-0000-0000', 'a@example.com', 10000, 0, 10000, ${status}, ${`tok-${orderNo}`})
  `);
}

/** show_orders + show_tickets 한 장을 issued 상태로 채워 넣는다(정원/쿼터 소진용). */
async function issueTicket(db: TestDb, orderNo: string, showtimeId: string, ticketId: string, code: string) {
  await insertOrder(db, orderNo, 'paid');
  await db.run(sql`insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact) values (${orderNo}, ${showtimeId}, 'x', '010')`);
  await db.run(sql`
    insert into show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, unit_amount)
    values (${ticketId}, ${orderNo}, ${showtimeId}, 'type-1', ${code}, 'issued', 10000)
  `);
}

describe('zoneCapacityCondition', () => {
  it('정원이 남으면 INSERT가 성공한다', async () => {
    const { db } = await createTestDb();
    const { showtimeId } = await seedShow(db, { capacity: 2 });
    const now = new Date();
    await insertOrder(db, 'TKT-1');
    const result = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-1', ${showtimeId}, '홍길동', '010-0000-0000'
      where ${zoneCapacityCondition(showtimeId, 'zone-1', 1, now)}
    `);
    expect(rowsAffectedOf(result)).toBe(1);
  });

  it('정원이 다 찼으면 INSERT가 0행이다', async () => {
    const { db } = await createTestDb();
    const { showtimeId } = await seedShow(db, { capacity: 2 });
    const now = new Date();
    // zone capacity=2, 이미 2장 issued로 채운다
    await issueTicket(db, 'TKT-0', showtimeId, 't1', 'SNT1:AAAAAAAAAAAAAAAA');
    await db.run(sql`insert into show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, unit_amount) values ('t2','TKT-0',${showtimeId},'type-1','SNT1:BBBBBBBBBBBBBBBB','issued',10000)`);

    await insertOrder(db, 'TKT-1');
    const result = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-1', ${showtimeId}, '홍길동', '010-0000-0000'
      where ${zoneCapacityCondition(showtimeId, 'zone-1', 1, now)}
    `);
    expect(rowsAffectedOf(result)).toBe(0);
  });

  it('만료된 hold는 정원 집계에서 빠진다', async () => {
    const { db } = await createTestDb();
    const { showtimeId } = await seedShow(db, { capacity: 1 });
    const now = new Date();
    const pastEpoch = Math.floor(now.getTime() / 1000) - 60;

    // 1장짜리 구역에 만료된 held 주문 하나를 만든다 — 정원을 먹지 않아야 한다.
    await insertOrder(db, 'TKT-HELD');
    await db.run(sql`insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact, hold_expires_at) values ('TKT-HELD', ${showtimeId}, 'x', '010', ${pastEpoch})`);
    await db.run(sql`insert into show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, unit_amount) values ('t-held','TKT-HELD',${showtimeId},'type-1','SNT1:CCCCCCCCCCCCCCCC','held',10000)`);

    await insertOrder(db, 'TKT-2');
    const result = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-2', ${showtimeId}, '홍길동', '010-0000-0000'
      where ${zoneCapacityCondition(showtimeId, 'zone-1', 1, now)}
    `);
    expect(rowsAffectedOf(result)).toBe(1);
  });

  it('같은 구역이라도 다른 회차의 판매분은 정원을 깎지 않는다 — 회차별 정원 격리', async () => {
    const { db } = await createTestDb();
    // capacity=1짜리 구역 하나를 공유하는 회차 두 개(금·토)를 만든다.
    const showId = 'show-1';
    const nowSec = Math.floor(Date.now() / 1000);
    await db.insert(shows).values({
      id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체',
      runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published',
    });
    await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A구역', capacity: 1 });
    const showtimeAId = 'showtime-fri';
    const showtimeBId = 'showtime-sat';
    await db.insert(showtimes).values([
      { id: showtimeAId, showId, startsAt: nowSec + DAY * 10, salesCloseAt: nowSec + DAY * 9 },
      { id: showtimeBId, showId, startsAt: nowSec + DAY * 11, salesCloseAt: nowSec + DAY * 10 },
    ]);
    await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000, quota: null });

    const now = new Date();
    // 금요일 회차(A)의 구역 정원 1을 다 채운다.
    await issueTicket(db, 'TKT-FRI', showtimeAId, 't-fri', 'SNT1:DDDDDDDDDDDDDDDD');

    // 토요일 회차(B)는 아직 아무도 안 샀다 — A가 매진이어도 B는 그대로 여유가 있어야 한다.
    await insertOrder(db, 'TKT-SAT');
    const result = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-SAT', ${showtimeBId}, '홍길동', '010-0000-0000'
      where ${zoneCapacityCondition(showtimeBId, 'zone-1', 1, now)}
    `);
    expect(rowsAffectedOf(result)).toBe(1);

    // 반대로 A는 여전히 매진 상태여야 한다(회차별 격리가 양방향으로 성립하는지 확인).
    await insertOrder(db, 'TKT-FRI-2');
    const friResult = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-FRI-2', ${showtimeAId}, '홍길동', '010-0000-0000'
      where ${zoneCapacityCondition(showtimeAId, 'zone-1', 1, now)}
    `);
    expect(rowsAffectedOf(friResult)).toBe(0);
  });
});

describe('ticketTypeQuotaCondition', () => {
  it('쿼터가 남으면 참(INSERT 성공)', async () => {
    const { db } = await createTestDb();
    const { showtimeId } = await seedShow(db, { quota: 2 });
    const now = new Date();
    await insertOrder(db, 'TKT-1');
    const result = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-1', ${showtimeId}, '홍길동', '010-0000-0000'
      where ${ticketTypeQuotaCondition(showtimeId, 'type-1', 1, now)}
    `);
    expect(rowsAffectedOf(result)).toBe(1);
  });

  it('쿼터가 소진되면 거짓(INSERT 0행)', async () => {
    const { db } = await createTestDb();
    const { showtimeId } = await seedShow(db, { quota: 1 });
    const now = new Date();
    await issueTicket(db, 'TKT-0', showtimeId, 't1', 'SNT1:AAAAAAAAAAAAAAAA');

    await insertOrder(db, 'TKT-1');
    const result = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-1', ${showtimeId}, '홍길동', '010-0000-0000'
      where ${ticketTypeQuotaCondition(showtimeId, 'type-1', 1, now)}
    `);
    expect(rowsAffectedOf(result)).toBe(0);
  });

  it('quota가 null이면(무제한) 언제나 참', async () => {
    const { db } = await createTestDb();
    const { showtimeId } = await seedShow(db, { quota: null });
    const now = new Date();
    await insertOrder(db, 'TKT-1');
    const result = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-1', ${showtimeId}, '홍길동', '010-0000-0000'
      where ${ticketTypeQuotaCondition(showtimeId, 'type-1', 100, now)}
    `);
    expect(rowsAffectedOf(result)).toBe(1);
  });

  it('같은 티켓타입이라도 다른 회차의 판매분은 쿼터를 깎지 않는다 — 회차별 쿼터 격리', async () => {
    const { db } = await createTestDb();
    const showId = 'show-1';
    const nowSec = Math.floor(Date.now() / 1000);
    await db.insert(shows).values({
      id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체',
      runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published',
    });
    await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A구역', capacity: 100 });
    const showtimeAId = 'showtime-fri';
    const showtimeBId = 'showtime-sat';
    await db.insert(showtimes).values([
      { id: showtimeAId, showId, startsAt: nowSec + DAY * 10, salesCloseAt: nowSec + DAY * 9 },
      { id: showtimeBId, showId, startsAt: nowSec + DAY * 11, salesCloseAt: nowSec + DAY * 10 },
    ]);
    // quota=1인 한정 티켓타입 하나를 두 회차가 공유한다.
    await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '한정', price: 10000, quota: 1 });

    const now = new Date();
    await issueTicket(db, 'TKT-FRI', showtimeAId, 't-fri', 'SNT1:EEEEEEEEEEEEEEEE');

    await insertOrder(db, 'TKT-SAT');
    const result = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-SAT', ${showtimeBId}, '홍길동', '010-0000-0000'
      where ${ticketTypeQuotaCondition(showtimeBId, 'type-1', 1, now)}
    `);
    expect(rowsAffectedOf(result)).toBe(1);

    await insertOrder(db, 'TKT-FRI-2');
    const friResult = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-FRI-2', ${showtimeAId}, '홍길동', '010-0000-0000'
      where ${ticketTypeQuotaCondition(showtimeAId, 'type-1', 1, now)}
    `);
    expect(rowsAffectedOf(friResult)).toBe(0);
  });
});

// drizzle의 `db.get(sql...)`은 결과가 0행이면 undefined를 매핑하지 못하고 던진다
// (LibSQLPreparedQuery.mapGetResult → normalizeRow가 빈 결과에서 TypeError).
// 그래서 "행이 없다"를 확인해야 하는 이 조건들은 `db.all(sql...)`로 rows 배열 길이를 본다.
describe('showtimeSalesWindowCondition', () => {
  it('판매마감 전이면(scheduled) 결과 행이 나온다', async () => {
    const { db } = await createTestDb();
    const nowSec = Math.floor(Date.now() / 1000);
    const { showtimeId } = await seedShow(db, { startsAt: nowSec + DAY * 10, salesCloseAt: nowSec + DAY });
    const rows = await db.all(sql`select 1 as x where ${showtimeSalesWindowCondition(showtimeId, new Date())}`);
    expect(rows).toEqual([{ x: 1 }]);
  });

  it('판매마감이 지났으면 결과가 없다', async () => {
    const { db } = await createTestDb();
    const nowSec = Math.floor(Date.now() / 1000);
    // showtimes.starts_at은 미래로 두되(스키마 제약 없음) sales_close_at만 과거로 만든다.
    const { showtimeId } = await seedShow(db, { startsAt: nowSec + DAY * 10, salesCloseAt: nowSec - DAY });
    const rows = await db.all(sql`select 1 as x where ${showtimeSalesWindowCondition(showtimeId, new Date())}`);
    expect(rows).toEqual([]);
  });

  it('회차가 cancelled면 판매마감 전이어도 결과가 없다', async () => {
    const { db } = await createTestDb();
    const nowSec = Math.floor(Date.now() / 1000);
    const { showtimeId } = await seedShow(db, {
      startsAt: nowSec + DAY * 10,
      salesCloseAt: nowSec + DAY,
      showtimeStatus: 'cancelled',
    });
    const rows = await db.all(sql`select 1 as x where ${showtimeSalesWindowCondition(showtimeId, new Date())}`);
    expect(rows).toEqual([]);
  });
});

describe('liveShowtimeCondition', () => {
  it('아직 시작 전이면 결과 행이 나온다', async () => {
    const { db } = await createTestDb();
    const nowSec = Math.floor(Date.now() / 1000);
    const { showtimeId } = await seedShow(db, { startsAt: nowSec + DAY * 10, salesCloseAt: nowSec + DAY });
    const rows = await db.all(sql`select 1 as x where ${liveShowtimeCondition(showtimeId, new Date())}`);
    expect(rows).toEqual([{ x: 1 }]);
  });

  it('이미 시작 시각이 지났으면 결과가 없다', async () => {
    const { db } = await createTestDb();
    const nowSec = Math.floor(Date.now() / 1000);
    const { showtimeId } = await seedShow(db, { startsAt: nowSec - DAY, salesCloseAt: nowSec - DAY * 2 });
    const rows = await db.all(sql`select 1 as x where ${liveShowtimeCondition(showtimeId, new Date())}`);
    expect(rows).toEqual([]);
  });

  it('회차가 취소됐으면 아직 시작 전이어도 결과가 없다', async () => {
    const { db } = await createTestDb();
    const nowSec = Math.floor(Date.now() / 1000);
    const { showtimeId } = await seedShow(db, {
      startsAt: nowSec + DAY * 10,
      salesCloseAt: nowSec + DAY,
      showtimeStatus: 'cancelled',
    });
    const rows = await db.all(sql`select 1 as x where ${liveShowtimeCondition(showtimeId, new Date())}`);
    expect(rows).toEqual([]);
  });
});
