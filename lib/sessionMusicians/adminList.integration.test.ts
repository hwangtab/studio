/** @jest-environment node */
/** 관리자 명단 화면의 getServerSideProps — 곡당 연주비 칸·정렬 쿼리, 그리고 표에 안 나오는 값은 props에 싣지 않는다. */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { GetServerSidePropsContext } from 'next';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn(), authenticateAdminApi: jest.fn() }));

/* eslint-disable import/first */
import { authenticateAdminRequest } from '../contracts/admin-auth';
import { getServerSideProps } from '../../pages/admin/session-musicians/index';
import { sealSessionPrivate } from './privateData';
import { insertSessionMusician } from './repository';
/* eslint-enable import/first */

let client: Client;

beforeAll(async () => {
  process.env.FUNDING_FIELD_KEY = randomBytes(32).toString('base64');
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(path.join(process.cwd(), 'drizzle/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(process.cwd(), 'drizzle/migrations', file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s);
    }
  }
});

beforeEach(async () => {
  await client.execute('DELETE FROM session_musicians');
  (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
});

const seed = async (stageName: string, ratePerSong: number | null, createdAt: number) => {
  const email = `${stageName}@example.com`;
  const id = await insertSessionMusician({
    input: {
      stageName, realName: '김하늘', primaryInstrument: 'bass', instruments: ['bass'], genres: ['jazz'], yearsExperience: 5,
      reading: 'chart', remoteRecording: true, region: '서울', bio: '비공개 소개', sampleLinks: [{ url: 'https://example.org/a', label: '' }],
      ratePerSong, rateNote: '비공개 연주비 메모', phone: '010-1111-2222', email, kakaoId: 'k1',
    },
    privateEnc: sealSessionPrivate({ realName: '김하늘', phone: '010-1111-2222', email, kakaoId: 'k1' }),
    emailHash: `hash-${email}`,
    manageTokenHash: `token-${email}`,
    consentVersion: 'test',
  });
  await client.execute({ sql: 'UPDATE session_musicians SET created_at = ?, operator_memo = ? WHERE id = ?', args: [createdAt, '운영자 비공개 메모', id] });
};

const run = async (query: Record<string, string> = {}) => {
  const result = await getServerSideProps({ query, req: {}, res: {} } as unknown as GetServerSidePropsContext);
  if (!('props' in result)) throw new Error('redirect');
  return await result.props;
};

describe('관리자 명단 getServerSideProps', () => {
  it('행에 ratePerSong은 싣되 운영자 메모·소개·연주비 메모·샘플 링크·연락처는 싣지 않는다', async () => {
    await seed('기타', 150000, 1000);
    const props = await run();
    expect(props.rows).toHaveLength(1);
    expect(props.rows[0]).toMatchObject({ stageName: '기타', ratePerSong: 150000 });
    for (const forbidden of ['operatorMemo', 'bio', 'rateNote', 'sampleLinks', 'private', 'realName']) {
      expect(props.rows[0]).not.toHaveProperty(forbidden);
    }
    expect(JSON.stringify(props)).not.toMatch(/비공개|010-1111-2222|김하늘|example\.org/);
  });

  it('?sort=rate는 곡당 낮은 순에 미기재를 뒤로, 기본·알 수 없는 값은 최신순', async () => {
    await seed('비쌈', 300000, 1000);
    await seed('미기재', null, 2000);
    await seed('쌈', 80000, 3000);
    expect((await run({ sort: 'rate' })).rows.map((r) => r.stageName)).toEqual(['쌈', '비쌈', '미기재']);
    expect((await run({ sort: 'rate' })).filters.sort).toBe('rate');
    expect((await run()).rows.map((r) => r.stageName)).toEqual(['쌈', '미기재', '비쌈']);
    const unknown = await run({ sort: 'rate; DROP TABLE session_musicians' });
    expect(unknown.rows.map((r) => r.stageName)).toEqual(['쌈', '미기재', '비쌈']);
    expect(unknown.filters.sort).toBe('newest');
  });
});
