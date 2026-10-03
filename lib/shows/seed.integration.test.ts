/** @jest-environment node */
import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { showTicketTypes, showTickets, showtimes, shows, showZones, orders } from '../../db/schema';
import { bakkeojiShow } from '../../data/shows/bakkeoji-anneun-maeumdeul';
import { SHOW_DEFINITIONS } from '../../data/shows';
import { eq } from 'drizzle-orm';
import { seedShow, ShowSeedError, validateShowDefinition, type ShowDefinition } from './seed';
import { parsePerformers, splitShowTitle, parseDescriptionParagraphs } from './content';
import { salesCloseAt } from './time';

describe('공연 정의(bakkeoji)', () => {
  it('정의가 유효하고 등록부에 있다', () => {
    expect(validateShowDefinition(bakkeojiShow)).toEqual([]);
    expect(SHOW_DEFINITIONS).toContain(bakkeojiShow);
  });

  it('핵심 값: 정원 50, 사전예매 25,000원, quota 없음, 초대 0', () => {
    expect(bakkeojiShow.zones).toEqual([{ code: 'GA', label: '비지정석', capacity: 50 }]);
    expect(bakkeojiShow.ticketTypes).toHaveLength(1);
    expect(bakkeojiShow.ticketTypes[0]).toMatchObject({ price: 25000, quota: null, compQuota: 0, zoneCode: 'GA' });
    expect(bakkeojiShow.ticketTypes[0].name).toContain('1드링크');
  });

  it('시작은 2026-10-24 18:30 KST, 판매마감은 당일 00:00 KST', () => {
    const { startsAt } = bakkeojiShow.showtimes[0];
    expect(startsAt.toISOString()).toBe('2026-10-24T09:30:00.000Z');
    expect(salesCloseAt(startsAt).toISOString()).toBe('2026-10-23T15:00:00.000Z');
  });

  it('텍스트 규칙: 부제·출연진 3명·문단', () => {
    expect(splitShowTitle(bakkeojiShow.title)).toEqual({ main: '베어지지 않는 마음들', subtitle: '풍천리를 위한 삼청동에서의 밤' });
    const p = parsePerformers(bakkeojiShow.performers);
    expect(p.map((x) => x.name)).toEqual(['자이(Jai)', '호와호(Howaho)', '솔가(Solga)']);
    expect(p.every((x) => x.bio && x.bio.length > 10)).toBe(true);
    const paras = parseDescriptionParagraphs(bakkeojiShow.description);
    expect(paras.some((x) => x.startsWith('시간: PM 6시 식사'))).toBe(true);
    expect(paras.some((x) => x.includes('뮤지션들과 공간에게'))).toBe(true);
  });
});

describe('seedShow', () => {
  let db: ShowsTestDb;
  beforeEach(async () => {
    db = (await createTestDb()).db;
  });

  it('dry-run은 아무것도 쓰지 않는다', async () => {
    const r = await seedShow(db, bakkeojiShow, { apply: false });
    expect(r.created).toBe(true);
    expect(r.applied).toBe(false);
    expect(r.actions.length).toBeGreaterThan(0);
    expect(await db.select().from(shows)).toHaveLength(0);
  });

  it('apply는 draft 공연·구역·회차·티켓타입을 만들고 값이 정의와 같다', async () => {
    const r = await seedShow(db, bakkeojiShow, { apply: true });
    expect(r.applied).toBe(true);
    const [show] = await db.select().from(shows);
    expect(show.status).toBe('draft');
    expect(show.slug).toBe('bakkeoji-anneun-maeumdeul');
    const [zone] = await db.select().from(showZones);
    expect(zone.capacity).toBe(50);
    const [st] = await db.select().from(showtimes);
    expect(st.startsAt).toBe(Math.floor(Date.parse('2026-10-24T18:30:00+09:00') / 1000));
    expect(st.salesCloseAt).toBe(Math.floor(Date.parse('2026-10-24T00:00:00+09:00') / 1000));
    const [tt] = await db.select().from(showTicketTypes);
    expect(tt).toMatchObject({ price: 25000, quota: null, compQuota: 0, zoneId: zone.id });
  });

  it('두 번 돌려도 같다(멱등) — 두 번째는 변경 없음, 행 수·id 불변', async () => {
    await seedShow(db, bakkeojiShow, { apply: true });
    const before = await db.select().from(shows);
    const r2 = await seedShow(db, bakkeojiShow, { apply: true });
    expect(r2.actions).toEqual([]);
    expect(r2.applied).toBe(false);
    const after = await db.select().from(shows);
    expect(after).toEqual(before);
    expect(await db.select().from(showZones)).toHaveLength(1);
    expect(await db.select().from(showtimes)).toHaveLength(1);
    expect(await db.select().from(showTicketTypes)).toHaveLength(1);
  });

  it('메타를 고치면 갱신하되 status·id는 보존한다', async () => {
    await seedShow(db, bakkeojiShow, { apply: true });
    await db.update(shows).set({ status: 'published' }).where(eq(shows.slug, bakkeojiShow.slug));
    const before = (await db.select().from(shows))[0];
    const r = await seedShow(db, { ...bakkeojiShow, venueAddress: '서울 종로구 삼청동 1' }, { apply: true });
    expect(r.created).toBe(false);
    expect(r.actions.join()).toContain('venueAddress');
    const after = (await db.select().from(shows))[0];
    expect(after.id).toBe(before.id);
    expect(after.status).toBe('published');
    expect(after.venueAddress).toBe('서울 종로구 삼청동 1');
  });

  it('정원 변경은 반영하되 잡힌 좌석 밑으로는 낮출 수 없다', async () => {
    await seedShow(db, bakkeojiShow, { apply: true });
    await seedShow(db, { ...bakkeojiShow, zones: [{ code: 'GA', label: '비지정석', capacity: 60 }] }, { apply: true });
    expect((await db.select().from(showZones))[0].capacity).toBe(60);

    const [st] = await db.select().from(showtimes);
    const [tt] = await db.select().from(showTicketTypes);
    await db.insert(orders).values({ id: 'o1', orderNo: 'TKT-20261001-AAAAAAAA', type: 'ticket', status: 'paid', customerName: 'a', customerPhone: '', customerEmail: '', itemAmount: 1, vatAmount: 0, totalAmount: 1, manageToken: 't' } as never);
    for (let i = 0; i < 3; i++) {
      await db.insert(showTickets).values({ orderNo: 'TKT-20261001-AAAAAAAA', showtimeId: st.id, ticketTypeId: tt.id, code: `C${i}`, status: 'issued', unitAmount: 25000 });
    }
    await expect(seedShow(db, { ...bakkeojiShow, zones: [{ code: 'GA', label: '비지정석', capacity: 2 }] }, { apply: true })).rejects.toThrow(ShowSeedError);
    expect((await db.select().from(showZones))[0].capacity).toBe(60);
  });

  it('팔린 티켓타입의 가격 변경은 막는다(새 티어를 추가하라)', async () => {
    await seedShow(db, bakkeojiShow, { apply: true });
    const [st] = await db.select().from(showtimes);
    const [tt] = await db.select().from(showTicketTypes);
    await db.insert(orders).values({ id: 'o1', orderNo: 'TKT-20261001-AAAAAAAA', type: 'ticket', status: 'paid', customerName: 'a', customerPhone: '', customerEmail: '', itemAmount: 1, vatAmount: 0, totalAmount: 1, manageToken: 't' } as never);
    await db.insert(showTickets).values({ orderNo: 'TKT-20261001-AAAAAAAA', showtimeId: st.id, ticketTypeId: tt.id, code: 'X1', status: 'issued', unitAmount: 25000 });
    const changed: ShowDefinition = { ...bakkeojiShow, ticketTypes: [{ ...bakkeojiShow.ticketTypes[0], price: 30000 }] };
    await expect(seedShow(db, changed, { apply: true })).rejects.toThrow(/가격/);
    expect((await db.select().from(showTicketTypes))[0].price).toBe(25000);
  });

  it('예약어 slug·잘못된 정의는 거부한다', async () => {
    await expect(seedShow(db, { ...bakkeojiShow, slug: 'scan' }, { apply: true })).rejects.toThrow(/예약어/);
    await expect(seedShow(db, { ...bakkeojiShow, zones: [{ code: 'GA', label: 'x', capacity: 0 }] }, { apply: true })).rejects.toThrow(ShowSeedError);
    expect(await db.select().from(shows)).toHaveLength(0);
  });
});
