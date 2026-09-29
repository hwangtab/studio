import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { PAYMENT_ORDER_NO_PATTERN } from './recordFailure';

/**
 * 결제창을 열었다는 기록(`payment_window_opens`, db/schema.ts 주석 참고).
 *
 * 만료된 주문을 두고 "폼에서 떠났나, 결제창까지 갔다가 떠났나"를 가르려고 둔다. 원문
 * User-Agent는 저장하지 않고 인앱 여부를 가를 만큼만 분류한다.
 */

export type PaymentBrowserKind = 'kakaotalk' | 'instagram' | 'facebook' | 'naver' | 'line' | 'mobile' | 'desktop';

export const PAYMENT_BROWSER_LABEL: Record<PaymentBrowserKind, string> = {
  kakaotalk: '카카오톡 인앱',
  instagram: '인스타그램 인앱',
  facebook: '페이스북 인앱',
  naver: '네이버 앱',
  line: '라인 인앱',
  mobile: '모바일 브라우저',
  desktop: '데스크톱',
};

/** 인앱 표식을 먼저 본다 — 인앱 브라우저의 UA에도 Mobile·Safari가 들어 있다. */
export const classifyPaymentBrowser = (userAgent: string | null | undefined): PaymentBrowserKind => {
  const ua = userAgent ?? '';
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'facebook';
  if (/NAVER\(inapp|NAVER\//i.test(ua)) return 'naver';
  if (/\bLine\//.test(ua)) return 'line';
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) return 'mobile';
  return 'desktop';
};

/**
 * 결제 대기(pending) 주문에만 적는다. 확정·환불된 주문에 뒤늦은 비콘이 와도 기록을 흐리지
 * 않게. **best-effort** — 표가 없거나(마이그레이션 0043 전) 쓰기가 실패하면 로그만 남긴다.
 * 결제창은 이미 열리고 있으므로 여기서 던지면 안 된다.
 */
export const recordPaymentWindowOpen = async (input: { orderNo: string; userAgent: string | null | undefined; now?: Date }): Promise<boolean> => {
  const orderNo = input.orderNo.toUpperCase();
  if (!PAYMENT_ORDER_NO_PATTERN.test(orderNo)) return false;
  const at = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const browser = classifyPaymentBrowser(input.userAgent);
  try {
    const result = await getDb().run(sql`
      INSERT INTO payment_window_opens (order_id, first_opened_at, last_opened_at, open_count, browser)
      SELECT id, ${at}, ${at}, 1, ${browser} FROM orders WHERE order_no = ${orderNo} AND status = 'pending'
      ON CONFLICT(order_id) DO UPDATE SET
        last_opened_at = excluded.last_opened_at,
        open_count = payment_window_opens.open_count + 1,
        browser = excluded.browser
    `);
    return Number(result.rowsAffected) > 0;
  } catch (error) {
    console.error('[payments] 결제창 열기 기록 실패', { orderNo, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
};

/** 관리자 화면용 — 없으면 null. 조회 실패(표 없음 포함)도 null로 삼킨다. */
export const loadPaymentWindowOpen = async (orderId: string): Promise<{
  firstOpenedAt: string; lastOpenedAt: string; openCount: number; browserLabel: string;
} | null> => {
  try {
    const rows = await getDb().all<{ first_opened_at: number; last_opened_at: number; open_count: number; browser: string }>(sql`
      SELECT first_opened_at, last_opened_at, open_count, browser FROM payment_window_opens WHERE order_id = ${orderId}
    `);
    const r = rows[0];
    if (!r) return null;
    return {
      firstOpenedAt: new Date(Number(r.first_opened_at) * 1000).toISOString(),
      lastOpenedAt: new Date(Number(r.last_opened_at) * 1000).toISOString(),
      openCount: Number(r.open_count),
      browserLabel: PAYMENT_BROWSER_LABEL[r.browser as PaymentBrowserKind] ?? r.browser,
    };
  } catch (error) {
    console.error('[payments] 결제창 열기 기록 조회 실패', { orderId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};
