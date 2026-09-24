/** @jest-environment node */
/**
 * 평문 계좌 컬럼(`payout_bank_name`·`payout_account`·`payout_holder`)을 **아무도 다시 쓰지
 * 않는지** 지킨다.
 *
 * 세 컬럼은 아직 DB에 남아 있다 — 이 저장소는 마이그레이션을 먼저 적용하고 코드를 나중에
 * 배포하므로, 컬럼을 지우면 그 사이에 도는 옛 코드가 없는 컬럼을 읽고 깨진다
 * (`db/schema.ts`의 deprecated 주석). 남아 있는 컬럼은 언젠가 다시 쓰이기 마련이라,
 * 그때 평문 계좌가 조용히 되살아난다. 그 경로를 여기서 막는다.
 *
 * 허용되는 자리는 **정의와 설명뿐**이다: `db/schema.ts`의 컬럼 선언, 마이그레이션 SQL,
 * 그리고 이 파일. 그 밖의 소스에서 이름이 보이면 실패한다.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();

/** 정의·설명이 있어도 되는 자리. */
const ALLOWED = new Set([
  'db/schema.ts',
  'lib/funding/payoutPlaintextColumns.test.ts',
]);

/**
 * 잡아야 하는 것은 **컬럼을 값으로 쓰는 표기 전부**다. 수신자를 `fundingCreators`로 묶으면
 * 안 된다 — 이 저장소에서 더 자연스러운 접근은 행 객체다(`payout.ts`가 `findFirst()`로 전
 * 컬럼 행을 받아 쓴다). `creator.payoutAccount`·`row.payoutHolder`·구조분해·축약이 전부
 * 타입 검사를 통과한다(컬럼이 스키마에 남아 있고 `@deprecated`는 힌트일 뿐이다).
 *
 * 반대로 **입력 길이 상수**(`payoutBankNameMax`)와 **파일 이름을 부르는 주석**
 * (`payoutAccount.ts`)은 대상이 아니다. `payout_account_enc`처럼 뒤에 글자가 이어지는
 * 이름도 아니다 — `\b`가 가른다.
 */
const NAMES = [
  // 객체 키: `payoutAccount: '...'`
  'payout(BankName|Account|Holder)\\s*:',
  // 속성 접근: `creator.payoutAccount`, `row.payoutHolder`
  '\\.payout(BankName|Account|Holder)\\b',
  // 축약·구조분해: `{ payoutAccount }`, `const { payoutAccount, ... } =`
  '[{,]\\s*payout(BankName|Account|Holder)\\s*[,}]',
  // SQL 컬럼 이름
  'payout_bank_name',
  'payout_account\\b',
  'payout_holder',
];

/**
 * 넓힌 패턴이 정말로 그 표기들을 잡는지 — 패턴을 고치다 좁아지면 가드가 조용히 통과한다.
 * git grep은 ERE를 쓰고 JS `RegExp`는 그 상위집합이라 여기서 그대로 확인할 수 있다.
 */
const matchesAny = (line: string): boolean => NAMES.some((pattern) => new RegExp(pattern).test(line));

describe('패턴이 실제 표기를 잡는다', () => {
  it.each([
    'const stored = creator.payoutAccount;',
    'return row.payoutHolder ?? null;',
    'const { payoutAccount } = creator;',
    'const { payoutBankName, payoutHolder } = row;',
    'await db.update(fundingCreators).set({ payoutAccount });',
    "  payoutBankName: '국민은행',",
    'select({ holder: fundingCreators.payoutHolder })',
    "ALTER TABLE x ADD payout_account text;",
  ])('%s', (line) => {
    expect(matchesAny(line)).toBe(true);
  });
});

describe('대상이 아닌 것은 잡지 않는다 — 넓히다 가드가 시끄러워지면 아무도 안 본다', () => {
  it.each([
    'maxLength={CREATOR_LIMITS.payoutBankNameMax}',
    "if (account.length > CREATOR_LIMITS.payoutAccountMax) {",
    ' * `payoutAccount.ts`와 같은 자리이되 경로를 따로 둔다.',
    "import { decryptPayoutAccount } from './payoutAccountCrypto';",
    '  payoutAccountEnc: text(\'payout_account_enc\'),',
    '  payoutAccountLast4: row.payoutAccountLast4,',
  ])('%s', (line) => {
    expect(matchesAny(line)).toBe(false);
  });
});

/** git grep으로 훑는다 — node_modules·.next를 걸러 낼 필요가 없다. 아직 add하지 않은 새 파일도 본다. */
const hits = (pattern: string): string[] => {
  let out = '';
  try {
    out = execFileSync(
      'git',
      ['grep', '-lE', '--untracked', pattern, '--', '*.ts', '*.tsx', '*.mjs', '*.js'],
      { cwd: ROOT, encoding: 'utf-8' },
    );
  } catch (error: unknown) {
    // git grep은 결과가 없으면 exit 1이다.
    const status = (error as { status?: number }).status;
    if (status === 1) return [];
    throw error;
  }
  return out.split('\n').map((line) => line.trim()).filter(Boolean);
};

it.each(NAMES)('%s를 참조하는 소스가 정의 자리 밖에 없다', (name) => {
  const offenders = hits(name).filter((file) => !ALLOWED.has(path.posix.normalize(file)));
  expect(offenders).toEqual([]);
});

/**
 * 스키마에는 남아 있어야 한다 — 이 테스트가 "지워졌는지"를 묻는 것이 아니라 "쓰이는지"를
 * 묻는다는 것을 분명히 해 둔다. 실제로 컬럼을 지우는 날에는 이 파일도 함께 지운다.
 */
it('스키마에는 아직 남아 있다 — 컬럼을 지우는 것은 다음 배포의 일이다', () => {
  expect(hits('payoutBankName')).toContain('db/schema.ts');
});
