/** @jest-environment node */

/**
 * 고유식별정보 접속기록을 실제 SQLite(in-memory)에서 검증한다.
 *
 * 지키려는 것은 셋이다.
 * 1. 조회하면 행이 남고, **그 행에 열람한 값이 들어 있지 않다.** 기록이 사본이 되면
 *    필드 암호화가 통째로 무의미해진다.
 * 2. 보존은 2년(「개인정보의 안전성 확보조치 기준」 제8조① 단서)이고, 펀딩 개인정보
 *    파기(1년·5년)와 **섞이지 않는다.**
 * 3. 기록이 실패해도 조회 자체는 살아 있어야 한다 — 다만 조용히는 아니다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { fundingPledges, orders, privacyAccessLogs } from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
let dbThrows = false;
jest.mock('../../db/client', () => ({
  getDb: () => {
    if (dbThrows) throw new Error('DB 장애');
    return mockDb;
  },
}));

// eslint-disable-next-line import/first
import {
  PRIVACY_ACCESS_LOG_RETENTION_YEARS,
  PRIVACY_ACTOR_ADMIN,
  purgeExpiredPrivacyAccessLogs,
  recordAdminPrivacyAccess,
  recordPrivacyAccess,
} from './accessLog';
// eslint-disable-next-line import/first
import { purgeExpiredFundingPersonalData } from '../funding/retention';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

/** 실제 번호가 아니라 형식만 같은 값이다. 기록에 새어 들지 않았는지 대조하는 용도다. */
const RESIDENT_NUMBER = '9901011234567';
const ACCOUNT_NUMBER = '123-456-789012';

const NOW = new Date('2026-09-23T00:00:00.000Z');
const rows = () => mockDb.select().from(privacyAccessLogs);

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
  dbThrows = false;
});

afterEach(() => {
  client.close();
  jest.restoreAllMocks();
});

describe('기록', () => {
  it('조회 한 번에 행이 하나 남는다 — 수행자·행위·대상·결과·IP·시각', async () => {
    await recordPrivacyAccess({
      actor: PRIVACY_ACTOR_ADMIN,
      action: 'funding_resident_number_view',
      targetId: 'proj-1',
      result: 'success',
      ip: '203.0.113.7',
      at: NOW,
    });

    const [row] = await rows();
    expect(row).toMatchObject({
      actor: 'admin',
      action: 'funding_resident_number_view',
      targetId: 'proj-1',
      result: 'success',
      ip: '203.0.113.7',
    });
    expect(row.at).toEqual(NOW);
    expect(row.id).toEqual(expect.any(String));
  });

  it('IP를 얻지 못하면 null로 남는다 — 지어내지 않는다', async () => {
    await recordAdminPrivacyAccess(
      { headers: {}, socket: {} },
      'funding_payout_account_view',
      'proj-2',
      'success',
    );
    const [row] = await rows();
    expect(row.ip).toBeNull();
    expect(row.actor).toBe(PRIVACY_ACTOR_ADMIN);
  });

  it('요청의 x-vercel-forwarded-for에서 IP를 뽑는다', async () => {
    await recordAdminPrivacyAccess(
      { headers: { 'x-vercel-forwarded-for': '198.51.100.9' }, socket: {} },
      'funding_resident_number_view',
      'proj-3',
      'success',
    );
    expect((await rows())[0].ip).toBe('198.51.100.9');
  });

  /** 실패를 안 남기면 "누가 무엇을 열려고 했는가"를 사후에 재구성할 수 없다. */
  it.each(['not_found', 'decrypt_failed', 'error'] as const)('실패한 조회도 %s로 남는다', async (result) => {
    await recordPrivacyAccess({
      actor: PRIVACY_ACTOR_ADMIN,
      action: 'funding_resident_number_view',
      targetId: 'proj-4',
      result,
      ip: null,
      at: NOW,
    });
    expect((await rows())[0].result).toBe(result);
  });

  /**
   * 이 표는 감사 대상이지 사본이 아니다. 열람한 값이 실려 들어갈 자리가 함수 시그니처에
   * 아예 없지만, 컬럼이 늘어날 때를 대비해 직렬화 결과로 한 번 더 못을 박는다.
   */
  it('행을 직렬화해도 주민등록번호·계좌번호가 없다', async () => {
    await recordPrivacyAccess({
      actor: PRIVACY_ACTOR_ADMIN,
      action: 'funding_resident_number_view',
      targetId: 'proj-5',
      result: 'success',
      ip: '203.0.113.7',
      at: NOW,
    });
    await recordPrivacyAccess({
      actor: PRIVACY_ACTOR_ADMIN,
      action: 'funding_payout_account_view',
      targetId: 'proj-5',
      result: 'success',
      ip: '203.0.113.7',
      at: NOW,
    });

    const serialized = JSON.stringify(await rows());
    expect(serialized).not.toContain(RESIDENT_NUMBER);
    expect(serialized).not.toContain('1234567');
    expect(serialized).not.toContain(ACCOUNT_NUMBER);
    expect(serialized).not.toContain('789012');
  });

  it('기록이 실패해도 던지지 않는다 — 다만 조용히 넘어가지도 않는다', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    dbThrows = true;

    await expect(
      recordPrivacyAccess({
        actor: PRIVACY_ACTOR_ADMIN,
        action: 'funding_resident_number_view',
        targetId: 'proj-6',
        result: 'success',
        ip: null,
      }),
    ).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('접속기록 저장 실패'), expect.anything());
  });
});

describe('보존 2년', () => {
  const seedAt = (id: string, at: Date) =>
    mockDb.insert(privacyAccessLogs).values({
      id,
      actor: PRIVACY_ACTOR_ADMIN,
      action: 'funding_resident_number_view',
      targetId: `t-${id}`,
      result: 'success',
      ip: null,
      at,
    });

  it('법이 정한 하한은 2년이다', () => {
    expect(PRIVACY_ACCESS_LOG_RETENTION_YEARS).toBe(2);
  });

  it('2년이 안 지난 기록은 남고, 지난 것만 지워진다', async () => {
    // 경계(2024-09-23)보다 하루 뒤·하루 앞.
    await seedAt('keep', new Date('2024-09-24T00:00:00.000Z'));
    await seedAt('drop', new Date('2024-09-22T00:00:00.000Z'));

    const result = await purgeExpiredPrivacyAccessLogs(NOW);

    expect(result.purged).toBe(1);
    expect((await rows()).map((r) => r.id)).toEqual(['keep']);
  });

  /**
   * 기준이 다르다. `purgeExpiredFundingPersonalData`는 배송지·응원 메시지를 1년(법정 보존
   * 5년 우선)으로 지운다 — 그 함수가 이 표까지 건드리면 접속기록이 법정 하한 전에 사라진다.
   */
  it('1년 기준 펀딩 파기 크론은 이 표를 건드리지 않는다', async () => {
    await seedAt('old', new Date('2020-01-01T00:00:00.000Z'));

    const [order] = await mockDb
      .insert(orders)
      .values({
        orderNo: 'SNB-TEST-000001',
        type: 'funding',
        customerName: '김후원',
        customerPhone: '010-1234-5678',
        customerEmail: 'a@example.com',
        itemAmount: 10000,
        vatAmount: 0,
        totalAmount: 10000,
        status: 'paid',
        manageToken: 'tok-1',
        createdAt: new Date('2019-01-01T00:00:00.000Z'),
      })
      .returning({ id: orders.id });
    await mockDb.insert(fundingPledges).values({
      orderId: order.id,
      projectSlug: 'demo',
      rewardId: 'cd',
      rewardTitle: 'CD',
      unitAmount: 10000,
      quantity: 1,
      paymentMethod: 'toss',
      holdExpiresAt: new Date('2019-01-01T00:00:00.000Z'),
      paidAt: new Date('2019-01-01T00:00:00.000Z'),
      deliveredAt: new Date('2019-06-01T00:00:00.000Z'),
      shippingName: '김후원',
      createdAt: new Date('2019-01-01T00:00:00.000Z'),
      updatedAt: new Date('2019-01-01T00:00:00.000Z'),
    });

    // 파기 대상이 실제로 있는 상태에서 돌린다 — 0건이라 안 지워진 것이 아니다.
    expect((await purgeExpiredFundingPersonalData(NOW)).purged).toBe(1);
    expect(await rows()).toHaveLength(1);
  });
});

/**
 * 목록 다운로드는 같은 대상이라도 그날 몇 사람분이 나갔는지가 매번 다르다. 그 숫자가
 * 실제 컬럼에 남는지, 그리고 **숫자 말고는 아무것도 늘지 않았는지**를 본다.
 */
describe('다운로드 건수', () => {
  it('내보낸 건수가 행에 남는다', async () => {
    await recordAdminPrivacyAccess(
      { headers: {}, socket: {} },
      'funding_pledge_export',
      'demo',
      'success',
      42,
    );
    const [row] = await rows();
    expect(row).toMatchObject({ action: 'funding_pledge_export', targetId: 'demo', rowCount: 42 });
  });

  it('한 건을 여는 조회에는 건수가 없다 — 0이 아니라 null이다', async () => {
    await recordAdminPrivacyAccess({ headers: {}, socket: {} }, 'funding_payout_account_view', 'proj-9', 'success');
    expect((await rows())[0].rowCount).toBeNull();
  });

  /** 건수만 담는다는 규칙을 행 자체로 못 박는다 — CSV에 실리는 값은 한 글자도 없다. */
  it('내보낸 행을 직렬화해도 이름·연락처가 없다', async () => {
    await recordPrivacyAccess({
      actor: PRIVACY_ACTOR_ADMIN,
      action: 'sales_ledger_export',
      targetId: '2026-09-01_2026-09-30',
      result: 'success',
      rowCount: 3,
      ip: '203.0.113.7',
      at: NOW,
    });
    const dump = JSON.stringify(await rows());
    expect(dump).not.toContain('김후원');
    expect(dump).not.toContain('010-1111-2222');
    expect(dump).toContain('"rowCount":3');
  });
});
