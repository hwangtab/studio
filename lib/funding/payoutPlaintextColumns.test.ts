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
 * `payoutBankNameMax` 같은 **입력 길이 상수**는 대상이 아니다 — 그건 화면이 받는 글자 수이지
 * 컬럼이 아니다. 주석이 파일 이름(`payoutAccount.ts`)을 부르는 것도 아니다. 그래서 값으로
 * 쓰이는 모양만 본다: 객체 키(`payoutAccount:`), drizzle 컬럼 참조
 * (`fundingCreators.payoutAccount`), 그리고 SQL 컬럼 이름. `payout_account_enc`는 뒤에
 * 이어지는 글자가 있어 `\\b`에 걸리지 않는다.
 */
const NAMES = [
  'payoutBankName\\s*:',
  'payoutAccount\\s*:',
  'payoutHolder\\s*:',
  'fundingCreators\\.payout(BankName|Account|Holder)\\b',
  'payout_bank_name',
  'payout_account\\b',
  'payout_holder',
];

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
