/* eslint-disable no-console */
/**
 * 맞춤 결제 링크(`/ko/pay/<slug>`) 발급·조회·닫기 — **배포 없이 즉시 열린다**(운영 DB `payment_links`에 바로 쓴다).
 * 관리자 화면 `/admin/payment-links`와 같은 표·같은 규칙(lib/payments/paymentLinkRules.ts)이다.
 *
 *   npx tsx scripts/pay-link.ts create --name "보컬 녹음 1프로 (10/17 11:00)" --amount 250000 --expires 2026-10-17 --memo 김준호님
 *   npx tsx scripts/pay-link.ts list
 *   npx tsx scripts/pay-link.ts close <slug>
 *
 * **--amount는 부가세 포함 총액이다**(고객이 결제하는 금액 그대로). 실행 전에 공급가·VAT를 풀어서 보여 주고, `--yes`가 있어야 만든다
 * (없으면 미리보기만). 발급한 링크의 금액은 바꾸지 않는다 — 틀렸으면 `close`하고 새로 만든다.
 *
 * 접속: `TURSO_DATABASE_URL`·`TURSO_AUTH_TOKEN`이 있으면 그걸 쓰고, 없으면 로그인된 Turso CLI(`~/.turso/turso`, DB `studio-nol`)로
 * 만료 1일 토큰을 만들어 쓴다(루트 CLAUDE.md "운영 DB 마이그레이션 적용 방법"). 토큰은 파일에 쓰지 않는다.
 * 표가 없으면(마이그레이션 0060 전) 안내하고 멈춘다.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';

import { createClient } from '@libsql/client';

import { splitInclusiveAmount } from '../lib/booking/amounts';
import { PAYMENT_LINK_SLUG_PATTERN, validatePaymentLinkInput } from '../lib/payments/paymentLinkRules';

const SITE = 'https://studionol.co.kr';
const TURSO = `${homedir()}/.turso/turso`;
const DB_NAME = 'studio-nol';

const args = process.argv.slice(2);
const command = args[0];
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);

const cli = (...a: string[]): string => execFileSync(TURSO, a, { encoding: 'utf8' }).trim();

const connect = () => {
  const url = process.env.TURSO_DATABASE_URL || cli('db', 'show', DB_NAME, '--url');
  const authToken = process.env.TURSO_AUTH_TOKEN || cli('db', 'tokens', 'create', DB_NAME, '-e', '1d');
  return createClient({ url, authToken });
};

const won = (n: number): string => `${n.toLocaleString('ko-KR')}원`;
const kstToday = (): string => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

const ensureTable = async (db: ReturnType<typeof connect>): Promise<void> => {
  const t = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'payment_links'");
  if (t.rows.length === 0) {
    console.error('payment_links 표가 없습니다. 마이그레이션 0060을 먼저 적용하세요(루트 CLAUDE.md "운영 DB 마이그레이션 적용 방법").');
    process.exit(1);
  }
};

const main = async (): Promise<void> => {
  if (command === 'create') {
    const input = validatePaymentLinkInput({ itemName: flag('name'), totalAmount: flag('amount'), expiresOn: flag('expires'), memo: flag('memo') });
    if (!input.ok) {
      console.error(input.message);
      process.exit(1);
    }
    const v = input.value;
    const split = splitInclusiveAmount(v.totalAmount);
    console.log(`상품명   ${v.itemName}`);
    console.log(`금액     ${won(v.totalAmount)} (부가세 포함) = 공급가 ${won(split.itemAmount)} + 부가세 ${won(split.vatAmount)}`);
    console.log(`만료     ${v.expiresOn ?? '없음(닫을 때까지)'}`);
    console.log(`메모     ${v.memo ?? '-'}`);
    if (!has('yes')) {
      console.log('\n미리보기입니다. 위 금액이 고객이 결제할 총액이 맞으면 --yes를 붙여 다시 실행하세요.');
      return;
    }
    const db = connect();
    await ensureTable(db);
    const slug = randomBytes(12).toString('hex');
    await db.execute({
      sql: 'INSERT INTO payment_links (slug, item_name, total_amount, expires_on, memo) VALUES (?, ?, ?, ?, ?)',
      args: [slug, v.itemName, v.totalAmount, v.expiresOn, v.memo],
    });
    console.log(`\n만들었습니다 — 바로 열립니다:\n${SITE}/ko/pay/${slug}`);
    return;
  }

  if (command === 'list') {
    const db = connect();
    await ensureTable(db);
    const rows = await db.execute('SELECT slug, item_name, total_amount, expires_on, memo, closed_at, created_at FROM payment_links ORDER BY created_at DESC LIMIT 50');
    const today = kstToday();
    for (const r of rows.rows) {
      const closed = r.closed_at !== null;
      const expired = typeof r.expires_on === 'string' && today > r.expires_on;
      const state = closed ? '닫힘' : expired ? '만료' : '열림';
      console.log(`${state}  ${won(Number(r.total_amount))}  ${r.item_name}${r.memo ? ` (${r.memo})` : ''}  ${r.expires_on ?? '무기한'}\n      ${SITE}/ko/pay/${r.slug}`);
    }
    if (rows.rows.length === 0) console.log('아직 없습니다.');
    return;
  }

  if (command === 'close') {
    const slug = args[1] ?? '';
    if (!PAYMENT_LINK_SLUG_PATTERN.test(slug)) {
      console.error('사용법: close <slug(24자리 hex)>');
      process.exit(1);
    }
    const db = connect();
    await ensureTable(db);
    const r = await db.execute({ sql: 'UPDATE payment_links SET closed_at = unixepoch() WHERE slug = ? AND closed_at IS NULL', args: [slug] });
    console.log(r.rowsAffected > 0 ? '닫았습니다.' : '이미 닫혔거나 없는 링크입니다(옛 파일 링크는 data/paymentLinks.ts에서 만료일로 닫습니다).');
    return;
  }

  console.error('사용법:\n  create --name <상품명> --amount <부가세 포함 총액> [--expires YYYY-MM-DD] [--memo <메모>] [--yes]\n  list\n  close <slug>');
  process.exit(1);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
