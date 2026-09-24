/** @jest-environment node */
/**
 * 평문 계좌 컬럼(`payout_bank_name`·`payout_account`·`payout_holder`)을 **아무도 다시 쓰지
 * 않는지** 지킨다.
 *
 * 세 컬럼은 아직 DB에 남아 있다 — 이 저장소는 마이그레이션을 먼저 적용하고 코드를 나중에
 * 배포하므로, 컬럼을 지우면 그 사이에 도는 옛 코드가 없는 컬럼을 읽고 깨진다
 * (`db/schema.ts`의 deprecated 주석). 남아 있는 컬럼은 언젠가 다시 쓰이기 마련이라,
 * 그때 평문 계좌가 조용히 되살아난다. 그 경로를 여기서 막는다.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();

/** 컬럼 **정의**가 있어도 되는 자리. 파일 단위 예외는 이 둘뿐이다. */
const ALLOWED_FILES = new Set([
  'db/schema.ts',
  'lib/funding/payoutPlaintextColumns.test.ts',
]);

/**
 * 한 **줄**만 예외로 빼는 표시.
 *
 * 파일을 통째로 화이트리스트에 넣지 않는 이유: 그 파일 안에서 평문 컬럼에 **쓰는** 코드까지
 * 함께 통과한다. 실제로 예외가 필요한 자리는 `creatorProjectWrite.integration.test.ts`의
 * "새 저장 경로가 옛 컬럼을 채우지 않는다"는 단언 한 줄인데, 그 파일은 정산 저장 경로를
 * 통째로 검사하는 가장 큰 테스트라 통째로 열어 주면 가드가 그 파일에서 무력해진다.
 *
 * 그래서 예외를 **그 줄에 붙인다.** 어디에 몇 개가 있는지는 이 문자열을 grep하면 바로 나오고,
 * 새로 쓰는 코드는 표시를 붙이지 않는 한 그대로 걸린다.
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
 */
const HEAD = '(^|[^_a-zA-Z0-9])';
const TAIL = '([^_a-zA-Z0-9]|$)';
const CAMEL = 'payout(BankName|Account|Holder)';

/**
 * 잡아야 하는 것은 **컬럼을 값으로 쓰는 표기 전부**다. 수신자를 `fundingCreators`로 묶으면
 * 안 된다 — 이 저장소에서 더 자연스러운 접근은 행 객체다(`payout.ts`가 `findFirst()`로 전
 * 컬럼 행을 받아 쓴다). `creator.payoutAccount`·`row.payoutHolder`·구조분해·축약이 전부
 * 타입 검사를 통과한다(컬럼이 스키마에 남아 있고 `@deprecated`는 힌트일 뿐이다).
 *
 * 반대로 **입력 길이 상수**(`payoutBankNameMax`), **파일 이름을 부르는 주석**
 * (`payoutAccount.ts`), **새 컬럼**(`payoutAccountEnc`)은 대상이 아니다.
 */
const NAMES = [
  // 객체 키: `payoutAccount: '...'`
  `${CAMEL}[[:space:]]*:`,
  // 속성 접근: `creator.payoutAccount`, `row.payoutHolder`
  `\\.${CAMEL}${TAIL}`,
  // 축약·구조분해: `{ payoutAccount }`, `const { payoutBankName, payoutHolder } =`
  `[{,][[:space:]]*${CAMEL}[[:space:]]*[,}]`,
  // SQL 컬럼 이름
  `${HEAD}payout_bank_name${TAIL}`,
  `${HEAD}payout_account${TAIL}`,
  `${HEAD}payout_holder${TAIL}`,
];

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
      ['grep', '-nE', '--untracked', pattern, '--', '*.ts', '*.tsx', '*.mjs', '*.js'],
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

it.each(NAMES)('%s를 참조하는 소스가 정의 자리 밖에 없다', (name) => {
  expect(offenders(name)).toEqual([]);
});

/**
 * **패턴이 실제로 무언가를 찾기는 하는지** — 이 가드가 한 번 조용히 통과한 적이 있다.
 * `\b`가 macOS ERE에서 단어 경계가 아니라 두 패턴이 아무것도 못 찾고 있었고, 아래 문자열
 * 단위 검사(JS `RegExp`, `\b`를 안다)는 통과했기 때문에 로컬에서는 드러나지 않았다.
 *
 * 그래서 **git grep 그 자체로** 확인한다: 이 파일에는 패턴마다 그 표기의 예가 들어 있으므로,
 * 각 패턴은 최소한 이 파일을 찾아내야 한다. 못 찾으면 그 패턴은 죽어 있는 것이다.
 */
it.each(NAMES)('%s가 git grep에서 실제로 동작한다 — 죽은 패턴은 가드가 아니다', (name) => {
  expect(hits(name).map((hit) => hit.file)).toContain('lib/funding/payoutPlaintextColumns.test.ts');
});

/** git grep(ERE)과 아래 문자열 검사가 **같은 패턴**을 쓰는지 확인하는 보조 검사. */
const matchesAny = (line: string): boolean =>
  NAMES.some((pattern) => new RegExp(pattern.replace(/\[\[:space:\]\]/g, '[ \\t]')).test(line));

describe('패턴이 실제 표기를 잡는다', () => {
  it.each([
    'const stored = creator.payoutAccount;',
    'return row.payoutHolder ?? null;',
    'const { payoutAccount } = creator;',
    'const { payoutBankName, payoutHolder } = row;',
    'await db.update(fundingCreators).set({ payoutAccount });',
    "  payoutBankName: '국민은행',",
    'select({ holder: fundingCreators.payoutHolder })',
    'ALTER TABLE x ADD payout_account text;',
    'ALTER TABLE x ADD payout_bank_name text;',
    'UPDATE t SET payout_holder = NULL;',
  ])('%s', (line) => {
    expect(matchesAny(line)).toBe(true);
  });
});

describe('대상이 아닌 것은 잡지 않는다 — 넓히다 가드가 시끄러워지면 아무도 안 본다', () => {
  it.each([
    'maxLength={CREATOR_LIMITS.payoutBankNameMax}',
    'if (account.length > CREATOR_LIMITS.payoutAccountMax) {',
    ' * `payoutAccount.ts`와 같은 자리이되 경로를 따로 둔다.',
    "import { decryptPayoutAccount } from './payoutAccountCrypto';",
    "  payoutAccountEnc: text('payout_account_enc'),",
    '  payoutAccountLast4: row.payoutAccountLast4,',
    // 거부 코드 이름이지 컬럼이 아니다 — 앞쪽 경계가 없으면 이게 통째로 걸린다.
    "    return { ok: false, code: 'no_payout_account' };",
  ])('%s', (line) => {
    expect(matchesAny(line)).toBe(false);
  });
});

describe('줄 단위 예외', () => {
  /** 표시가 붙은 줄만 빠진다 — 같은 파일의 다른 줄은 그대로 걸린다. */
  it('표시가 붙은 줄은 예외이고, 안 붙은 줄은 걸린다', () => {
    const marked = `expect(row.payoutAccount).toBeNull(); // ${LINE_EXEMPTION} 읽기만 한다`;
    const bare = 'expect(row.payoutAccount).toBeNull();';
    expect(marked.includes(LINE_EXEMPTION)).toBe(true);
    expect(bare.includes(LINE_EXEMPTION)).toBe(false);
    expect(matchesAny(marked)).toBe(true); // 패턴 자체는 둘 다 잡는다 — 거르는 것은 표시다
    expect(matchesAny(bare)).toBe(true);
  });

  /** 예외가 몇 개인지는 한눈에 보여야 한다. 늘어나면 이 숫자가 먼저 말한다. */
  it('지금 표시가 붙은 줄은 하나뿐이다', () => {
    const marked = hits(LINE_EXEMPTION.replace(':', ':')).filter(
      (hit) => !ALLOWED_FILES.has(hit.file),
    );
    expect(marked.map((hit) => hit.file)).toEqual(['lib/funding/creatorProjectWrite.integration.test.ts']);
  });
});

/**
 * 스키마에는 남아 있어야 한다 — 이 테스트가 "지워졌는지"를 묻는 것이 아니라 "쓰이는지"를
 * 묻는다는 것을 분명히 해 둔다. 실제로 컬럼을 지우는 날에는 이 파일도 함께 지운다.
 */
it('스키마에는 아직 남아 있다 — 컬럼을 지우는 것은 다음 배포의 일이다', () => {
  expect(hits('payoutBankName').map((hit) => hit.file)).toContain('db/schema.ts');
});
