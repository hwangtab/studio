import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { showOrderLocales } from '../../db/schema';
import type { ShowLocale } from './i18n';

/**
 * 공연 주문의 화면 언어 — 영어 화면으로 예매한 주문만 `show_order_locales`(0050)에 행을 남긴다. 없으면 한국어.
 *
 * 둘 다 던지지 않는다(lib/contracts/template-snapshot.ts와 같은 방식). 언어는 메일·링크 언어를 고르는 보조
 * 정보라, 표가 아직 없는 환경(마이그레이션 전 배포)이나 일시적 DB 오류로 주문·결제 확인을 막으면 안 된다.
 * 실패하면 한국어로 동작하고 로그를 남긴다 — `[shows/order-locale]`이 보이면 0050 적용 여부를 확인한다.
 */
export async function saveShowOrderLocale(orderNo: string, locale: ShowLocale): Promise<void> {
  if (locale === 'ko') return;
  try {
    await getDb().insert(showOrderLocales).values({ orderNo, locale }).onConflictDoNothing();
  } catch (error: unknown) {
    console.error(`[shows/order-locale] 저장 실패 ${orderNo}:`, error);
  }
}

export async function loadShowOrderLocale(orderNo: string): Promise<ShowLocale> {
  try {
    const row = await getDb().query.showOrderLocales.findFirst({ where: eq(showOrderLocales.orderNo, orderNo) });
    return row?.locale === 'en' ? 'en' : 'ko';
  } catch (error: unknown) {
    console.error(`[shows/order-locale] 조회 실패 ${orderNo}:`, error);
    return 'ko';
  }
}
