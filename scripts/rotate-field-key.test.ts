/** @jest-environment node */
/**
 * 회전 CLI의 게이트 회귀. **DB에는 닿지 않는다** — 전부 키를 읽는 단계에서 갈린다.
 *
 * 가장 중요한 것은 "옛 키와 새 키가 같으면 막는다"다. 같은 키로 돌면 모든 v2 행이
 * keyId가 맞아 건너뛰어져 `회전 0 · 건너뜀 n · 실패 0`이 나오는데, 그것이 회전이 정상적으로
 * 끝난 상태와 글자 하나 다르지 않다. 운영자가 그 출력을 보고 옛 키를 지우면 값을 영영 잃는다.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts/rotate-field-key.mjs');
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'rotate-key-'));
});

afterAll(() => {
  // 키가 적힌 임시 파일은 반드시 지운다.
  rmSync(dir, { recursive: true, force: true });
});

/** 테스트용 임의 키. 저장소 안에는 쓰지 않는다. */
const envFile = (name: string, vars: Record<string, string>): string => {
  const file = path.join(dir, `${name}.env`);
  writeFileSync(file, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 });
  return file;
};

const run = (file: string, args: string[]): { status: number; out: string } => {
  try {
    const stdout = execFileSync('node', [`--env-file=${file}`, TSX, SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, out: stdout };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};

jest.setTimeout(60_000);

describe('옛 키 == 새 키', () => {
  const key = randomBytes(32).toString('base64');

  it('막는다 — 경고가 아니라 exit 2다', () => {
    const file = envFile('same', {
      FUNDING_FIELD_KEY: key,
      FUNDING_FIELD_KEY_OLD: key,
      TURSO_DATABASE_URL: 'libsql://example.invalid',
      TURSO_AUTH_TOKEN: 'token',
    });
    const { status, out } = run(file, ['--apply']);

    expect(status).toBe(2);
    expect(out).toContain('같은 키');
    expect(out).toContain('아무것도 하지 않았습니다');
    // 회전이 끝난 것처럼 보이는 요약을 내지 않는다.
    expect(out).not.toContain('건너뜀');
    expect(out).not.toContain('합계');
    // 키 값은 출력에 없다.
    expect(out).not.toContain(key);
  });

  it('--same-key를 붙이면 그 게이트만 지난다 (v1 → v2 승격용)', () => {
    const file = envFile('same-allowed', { FUNDING_FIELD_KEY: key, FUNDING_FIELD_KEY_OLD: key });
    const { status, out } = run(file, ['--same-key']);

    // TURSO 변수를 뺐으므로 그다음 게이트에서 선다 = 같은 키 게이트는 지났다는 뜻이다.
    expect(status).toBe(2);
    expect(out).toContain('TURSO_DATABASE_URL');
    expect(out).toContain('키는 바뀌지 않습니다');
    expect(out).not.toContain(key);
  });
});

it('키가 없으면 exit 2 — 돌지 않는다', () => {
  const file = envFile('nokey', { TURSO_DATABASE_URL: 'x', TURSO_AUTH_TOKEN: 'y' });
  const { status, out } = run(file, []);
  expect(status).toBe(2);
  expect(out).toContain('FUNDING_FIELD_KEY_OLD');
});

it('모르는 인자는 exit 2 — 오타가 dry-run으로 조용히 떨어지지 않는다', () => {
  const file = envFile('typo', {
    FUNDING_FIELD_KEY: randomBytes(32).toString('base64'),
    FUNDING_FIELD_KEY_OLD: randomBytes(32).toString('base64'),
  });
  const { status, out } = run(file, ['--aply']);
  expect(status).toBe(2);
  expect(out).toContain('모르는 인자');
});

it('--help는 대상 컬럼 목록을 보여 준다', () => {
  const file = envFile('help', {});
  const { status, out } = run(file, ['--help']);
  expect(status).toBe(0);
  expect(out).toContain('funding_creators.resident_number_enc');
});
