/** @jest-environment node */

/**
 * 서명 후처리(finalize)가 보관 PDF를 덮어쓰지 않는지 실제 SQLite(in-memory)로 확인한다.
 *
 * "완료 메일 재발송"도 이 함수를 부른다. 예전엔 매번 PDF를 새로 그려 같은 경로에 덮어써(allowOverwrite)
 * 서명 당시 발급한 보관본이 재발송 시점의 렌더로 바뀌었다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { contracts } from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./pdf', () => ({ generateContractPdf: jest.fn() }));
jest.mock('./email', () => ({
  sendContractSignedEmail: jest.fn(),
  sendOperatorContractNotification: jest.fn(),
}));
jest.mock('@vercel/blob', () => ({ get: jest.fn(), put: jest.fn() }));

// eslint-disable-next-line import/first
import { get, put } from '@vercel/blob';
// eslint-disable-next-line import/first
import { sendContractSignedEmail, sendOperatorContractNotification } from './email';
// eslint-disable-next-line import/first
import { finalizeSignedContract } from './finalize';
// eslint-disable-next-line import/first
import { generateContractPdf } from './pdf';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const STORED_URL = 'https://blob.example/contracts/c1.pdf';
const STORED_PDF = Buffer.from('%PDF-stored-at-signing');
const RENDERED_PDF = Buffer.from('%PDF-rendered-now');

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});

afterAll(() => client.close());

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await client.execute('DELETE FROM contracts');
  (generateContractPdf as jest.Mock).mockResolvedValue(RENDERED_PDF);
  (put as jest.Mock).mockResolvedValue({ url: 'https://blob.example/contracts/c1.pdf?new' });
  (sendContractSignedEmail as jest.Mock).mockResolvedValue({ ok: true });
  (sendOperatorContractNotification as jest.Mock).mockResolvedValue({ ok: true });
});

const insertSigned = async (pdfUrl: string | null) => {
  const pdfGeneratedAt = pdfUrl ? new Date('2026-09-01T00:00:00Z') : null;
  await mockDb.insert(contracts).values({
    id: 'c1',
    title: '계약',
    customerName: '홍길동',
    customerEmail: 'a@studionol.co.kr',
    customerPhone: '010-1234-5678',
    roomNumber: '302',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-03-01T00:00:00Z'),
    monthlyRent: 300000,
    depositAmount: 300000,
    content: '본문',
    status: 'signed',
    signedAt: new Date('2026-09-01T00:00:00Z'),
    signToken: 'tok',
    pdfUrl,
    pdfGeneratedAt,
    createdAt: new Date('2026-08-30T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
  });
};

const readContract = async () => mockDb.query.contracts.findFirst({ where: eq(contracts.id, 'c1') });
const attachedPdf = () => (sendContractSignedEmail as jest.Mock).mock.calls[0][1] as Buffer | undefined;

it('보관본이 있으면 그대로 첨부하고 다시 그리지도 올리지도 않는다 (완료 메일 재발송)', async () => {
  await insertSigned(STORED_URL);
  (get as jest.Mock).mockResolvedValue({ stream: new Response(STORED_PDF).body });

  await finalizeSignedContract('c1');

  expect(get).toHaveBeenCalledWith(STORED_URL, { access: 'private' });
  expect(generateContractPdf).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
  expect(attachedPdf()?.equals(STORED_PDF)).toBe(true);

  const after = await readContract();
  expect(after?.pdfUrl).toBe(STORED_URL);
  expect(after?.pdfGeneratedAt?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  expect(after?.notifiedAt).not.toBeNull();
  expect(after?.notificationError).toBeNull();
});

it('보관본이 없으면 그려서 올리고 pdfUrl을 기록한다 (서명 직후)', async () => {
  await insertSigned(null);

  await finalizeSignedContract('c1');

  expect(generateContractPdf).toHaveBeenCalledTimes(1);
  expect(put).toHaveBeenCalledTimes(1);
  expect(attachedPdf()?.equals(RENDERED_PDF)).toBe(true);
  expect((await readContract())?.pdfUrl).toBe('https://blob.example/contracts/c1.pdf?new');
});

it('보관본을 읽지 못하면 메일 첨부만 새로 그리고 보관본은 덮어쓰지 않는다', async () => {
  await insertSigned(STORED_URL);
  (get as jest.Mock).mockRejectedValue(new Error('blob: 503'));

  await finalizeSignedContract('c1');

  expect(put).not.toHaveBeenCalled();
  expect(attachedPdf()?.equals(RENDERED_PDF)).toBe(true);
  expect((await readContract())?.pdfUrl).toBe(STORED_URL);
});

it('운영자 알림만 실패하면 그 사실만 남는다', async () => {
  await insertSigned(STORED_URL);
  (get as jest.Mock).mockResolvedValue({ stream: new Response(STORED_PDF).body });
  (sendOperatorContractNotification as jest.Mock).mockResolvedValue({ ok: false, errorCode: 'RATE_LIMIT' });

  await finalizeSignedContract('c1');

  expect((await readContract())?.notificationError).toBe('운영자 알림 메일 발송 실패 (RATE_LIMIT)');
});
