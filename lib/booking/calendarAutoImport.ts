import { MANUAL_PLACEHOLDER_EMAIL, MANUAL_PLACEHOLDER_PHONE } from '../privacy/manualPlaceholder';
import { loadUnlinkedCalendarEvents, type UnlinkedCalendarEvent } from '../ops/calendarImport';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { kstDateString, kstDateTime } from './kst';
import { createManualBooking } from './manualEntry';
import { getProduct, occupancyConflictKeys, productHours } from './products';
import { occupiedBookingSql } from './service';

/**
 * **캘린더에 손으로 넣은 일정 → 사이트 예약 자동 등록.** 운영자는 "캘린더에 넣으면 사이트에도 들어가야 한다"고 기대한다(2026-10-17).
 *
 * 캘린더 일정에는 고객·상품·금액이 없으므로 **입금 대기 상태의 수기 예약**으로 만든다(`received: false`) — 시간대가 점유되고 예약 목록·일정 변경이
 * 되지만 **매출에는 잡히지 않아** 금액을 모르는 채 장부가 틀어지지 않는다. 이름은 제목에서 짐작하고(`guessNameFromTitle`), 연락처·이메일은 비운다
 * (고객 메일은 안 나간다). 상품은 임시로 `시간당 레코딩`을 붙이고 금액은 그 상품가×시간이다 — 운영자가 예약 상세에서 고객·금액을 바로잡는다
 * (`lib/booking/manualEdit.ts`). 메모에 `AUTO_IMPORT_NOTE_MARK`가 남아 운영 점검 메일이 "확인 필요"로 알린다.
 *
 * 만드는 순서는 수기 "사이트에 등록"과 같다(`createManualBooking`의 `adoptEventId`): 충돌 검사에서 그 일정 자신을 빼고, 예약이 만들어지면
 * 사이트가 자기 일정을 새로 올린 뒤 원래 일정을 지운다. 사이트가 올린 일정은 감지에서 이미 빠진다. 같은 일정을 두 번 가져오지 못하게
 * 첫 등록이 만든 점유·`[입금 대기]` 일정이 두 번째를 충돌로 막는다.
 *
 * - **자동으로 못 가져오는 일정**(종일·자정을 넘김·영업시간 밖·8시간 초과)은 대시보드 "캘린더에만 있는 일정" 카드에 그대로 남는다.
 * - 30분 단위 일정은 시작을 내리고 끝을 올려 **원래 시간을 덮는** 시 단위로 만들고, 원본 시각을 메모에 남긴다.
 * - 이미 끝난 일정은 가져오지 않는다. 끄려면 env `CALENDAR_AUTO_IMPORT=off`.
 */

export const AUTO_IMPORT_NOTE_MARK = '[캘린더 자동 등록]';
export const AUTO_IMPORT_PRODUCT_ID = 'recording-hourly';
export const AUTO_IMPORT_WINDOW_DAYS = 60;
const MAX_IMPORT_PER_RUN = 10;
const MAX_ATTEMPTS_PER_RUN = 30;
const KST_OFFSET_MS = 9 * 3600 * 1000;

/** "조희정 녹음" → "조희정". 꼬리의 서비스 말(녹음·레코딩·믹싱·예약)과 대괄호 머리말을 걷어 낸다. 비면 제목 전체. */
export const guessNameFromTitle = (title: string): string => {
  const cleaned = title
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .replace(/\s*(녹음|레코딩|믹싱|마스터링|예약|세션)\s*$/u, '')
    .trim();
  return (cleaned || title.trim() || '캘린더 일정').slice(0, 50);
};

export interface AutoImportPlan {
  date: string;
  startHour: number;
  hours: number;
  originalRange: string | null;
}

const clock = (d: Date): string => {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
};

/** 일정이 자동 등록 대상인가 — 대상이면 만들 예약 모양을, 아니면 null(그대로 카드에 남는다). */
export const planAutoImport = (event: Pick<UnlinkedCalendarEvent, 'startAt' | 'endAt' | 'allDay'>, now: Date): AutoImportPlan | null => {
  if (event.allDay) return null;
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  if (end.getTime() <= now.getTime() || end <= start) return null;
  const ks = new Date(start.getTime() + KST_OFFSET_MS);
  const ke = new Date(end.getTime() + KST_OFFSET_MS);
  const date = kstDateString(start);
  const startHour = ks.getUTCHours();
  const endAtMidnight = ke.getUTCHours() === 0 && ke.getUTCMinutes() === 0 && kstDateString(new Date(end.getTime() - 1)) === date;
  if (kstDateString(end) !== date && !endAtMidnight) return null; // 자정을 넘기는 일정
  const endHour = endAtMidnight ? 24 : ke.getUTCHours() + (ke.getUTCMinutes() > 0 ? 1 : 0);
  const hours = endHour - startHour;
  const product = getProduct(AUTO_IMPORT_PRODUCT_ID);
  if (!product || hours < 1 || hours > (product.maxHours ?? 8)) return null;
  const { openHour, closeHour } = productHours(product);
  if (startHour < openHour || endHour > closeHour) return null;
  const exact = ks.getUTCMinutes() === 0 && ke.getUTCMinutes() === 0;
  return { date, startHour, hours, originalRange: exact ? null : `${clock(start)}~${clock(end)}` };
};

/**
 * 그 시간대가 **DB에서** 이미 점유돼 있는가(다른 예약·예약 불가 블록) — 등록을 시도하기 전에 읽기만으로 거른다.
 * `createBookingOrder`는 주문 행을 먼저 만들고 겹침을 검사해 실패하면 `failed` 주문을 남기므로, 매 대시보드 열람마다 같은 충돌 일정을
 * 시도하면 실패 주문이 계속 쌓인다(감사 2026-10-18). 충돌하는 일정은 건너뛰어 카드에 남긴다.
 */
const hasDbConflict = async (plan: AutoImportPlan): Promise<boolean> => {
  const start = Math.floor(kstDateTime(plan.date, plan.startHour).getTime() / 1000);
  const end = Math.floor(kstDateTime(plan.date, plan.startHour + plan.hours).getTime() / 1000);
  const keys = occupancyConflictKeys(null);
  const roomMatch = sql.join(keys.map((k) => (k === null ? sql`b.room_number IS NULL` : sql`b.room_number = ${k}`)), sql` OR `);
  const rows = await getDb().all<{ n: number }>(sql`
    SELECT (
      (SELECT COUNT(*) FROM bookings b WHERE (${roomMatch}) AND b.start_at < ${end} AND b.end_at > ${start} AND ${occupiedBookingSql('b')})
      + (SELECT COUNT(*) FROM availability_blocks ab WHERE ab.room_number IS NULL AND ab.start_at < ${end} AND ab.end_at > ${start})
    ) AS n
  `);
  return Number(rows[0]?.n ?? 0) > 0;
};

export type AutoImportResult = { imported: number; skipped: number; failed: Array<{ eventId: string; reason: string }>; disabled: boolean };

export const autoImportCalendarEvents = async (now: Date = new Date()): Promise<AutoImportResult> => {
  const result: AutoImportResult = { imported: 0, skipped: 0, failed: [], disabled: false };
  if (process.env.CALENDAR_AUTO_IMPORT === 'off') return { ...result, disabled: true };
  const { events, error } = await loadUnlinkedCalendarEvents(now, new Date(now.getTime() + AUTO_IMPORT_WINDOW_DAYS * 86_400_000));
  if (error) return result;
  let attempts = 0;
  for (const event of events) {
    const plan = planAutoImport(event, now);
    if (!plan) { result.skipped += 1; continue; }
    if (result.imported >= MAX_IMPORT_PER_RUN || attempts >= MAX_ATTEMPTS_PER_RUN) break;
    attempts += 1;
    const name = guessNameFromTitle(event.summary);
    // 일정 설명(운영자가 적은 메모)도 보존한다 — 일정이 지워지므로 여기 안 남기면 사라진다.
    const detail = event.description.replace(/\s+/g, ' ').trim().slice(0, 200);
    const note = [AUTO_IMPORT_NOTE_MARK, event.summary, plan.originalRange ? `(캘린더 원본 ${plan.originalRange})` : null, detail ? `· 메모: ${detail}` : null, '— 고객·금액을 확인해 주세요'].filter(Boolean).join(' ');
    try {
      if (await hasDbConflict(plan)) { result.skipped += 1; continue; }
      const outcome = await createManualBooking(
        {
          kind: 'session', customerName: name, customerPhone: MANUAL_PLACEHOLDER_PHONE, customerEmail: MANUAL_PLACEHOLDER_EMAIL,
          customerNote: note.slice(0, 500), totalAmount: null, received: false, method: '계좌 입금',
          payload: {
            productId: AUTO_IMPORT_PRODUCT_ID, hours: plan.hours, date: plan.date, startHour: plan.startHour,
            customerName: name, customerPhone: MANUAL_PLACEHOLDER_PHONE, customerEmail: MANUAL_PLACEHOLDER_EMAIL,
            customerNote: note.slice(0, 500), refundPolicyAgreed: true,
          },
        },
        now,
        { adoptEventId: event.id, expectEventWindow: { startAt: event.startAt, endAt: event.endAt } },
      );
      if (outcome.ok) {
        result.imported += 1;
        if (outcome.warnings.length > 0) console.warn('[calendar-auto-import] 등록은 됐지만 경고', { eventId: event.id, warnings: outcome.warnings });
      }
      else result.failed.push({ eventId: event.id, reason: outcome.message });
    } catch (error) {
      result.failed.push({ eventId: event.id, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  if (result.failed.length > 0) console.warn('[calendar-auto-import] 자동 등록하지 못한 일정', result.failed);
  return result;
};
