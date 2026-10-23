/** @jest-environment node */
/** 세션 연주자 보유 기간 — 마지막 확인 2년 파기, 1년 9개월 재확인 메일(한 기간 한 번), 월간 파기 크론 연결. */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextApiRequest, NextApiResponse } from 'next';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn() }));
jest.mock('../cron/auth', () => ({ isCronAuthorized: jest.fn().mockReturnValue(true) }));
jest.mock('../contracts/retention', () => ({
  RETENTION_YEARS: 3,
  purgeExpiredPersonalData: jest.fn().mockResolvedValue({ purged: 0, failed: 0 }),
}));
jest.mock('../contracts/production/retention', () => ({
  purgeExpiredProductionPersonalData: jest.fn().mockResolvedValue({ purged: 0, failed: 0 }),
}));
jest.mock('../tenancy/retention', () => ({
  purgeEndedTenancies: jest.fn().mockResolvedValue({ personalCleared: 0, recordsDeleted: 0 }),
}));

/* eslint-disable import/first */
import cronHandler from '../../pages/api/cron/purge-contracts';
import { sendEmail } from '../email/resend';
import { purgeExpiredPersonalData } from '../contracts/retention';
import { purgeEndedTenancies } from '../tenancy/retention';
import { sealSessionPrivate } from './privateData';
import { purgeExpiredSessionMusicians, reconfirmCutoff, retentionCutoff, sendSessionMusicianReconfirmNotices } from './retention';
import { hashManageToken } from './tokens';
/* eslint-enable import/first */

let client: Client;
const sendEmailMock = sendEmail as jest.Mock;
const NOW = new Date('2026-10-20T00:00:00Z');
const monthsAgo = (months: number): number => {
  const d = new Date(NOW.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return Math.floor(d.getTime() / 1000);
};

beforeAll(async () => {
  process.env.FUNDING_FIELD_KEY = randomBytes(32).toString('base64');
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(path.join(process.cwd(), 'drizzle/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(process.cwd(), 'drizzle/migrations', file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.execute('DELETE FROM session_musicians');
  jest.clearAllMocks();
  sendEmailMock.mockResolvedValue({ ok: true });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const insert = async (id: string, ageMonths: number, over: { status?: string; reconfirmSentAt?: number | null } = {}) =>
  client.execute({
    sql: `INSERT INTO session_musicians (id, stage_name, primary_instrument, sample_links_json, adult_confirmed, private_enc, email_hash, manage_token_hash, status, operator_memo, consent_version, last_confirmed_at, reconfirm_sent_at)
          VALUES (?, ?, 'bass', '[]', 1, ?, ?, ?, ?, '메모', 'test', ?, ?)`,
    args: [
      id, `활동명-${id}`, sealSessionPrivate({ realName: '실명', phone: '010-0000-0000', email: `${id}@example.org` }), `h-${id}`, `old-token-hash-${id}`,
      over.status ?? 'reviewed', monthsAgo(ageMonths), over.reconfirmSentAt ?? null,
    ],
  });

const ids = async () => ((await client.execute('SELECT id FROM session_musicians ORDER BY id')).rows as unknown as Array<{ id: string }>).map((r) => r.id);
const row = async (id: string) => (await client.execute({ sql: 'SELECT * FROM session_musicians WHERE id = ?', args: [id] })).rows[0] as unknown as Record<string, unknown>;

describe('기한 계산', () => {
  it('보유 2년·재확인 21개월(1년 9개월)', () => {
    expect(retentionCutoff(NOW).toISOString()).toBe('2024-10-20T00:00:00.000Z');
    expect(reconfirmCutoff(NOW).toISOString()).toBe('2025-01-20T00:00:00.000Z');
  });
});

describe('purgeExpiredSessionMusicians', () => {
  it('마지막 확인 2년이 지난 행만 지운다 — 상태(inactive 포함)와 무관하고 운영자 메모도 행과 함께 사라진다', async () => {
    await insert('old1', 25);
    await insert('old2', 30, { status: 'inactive' });
    await insert('edge', 23);
    await insert('fresh', 3);
    const result = await purgeExpiredSessionMusicians(NOW);
    expect(result).toEqual({ deleted: 2 });
    expect(await ids()).toEqual(['edge', 'fresh']);
  });

  it('다시 돌려도 안전하다', async () => {
    await insert('old', 26);
    await purgeExpiredSessionMusicians(NOW);
    expect(await purgeExpiredSessionMusicians(NOW)).toEqual({ deleted: 0 });
  });

  it('표가 없으면(0077 전) 아무것도 하지 않고 skipped로 돌아간다', async () => {
    await client.execute('ALTER TABLE session_musicians RENAME TO session_musicians_x');
    try {
      expect(await purgeExpiredSessionMusicians(NOW)).toEqual({ deleted: 0, skipped: 'table_missing' });
      expect(await sendSessionMusicianReconfirmNotices(NOW)).toEqual({ sent: 0, failed: 0, skipped: 'table_missing' });
    } finally {
      await client.execute('ALTER TABLE session_musicians_x RENAME TO session_musicians');
    }
  });
});

describe('sendSessionMusicianReconfirmNotices', () => {
  it('21개월 지나 24개월 안인 등록에만, 한 번 보낸다 — 새 관리 링크와 함께, 광고 문구 없이', async () => {
    await insert('due', 22);
    await insert('early', 20);
    await insert('expired', 25);
    const result = await sendSessionMusicianReconfirmNotices(NOW);
    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const mail = sendEmailMock.mock.calls[0][0];
    expect(mail.to).toBe('due@example.org');
    expect(mail.subject).toContain('아직 세션 연주');
    expect(mail.text).toContain('활동명-due');
    const token = /\/manage\/([0-9a-f]{64})/.exec(mail.text)![1];
    const after = await row('due');
    expect(after.manage_token_hash).toBe(hashManageToken(token));
    expect(after.manage_token_hash).not.toBe('old-token-hash-due');
    expect(Number(after.reconfirm_sent_at)).toBe(Math.floor(NOW.getTime() / 1000));
    expect(mail.html + mail.text).not.toMatch(/할인|이벤트|혜택|광고/);
  });

  it('같은 기간에 두 번 보내지 않는다', async () => {
    await insert('due', 22);
    await sendSessionMusicianReconfirmNotices(NOW);
    sendEmailMock.mockClear();
    expect(await sendSessionMusicianReconfirmNotices(new Date(NOW.getTime() + 24 * 3600 * 1000))).toEqual({ sent: 0, failed: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('메일이 실패하면 표시와 이전 토큰을 되돌려 다음 달에 다시 시도한다', async () => {
    await insert('due', 22);
    sendEmailMock.mockResolvedValue({ ok: false, errorCode: 'API_ERROR', errorDetail: 'boom' });
    expect(await sendSessionMusicianReconfirmNotices(NOW)).toEqual({ sent: 0, failed: 1 });
    const after = await row('due');
    expect(after.reconfirm_sent_at).toBeNull();
    expect(after.manage_token_hash).toBe('old-token-hash-due');

    sendEmailMock.mockResolvedValue({ ok: true });
    const nextMonth = new Date('2026-11-20T00:00:00Z');
    expect(await sendSessionMusicianReconfirmNotices(nextMonth)).toEqual({ sent: 1, failed: 0 });
  });

  it('응답 지연(TIMEOUT)이면 도착했을 수 있어 새 링크와 표시를 그대로 둔다', async () => {
    await insert('due', 22);
    sendEmailMock.mockResolvedValue({ ok: false, errorCode: 'TIMEOUT' });
    expect(await sendSessionMusicianReconfirmNotices(NOW)).toEqual({ sent: 1, failed: 0 });
    const after = await row('due');
    expect(after.reconfirm_sent_at).not.toBeNull();
    expect(after.manage_token_hash).not.toBe('old-token-hash-due');
  });

  it('복호화에 실패해도 던지지 않고 실패로 센다', async () => {
    await insert('due', 22);
    process.env.FUNDING_FIELD_KEY = randomBytes(32).toString('base64');
    expect(await sendSessionMusicianReconfirmNotices(NOW)).toEqual({ sent: 0, failed: 1 });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect((await row('due')).reconfirm_sent_at).toBeNull();
  });
});

describe('월간 파기 크론 연결', () => {
  const makeRes = () => {
    const out: { status: number; body: Record<string, unknown> } = { status: 200, body: {} };
    const res = {
      setHeader: () => res,
      status(code: number) {
        out.status = code;
        return res;
      },
      json(payload: Record<string, unknown>) {
        out.body = payload;
        return res;
      },
    } as unknown as NextApiResponse;
    return { res, out };
  };
  const runCron = async () => {
    const { res, out } = makeRes();
    await cronHandler({ method: 'GET', headers: {} } as unknown as NextApiRequest, res);
    return out;
  };

  it('같은 크론이 2년 지난 등록을 지우고 재확인 메일을 보낸다', async () => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    try {
      await insert('old', 25);
      await insert('due', 22);
      const out = await runCron();
      expect(out.status).toBe(200);
      expect(out.body.sessionMusicians).toEqual({ deleted: 1 });
      expect(out.body.sessionReconfirm).toEqual({ sent: 1, failed: 0 });
      expect(await ids()).toEqual(['due']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('재확인 메일 실패는 운영자에게 알리지만 크론을 실패로 만들지 않는다', async () => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    try {
      await insert('due', 22);
      sendEmailMock.mockResolvedValue({ ok: false, errorCode: 'API_ERROR', errorDetail: 'boom' });
      const out = await runCron();
      expect(out.status).toBe(200);
      const subjects = sendEmailMock.mock.calls.map((c) => c[0].subject);
      expect(subjects).toContain('[Studio NOL] 세션 연주자 재확인 메일 일부 실패');
    } finally {
      jest.useRealTimers();
    }
  });

  it('파기가 DB 오류로 실패하면 운영자 메일 + 500', async () => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    try {
      // 표가 없는 오류가 아니라 다른 DB 오류 — 잠깐 컬럼을 망가뜨린다.
      await client.execute('ALTER TABLE session_musicians RENAME COLUMN last_confirmed_at TO last_confirmed_at_x');
      try {
        const out = await runCron();
        expect(out.status).toBe(500);
        expect(sendEmailMock.mock.calls.map((c) => c[0].subject)).toContain('[Studio NOL] 세션 연주자 등록 파기 실패');
      } finally {
        await client.execute('ALTER TABLE session_musicians RENAME COLUMN last_confirmed_at_x TO last_confirmed_at');
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it('계약 파기가 던져도 세션 연주자 파기·재확인 메일은 그달 그대로 돈다 — 운영자 알림 + 500', async () => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    (purgeExpiredPersonalData as jest.Mock).mockRejectedValueOnce(new Error('turso down'));
    try {
      await insert('old', 25);
      await insert('due', 22);
      const out = await runCron();
      expect(out.status).toBe(500);
      expect(out.body.sessionMusicians).toEqual({ deleted: 1 });
      expect(out.body.sessionReconfirm).toEqual({ sent: 1, failed: 0 });
      expect(sendEmailMock.mock.calls.map((c) => c[0].subject)).toContain('[Studio NOL] 계약 개인정보 파기 일부 실패');
    } finally {
      jest.useRealTimers();
    }
  });

  it('월 입주 파기도 같은 달에 실패하면 두 실패를 모두 알린다 — 앞 알림이 뒤 알림을 가리지 않는다', async () => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    (purgeEndedTenancies as jest.Mock).mockRejectedValueOnce(new Error('tenancy down'));
    try {
      await client.execute('ALTER TABLE session_musicians RENAME COLUMN last_confirmed_at TO last_confirmed_at_x');
      try {
        const out = await runCron();
        expect(out.status).toBe(500);
        const subjects = sendEmailMock.mock.calls.map((c) => c[0].subject);
        expect(subjects).toContain('[Studio NOL] 월 입주 기록 파기 실패');
        expect(subjects).toContain('[Studio NOL] 세션 연주자 등록 파기 실패');
      } finally {
        await client.execute('ALTER TABLE session_musicians RENAME COLUMN last_confirmed_at_x TO last_confirmed_at');
      }
    } finally {
      jest.useRealTimers();
    }
  });
});
