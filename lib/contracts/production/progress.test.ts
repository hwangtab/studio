/** @jest-environment node */

/**
 * 진행 기록 → 장부 → 기한 크론 → 의뢰인 진행 API를 실제 SQLite(in-memory)에서 돌린다. 메일은 결과만 흉내 낸다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextApiRequest, NextApiResponse } from 'next';

import * as schema from '../../../db/schema';

let client: Client;
let mockDb: ReturnType<typeof drizzle<typeof schema>>;
const mockSendEmail = jest.fn().mockResolvedValue({ ok: true });

jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../email/resend', () => ({ sendEmail: (...args: unknown[]) => mockSendEmail(...args) }));
jest.mock('@vercel/functions', () => ({ waitUntil: (promise: Promise<unknown>) => promise }));
jest.mock('../admin-rate-limit', () => ({
  getDownloadIdentityVerdict: jest.fn().mockResolvedValue('ok'),
  reserveDownloadIdentityAttempt: jest.fn().mockResolvedValue('ok'),
  resetDownloadIdentityAttempts: jest.fn().mockResolvedValue(undefined),
  resetIdentityAttempts: jest.fn().mockResolvedValue(undefined),
}));

import progressHandler from '../../../pages/api/contracts/production/[id]/progress';
import { createProductionContract, sendProductionContract } from './service';
import { loadProgressContext, recordProgressEvent, runProductionDeadlines, sendEventNotice } from './progress';
import { buildDefaultProductionTerms } from './terms';
import type { EventInput } from './events';
import { findStage } from './ledger';

const kst = (local: string) => new Date(`${local}+09:00`);

const input = (overrides: Partial<EventInput> & Pick<EventInput, 'type'>): EventInput => ({
  stage: null,
  song: null,
  amount: null,
  occurredAt: new Date(),
  data: {},
  voidsEventId: null,
  ...overrides,
});
const admin = { actor: 'admin:kyungha', ip: null };

/** 체결된 계약 하나를 만든다(서명 API는 flow.test.ts가 본다 — 여기서는 상태만 맞춘다). */
const signedContract = async (
  signedAt: Date,
  release: { kind: 'single' | 'ep' | 'album'; songs: number } = { kind: 'single', songs: 1 },
): Promise<{ id: string; token: string }> => {
  const { id } = await createProductionContract({
    kind: release.kind,
    title: '테스트 계약',
    clientName: '홍길동',
    clientStageName: null,
    clientEmail: 'g@example.com',
    clientPhone: '010-1234-5678',
    guardian: null,
    terms: buildDefaultProductionTerms(release.kind, release.songs),
  });
  const sent = await sendProductionContract(id, { allowedStatuses: ['draft'], adminActor: 'kyungha', ipAddress: null, userAgent: 'jest' });
  const token = new URL(sent!.signUrls.client!).searchParams.get('token')!;
  await client.execute({
    sql: "UPDATE production_contracts SET status = 'signed', signed_at = ? WHERE id = ?",
    args: [Math.floor(signedAt.getTime() / 1000), id],
  });
  await client.execute({ sql: "UPDATE production_contract_signers SET status = 'signed' WHERE contract_id = ?", args: [id] });
  return { id, token };
};

const record = async (id: string, event: EventInput) => {
  const result = await recordProgressEvent(id, event, admin);
  if (!result.ok) throw new Error(result.message);
  await sendEventNotice(id, result.event.id);
  return result.event;
};

const callProgress = async (id: string, body: Record<string, unknown>, cookie = '') => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  const req = { method: 'POST', query: { id }, headers: { cookie }, socket: {}, body } as unknown as NextApiRequest;
  await progressHandler(req, res as unknown as NextApiResponse);
  const setCookie = res.setHeader.mock.calls.find(([name]) => name === 'Set-Cookie')?.[1] as string | undefined;
  return { status: res.status.mock.calls[0][0] as number, body: res.json.mock.calls[0][0], cookie: setCookie?.split(';')[0] ?? '' };
};

beforeAll(async () => {
  process.env.ADMIN_SESSION_SECRET = 'test-secret-test-secret-test-secret-123';
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  const dir = path.join(process.cwd(), 'drizzle/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(path.join(dir, file), 'utf-8').split('--> statement-breakpoint')) {
      if (statement.trim()) await client.execute(statement.trim());
    }
  }
});

afterAll(() => client.close());

beforeEach(async () => {
  mockSendEmail.mockReset().mockResolvedValue({ ok: true });
  await client.execute('DELETE FROM production_contract_events');
  await client.execute('DELETE FROM production_contract_signers');
  await client.execute('DELETE FROM production_contracts');
});

describe('진행 기록 쓰기', () => {
  it('순번을 1부터 매기고, 통지 결과를 기록에 남긴다', async () => {
    const { id } = await signedContract(new Date());
    await record(id, input({ type: 'payment_received', amount: 575_000 }));
    await record(id, input({ type: 'client_contacted', data: { note: '가사 요청' } }));
    const context = await loadProgressContext(id);
    expect(context!.events.map((e) => [e.seq, e.type, e.noticeStatus])).toEqual([
      [1, 'payment_received', 'sent'],
      [2, 'client_contacted', 'none'],
    ]);
  });

  it('결과물 전달 없이 승인·수정 요청을 기록할 수 없다', async () => {
    const { id } = await signedContract(new Date());
    const result = await recordProgressEvent(id, input({ type: 'stage_approved', stage: 'arrangement', data: { mode: 'proxy' } }), admin);
    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it('잔금 전에는 최종 파일 인도를 기록할 수 없다(제5조 6항)', async () => {
    const { id } = await signedContract(new Date());
    await record(id, input({ type: 'stage_delivered', stage: 'mastering' }));
    await record(id, input({ type: 'stage_approved', stage: 'mastering', data: { mode: 'proxy' } }));
    await record(id, input({ type: 'payment_received', amount: 575_000 }));
    const refused = await recordProgressEvent(id, input({ type: 'final_delivered' }), admin);
    expect(refused).toMatchObject({ ok: false, message: expect.stringContaining('제5조 6항') });

    await record(id, input({ type: 'payment_received', amount: 575_000 }));
    expect(await recordProgressEvent(id, input({ type: 'final_delivered' }), admin)).toMatchObject({ ok: true });
  });

  it('진행 중이 아닌 계약에는 기록하지 않는다', async () => {
    const { id } = await signedContract(new Date());
    await client.execute({ sql: "UPDATE production_contracts SET status = 'terminated' WHERE id = ?", args: [id] });
    expect(await recordProgressEvent(id, input({ type: 'kickoff' }), admin)).toMatchObject({ ok: false, status: 409 });
  });
});

describe('기한 크론', () => {
  it('통지가 나간 전달은 기한 다음 날 간주 승인을 기록하고, 다시 돌려도 한 번뿐이다', async () => {
    const { id } = await signedContract(kst('2026-11-02T10:00:00'));
    await record(id, input({ type: 'stage_delivered', stage: 'arrangement', occurredAt: kst('2026-11-10T09:00:00') }));

    // 기한 마지막 날(11/17)에는 아직이다.
    expect((await runProductionDeadlines(kst('2026-11-17T12:00:00'))).deemedApprovals).toBe(0);
    expect((await runProductionDeadlines(kst('2026-11-18T10:00:00'))).deemedApprovals).toBe(1);
    expect((await runProductionDeadlines(kst('2026-11-18T11:00:00'))).deemedApprovals).toBe(0);

    const context = await loadProgressContext(id, kst('2026-11-18T12:00:00'));
    const approval = context!.events.find((e) => e.type === 'stage_approved')!;
    expect(approval).toMatchObject({ actor: 'system', occurredAt: kst('2026-11-18T00:00:00'), noticeStatus: 'sent' });
    expect(findStage(context!.ledger, 'arrangement')!.approved).toMatchObject({ mode: 'deemed' });
  });

  it('전달 통지가 실패한 전달에는 간주 승인을 남기지 않고 운영자 할 일로 올린다', async () => {
    const { id } = await signedContract(kst('2026-11-02T10:00:00'));
    mockSendEmail.mockResolvedValueOnce({ ok: false, errorCode: 'UNDELIVERABLE_ADDRESS' });
    await record(id, input({ type: 'stage_delivered', stage: 'arrangement', occurredAt: kst('2026-11-10T09:00:00') }));

    const result = await runProductionDeadlines(kst('2026-11-20T10:00:00'));
    expect(result.deemedApprovals).toBe(0);
    expect(result.todoContracts[0].todos).toContainEqual(expect.objectContaining({ message: expect.stringContaining('통지') }));
  });

  it('간주 승인 이틀 전 안내는 한 번만 보낸다', async () => {
    const { id } = await signedContract(kst('2026-11-02T10:00:00'));
    await record(id, input({ type: 'stage_delivered', stage: 'mixing', occurredAt: kst('2026-11-10T09:00:00') }));
    mockSendEmail.mockClear();

    expect((await runProductionDeadlines(kst('2026-11-16T10:00:00'))).reminders).toBe(1);
    expect((await runProductionDeadlines(kst('2026-11-16T11:00:00'))).reminders).toBe(0);
    const subjects = mockSendEmail.mock.calls.map(([mail]) => (mail as { subject: string }).subject);
    expect(subjects.filter((s) => s.includes('확인 기한'))).toHaveLength(1);
  });
});

describe('의뢰인 진행 API', () => {
  it('연락처 뒷자리를 확인해야 승인할 수 있다', async () => {
    const { id, token } = await signedContract(new Date());
    const delivery = await record(id, input({ type: 'stage_delivered', stage: 'arrangement' }));

    const blocked = await callProgress(id, { action: 'approve', token, stage: 'arrangement', deliveryEventId: delivery.id });
    expect(blocked.status).toBe(401);

    const unlocked = await callProgress(id, { action: 'unlock', token, identityDigits: '5678' });
    expect(unlocked.status).toBe(200);
    expect(unlocked.cookie).toMatch(/^nol_pc_/);

    const approved = await callProgress(id, { action: 'approve', token, stage: 'arrangement', deliveryEventId: delivery.id }, unlocked.cookie);
    expect(approved.status).toBe(200);
    const context = await loadProgressContext(id);
    expect(findStage(context!.ledger, 'arrangement')!.approved).toMatchObject({ mode: 'explicit' });
    expect(context!.events.at(-1)).toMatchObject({ actor: 'client' });
  });

  it('화면을 연 뒤 새 결과물이 나갔으면 옛 버튼의 승인을 받지 않는다', async () => {
    const { id, token } = await signedContract(new Date());
    const first = await record(id, input({ type: 'stage_delivered', stage: 'mixing' }));
    await record(id, input({ type: 'revision_requested', stage: 'mixing', data: { note: '보컬 크게' } }));
    await record(id, input({ type: 'stage_delivered', stage: 'mixing' }));
    const { cookie } = await callProgress(id, { action: 'unlock', token, identityDigits: '5678' });

    const stale = await callProgress(id, { action: 'approve', token, stage: 'mixing', deliveryEventId: first.id }, cookie);
    expect(stale.status).toBe(409);
  });

  it('무료 횟수를 넘는 수정 요청은 추가 요금 동의를 받는다(제5조 3항)', async () => {
    const { id, token } = await signedContract(new Date());
    await record(id, input({ type: 'stage_delivered', stage: 'mastering' }));
    await record(id, input({ type: 'revision_requested', stage: 'mastering', data: { note: '1회차' } }));
    const second = await record(id, input({ type: 'stage_delivered', stage: 'mastering' }));
    const { cookie } = await callProgress(id, { action: 'unlock', token, identityDigits: '5678' });
    const body = { action: 'revision', token, stage: 'mastering', deliveryEventId: second.id, note: '저음 조금 더' };

    expect((await callProgress(id, body, cookie)).status).toBe(400);
    expect((await callProgress(id, { ...body, acceptFee: true }, cookie)).status).toBe(200);
    expect((await loadProgressContext(id))!.ledger.payments.revisionFees).toBe(30_000);
  });

  it('뒷자리가 틀리면 쿠키를 주지 않는다', async () => {
    const { id, token } = await signedContract(new Date());
    const result = await callProgress(id, { action: 'unlock', token, identityDigits: '0000' });
    expect(result.status).toBe(400);
    expect(result.cookie).toBe('');
  });
});

describe('해지 환불 계좌', () => {
  beforeAll(() => {
    process.env.FUNDING_FIELD_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  const terminatedWithRefund = async () => {
    const { id, token } = await signedContract(new Date());
    await record(id, input({ type: 'payment_received', amount: 575_000 }));
    await record(id, input({ type: 'kickoff' }));
    await client.execute({ sql: "UPDATE production_contracts SET status = 'terminated' WHERE id = ?", args: [id] });
    const { cookie } = await callProgress(id, { action: 'unlock', token, identityDigits: '5678' });
    return { id, token, cookie };
  };
  const account = { bankName: '카카오뱅크', accountNumber: '3333-01-1234567', accountHolder: '홍길동' };

  it('해지 계약에서 돌려받을 금액이 있으면 계좌를 받아 번호를 암호화해 둔다', async () => {
    const { id, token, cookie } = await terminatedWithRefund();
    const result = await callProgress(id, { action: 'refund-account', token, ...account }, cookie);
    expect(result.status).toBe(200);

    const row = (await client.execute({ sql: "SELECT * FROM refund_accounts WHERE order_kind = 'production' AND order_no = ?", args: [id] })).rows[0];
    expect(row.bank_name).toBe('카카오뱅크');
    expect(String(row.account_number_enc)).toMatch(/^v2:/);
    expect(String(row.account_number_enc)).not.toContain('1234567');
  });

  it('진행 중인 계약에서는 받지 않는다', async () => {
    const { id, token } = await signedContract(new Date());
    const { cookie } = await callProgress(id, { action: 'unlock', token, identityDigits: '5678' });
    expect((await callProgress(id, { action: 'refund-account', token, ...account }, cookie)).status).toBe(409);
  });

  it('본인 확인 쿠키가 없으면 받지 않는다', async () => {
    const { id, token } = await terminatedWithRefund();
    expect((await callProgress(id, { action: 'refund-account', token, ...account })).status).toBe(401);
  });
});

describe('EP — 곡마다 진행', () => {
  it('곡마다 결과물·승인을 따로 기록하고, 의뢰인은 그 곡의 전달에 답한다', async () => {
    const { id, token } = await signedContract(new Date(), { kind: 'ep', songs: 3 });
    const song0 = await record(id, input({ type: 'stage_delivered', stage: 'arrangement', song: 0 }));
    await record(id, input({ type: 'stage_delivered', stage: 'arrangement', song: 2 }));
    const { cookie } = await callProgress(id, { action: 'unlock', token, identityDigits: '5678' });

    expect((await callProgress(id, { action: 'approve', token, stage: 'arrangement', deliveryEventId: song0.id }, cookie)).status).toBe(200);
    const context = await loadProgressContext(id);
    expect(findStage(context!.ledger, 'arrangement', 0)?.approved).toMatchObject({ mode: 'explicit' });
    expect(findStage(context!.ledger, 'arrangement', 2)?.pending).not.toBeNull();
    expect(context!.events.at(-1)).toMatchObject({ type: 'stage_approved', song: 0 });
  });

  it('계약에 없는 곡 번호는 받지 않는다', async () => {
    const { id } = await signedContract(new Date(), { kind: 'ep', songs: 3 });
    const result = await recordProgressEvent(id, input({ type: 'stage_delivered', stage: 'mixing', song: 5 }), admin);
    expect(result).toMatchObject({ ok: false, message: '계약에 없는 곡입니다.' });
  });

  it('간주 승인도 곡마다 — 기한이 지난 곡만 기록한다', async () => {
    const { id } = await signedContract(kst('2026-11-02T10:00:00'), { kind: 'ep', songs: 2 });
    await record(id, input({ type: 'stage_delivered', stage: 'mixing', song: 0, occurredAt: kst('2026-11-10T09:00:00') }));
    await record(id, input({ type: 'stage_delivered', stage: 'mixing', song: 1, occurredAt: kst('2026-11-14T09:00:00') }));

    expect((await runProductionDeadlines(kst('2026-11-18T10:00:00'))).deemedApprovals).toBe(1);
    const ledger = (await loadProgressContext(id, kst('2026-11-18T12:00:00')))!.ledger;
    expect(findStage(ledger, 'mixing', 0)?.approved).toMatchObject({ mode: 'deemed' });
    expect(findStage(ledger, 'mixing', 1)?.approved).toBeNull();
  });
});
