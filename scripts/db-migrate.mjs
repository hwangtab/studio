#!/usr/bin/env node
/**
 * 운영 DB 마이그레이션 적용 — **유일한 적용 경로**(CLAUDE.md '운영 DB 마이그레이션 적용 방법').
 *
 * 왜 drizzle-kit을 바로 부르지 않는가:
 * - 브랜치 체크아웃에서 적용하면 그 브랜치의 큰 `when`이 운영 `max(created_at)`이 되어, 뒤에 main으로 들어오는
 *   더 작은 `when`은 영영 건너뛰어진다(drizzle libsql 마이그레이터는 `when > max(created_at)`만 실행). 그래서
 *   HEAD == origin/main, 브랜치 main 일 때만 돈다. 우회 플래그는 없다.
 * - 토큰은 .env.local에서 읽지 않고 그 자리에서 1일짜리로 만든다(Turso CLI). 만료 없는 운영 토큰이 로컬에 있어야 할
 *   이유를 없앤다.
 * - 적용 전에 "적용될 목록"과 "when이 작아 조용히 건너뛰어질 목록"을 대상 호스트와 함께 보여 주고, 건너뛰어질 것이
 *   있으면 멈춘다(재발행이 먼저다). 없으면 `--yes`가 있어야 실제로 적용한다.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const DB_NAME = 'studio-nol';
const TURSO = path.join(homedir(), '.turso', 'turso');
const yes = process.argv.includes('--yes');

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const fail = (msg) => { console.error(`\n✖ ${msg}`); process.exit(1); };

// 1) 저장소·브랜치 가드
const top = sh('git', ['rev-parse', '--show-toplevel']);
if (path.resolve(top) !== path.resolve(process.cwd())) fail(`저장소 루트(${top})에서 실행할 것.`);
const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') fail(`현재 브랜치가 '${branch}'다 — 마이그레이션은 main 병합본에서만 적용한다(브랜치의 when이 운영 max가 되면 뒤의 main 마이그레이션이 영영 건너뛰어진다).`);
try { sh('git', ['fetch', '--quiet', 'origin', 'main']); } catch (error) { fail(`origin/main을 가져오지 못했다(네트워크?): ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`); }
const head = sh('git', ['rev-parse', 'HEAD']);
const originMain = sh('git', ['rev-parse', 'origin/main']);
if (head !== originMain) fail(`HEAD(${head.slice(0, 10)})가 origin/main(${originMain.slice(0, 10)})과 다르다 — git pull 뒤 다시.`);
if (sh('git', ['status', '--porcelain', '--', 'drizzle/migrations']) !== '') fail('drizzle/migrations에 커밋되지 않은 변경이 있다.');

// 2) 대상 확인·대조는 CLI 세션으로만 한다(토큰 불필요). 토큰은 실제 적용 직전(--yes)에만 만든다 — 미리 보기마다
//    운영 전권 토큰이 하나씩 생기지 않게.
let url; let shellOut;
try {
  url = sh(TURSO, ['db', 'show', DB_NAME, '--url']);
  // turso shell 출력은 표 형식이라 13자리 밀리초 값만 긁는다(created_at은 저널 when과 같은 밀리초).
  shellOut = sh(TURSO, ['db', 'shell', DB_NAME, 'select created_at from __drizzle_migrations;']);
} catch (error) {
  fail(`Turso CLI 실패 — 로그인(~/.turso/turso auth login) 상태를 확인할 것: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
}
const host = url.replace(/^libsql:\/\//, '');

// 3) 저널 vs 운영 __drizzle_migrations 대조
const journal = JSON.parse(readFileSync(path.join(top, 'drizzle/migrations/meta/_journal.json'), 'utf8'));
const applied = shellOut.match(/\d{13}/g)?.map(Number) ?? [];
const maxApplied = applied.length ? Math.max(...applied) : 0;
const pending = journal.entries.filter((e) => !applied.includes(e.when));
const willRun = pending.filter((e) => e.when > maxApplied);
const willSkip = pending.filter((e) => e.when <= maxApplied);

console.log(`대상: ${host}`);
console.log(`저널 ${journal.entries.length}개 / 운영 적용 ${applied.length}개 / max(created_at) ${maxApplied}`);
console.log(`\n적용 예정 (${willRun.length}):`);
for (const e of willRun) console.log(`  + ${e.tag} (when ${e.when})`);
if (willSkip.length) {
  console.log(`\n⚠ when이 운영 max보다 작아 조용히 건너뛰어질 것 (${willSkip.length}):`);
  for (const e of willSkip) console.log(`  ! ${e.tag} (when ${e.when})`);
  fail('건너뛰어질 마이그레이션이 있다 — 적용하지 말고 when을 현재 최댓값보다 크게 재발행할 것(CLAUDE.md 함정 절).');
}
if (willRun.length === 0) { console.log('\n적용할 것이 없다.'); process.exit(0); }
if (!yes) { console.log('\n위 목록을 적용하려면 --yes 를 붙여 다시 실행.'); process.exit(0); }

// 4) 적용 — 토큰은 여기서만, 1일 만료로 만든다.
let token;
try {
  token = sh(TURSO, ['db', 'tokens', 'create', DB_NAME, '-e', '1d']);
} catch (error) {
  fail(`토큰 발급 실패: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
}
const r = spawnSync(path.join(top, 'node_modules/.bin/drizzle-kit'), ['migrate'], {
  stdio: 'inherit', env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: token },
});
if (r.status !== 0) fail(`drizzle-kit migrate 종료 코드 ${r.status}`);
const after = sh(TURSO, ['db', 'shell', DB_NAME, 'select count(*) from __drizzle_migrations;']);
console.log(`\n적용 완료. 운영 __drizzle_migrations: ${after.replace(/\s+/g, ' ').trim()} (저널 ${journal.entries.length})`);
