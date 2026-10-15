/* eslint-disable no-console */
/**
 * 맞춤 결제 링크(`/ko/pay/<slug>`) 발급·조회·닫기 — **배포 없이 즉시 열린다**(운영 DB `payment_links`에 바로 쓴다).
 * 관리자 화면 `/admin/payment-links`와 **같은 코드**(lib/payments/paymentLinks.ts)를 부른다 — 규칙·슬롯 차단이 한 벌이다.
 *
 *   npx tsx scripts/pay-link.ts create --name "보컬 녹음 1프로" --amount 250000 --session "2026-10-17 11:00" --hours 3 --memo 김준호님 --yes
 *   npx tsx scripts/pay-link.ts list
 *   npx tsx scripts/pay-link.ts close <slug>
 *
 * - **--amount는 부가세 포함 총액이다**(고객이 결제하는 금액 그대로). 실행 전에 공급가·VAT를 풀어서 보여 주고, `--yes`가 있어야 만든다
 *   (없으면 미리보기만). 발급한 링크의 금액은 바꾸지 않는다 — 틀렸으면 `close`하고 새로 만든다.
 * - `--session "YYYY-MM-DD HH:mm"`(한국시간) + `--hours N`: 이용 일시·시간. 결제되면 관리자 대시보드 "이번 주 세션"·예약 목록에 그 시각으로 보이고,
 *   **그 시간대를 "예약 불가 블록"으로 자동 차단한다**(웹 이중 예약 방지) — 막지 않으려면 `--no-block`. 링크를 결제 없이 `close`하면 블록도 풀린다.
 * - `--expires YYYY-MM-DD`: 그날 끝까지만 열린다. `--memo`: 운영자 메모(고객에게 안 보인다).
 *
 * 접속: `TURSO_DATABASE_URL`·`TURSO_AUTH_TOKEN`이 있으면 그걸 쓰고, 없으면 로그인된 Turso CLI(`~/.turso/turso`, DB `studio-nol`)로
 * 만료 1일 토큰을 만들어 쓴다(루트 CLAUDE.md "운영 DB 마이그레이션 적용 방법"). 토큰은 파일에 쓰지 않는다.
 * 표·컬럼이 없으면(마이그레이션 0060·0062 전) 오류로 멈춘다.
 */
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

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

/** lib이 쓰는 `getDb()`가 읽는 환경 변수를 채운다 — lib을 **동적으로** 불러오므로 그 전에 해야 한다. */
const connect = async () => {
  process.env.TURSO_DATABASE_URL ||= cli('db', 'show', DB_NAME, '--url');
  process.env.TURSO_AUTH_TOKEN ||= cli('db', 'tokens', 'create', DB_NAME, '-e', '1d');
  return import('../lib/payments/paymentLinks');
};

const won = (n: number): string => `${n.toLocaleString('ko-KR')}원`;
const kstLabel = (sec: number): string =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(sec * 1000));

const main = async (): Promise<void> => {
  if (command === 'create') {
    const input = validatePaymentLinkInput({
      itemName: flag('name'), totalAmount: flag('amount'), expiresOn: flag('expires'), memo: flag('memo'),
      sessionAt: flag('session'), sessionHours: flag('hours'), blockSlot: !has('no-block'),
    });
    if (!input.ok) {
      console.error(input.message);
      process.exit(1);
    }
    const v = input.value;
    const split = splitInclusiveAmount(v.totalAmount);
    console.log(`상품명   ${v.itemName}`);
    console.log(`금액     ${won(v.totalAmount)} (부가세 포함) = 공급가 ${won(split.itemAmount)} + 부가세 ${won(split.vatAmount)}`);
    console.log(`이용     ${v.sessionAt ? `${kstLabel(v.sessionAt)} · ${v.sessionHours}시간 — ${v.blockSlot ? '그 시간대를 예약 불가로 차단' : '슬롯은 차단하지 않음'}` : '일시 없음(대시보드·예약 목록에 안 보임)'}`);
    console.log(`만료     ${v.expiresOn ?? '없음(닫을 때까지)'}`);
    console.log(`메모     ${v.memo ?? '-'}`);
    if (!has('yes')) {
      console.log('\n미리보기입니다. 위 금액이 고객이 결제할 총액이 맞으면 --yes를 붙여 다시 실행하세요.');
      return;
    }
    const lib = await connect();
    const { slug, blockId } = await lib.createPaymentLink(v);
    console.log(`\n만들었습니다${blockId ? '(슬롯 차단 포함)' : ''} — 바로 열립니다:\n${SITE}/ko/pay/${slug}`);
    return;
  }

  if (command === 'list') {
    const lib = await connect();
    const rows = await lib.listPaymentLinks(50);
    for (const r of rows) {
      const state = r.closedAt !== null ? '닫힘' : r.open ? '열림' : '만료';
      const use = r.sessionAt ? `  이용 ${kstLabel(r.sessionAt)} ${r.sessionHours}시간${r.blocked ? ' [슬롯 차단 중]' : ''}` : '';
      console.log(`${state}  ${won(r.totalAmount)}  ${r.itemName}${r.memo ? ` (${r.memo})` : ''}  ${r.expiresOn ?? '무기한'}${use}\n      ${SITE}/ko/pay/${r.slug}`);
    }
    if (rows.length === 0) console.log('아직 없습니다.');
    return;
  }

  if (command === 'close') {
    const slug = args[1] ?? '';
    if (!PAYMENT_LINK_SLUG_PATTERN.test(slug)) {
      console.error('사용법: close <slug(24자리 hex)>');
      process.exit(1);
    }
    const lib = await connect();
    const r = await lib.closePaymentLink(slug);
    console.log(r.closed
      ? `닫았습니다.${r.blockReleased ? ' 슬롯 차단도 풀었습니다.' : ''}`
      : '이미 닫혔거나 없는 링크입니다(옛 파일 링크는 data/paymentLinks.ts에서 만료일로 닫습니다).');
    return;
  }

  console.error('사용법:\n  create --name <상품명> --amount <부가세 포함 총액> [--session "YYYY-MM-DD HH:mm" --hours N [--no-block]] [--expires YYYY-MM-DD] [--memo <메모>] [--yes]\n  list\n  close <slug>');
  process.exit(1);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
