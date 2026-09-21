/**
 * 로컬/운영 마이그레이션 개수 판정 네 경우: 밀림 있음 / 없음 / 운영이 앞서 있음(정상) /
 * 판정 불가(env 없음).
 *
 * 저널 파일은 임시 파일로 직접 만든다 — 저장소의 실제 _journal.json은 계속 커밋이
 * 쌓이므로, 테스트를 그 개수에 의존시키면 새 마이그레이션을 추가할 때마다 이 테스트가
 * 깨진다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { checkMigrationDrift } from './migrationDrift';

const writeJournal = (tags: string[]): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-drift-test-'));
  const journalPath = path.join(dir, '_journal.json');
  fs.writeFileSync(
    journalPath,
    JSON.stringify({
      version: '7',
      dialect: 'sqlite',
      entries: tags.map((tag, idx) => ({ idx, version: '6', when: idx, tag, breakpoints: true })),
    }),
  );
  return journalPath;
};

const TAGS = ['0000_a', '0001_b', '0002_c', '0003_d', '0004_e'];

describe('checkMigrationDrift', () => {
  it('운영이 로컬보다 뒤처져 있으면 drift — 밀린 tag를 저널 뒤에서부터 이름으로 돌려준다', async () => {
    const journalPath = writeJournal(TAGS);
    const result = await checkMigrationDrift({
      journalPath,
      queryAppliedCount: async () => 3,
    });

    expect(result.status).toBe('drift');
    expect(result.localCount).toBe(5);
    expect(result.appliedCount).toBe(3);
    expect(result.pendingCount).toBe(2);
    expect(result.pendingTags).toEqual(['0003_d', '0004_e']);
  });

  it('로컬과 운영이 같으면 ok — 밀린 것 없음', async () => {
    const journalPath = writeJournal(TAGS);
    const result = await checkMigrationDrift({
      journalPath,
      queryAppliedCount: async () => 5,
    });

    expect(result.status).toBe('ok');
    expect(result.pendingCount).toBe(0);
    expect(result.pendingTags).toEqual([]);
  });

  it('운영이 로컬보다 앞서 있으면 ok — 운영자가 먼저 적용한 정상 순서', async () => {
    const journalPath = writeJournal(TAGS);
    const result = await checkMigrationDrift({
      journalPath,
      queryAppliedCount: async () => 8,
    });

    expect(result.status).toBe('ok');
    expect(result.appliedCount).toBe(8);
    expect(result.pendingCount).toBe(0);
    expect(result.pendingTags).toEqual([]);
  });

  it('DB 환경변수가 없으면 unknown — "이상 없음"과 구분한다', async () => {
    const journalPath = writeJournal(TAGS);
    const result = await checkMigrationDrift({
      journalPath,
      env: {} as NodeJS.ProcessEnv,
    });

    expect(result.status).toBe('unknown');
    expect(result.appliedCount).toBeNull();
    expect(result.pendingCount).toBe(0);
    expect(result.reason).toBeTruthy();
  });

  it('env가 없어도 queryAppliedCount를 테스트가 직접 주입했으면 그것을 쓴다', async () => {
    const journalPath = writeJournal(TAGS);
    const result = await checkMigrationDrift({
      journalPath,
      env: {} as NodeJS.ProcessEnv,
      queryAppliedCount: async () => 5,
    });

    expect(result.status).toBe('ok');
    expect(result.appliedCount).toBe(5);
  });

  it('queryAppliedCount가 던지면(주입 경로) 그대로 전파한다', async () => {
    const journalPath = writeJournal(TAGS);
    await expect(
      checkMigrationDrift({
        journalPath,
        queryAppliedCount: async () => {
          throw new Error('boom');
        },
      }),
    ).rejects.toThrow('boom');
  });
});
