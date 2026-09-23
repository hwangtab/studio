#!/usr/bin/env node
/**
 * 필드 암호화 키 회전 — 옛 키로 열어 새 키로 다시 잠근다.
 *
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/rotate-field-key.mjs
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/rotate-field-key.mjs --apply
 *
 * tsx로 도는 이유: 판정과 쓰기는 `lib/crypto/fieldKeyRotation.ts`에 있고(테스트가 인메모리
 * libsql로 그 모듈을 그대로 돌린다), 이 파일은 env·플래그를 읽어 넘기고 개수를 찍는
 * 껍데기다. 로직을 여기 베끼면 두 벌이 갈라지고, 갈라진 날 잃는 것은 주민등록번호다.
 *
 * 환경 변수 네 개가 필요하다:
 *   FUNDING_FIELD_KEY       ← **새 키**. 회전이 끝나면 이 값 하나만 남는다.
 *   FUNDING_FIELD_KEY_OLD   ← 옛 키. 회전이 끝난 뒤에 지운다 — **끝나기 전에 지우면 안 된다.**
 *   TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
 *
 * ⚠ 프로덕션 DB를 직접 고친다. 운영자가 직접 돌린다 — 자동화·CI에 걸지 않는다.
 * 절차는 CLAUDE.md "암호화 필드" 절의 회전 절차를 따를 것. 순서가 틀리면 값을 잃는다.
 *
 * 출력에는 **개수와 행 id만** 나온다. 평문·키·암호문은 한 글자도 찍지 않는다.
 */
import { parseFieldKey } from '../lib/crypto/fieldCrypto.ts';
import { ENCRYPTED_FIELD_TARGETS, rotateFieldKey } from '../lib/crypto/fieldKeyRotation.ts';

const NEW_KEY_ENV = 'FUNDING_FIELD_KEY';
const OLD_KEY_ENV = 'FUNDING_FIELD_KEY_OLD';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const sameKeyAllowed = args.includes('--same-key');

if (args.includes('--help') || args.includes('-h')) {
  console.log(
    [
      '필드 암호화 키 회전',
      '',
      '  node --env-file=.env.local node_modules/.bin/tsx scripts/rotate-field-key.mjs',
      '      dry-run — 무엇이 바뀔지 개수만 본다 (기본)',
      '  node --env-file=.env.local node_modules/.bin/tsx scripts/rotate-field-key.mjs --apply',
      '      실제로 쓴다',
      '  --same-key',
      `      ${OLD_KEY_ENV}와 ${NEW_KEY_ENV}가 같아도 돈다. 판본 v1 값을 같은 키로 v2에`,
      '      올릴 때만 쓴다 — 키 회전에는 쓰지 않는다.',
      '',
      `env: ${NEW_KEY_ENV}(새 키) · ${OLD_KEY_ENV}(옛 키) · TURSO_DATABASE_URL · TURSO_AUTH_TOKEN`,
      '',
      '대상 컬럼:',
      ...ENCRYPTED_FIELD_TARGETS.map((t) => `  - ${t.label}`),
    ].join('\n'),
  );
  process.exit(0);
}

const unknown = args.filter((a) => !['--apply', '--same-key', '--help', '-h'].includes(a));
if (unknown.length > 0) {
  console.error(`[rotate-field-key] 모르는 인자: ${unknown.join(' ')} (--help 참고)`);
  process.exit(2);
}

let oldKey;
let newKey;
try {
  oldKey = parseFieldKey(process.env[OLD_KEY_ENV], OLD_KEY_ENV);
  newKey = parseFieldKey(process.env[NEW_KEY_ENV], NEW_KEY_ENV);
} catch (error) {
  // FieldCryptoError의 메시지에는 키 값이 들어 있지 않다(env 이름과 길이뿐).
  console.error(`[rotate-field-key] 키를 읽지 못했습니다: ${error.message}`);
  process.exit(2);
}

/**
 * **두 키가 같으면 막는다.** 경고로 두면 안 되는 이유가 분명하다.
 *
 * 키가 같으면 이미 v2인 행은 keyId가 맞아 전부 건너뛰어진다 — 출력이
 * `회전 0 · 건너뜀 n · 실패 0`이 되는데, 그것이 **회전이 정상적으로 끝난 상태와 글자
 * 하나 다르지 않다.** 운영자는 그 출력을 보고 절차 6번으로 가 옛 키를 지운다. 그런데
 * 실제로는 아무것도 안 돌았으므로, 프로덕션에는 새 키만 남고 값은 전부 옛 키로 잠긴다.
 * 복구 경로는 개설자 재등록뿐이다.
 *
 * 그리고 이 상태는 실수로 쉽게 만들어진다: Vercel env만 새 키로 바꾸고 로컬 `.env.local`이
 * 옛 키 그대로면 이 스크립트에는 두 키가 같게 보인다(이 저장소에는 `vercel env pull`·blob
 * 명령이 `.env.local`을 통째로 덮어쓴 사고 이력이 있다).
 *
 * v1 값을 같은 키로 v2에 올리는 것은 정당한 용법이므로 `--same-key`로만 연다.
 */
if (oldKey.equals(newKey) && !sameKeyAllowed) {
  console.error(
    [
      `[rotate-field-key] ${OLD_KEY_ENV}와 ${NEW_KEY_ENV}가 **같은 키**입니다. 아무것도 하지 않았습니다.`,
      '  키 회전이라면 두 값이 같을 수 없습니다 — 한쪽을 잘못 넣었거나, Vercel env만 새 키로',
      `  바꾸고 로컬 .env.local의 ${NEW_KEY_ENV}가 옛 키 그대로인 상태입니다.`,
      '  이대로 돌면 모든 행이 "이미 새 키"로 건너뛰어져 회전이 끝난 것과 똑같은 출력이 나옵니다.',
      `  판본 v1 값을 같은 키로 v2에 올리려는 것이라면 --same-key를 붙이세요.`,
    ].join('\n'),
  );
  process.exit(2);
}

if (oldKey.equals(newKey)) {
  console.warn(
    `[rotate-field-key] ⚠ --same-key — ${OLD_KEY_ENV}와 ${NEW_KEY_ENV}가 같습니다. `
      + '**키는 바뀌지 않습니다.** 판본 v1 값만 v2로 올라갑니다.',
  );
}

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('[rotate-field-key] TURSO_DATABASE_URL·TURSO_AUTH_TOKEN이 없습니다.');
  process.exit(2);
}

console.log(
  apply
    ? '[rotate-field-key] --apply — 실제로 씁니다.'
    : '[rotate-field-key] dry-run — 아무것도 쓰지 않습니다. 실제로 쓰려면 --apply.',
);

let summary;
try {
  summary = await rotateFieldKey({ oldKey, newKey, apply });
} catch (error) {
  // 여기까지 오는 것은 "행별 실패"가 아니라 **한 바퀴도 못 돌았다**는 뜻이다(DB 연결,
  // SELECT 실패, 키 식별자 충돌 게이트). 실패 n건(exit 1)과 갈라야 운영자가 절차 6번으로
  // 넘어가지 않는다.
  console.error(`[rotate-field-key] 돌지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

for (const t of summary.byTarget) {
  console.log(
    `[rotate-field-key] ${t.target}: 대상 ${t.scanned}건 — `
      + `${apply ? '회전' : '회전 예정'} ${t.rotated} · 건너뜀 ${t.skipped} · 실패 ${t.failed}`,
  );
}
console.log(
  `[rotate-field-key] 합계 — ${apply ? '회전' : '회전 예정'} ${summary.rotated} · `
    + `건너뜀 ${summary.skipped} · 실패 ${summary.failed}`,
);

if (summary.failures.length > 0) {
  console.error('[rotate-field-key] 회전하지 못한 행 (id와 사유만):');
  for (const f of summary.failures) console.error(`  - ${f.target} id=${f.id} code=${f.code}`);
  console.error(
    '[rotate-field-key] code=changed는 도는 중에 그 행이 다시 저장된 것입니다 — 다시 돌리면 '
      + '대개 건너뜁니다. code=key_mismatch는 옛 키도 새 키도 아닌 키로 잠긴 값이고, '
      + `code=auth_failed는 ${OLD_KEY_ENV}가 그 값의 키가 아니거나 값이 손상된 것입니다. `
      + '**어느 경우에도 값을 지우지 마세요.**',
  );
  process.exit(1);
}

if (!apply && summary.rotated > 0) {
  console.log('[rotate-field-key] 개수가 예상과 같으면 --apply로 다시 돌리세요.');
}
process.exit(0);
