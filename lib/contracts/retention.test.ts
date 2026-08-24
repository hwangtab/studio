/** @jest-environment node */

/**
 * 개인정보 파기 로직을 실제 SQLite(in-memory)에서 검증한다.
 *
 * 이 코드는 시스템에서 가장 파괴적인 경로다 — 한 번 파기하면 이름·연락처·PDF·서명이
 * 모두 사라지고 28일 백업으로만 복구된다. 그런데 오래 테스트가 0건이었다.
 *
 * 핵심 불변식: 파기 기산점은 "이용이 끝난 날"(계약서 제12조 ④ "계약 종료 후 3년")이지
 * 계약서에 적힌 종료일이 아니다. 자동 갱신(제3조)으로 종료일이 지나도 이용 중일 수 있어,
 * 이용 중인 계약을 파기하면 안 된다. 모킹으로는 COALESCE·상태 필터가 실제로 어떻게 도는지
 * 알 수 없어 실 DB로 확인한다.
 */

const del = jest.fn().mockResolvedValue(undefined);
jest.mock('@vercel/blob', () => ({ del: (...args: unknown[]) => del(...args) }));

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { contracts, signatures } from '../../db/schema';
import type { ContractStatus } from './status';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { purgeExpiredPersonalData, getRetentionBoundary } from './retention';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// 파기 판정의 기준 시각. boundary = NOW - 3년 = 2023-08-24.
const NOW = new Date('2026-08-24T18:00:00.000Z');

const addContract = async (opts: {
  id: string;
  status: ContractStatus;
  end: string;
  created?: string;
  terminatedAt?: string | null;
  pdfUrl?: string | null;
}) => {
  await mockDb.insert(contracts).values({
    id: opts.id,
    title: `홍길동 ${opts.id}`,
    customerName: '홍길동',
    customerBirthdate: '1990-01-02',
    customerEmail: 'a@studionol.co.kr',
    customerPhone: '010-1234-5678',
    customerAddress: '서울시 은평구',
    roomNumber: '302',
    startDate: d('2020-01-01'),
    endDate: d(opts.end),
    monthlyRent: 300000,
    depositAmount: 300000,
    content: '이름 홍길동, 연락처 010-1234-5678',
    terminationReason: opts.status === 'terminated' ? '중도 퇴실, 010 통화 합의' : null,
    status: opts.status,
    terminatedAt: opts.terminatedAt ? d(opts.terminatedAt) : null,
    pdfUrl: opts.pdfUrl === undefined ? 'https://blob/x.pdf' : opts.pdfUrl,
    signToken: `tok_${opts.id}`,
    createdAt: opts.created ? d(opts.created) : d('2020-01-01'),
    updatedAt: d('2020-01-01'),
  });
  await mockDb.insert(signatures).values({
    id: `sig_${opts.id}`,
    contractId: opts.id,
    signerRole: 'customer',
    signerName: '홍길동',
    signerEmail: 'a@studionol.co.kr',
    signatureData: 'data:image/png;base64,AAAA',
    ipAddress: '1.2.3.4',
    userAgent: 'UA',
    status: 'signed',
    createdAt: d('2020-01-01'),
    updatedAt: d('2020-01-01'),
  });
};

const rowOf = async (id: string) =>
  (await mockDb.select().from(contracts).where(eq(contracts.id, id)))[0];
const sigOf = async (id: string) =>
  (await mockDb.select().from(signatures).where(eq(signatures.contractId, id)))[0];

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split(
      '--> statement-breakpoint',
    )) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});

beforeEach(async () => {
  jest.clearAllMocks();
  await client.execute('DELETE FROM signatures');
  await client.execute('DELETE FROM contracts');
});

afterAll(() => client.close());

describe('파기 대상 판정', () => {
  it('종료일이 3년 지난 terminated 계약을 파기한다', async () => {
    await addContract({ id: 'old', status: 'terminated', end: '2022-01-01', terminatedAt: '2022-01-01' });
    const r = await purgeExpiredPersonalData(NOW);

    expect(r).toEqual({ purged: 1, failed: 0 });
    const row = await rowOf('old');
    expect(row.customerName).toBe('(개인정보 파기됨)');
    expect(row.customerBirthdate).toBeNull();
    expect(row.customerAddress).toBeNull();
    expect(row.terminationReason).toBe('(개인정보 파기됨)');
    expect(row.content).toBe('(개인정보 파기됨)');
    expect(row.purgedAt).not.toBeNull();
    // 운영 기록으로 남기는 값은 보존
    expect(row.roomNumber).toBe('302');
    expect(row.monthlyRent).toBe(300000);
    const sig = await sigOf('old');
    expect(sig.signatureData).toBeNull();
    expect(sig.ipAddress).toBeNull();
    expect(del).toHaveBeenCalledWith('https://blob/x.pdf');
  });

  /**
   * 이번 수정의 핵심. 자동 갱신으로 종료일이 4년 전이어도, 종료 처리가 없는 signed 계약은
   * 지금 이용 중일 수 있다. 파기하면 청구·통지가 불가능해진다.
   */
  it('종료일이 오래 지났어도 signed(미종료) 계약은 파기하지 않는다', async () => {
    await addContract({ id: 'active', status: 'signed', end: '2022-01-01', terminatedAt: null });
    const r = await purgeExpiredPersonalData(NOW);

    expect(r).toEqual({ purged: 0, failed: 0 });
    const row = await rowOf('active');
    expect(row.customerName).toBe('홍길동');
    expect(row.purgedAt).toBeNull();
    expect(del).not.toHaveBeenCalled();
  });

  /**
   * 기산점은 terminatedAt이다. 종료일이 5년 전이어도 최근에 종료 처리했다면 아직 3년이
   * 안 됐다 — 12조가 약속한 보관 기간을 지켜야 한다.
   */
  it('종료일은 오래됐지만 최근 종료 처리한 계약은 보관한다', async () => {
    await addContract({
      id: 'recent-term',
      status: 'terminated',
      end: '2021-01-01',
      terminatedAt: '2025-06-01', // NOW-3년(2023-08-24)보다 뒤
    });
    const r = await purgeExpiredPersonalData(NOW);

    expect(r.purged).toBe(0);
    expect((await rowOf('recent-term')).customerName).toBe('홍길동');
  });

  it('종료 처리가 3년을 넘겼으면 파기한다', async () => {
    await addContract({
      id: 'term-old',
      status: 'terminated',
      end: '2021-01-01',
      terminatedAt: '2022-06-01', // boundary보다 앞
    });
    const r = await purgeExpiredPersonalData(NOW);
    expect(r.purged).toBe(1);
  });

  it('expired·cancelled도 종료일 3년이 지나면 파기한다', async () => {
    await addContract({ id: 'exp', status: 'expired', end: '2022-01-01' });
    await addContract({ id: 'can', status: 'cancelled', end: '2022-01-01' });
    const r = await purgeExpiredPersonalData(NOW);
    expect(r.purged).toBe(2);
  });

  it('draft·sent는 종료일이 지나도 파기하지 않는다', async () => {
    await addContract({ id: 'dft', status: 'draft', end: '2022-01-01' });
    await addContract({ id: 'snt', status: 'sent', end: '2022-01-01' });
    const r = await purgeExpiredPersonalData(NOW);
    expect(r.purged).toBe(0);
  });

  it('아직 3년이 안 지난 계약은 보관한다', async () => {
    await addContract({ id: 'young', status: 'terminated', end: '2025-01-01', terminatedAt: '2025-01-01' });
    const r = await purgeExpiredPersonalData(NOW);
    expect(r.purged).toBe(0);
  });

  it('createdAt이 3년 안이면(연도 오기입 등) 파기하지 않는다', async () => {
    // 종료일은 2010년이지만 실제로는 올해 만든 기록
    await addContract({
      id: 'backdated',
      status: 'terminated',
      end: '2010-01-01',
      terminatedAt: '2010-01-01',
      created: '2026-08-01',
    });
    const r = await purgeExpiredPersonalData(NOW);
    expect(r.purged).toBe(0);
  });

  it('이미 파기된 계약은 다시 파기하지 않는다', async () => {
    await addContract({ id: 'exp', status: 'expired', end: '2022-01-01' });
    await purgeExpiredPersonalData(NOW);
    del.mockClear();
    const r = await purgeExpiredPersonalData(NOW);
    expect(r.purged).toBe(0);
    expect(del).not.toHaveBeenCalled();
  });
});

describe('파기 실행 안전성', () => {
  it('PDF 삭제가 실패하면 표식을 남기지 않고 다음 회차에 재시도한다', async () => {
    await addContract({ id: 'exp', status: 'expired', end: '2022-01-01' });
    del.mockRejectedValueOnce(new Error('blob down'));

    const r = await purgeExpiredPersonalData(NOW);
    expect(r).toEqual({ purged: 0, failed: 1 });
    // 표식이 안 찍혔으므로 데이터는 그대로
    expect((await rowOf('exp')).customerName).toBe('홍길동');
    expect((await rowOf('exp')).purgedAt).toBeNull();
  });

  it('pdfUrl이 없으면 Blob 삭제를 건너뛰고 파기한다', async () => {
    await addContract({ id: 'nopdf', status: 'expired', end: '2022-01-01', pdfUrl: null });
    const r = await purgeExpiredPersonalData(NOW);
    expect(r.purged).toBe(1);
    expect(del).not.toHaveBeenCalled();
  });
});

describe('getRetentionBoundary', () => {
  it('NOW로부터 3년 전이다', () => {
    expect(getRetentionBoundary(new Date('2026-08-24T00:00:00Z')).toISOString()).toBe(
      '2023-08-24T00:00:00.000Z',
    );
  });
});
