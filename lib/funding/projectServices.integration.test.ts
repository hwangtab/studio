/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { FUNDING_DESIGN_PRICE } from '../../data/pricing';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import {
  isMissingServicesTable,
  loadProjectService,
  loadProjectServiceMap,
  setDesignFeePaid,
  setProjectService,
} from './projectServices';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

/** 마이그레이션을 순서대로 적용한다. skip에 든 파일은 건너뛴다 — "0037 미적용 운영 DB" 재현용. */
const migrate = async (skip: (file: string) => boolean = () => false) => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    if (skip(file)) continue;
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
};

afterEach(() => client.close());

/** 쓰기 감사 로그가 남기는 수행자. 서버 로그로만 남으므로 테스트 출력에서는 잠재운다. */
const ACTOR = 'kyungha';
let warnSpy: jest.SpyInstance;
beforeEach(() => { warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => warnSpy.mockRestore());

const seedProject = async (): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email: `c-${crypto.randomUUID()}@example.com`, name: '개설자' }).returning();
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    creatorId: creator.id,
    slug: `slug-${crypto.randomUUID()}`,
    title: '제목',
    summary: '요약',
    content: '본문',
    coverUrl: '/cover.webp',
    goalAmount: 1_000_000,
    startAt: new Date('2026-10-01T00:00:00Z'),
    endAt: new Date('2026-10-31T00:00:00Z'),
  }).returning();
  return project.id;
};

describe('스튜디오 서비스 (0037 적용된 DB)', () => {
  beforeEach(() => migrate());

  it('행이 없으면 직접 개설이다', async () => {
    const id = await seedProject();
    expect(await loadProjectService(id)).toEqual({ available: true, service: null });
  });

  it('처음 지정할 때 지금의 설계비를 약정가로 복사한다', async () => {
    const id = await seedProject();
    const r = await setProjectService(id, 'design', new Date('2026-09-26T00:00:00Z'), ACTOR);
    expect(r).toEqual({ ok: true, service: { kind: 'design', designFee: FUNDING_DESIGN_PRICE, designFeePaidAt: null } });
  });

  it('종류를 바꿔도 약정 설계비와 입금 시각은 그대로다', async () => {
    const id = await seedProject();
    await setProjectService(id, 'design', new Date('2026-09-26T00:00:00Z'), ACTOR);
    // 약정 뒤 정가가 바뀐 상황을 흉내 낸다 — 기존 행의 금액은 지켜져야 한다.
    await client.execute({ sql: 'UPDATE funding_project_services SET design_fee = ? WHERE project_id = ?', args: [400000, id] });
    const paidAt = new Date('2026-09-27T01:00:00Z');
    await setDesignFeePaid(id, true, paidAt, ACTOR);

    const r = await setProjectService(id, 'release', new Date('2026-09-28T00:00:00Z'), ACTOR);
    expect(r).toEqual({ ok: true, service: { kind: 'release', designFee: 400000, designFeePaidAt: paidAt.toISOString() } });
  });

  it('입금 확인을 켜고 끈다', async () => {
    const id = await seedProject();
    await setProjectService(id, 'design', new Date(), ACTOR);
    const on = await setDesignFeePaid(id, true, new Date('2026-09-27T00:00:00Z'), ACTOR);
    expect(on.ok && on.service?.designFeePaidAt).toBe('2026-09-27T00:00:00.000Z');
    const off = await setDesignFeePaid(id, false, new Date(), ACTOR);
    expect(off.ok && off.service?.designFeePaidAt).toBeNull();
  });

  /**
   * 예전에는 `none`이 행을 DELETE해서, 되돌렸다 재지정하는 왕복 한 번에 약정가가 그때의
   * 정가로 재발행되고 입금 확인 시각이 사라졌다 — 정가가 오른 뒤라면 이미 받은 돈이 화면에서
   * "미입금"이 되고 청구액이 올라간다. 그걸 드러내야 할 "현재 정가와 다름" 배지는 재발행값이
   * 정의상 현재 정가와 같아서 침묵한다.
   */
  it('직접 개설로 되돌려도 약정 설계비·입금 기록은 남는다', async () => {
    const id = await seedProject();
    await setProjectService(id, 'design', new Date(), ACTOR);
    await client.execute({ sql: 'UPDATE funding_project_services SET design_fee = ? WHERE project_id = ?', args: [400000, id] });
    const paidAt = new Date('2026-10-03T00:00:00Z');
    await setDesignFeePaid(id, true, paidAt, ACTOR);

    const reverted = await setProjectService(id, 'none', new Date(), ACTOR);
    expect(reverted).toEqual({ ok: true, service: { kind: 'none', designFee: 400000, designFeePaidAt: paidAt.toISOString() } });
    expect(await loadProjectService(id)).toEqual({
      available: true, service: { kind: 'none', designFee: 400000, designFeePaidAt: paidAt.toISOString() },
    });
  });

  it('none → design 왕복 뒤에도 최초 약정가와 입금 시각이 그대로다 — 정가로 재발행하지 않는다', async () => {
    const id = await seedProject();
    await setProjectService(id, 'design', new Date(), ACTOR);
    await client.execute({ sql: 'UPDATE funding_project_services SET design_fee = ? WHERE project_id = ?', args: [400000, id] });
    const paidAt = new Date('2026-10-03T00:00:00Z');
    await setDesignFeePaid(id, true, paidAt, ACTOR);

    await setProjectService(id, 'none', new Date(), ACTOR);
    const again = await setProjectService(id, 'design', new Date(), ACTOR);
    expect(again).toEqual({ ok: true, service: { kind: 'design', designFee: 400000, designFeePaidAt: paidAt.toISOString() } });
    expect(400000).not.toBe(FUNDING_DESIGN_PRICE);
  });

  it('행이 없는 프로젝트를 none으로 지정하면 아무것도 만들지 않는다', async () => {
    const id = await seedProject();
    expect(await setProjectService(id, 'none', new Date(), ACTOR)).toEqual({ ok: true, service: null });
    expect(await loadProjectService(id)).toEqual({ available: true, service: null });
  });

  /**
   * 시스템 밖의 돈을 사람이 눈으로 확인해 기록하는 자리라, 수행자가 어딘가에는 남아야 한다 —
   * 남는 것이 타임스탬프 하나뿐이면 통장 대사에서 그 돈이 안 보일 때 물을 데가 없다.
   * 새 컬럼을 만들지 않고 개설자 계정 변경과 같은 방식(서버 로그)을 쓴다.
   */
  it('종류 지정과 입금 확인이 수행자를 서버 로그에 남긴다', async () => {
    const id = await seedProject();
    await setProjectService(id, 'design', new Date('2026-09-26T00:00:00Z'), ACTOR);
    await setDesignFeePaid(id, true, new Date('2026-10-03T00:00:00Z'), ACTOR);
    await setDesignFeePaid(id, false, new Date('2026-10-04T00:00:00Z'), ACTOR);
    const logged = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(logged).toHaveLength(3);
    expect(logged.every((line) => line.includes(`actor=${ACTOR}`))).toBe(true);
    expect(logged[1]).toContain('설계비 입금 확인');
    expect(logged[2]).toContain('설계비 입금 확인 취소');
  });

  it('없는 프로젝트는 not_found, 서비스 없는 프로젝트의 입금 확인은 no_service', async () => {
    expect(await setProjectService('nope', 'design', new Date(), ACTOR)).toEqual({ ok: false, code: 'not_found' });
    const id = await seedProject();
    expect(await setDesignFeePaid(id, true, new Date(), ACTOR)).toEqual({ ok: false, code: 'no_service' });
  });

  it('목록용 맵은 서비스가 있는 프로젝트만 싣는다', async () => {
    const a = await seedProject();
    const b = await seedProject();
    await setProjectService(a, 'release', new Date(), ACTOR);
    const map = await loadProjectServiceMap();
    expect(map.available).toBe(true);
    if (map.available) {
      expect(Object.keys(map.byProjectId)).toEqual([a]);
      expect(map.byProjectId[b]).toBeUndefined();
    }
  });
});

describe('0037이 아직 적용되지 않은 운영 DB', () => {
  beforeEach(() => migrate((file) => file.startsWith('0037_')));

  it('읽기는 던지지 않고 available: false', async () => {
    const id = await seedProject();
    expect(await loadProjectService(id)).toEqual({ available: false, reason: 'missing_table' });
    expect(await loadProjectServiceMap()).toEqual({ available: false, reason: 'missing_table' });
  });

  it('쓰기는 unavailable을 돌려준다', async () => {
    const id = await seedProject();
    expect(await setProjectService(id, 'design', new Date(), ACTOR)).toEqual({ ok: false, code: 'unavailable' });
    expect(await setDesignFeePaid(id, true, new Date(), ACTOR)).toEqual({ ok: false, code: 'unavailable' });
  });

  it('funding_projects 조회는 영향이 없다 — 별도 테이블로 둔 이유', async () => {
    const id = await seedProject();
    const rows = await mockDb.select().from(schema.fundingProjects);
    expect(rows.map((r) => r.id)).toEqual([id]);
  });
});

describe('테이블 부재가 아닌 DB 장애', () => {
  beforeEach(() => migrate());

  it('읽기는 던지지 않고 reason: error로 좁힌다 — 심사 화면을 막지 않는다', async () => {
    const id = await seedProject();
    client.close();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadProjectService(id)).toEqual({ available: false, reason: 'error' });
    expect(await loadProjectServiceMap()).toEqual({ available: false, reason: 'error' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    await migrate(); // afterEach의 close 대상
  });
});

describe('isMissingServicesTable', () => {
  it('이 테이블의 부재만 잡고 다른 오류는 잡지 않는다', () => {
    expect(isMissingServicesTable(new Error('SQLITE_ERROR: no such table: funding_project_services'))).toBe(true);
    const wrapped = Object.assign(new Error('Failed query'), { cause: new Error('no such table: funding_project_services') });
    expect(isMissingServicesTable(wrapped)).toBe(true);
    expect(isMissingServicesTable(new Error('no such table: funding_projects'))).toBe(false);
    expect(isMissingServicesTable(new Error('SQLITE_BUSY'))).toBe(false);
  });
});
