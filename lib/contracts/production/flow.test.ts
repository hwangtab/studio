/** @jest-environment node */

/**
 * 제작 계약의 생성 → 발송(운영자 서명) → 의뢰인 서명을 실제 SQLite(in-memory)와 실제 API 핸들러로 돌린다.
 *
 * 이 경로의 결함은 SQL이 실제로 어떻게 실행되는지에 달려 있다(연습실 sign-transaction.test.ts와 같은 이유) —
 * 조건부 UPDATE가 0행인 것은 트랜잭션 실패가 아니라, 문장마다 조건이 맞물려 있는지를 실제로 실행해 봐야 안다.
 * 메일·PDF(finalize)와 시도 제한은 이 테스트의 관심 밖이라 막는다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextApiRequest, NextApiResponse } from 'next';

import * as schema from '../../../db/schema';

let client: Client;
let mockDb: ReturnType<typeof drizzle<typeof schema>>;

jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('@vercel/functions', () => ({ waitUntil: jest.fn() }));
jest.mock('./finalize', () => ({ finalizeSignedProductionContract: jest.fn() }));
jest.mock('../admin-rate-limit', () => ({
  checkIdentityAttempt: jest.fn().mockResolvedValue('ok'),
  resetIdentityAttempts: jest.fn().mockResolvedValue(undefined),
}));

// 위 mock이 걸린 뒤에 불러온다.
import signHandler from '../../../pages/api/contracts/production/[id]/sign';
import { verifyStoredProductionContract } from './audit';
import { cancelProductionContract, createProductionContract, sendProductionContract } from './service';
import { buildProductionSignStatements } from './sign-transaction';
import { buildDefaultProductionTerms } from './terms';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');

/** 서명 캔버스가 내보내는 것과 같은 구조의 PNG(signature-validation.test.ts와 같은 모양). */
const signaturePng = (): string => {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(300, 8);
  ihdr.writeUInt32BE(100, 12);
  ihdr[16] = 8;
  ihdr[17] = 6;
  const iend = Buffer.alloc(12);
  iend.write('IEND', 4, 'ascii');
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return `data:image/png;base64,${Buffer.concat([magic, ihdr, Buffer.alloc(800, 0x42), iend]).toString('base64')}`;
};

const PAYLOAD = {
  title: '홍길동님 음원 제작 용역 계약',
  clientName: '홍길동',
  clientStageName: '길동밴드',
  clientEmail: 'gildong@example.com',
  clientPhone: '010-1234-5678',
  terms: buildDefaultProductionTerms(),
};

const ALL_CLAUSES = ['revisions', 'rights', 'refund', 'portfolio', 'privacy'];

const callSign = async (contractId: string, body: Record<string, unknown>) => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  const req = {
    method: 'POST',
    query: { id: contractId },
    headers: { 'user-agent': 'jest', 'x-forwarded-for': '203.0.113.7' },
    socket: { remoteAddress: '203.0.113.7' },
    body: {
      signatureData: signaturePng(),
      agreements: ALL_CLAUSES,
      identityDigits: '5678',
      identityConfirmed: true,
      clientBirthdate: '1990-05-15',
      clientAddress: '서울시 은평구 대조동 1-1',
      ...body,
    },
  } as unknown as NextApiRequest;
  await signHandler(req, res as unknown as NextApiResponse);
  return { status: res.status.mock.calls[0]?.[0] as number, body: res.json.mock.calls[0]?.[0] as Record<string, unknown> };
};

const loadContract = (id: string) =>
  mockDb.query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, id), with: { signers: true } });

const clientToken = async (id: string): Promise<string> => {
  const contract = await loadContract(id);
  const token = contract?.signers.find((signer) => signer.role === 'client')?.signToken;
  if (!token) throw new Error('토큰이 없다');
  return token;
};

const sendAsOperator = (id: string, allowedStatuses: Parameters<typeof sendProductionContract>[1]['allowedStatuses'] = ['draft']) =>
  sendProductionContract(id, { allowedStatuses, adminActor: 'kyungha', ipAddress: '198.51.100.1', userAgent: 'admin' });

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (statement.trim()) await client.execute(statement.trim());
    }
  }
});

afterAll(() => client.close());

beforeEach(async () => {
  await client.execute('DELETE FROM production_contract_signers');
  await client.execute('DELETE FROM production_contracts');
});

describe('제작 계약 체결 흐름', () => {
  it('초안에는 서명 링크가 없다 — 운영자가 서명(발송)하기 전의 문서다', async () => {
    const contract = await createProductionContract(PAYLOAD);
    const loaded = await loadContract(contract.id);
    expect(loaded?.status).toBe('draft');
    expect(loaded?.signers.map((signer) => [signer.role, signer.status, signer.signToken])).toEqual(
      expect.arrayContaining([
        ['operator', 'pending', null],
        ['client', 'pending', null],
      ]),
    );
  });

  it('발송은 운영자 서명을 남기고 의뢰인 링크를 연다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    const sent = await sendAsOperator(id);
    expect(sent?.signUrl).toContain(`/ko/contracts/production/${id}/sign?token=`);

    const loaded = await loadContract(id);
    const operator = loaded?.signers.find((signer) => signer.role === 'operator');
    expect(loaded?.status).toBe('sent');
    expect(operator).toMatchObject({ status: 'signed', adminActor: 'kyungha', ipAddress: '198.51.100.1' });
  });

  it('같은 순간의 두 번째 발송은 아무것도 바꾸지 않는다 — 먼저 보낸 메일의 링크가 살아 있다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    const firstToken = await clientToken(id);
    expect(await sendAsOperator(id, ['sent', 'expired'])).toBeNull();
    expect(await clientToken(id)).toBe(firstToken);
  });

  it('의뢰인이 서명하면 체결되고, 저장된 지문이 다시 계산한 값과 맞는다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);

    const result = await callSign(id, { token: await clientToken(id) });
    expect(result).toEqual({ status: 200, body: { ok: true } });

    const loaded = await loadContract(id);
    expect(loaded?.status).toBe('signed');
    expect(loaded?.clientBirthdate).toBe('1990-05-15');
    expect(loaded?.content).toContain('서울시 은평구 대조동 1-1');
    expect(loaded?.contentHash).toMatch(/^p1:[0-9a-f]{64}$/);
    expect(loaded?.signers.find((signer) => signer.role === 'client')?.agreedClauses).toBe(JSON.stringify(ALL_CLAUSES));
    expect(verifyStoredProductionContract(loaded!)).toMatchObject({ kind: 'match' });
  });

  it('서명 뒤 금액을 바꾸면 지문 대조가 불일치로 드러난다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    await callSign(id, { token: await clientToken(id) });

    await client.execute({ sql: 'UPDATE production_contracts SET total_amount = 1 WHERE id = ?', args: [id] });
    expect(verifyStoredProductionContract((await loadContract(id))!)).toMatchObject({ kind: 'mismatch' });
  });

  it('재발송으로 바뀐 옛 링크로는 서명할 수 없다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    const oldToken = await clientToken(id);
    // 쿨다운을 지난 것처럼 발송 시각을 당겨 둔다.
    await client.execute({ sql: 'UPDATE production_contracts SET sent_at = sent_at - 60 WHERE id = ?', args: [id] });
    await sendAsOperator(id, ['sent', 'expired']);

    const result = await callSign(id, { token: oldToken });
    expect(result.status).toBe(404);
    expect((await loadContract(id))?.status).toBe('sent');
  });

  it('취소된 계약은 서명되지 않고 서명자 행도 그대로다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    const token = await clientToken(id);
    await cancelProductionContract(id);

    const result = await callSign(id, { token });
    expect(result.status).toBe(409);
    const loaded = await loadContract(id);
    expect(loaded?.status).toBe('cancelled');
    expect(loaded?.signers.find((signer) => signer.role === 'client')?.status).toBe('pending');
  });

  it('필수 동의 하나라도 빠지면 거부한다(서버에서 다시 확인)', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    const result = await callSign(id, { token: await clientToken(id), agreements: ALL_CLAUSES.slice(1) });
    expect(result.status).toBe(400);
    expect((await loadContract(id))?.status).toBe('sent');
  });

  it('연락처 뒷자리가 틀리면 거부한다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    const result = await callSign(id, { token: await clientToken(id), identityDigits: '0000' });
    expect(result.status).toBe(400);
  });

  it('만 19세 미만은 온라인으로 서명할 수 없다(법정대리인 서명은 아직 열지 않았다)', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    const thisYear = new Date().getFullYear();
    const result = await callSign(id, { token: await clientToken(id), clientBirthdate: `${thisYear - 15}-01-01` });
    expect(result.status).toBe(400);
    expect(result.body.errors).toEqual([expect.objectContaining({ field: 'clientBirthdate' })]);
  });

  it('운영자 서명이 없는 계약은 의뢰인 서명을 받지 않는다 — 양 당사자 서명으로 성립한다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    await client.execute({
      sql: "UPDATE production_contract_signers SET status = 'pending' WHERE contract_id = ? AND role = 'operator'",
      args: [id],
    });
    const result = await callSign(id, { token: await clientToken(id) });
    expect(result.status).toBe(409);
    expect((await loadContract(id))?.status).toBe('sent');
  });

  it('두 번째 서명 제출은 "이미 서명됨"으로 답한다 — 화면이 완료 페이지로 간다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    const token = await clientToken(id);
    await callSign(id, { token });
    const second = await callSign(id, { token });
    expect(second.status).toBe(409);
    expect(second.body.status).toBe('signed');
  });
});

/**
 * API의 상태 확인과 batch 사이에 취소·만료·재발송이 끼어든 경우. 위 흐름 테스트는 API 앞단의 확인에서
 * 걸러지므로, 여기서는 쓰기 문장 자체가 같은 조건에 걸려 있는지를 본다.
 */
describe('서명 쓰기 묶음의 조건', () => {
  const run = async (id: string, token: string) => {
    const contract = await loadContract(id);
    const signer = contract!.signers.find((s) => s.role === 'client')!;
    const [signerResult, contractResult] = await mockDb.batch(
      buildProductionSignStatements(mockDb, {
        contractId: id,
        signerId: signer.id,
        signToken: token,
        now: new Date(),
        signatureData: signaturePng(),
        ipAddress: null,
        userAgent: 'jest',
        agreedClauseKeys: ALL_CLAUSES,
        clientBirthdate: '1990-05-15',
        clientAddress: '주소',
        content: '본문',
        contentHash: 'p1:' + '0'.repeat(64),
      }),
    );
    return [signerResult.rowsAffected, contractResult.rowsAffected];
  };

  it('그 사이 취소됐으면 서명자 행도 계약도 그대로다 — 반쪽 상태를 남기지 않는다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    const token = await clientToken(id);
    await cancelProductionContract(id);
    expect(await run(id, token)).toEqual([0, 0]);
  });

  it('그 사이 만료됐으면 쓰지 않는다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    const token = await clientToken(id);
    await client.execute({ sql: 'UPDATE production_contracts SET expires_at = 1 WHERE id = ?', args: [id] });
    expect(await run(id, token)).toEqual([0, 0]);
  });

  it('그 사이 재발송돼 토큰이 바뀌었으면 쓰지 않는다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    const oldToken = await clientToken(id);
    await client.execute({ sql: 'UPDATE production_contracts SET sent_at = sent_at - 60 WHERE id = ?', args: [id] });
    await sendAsOperator(id, ['sent', 'expired']);
    expect(await run(id, oldToken)).toEqual([0, 0]);
  });

  it('정상이면 두 문장이 모두 쓴다', async () => {
    const { id } = await createProductionContract(PAYLOAD);
    await sendAsOperator(id);
    expect(await run(id, await clientToken(id))).toEqual([1, 1]);
  });
});
