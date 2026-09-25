/** @jest-environment node */
/**
 * 평문 계좌 컬럼(`payout_bank_name`·`payout_account`·`payout_holder`)이 **되살아나지 않는지**
 * 지킨다.
 *
 * 세 컬럼은 `db/schema.ts`에서 사라졌고(0028 마이그레이션이 DB에서도 지운다), 정본은
 * `payout_account_enc` 한 벌 + 표시용 `payout_account_last4`다.
 *
 * **캐멀 표기(`creator.payoutAccount`)는 더 이상 여기서 보지 않는다.** 컬럼이 스키마에
 * 없으므로 그 표기는 전부 타입 검사에서 막힌다 — 컴파일러가 이미 하는 일을 grep으로
 * 한 번 더 하면, `payoutBankName` 같은 **입력 필드 이름**까지 걸려 가드가 시끄러워지기만
 * 한다. 컴파일러가 못 보는 것은 **스네이크 이름** 쪽이다: 원시 SQL(`sql\`\``)과 새 마이그레이션
 * 파일. 그래서 대상을 그쪽으로 좁히고, 대신 `*.sql`까지 훑는다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/**
 * 컬럼 이름이 있어도 되는 자리 — **이미 발행된 마이그레이션** 셋과 이 파일뿐이다.
 * 새로 만드는 마이그레이션은 파일 이름이 다르므로 그대로 걸린다.
 *
 * `db/schema.ts`는 일부러 빼 뒀다. 컬럼을 스키마에 되돌려 놓는 것이 이 가드가 막으려는
 * 바로 그 일이다.
 */
const ALLOWED_FILES = new Set([
  'drizzle/migrations/0017_funding_self_serve.sql',
  'drizzle/migrations/0027_funding_payout_account_enc.sql',
  'drizzle/migrations/0028_funding_drop_plaintext_payout.sql',
  'lib/funding/payoutPlaintextColumns.test.ts',
]);

/**
 * 한 **줄**만 예외로 빼는 표시. 파일을 통째로 열어 주면 그 파일에서 컬럼을 되살리는 코드까지
 * 함께 통과하므로, 예외는 줄에 붙인다. 지금은 붙은 줄이 하나도 없고, 아래 검사가 그 수를 센다.
 */
const LINE_EXEMPTION = 'plaintext-column-guard:';

/**
 * **`\b`를 쓰지 않는다.** git grep의 `-E`는 플랫폼 정규식 라이브러리를 그대로 쓰는데,
 * macOS(BSD)에서는 `\b`가 단어 경계가 아니다 — 패턴이 아무것도 못 찾고 **가드가 조용히
 * 통과한다.** 실제로 그 상태로 로컬은 초록, CI(glibc)는 빨강이었다. 경계는 "밑줄·영숫자가
 * 아닌 글자 또는 줄 끝"으로 직접 적어 양쪽에서 같게 만든다.
 *
 * 앞쪽 경계도 필요하다. 없으면 거부 코드 문자열 `no_payout_account`가 컬럼 참조로 잡힌다
 * (payout.ts·healthCheck.ts·약관 테스트에 흩어져 있다). 그건 컬럼이 아니라 오류 코드 이름이다.
 * 뒤쪽 경계는 새 컬럼 `payout_account_enc`·`payout_account_last4`를 갈라 낸다.
 */
const HEAD = '(^|[^_a-zA-Z0-9])';
const TAIL = '([^_a-zA-Z0-9]|$)';

const NAMES = [
  `${HEAD}payout_bank_name${TAIL}`,
  `${HEAD}payout_account${TAIL}`,
  `${HEAD}payout_holder${TAIL}`,
];

/** 훑는 범위 — 코드에 박힌 원시 SQL과 마이그레이션 파일 양쪽. */
const GLOBS = ['*.ts', '*.tsx', '*.mjs', '*.js', '*.sql'];

interface Hit {
  file: string;
  line: string;
}

/**
 * git grep으로 훑는다 — node_modules·.next를 걸러 낼 필요가 없고, 아직 add하지 않은 새 파일도 본다.
 * 줄 번호까지 받아 오는 이유는 줄 단위 예외 때문이다(`LINE_EXEMPTION`).
 */
const hits = (pattern: string): Hit[] => {
  let out = '';
  try {
    out = execFileSync(
      'git',
      ['grep', '-nE', '--untracked', pattern, '--', ...GLOBS],
      { cwd: ROOT, encoding: 'utf-8' },
    );
  } catch (error: unknown) {
    // git grep은 결과가 없으면 exit 1이다.
    const status = (error as { status?: number }).status;
    if (status === 1) return [];
    throw error;
  }
  return out
    .split('\n')
    .filter(Boolean)
    .map((row) => {
      const [file, , ...rest] = row.split(':');
      return { file: path.posix.normalize(file), line: rest.join(':') };
    });
};

const offenders = (pattern: string): string[] =>
  hits(pattern)
    .filter((hit) => !ALLOWED_FILES.has(hit.file) && !hit.line.includes(LINE_EXEMPTION))
    .map((hit) => `${hit.file}: ${hit.line.trim()}`);

it.each(NAMES)('%s를 쓰는 소스·마이그레이션이 없다', (name) => {
  expect(offenders(name)).toEqual([]);
});

/**
 * **패턴이 실제로 무언가를 찾기는 하는지** — 이 가드가 한 번 조용히 통과한 적이 있다.
 * `\b`가 macOS ERE에서 단어 경계가 아니라 패턴이 아무것도 못 찾고 있었고, 아래 문자열
 * 단위 검사(JS `RegExp`, `\b`를 안다)는 통과했기 때문에 로컬에서는 드러나지 않았다.
 *
 * 그래서 **git grep 그 자체로** 확인한다: 이 파일에는 패턴마다 그 표기의 예가 들어 있으므로,
 * 각 패턴은 최소한 이 파일을 찾아내야 한다. 못 찾으면 그 패턴은 죽어 있는 것이다.
 */
it.each(NAMES)('%s가 git grep에서 실제로 동작한다 — 죽은 패턴은 가드가 아니다', (name) => {
  expect(hits(name).map((hit) => hit.file)).toContain('lib/funding/payoutPlaintextColumns.test.ts');
});

/** git grep(ERE)과 아래 문자열 검사가 **같은 패턴**을 쓰는지 확인하는 보조 검사. */
const matchesAny = (line: string): boolean => NAMES.some((pattern) => new RegExp(pattern).test(line));

describe('패턴이 실제 표기를 잡는다', () => {
  it.each([
    'ALTER TABLE `funding_creators` ADD `payout_account` text;',
    'ALTER TABLE x ADD payout_bank_name text;',
    'UPDATE t SET payout_holder = NULL;',
    'await db.run(sql`select payout_account from funding_creators`);',
  ])('%s', (line) => {
    expect(matchesAny(line)).toBe(true);
  });
});

describe('대상이 아닌 것은 잡지 않는다 — 넓히다 가드가 시끄러워지면 아무도 안 본다', () => {
  it.each([
    "  payoutAccountEnc: text('payout_account_enc'),",
    "  payoutAccountLast4: text('payout_account_last4'),",
    'ALTER TABLE `funding_creators` ADD `payout_account_enc` text;',
    // 거부 코드 이름이지 컬럼이 아니다 — 앞쪽 경계가 없으면 이게 통째로 걸린다.
    "    return { ok: false, code: 'no_payout_account' };",
    // 캐멀 표기는 이제 타입 검사가 막는다. 입력 길이 상수까지 걸리면 가드가 시끄러워진다.
    'maxLength={CREATOR_LIMITS.payoutBankNameMax}',
    'const stored = creator.payoutAccount;',
  ])('%s', (line) => {
    expect(matchesAny(line)).toBe(false);
  });
});

/** 예외가 몇 개인지는 한눈에 보여야 한다. 늘어나면 이 숫자가 먼저 말한다. */
it('줄 단위 예외는 지금 하나도 없다', () => {
  const marked = hits(LINE_EXEMPTION).filter((hit) => !ALLOWED_FILES.has(hit.file));
  expect(marked.map((hit) => hit.file)).toEqual([]);
});

/** 컬럼이 스키마에서 사라진 상태 자체를 고정한다 — 되돌아오면 여기서 먼저 걸린다. */
it('스키마에 평문 계좌 컬럼이 없다', () => {
  const schema = readFileSync(path.join(ROOT, 'db/schema.ts'), 'utf-8');
  expect(schema).not.toMatch(/payout_bank_name|payout_holder/);
});
