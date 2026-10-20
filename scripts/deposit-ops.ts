/* eslint-disable no-console */
/**
 * 계좌 입금 대기 주문 조회·입금 확인·미입금 취소 — 관리자 화면 버튼과 **같은 서비스 함수**를 운영 DB에 대고 부른다
 * (발권·결제 행·확정 메일·캘린더 후처리가 화면에서 누른 것과 같다). 규칙은 lib/payments/bankDeposit.ts 머리 주석.
 *
 *   node --env-file=.env.local --import tsx scripts/deposit-ops.ts list
 *   node --env-file=.env.local --import tsx scripts/deposit-ops.ts confirm <주문번호> [--yes]
 *   node --env-file=.env.local --import tsx scripts/deposit-ops.ts cancel  <주문번호> [--yes]
 *
 * - `--yes`가 없으면 주문 요약(개인정보 없음)만 보여 주고 멈춘다. **돈을 실제로 받았다는 운영자 확인이 있을 때만** `--yes`를 붙인다.
 * - 대상: 예약·믹싱·예약금 링크(`session`·`mixing`·`deposit`), 공연(`ticket`), 상점(`merch`). 펀딩은 자기 표를 쓰므로
 *   관리자 후원 상세 화면에서 처리한다. 소프트웨어는 계좌 입금이 없다.
 * - 접속: `.env.local`의 RESEND·구글 키는 쓰되, 운영 DB는 로그인된 Turso CLI로 만료 1일 토큰을 만들어 쓴다(파일에 쓰지 않는다).
 * - 공연 페이지 캐시(`revalidateShow`)는 요청 컨텍스트가 없어 부르지 않는다 — 잔여 좌석 표시가 잠깐 늦을 수 있다.
 */
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

const TURSO = `${homedir()}/.turso/turso`;
const DB_NAME = 'studio-nol';
const cli = (...a: string[]): string => execFileSync(TURSO, a, { encoding: 'utf8' }).trim();

const [command, orderNo] = process.argv.slice(2);
const yes = process.argv.includes('--yes');
const won = (n: number): string => `${n.toLocaleString('ko-KR')}원`;
const kst = (sec: number): string => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(sec * 1000));

const main = async (): Promise<void> => {
  process.env.TURSO_DATABASE_URL = cli('db', 'show', DB_NAME, '--url');
  process.env.TURSO_AUTH_TOKEN = cli('db', 'tokens', 'create', DB_NAME, '-e', '1d');
  const { getDb } = await import('../db/client');
  const db = getDb();

  if (command === 'list') {
    const rows = await db.query.orders.findMany({ where: (o, { eq }) => eq(o.status, 'awaiting_deposit'), orderBy: (o, { asc }) => asc(o.createdAt) });
    if (rows.length === 0) return console.log('입금 대기 주문 없음');
    for (const o of rows) console.log(`${o.orderNo}  ${o.type.padEnd(8)} ${won(o.totalAmount).padStart(12)}  접수 ${kst(Math.floor(o.createdAt.getTime() / 1000))}`);
    return;
  }

  if ((command !== 'confirm' && command !== 'cancel') || !orderNo) {
    console.error('사용법: deposit-ops.ts list | confirm <주문번호> [--yes] | cancel <주문번호> [--yes]');
    process.exit(1);
  }
  const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
  if (!order) throw new Error(`주문 ${orderNo}을(를) 찾을 수 없습니다.`);
  console.log(`${order.orderNo}  ${order.type}  ${won(order.totalAmount)}  상태 ${order.status}`);
  if (order.status !== 'awaiting_deposit') throw new Error('입금 대기 상태가 아닙니다.');
  if (!['session', 'mixing', 'deposit', 'ticket', 'merch'].includes(order.type)) throw new Error(`${order.type} 주문은 이 스크립트 대상이 아닙니다(펀딩은 관리자 후원 상세에서).`);
  if (!yes) return console.log(`\n미리보기입니다. ${command === 'confirm' ? '돈을 받은 것을 확인했으면' : '미입금으로 닫는 게 맞으면'} --yes를 붙여 다시 실행하세요.`);

  const now = new Date();
  let result: unknown;
  if (order.type === 'ticket') {
    const m = await import('../lib/shows/bankDeposit');
    result = command === 'confirm' ? await m.confirmShowBankDeposit({ orderId: order.id, now }) : await m.cancelAwaitingShowDeposit({ orderId: order.id });
  } else if (order.type === 'merch') {
    const m = await import('../lib/shop/bankDeposit');
    result = command === 'confirm' ? await m.confirmShopBankDeposit({ orderNo, now }) : await m.cancelAwaitingShopDeposit({ orderNo });
  } else {
    const m = await import('../lib/booking/bankDeposit');
    result = command === 'confirm' ? await m.confirmBookingBankDeposit({ orderId: order.id, now }) : await m.cancelAwaitingBookingDeposit({ orderId: order.id });
  }
  console.log(JSON.stringify(result));
  const after = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
  console.log(`처리 후 상태: ${after?.status}`);
};

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
