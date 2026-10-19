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
const mockBackground: Array<Promise<unknown>> = [];
jest.mock('@vercel/functions', () => ({
  waitUntil: (promise: Promise<unknown>) => {
    mockBackground.push(promise);
    return promise;
  },
}));
// 성립 후처리의 PDF는 크로미움이 필요하다 — 여기서는 실패로 두고(메일은 그대로 나간다) 성립 여부만 본다.
jest.mock('./pdf-storage', () => ({
  renderProductionPdf: jest.fn().mockRejectedValue(new Error('no chromium in jest')),
  uploadProductionPdf: jest.fn(),
}));
jest.mock('../admin-rate-limit', () => ({
  getDownloadIdentityVerdict: jest.fn().mockResolvedValue('ok'),
  reserveDownloadIdentityAttempt: jest.fn().mockResolvedValue('ok'),
  resetDownloadIdentityAttempts: jest.fn().mockResolvedValue(undefined),
  resetIdentityAttempts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true, actor: 'kyungha' }) }));

import progressHandler from '../../../pages/api/contracts/production/[id]/progress';
import adminContractHandler from '../../../pages/api/contracts/production/[id]';
import eventsHandler from '../../../pages/api/contracts/production/[id]/events';
import { createProductionContract, expireOverdueProductionContracts, sendProductionContract } from './service';
import { completeStalledProductionContract } from './finalize';
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

/** 기록하고 통지한다 — 통지는 그 일이 일어난 때 나간 것으로 본다(기한 계산이 실제 시계에 묶이지 않게). */
const record = async (id: string, event: EventInput) => {
  const result = await recordProgressEvent(id, event, admin);
  if (!result.ok) throw new Error(result.message);
  await sendEventNotice(id, result.event.id, event.occurredAt);
  return result.event;
};

/** 마스터링 앞 단계 — 모든 곡의 믹싱 승인(제2조 순서). */
const approveMixing = async (id: string) => {
  await record(id, input({ type: 'stage_delivered', stage: 'mixing' }));
  await record(id, input({ type: 'stage_approved', stage: 'mixing', data: { mode: 'proxy' } }));
};

const callAdmin = async (id: string, body: Record<string, unknown>) => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  const req = { method: 'PATCH', query: { id }, headers: {}, socket: {}, body } as unknown as NextApiRequest;
  await adminContractHandler(req, res as unknown as NextApiResponse);
  return { status: res.status.mock.calls[0][0] as number, body: res.json.mock.calls[0][0] };
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
    await approveMixing(id);
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
    await approveMixing(id);
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

  it('한 번 받은 계좌는 다시 받지 않는다 — 송금 완료 표시가 지워지지 않게', async () => {
    const { id, token, cookie } = await terminatedWithRefund();
    expect((await callProgress(id, { action: 'refund-account', token, ...account }, cookie)).status).toBe(200);
    await client.execute({ sql: "UPDATE refund_accounts SET refunded_at = unixepoch() WHERE order_no = ?", args: [id] });
    const again = await callProgress(id, { action: 'refund-account', token, ...account, accountHolder: '김철수' }, cookie);
    expect(again.status).toBe(409);
    const row = (await client.execute({ sql: 'SELECT account_holder, refunded_at FROM refund_accounts WHERE order_no = ?', args: [id] })).rows[0];
    expect(row.account_holder).toBe('홍길동');
    expect(row.refunded_at).not.toBeNull();
  });

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

describe('기한·순서·동시 기록(2026-10-18 점검)', () => {
  it('통지가 실패했다가 나중에 나가면 간주 승인 기한은 그날부터 센다', async () => {
    const { id } = await signedContract(kst('2026-11-02T10:00:00'));
    mockSendEmail.mockResolvedValueOnce({ ok: false, errorCode: 'UNDELIVERABLE_ADDRESS' });
    const delivery = await record(id, input({ type: 'stage_delivered', stage: 'arrangement', occurredAt: kst('2026-11-10T09:00:00') }));
    await sendEventNotice(id, delivery.id, kst('2026-11-20T10:00:00'));

    expect((await runProductionDeadlines(kst('2026-11-21T10:00:00'))).deemedApprovals).toBe(0);
    expect((await runProductionDeadlines(kst('2026-11-27T12:00:00'))).deemedApprovals).toBe(0);
    expect((await runProductionDeadlines(kst('2026-11-28T10:00:00'))).deemedApprovals).toBe(1);
  });

  it('간주 기한이 지난 뒤의 수정 요청은 받지 않는다(크론이 아직 돌지 않았어도)', async () => {
    const { id } = await signedContract(kst('2026-11-02T10:00:00'));
    await record(id, input({ type: 'stage_delivered', stage: 'arrangement', occurredAt: kst('2026-11-10T09:00:00') }));
    const late = await recordProgressEvent(
      id,
      input({ type: 'revision_requested', stage: 'arrangement', occurredAt: kst('2026-11-18T08:00:00'), data: { note: '늦은 요청' } }),
      admin,
    );
    expect(late).toMatchObject({ ok: false, message: expect.stringContaining('제5조 5항') });
    const inTime = await recordProgressEvent(
      id,
      input({ type: 'revision_requested', stage: 'arrangement', occurredAt: kst('2026-11-17T23:00:00'), data: { note: '기한 안' } }),
      admin,
    );
    expect(inTime.ok).toBe(true);
  });

  it('같은 결과물에 승인이 동시에 두 번 와도 하나만 남는다', async () => {
    const { id, token } = await signedContract(new Date());
    const delivery = await record(id, input({ type: 'stage_delivered', stage: 'mixing' }));
    const { cookie } = await callProgress(id, { action: 'unlock', token, identityDigits: '5678' });
    const body = { action: 'approve', token, stage: 'mixing', deliveryEventId: delivery.id };
    const results = await Promise.all([callProgress(id, body, cookie), callProgress(id, body, cookie)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const context = await loadProgressContext(id);
    expect(context!.events.filter((e) => e.type === 'stage_approved')).toHaveLength(1);
  });

  it('전달을 무효로 하면 그 전달의 승인도 효력을 잃고, 다시 전달할 수 있다', async () => {
    const { id } = await signedContract(new Date());
    const delivery = await record(id, input({ type: 'stage_delivered', stage: 'arrangement' }));
    await record(id, input({ type: 'stage_approved', stage: 'arrangement', data: { mode: 'proxy' } }));
    await record(id, input({ type: 'void', voidsEventId: delivery.id, data: { reason: '잘못 올린 파일' } }));

    const context = await loadProgressContext(id);
    expect(findStage(context!.ledger, 'arrangement')).toMatchObject({ deliveries: 0, approved: null });
    expect((await recordProgressEvent(id, input({ type: 'stage_delivered', stage: 'arrangement' }), admin)).ok).toBe(true);
  });

  it('믹싱이 승인되지 않은 곡이 있으면 마스터링을 전달할 수 없다', async () => {
    const { id } = await signedContract(new Date(), { kind: 'ep', songs: 2 });
    await record(id, input({ type: 'stage_delivered', stage: 'mixing', song: 0 }));
    await record(id, input({ type: 'stage_approved', stage: 'mixing', song: 0, data: { mode: 'proxy' } }));
    const refused = await recordProgressEvent(id, input({ type: 'stage_delivered', stage: 'mastering' }), admin);
    expect(refused).toMatchObject({ ok: false, message: expect.stringContaining('2번') });
  });

  it('작업 정지 끝은 시작보다 앞선 시각으로 기록할 수 없다', async () => {
    const { id } = await signedContract(new Date());
    const now = Date.now();
    await record(id, input({ type: 'pause_started', occurredAt: new Date(now - 60_000), data: { cause: 'client' } }));
    const refused = await recordProgressEvent(id, input({ type: 'pause_ended', occurredAt: new Date(now - 3 * 86_400_000) }), admin);
    expect(refused).toMatchObject({ ok: false, status: 409 });
  });
});

describe('서명 뒤 성립이 멈춘 계약', () => {
  it('서명자가 모두 서명했으면 만료로 내리지 않고, 화면을 열 때 마지막 서명 시각으로 성립시킨다', async () => {
    const { id } = await createProductionContract({
      kind: 'single',
      title: '멈춘 계약',
      clientName: '홍길동',
      clientStageName: null,
      clientEmail: 'g@example.com',
      clientPhone: '010-1234-5678',
      guardian: null,
      terms: buildDefaultProductionTerms('single', 1),
    });
    await sendProductionContract(id, { allowedStatuses: ['draft'], adminActor: 'kyungha', ipAddress: null, userAgent: 'jest' });
    const signedAt = kst('2026-10-17T15:00:00');
    await client.execute({
      sql: "UPDATE production_contract_signers SET status = 'signed', signed_at = ? WHERE contract_id = ?",
      args: [Math.floor(signedAt.getTime() / 1000), id],
    });
    await client.execute({ sql: 'UPDATE production_contracts SET expires_at = 1 WHERE id = ?', args: [id] });

    expect(await expireOverdueProductionContracts()).toBe(0);
    const contract = await mockDb.query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, id), with: { signers: true } });
    expect(await completeStalledProductionContract(contract!)).toBe(true);
    await Promise.allSettled(mockBackground.splice(0));

    const after = await mockDb.query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
    expect(after).toMatchObject({ status: 'signed', signedAt });
    expect(after!.contentHash).toBeTruthy();
  });
});

describe('두 번째 점검(2026-10-18)', () => {
  it('옛 결과물에 대한 승인은 그 사이 새 결과물이 나갔으면 받지 않는다', async () => {
    const { id } = await signedContract(new Date());
    const first = await record(id, input({ type: 'stage_delivered', stage: 'mixing' }));
    await record(id, input({ type: 'revision_requested', stage: 'mixing', data: { note: '보컬 크게' } }));
    await record(id, input({ type: 'stage_delivered', stage: 'mixing' }));
    const stale = await recordProgressEvent(
      id,
      input({ type: 'stage_approved', stage: 'mixing', data: { mode: 'explicit', deliveryEventId: first.id } }),
      { actor: 'client', ip: null },
    );
    expect(stale).toMatchObject({ ok: false, status: 409 });
    expect(findStage((await loadProgressContext(id))!.ledger, 'mixing')!.approved).toBeNull();
  });

  it('통지가 나가지 않은 결과물에는 간주 승인을 기록하지 않는다(크론이 읽은 뒤 바뀐 경우)', async () => {
    const { id } = await signedContract(kst('2026-11-02T10:00:00'));
    mockSendEmail.mockResolvedValueOnce({ ok: false, errorCode: 'UNDELIVERABLE_ADDRESS' });
    const delivery = await record(id, input({ type: 'stage_delivered', stage: 'arrangement', occurredAt: kst('2026-11-10T09:00:00') }));
    const deemed = await recordProgressEvent(
      id,
      input({ type: 'stage_approved', stage: 'arrangement', occurredAt: kst('2026-11-18T00:00:00'), data: { mode: 'deemed', deliveryEventId: delivery.id } }),
      { actor: 'system', ip: null },
    );
    expect(deemed).toMatchObject({ ok: false, status: 409 });
  });

  it('파기된 계약·만료된 계약은 성립을 잇지 않는다', async () => {
    const { id } = await createProductionContract({
      kind: 'single',
      title: '파기된 계약',
      clientName: '홍길동',
      clientStageName: null,
      clientEmail: 'g@example.com',
      clientPhone: '010-1234-5678',
      guardian: null,
      terms: buildDefaultProductionTerms('single', 1),
    });
    await sendProductionContract(id, { allowedStatuses: ['draft'], adminActor: 'kyungha', ipAddress: null, userAgent: 'jest' });
    await client.execute({ sql: "UPDATE production_contract_signers SET status = 'signed', signed_at = 1700000000 WHERE contract_id = ?", args: [id] });
    const load = () => mockDb.query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, id), with: { signers: true } });

    await client.execute({ sql: "UPDATE production_contracts SET status = 'expired' WHERE id = ?", args: [id] });
    expect(await completeStalledProductionContract((await load())!)).toBe(false);

    await client.execute({ sql: "UPDATE production_contracts SET status = 'sent', purged_at = unixepoch() WHERE id = ?", args: [id] });
    expect(await completeStalledProductionContract((await load())!)).toBe(false);
    expect((await load())!.status).toBe('sent');
  });

  it('해지한 계약은 잘못 넣은 기록의 무효 처리만 받는다', async () => {
    const { id } = await signedContract(new Date());
    await record(id, input({ type: 'payment_received', amount: 575_000 }));
    const wrong = await record(id, input({ type: 'kickoff' }));
    await client.execute({ sql: "UPDATE production_contracts SET status = 'terminated' WHERE id = ?", args: [id] });

    expect(await recordProgressEvent(id, input({ type: 'note', data: { note: 'x' } }), admin)).toMatchObject({ ok: false });
    expect(await recordProgressEvent(id, input({ type: 'void', voidsEventId: wrong.id, data: { reason: '착수 전이었다' } }), admin)).toMatchObject({ ok: true });
    expect((await loadProgressContext(id))!.ledger.refund.refundable).toBe(575_000);
  });

  it('완료일은 체결일·최종 인도일보다 앞설 수 없다', async () => {
    const { id } = await signedContract(kst('2026-10-01T10:00:00'));
    await client.execute({ sql: "INSERT INTO production_contract_events (id, contract_id, seq, type, occurred_at, recorded_at, actor) VALUES ('fd1', ?, 1, 'final_delivered', ?, ?, 'admin:kyungha')", args: [id, Math.floor(kst('2026-10-10T10:00:00').getTime() / 1000), Math.floor(Date.now() / 1000)] });

    expect((await callAdmin(id, { action: 'complete', closedOn: '2025-10-10' })).status).toBe(400);
    expect((await callAdmin(id, { action: 'complete', closedOn: '2026-10-05' })).status).toBe(400);
    expect((await callAdmin(id, { action: 'complete', closedOn: '2026-10-10' })).status).toBe(200);
  });

  it('파기된 계약에는 체결 메일을 다시 보내지 않는다', async () => {
    const { id } = await signedContract(new Date());
    await client.execute({ sql: "UPDATE production_contracts SET status = 'completed', purged_at = unixepoch() WHERE id = ?", args: [id] });
    expect((await callAdmin(id, { action: 'resend-signed' })).status).toBe(409);
  });
});

describe('해지 처리(2026-10-19)', () => {
  beforeAll(() => {
    process.env.FUNDING_FIELD_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  it('해지 사유 구분을 받아 사유에 적고, 의뢰인에게 환불액과 계좌 안내를 보낸다', async () => {
    const { id } = await signedContract(new Date());
    await record(id, input({ type: 'payment_received', amount: 575_000 }));
    expect((await callAdmin(id, { action: 'terminate', reason: '의뢰인 요청' })).status).toBe(400);

    mockSendEmail.mockClear();
    expect((await callAdmin(id, { action: 'terminate', cause: 'client', reason: '의뢰인 요청' })).status).toBe(200);
    await Promise.allSettled(mockBackground.splice(0));

    const contract = await mockDb.query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
    expect(contract).toMatchObject({ status: 'terminated', terminationReason: '[의뢰인 사정] 의뢰인 요청' });
    const mail = mockSendEmail.mock.calls.map(([arg]) => arg as { subject: string; text: string }).find((m) => m.subject.includes('해지'));
    expect(mail?.text).toContain('제10조 2항');
    expect(mail?.text).toContain('575,000원');
    expect(mail?.text).toContain('환불받을 계좌');
  });

  it('환불을 보낸 뒤에는 정산을 바꾸는 무효 처리를 받지 않는다', async () => {
    const { id } = await signedContract(new Date());
    const payment = await record(id, input({ type: 'payment_received', amount: 575_000 }));
    await client.execute({ sql: "UPDATE production_contracts SET status = 'terminated' WHERE id = ?", args: [id] });
    await client.execute({
      sql: "INSERT INTO refund_accounts (id, order_kind, order_no, bank_name, account_number_enc, account_holder, requested_at, refunded_at) VALUES ('ra1', 'production', ?, '카카오뱅크', 'v2:x', '홍길동', unixepoch(), unixepoch())",
      args: [id],
    });
    const res: Record<string, jest.Mock> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    const req = { method: 'POST', query: { id }, headers: {}, socket: {}, body: { action: 'void', eventId: payment.id, reason: '중복' } } as unknown as NextApiRequest;
    await eventsHandler(req, res as unknown as NextApiResponse);
    expect(res.status.mock.calls[0][0]).toBe(409);
  });
});

describe('네 번째 점검(2026-10-19)', () => {
  it('서명 전 계약의 진행 페이지는 열지 않는다 — 연락처 뒷자리를 맞혀 보는 창구가 되지 않게', async () => {
    const { id } = await createProductionContract({
      kind: 'single',
      title: '서명 전',
      clientName: '홍길동',
      clientStageName: null,
      clientEmail: 'g@example.com',
      clientPhone: '010-1234-5678',
      guardian: null,
      terms: buildDefaultProductionTerms('single', 1),
    });
    const sent = await sendProductionContract(id, { allowedStatuses: ['draft'], adminActor: 'kyungha', ipAddress: null, userAgent: 'jest' });
    const token = new URL(sent!.signUrls.client!).searchParams.get('token')!;
    const result = await callProgress(id, { action: 'unlock', token, identityDigits: '5678' });
    expect(result.status).toBe(409);
    expect(result.cookie).toBe('');
  });

  it('승인에는 메모를 남기지 않는다', async () => {
    const { id, token } = await signedContract(new Date());
    const delivery = await record(id, input({ type: 'stage_delivered', stage: 'mixing' }));
    const { cookie } = await callProgress(id, { action: 'unlock', token, identityDigits: '5678' });
    const result = await callProgress(id, { action: 'approve', token, stage: 'mixing', deliveryEventId: delivery.id, note: '보컬 크게(쓰다 취소한 글)' }, cookie);
    expect(result.status).toBe(200);
    const approval = (await loadProgressContext(id))!.events.find((e) => e.type === 'stage_approved')!;
    expect(JSON.parse(approval.dataJson!)).not.toHaveProperty('note');
  });

  it('해지 안내는 해지한 계약에만 다시 보내고, 해지한 계약에는 체결 메일을 다시 보내지 않는다', async () => {
    const { id } = await signedContract(new Date());
    expect((await callAdmin(id, { action: 'resend-termination' })).status).toBe(409);
    await callAdmin(id, { action: 'terminate', cause: 'studio', reason: '장비 고장' });
    await Promise.allSettled(mockBackground.splice(0));
    expect((await callAdmin(id, { action: 'resend-signed' })).status).toBe(409);
    expect((await callAdmin(id, { action: 'resend-termination' })).status).toBe(200);
    await Promise.allSettled(mockBackground.splice(0));
  });

  it('해지 안내가 실패하면 알림 오류만 남기고 체결 메일을 보낸 시각은 그대로 둔다', async () => {
    const { id } = await signedContract(new Date());
    await client.execute({ sql: 'UPDATE production_contracts SET notified_at = 1700000000 WHERE id = ?', args: [id] });
    mockSendEmail.mockResolvedValueOnce({ ok: false, errorCode: 'UNDELIVERABLE_ADDRESS' });
    await callAdmin(id, { action: 'terminate', cause: 'client', reason: '의뢰인 요청' });
    await Promise.allSettled(mockBackground.splice(0));
    const contract = await mockDb.query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
    expect(contract?.notificationError).toContain('해지 안내');
    expect(contract?.notifiedAt?.getTime()).toBe(1700000000 * 1000);
  });
});
