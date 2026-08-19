/** @jest-environment node */

/**
 * 서명 확정 쓰기를 실제 SQLite(in-memory)에서 돌려본다.
 *
 * 이 경로의 결함은 SQL이 실제로 어떻게 실행되는지에 달려 있어, 모킹으로는 잡히지 않는다.
 * 특히 "조건부 UPDATE가 0행"인 것은 트랜잭션 실패가 아니라서, batch로 묶어 두어도 앞선
 * 문장이 쓴 것은 그대로 커밋된다. 그 성질 때문에 계약 취소와 서명 제출이 겹치면 계약은
 * 그대로인데 서명행만 확정되고, 그 계약은 재발송해도 영원히 서명할 수 없게 된다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { and, eq, isNull } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { contractClauses, contracts, signatures } from '../../db/schema';
import { buildSignStatements } from './sign-transaction';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');

let client: Client;
let db: ReturnType<typeof drizzle<typeof schema>>;

const applyMigrations = async () => {
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const text = readFileSync(path.join(MIGRATIONS, file), 'utf-8');
    for (const statement of text.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
};

const seed = async (status: 'sent' | 'cancelled' | 'signed') => {
  await client.execute('DELETE FROM signatures');
  await client.execute('DELETE FROM contract_clauses');
  await client.execute('DELETE FROM contracts');

  const now = new Date();
  await db.insert(contracts).values({
    id: 'c1',
    title: '테스트 계약',
    customerName: '홍길동',
    customerEmail: 'a@studionol.co.kr',
    customerPhone: '010-1234-5678',
    roomNumber: '302',
    startDate: now,
    endDate: now,
    monthlyRent: 300000,
    depositAmount: 300000,
    content: '본문',
    status,
    signToken: 'tok_test',
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(signatures).values({
    id: 's1',
    contractId: 'c1',
    signerRole: 'customer',
    signerName: '홍길동',
    signerEmail: 'a@studionol.co.kr',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(contractClauses).values({
    id: 'cl1',
    contractId: 'c1',
    clauseNumber: '제5조',
    title: '보증금',
    createdAt: now,
  });
};

const runSign = async () => {
  const [signatureResult, , , contractResult] = await db.batch(
    buildSignStatements(db, {
      contractId: 'c1',
      signatureId: 's1',
      now: new Date(),
      signatureData: 'data:image/png;base64,AAAA',
      ipAddress: '203.0.113.9',
      userAgent: 'jest',
      contentHash: 'v3:test',
      customerBirthdate: '1990-01-02',
      customerAddress: '서울시 은평구 대조동',
      content: '# 서명 시점에 완성된 계약 본문',
    }),
  );

  return {
    signatureRows: signatureResult.rowsAffected,
    contractRows: contractResult.rowsAffected,
    // 호출부(sign.ts)가 409를 돌려주는 조건과 같다.
    rejected: signatureResult.rowsAffected === 0 || contractResult.rowsAffected === 0,
  };
};

const readState = async () => ({
  signature: await db.query.signatures.findFirst({ where: eq(signatures.id, 's1') }),
  contract: await db.query.contracts.findFirst({ where: eq(contracts.id, 'c1') }),
  clause: await db.query.contractClauses.findFirst({ where: eq(contractClauses.id, 'cl1') }),
});

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  db = drizzle(client, { schema });
  await applyMigrations();
});

afterAll(() => {
  client.close();
});

describe('서명 확정 트랜잭션', () => {
  it('서명 대기 중인 계약은 계약·서명·동의가 함께 확정된다', async () => {
    await seed('sent');
    const result = await runSign();
    const state = await readState();

    expect(result.rejected).toBe(false);
    expect(state.contract?.status).toBe('signed');
    expect(state.signature?.status).toBe('signed');
    expect(state.signature?.ipAddress).toBe('203.0.113.9');
    expect(state.clause?.agreedAt).not.toBeNull();
    expect(state.contract?.contentHash).toBe('v3:test');
    // 서명자가 채운 정보와 그것으로 완성한 본문이 함께 확정된다.
    expect(state.contract?.customerBirthdate).toBe('1990-01-02');
    expect(state.contract?.customerAddress).toBe('서울시 은평구 대조동');
    expect(state.contract?.content).toBe('# 서명 시점에 완성된 계약 본문');
  });

  /**
   * 관리자가 계약을 취소한 직후 고객의 서명이 도착하는 상황. 앞단 검사(checkAction)를
   * 통과한 뒤 취소가 반영되면 여기까지 온다.
   */
  it('취소된 계약에는 서명행도 동의도 남지 않는다', async () => {
    await seed('cancelled');
    const result = await runSign();
    const state = await readState();

    expect(result.rejected).toBe(true);
    expect(state.signature?.status).toBe('pending');
    expect(state.signature?.signatureData).toBeNull();
    expect(state.clause?.agreedAt).toBeNull();
    expect(state.contract?.status).toBe('cancelled');
  });

  it('이미 서명된 계약에 다시 들어와도 기록을 덮어쓰지 않는다', async () => {
    await seed('sent');
    await runSign();
    const first = await readState();

    // 같은 요청이 한 번 더 도착한 상황 — 서명행은 이미 signed다.
    const second = await runSign();
    const after = await readState();

    expect(second.rejected).toBe(true);
    expect(after.signature?.signedAt?.getTime()).toBe(first.signature?.signedAt?.getTime());
    expect(after.contract?.signedAt?.getTime()).toBe(first.contract?.signedAt?.getTime());
  });

  it('동의 시각은 최초 서명 때만 남는다', async () => {
    await seed('sent');
    await runSign();
    const first = await readState();

    await db
      .update(contracts)
      .set({ status: 'sent' })
      .where(eq(contracts.id, 'c1'));
    await runSign();
    const after = await readState();

    expect(after.clause?.agreedAt?.getTime()).toBe(first.clause?.agreedAt?.getTime());
    expect(
      await db.query.contractClauses.findFirst({
        where: and(eq(contractClauses.contractId, 'c1'), isNull(contractClauses.agreedAt)),
      }),
    ).toBeUndefined();
  });
});
