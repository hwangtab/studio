import { and, eq, gte, isNull, lt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { sessionMusicians } from '../../db/schema';
import { SESSION_RECONFIRM_AFTER_MONTHS, SESSION_RETENTION_YEARS } from '../../data/sessionMusicians';
import { isMissingTableError } from '../dbErrors';
import { FieldCryptoError } from '../crypto/fieldCrypto';
import { manageLinkUrl, sendReconfirmMail } from './email';
import { openSessionPrivate } from './privateData';
import { generateManageToken, hashManageToken } from './tokens';

/**
 * 세션 연주자 등록의 보유 기간 — **마지막 확인일(`last_confirmed_at`)로부터 2년**, 지나면 행을 지운다.
 * 처리방침 3항·18항 자동 파기 ⑯과 폼 동의 요약이 같은 약속을 한다(바꾸면 셋을 함께 — `data/sessionMusicians.ts`의 상수 하나).
 * 월 1회 크론(`/api/cron/purge-contracts`)이 부른다. 새 크론을 만들지 않는다.
 *
 * - `inactive`(운영자가 내린 것)도 같은 기한을 탄다.
 * - 이미 지운 건은 건너뛰므로 재시도해도 안전하다.
 * - 표가 없으면(마이그레이션 0077 전) 아무것도 지우지 않고 `skipped`로 돌아간다 — 파기 크론 전체가 500이 되지 않게.
 *
 * 1년 9개월째에는 "아직 세션 연주 하세요?" 메일을 한 번 보낸다(`sendSessionMusicianReconfirmNotices`).
 * 본인이 관리 링크에서 확인하거나 고치면 `last_confirmed_at`이 갱신되어 기한이 다시 2년으로 이어진다.
 */

/** 기준 시각에서 달력상 N개월 전. */
const monthsBefore = (now: Date, months: number): Date => {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
};

export const retentionCutoff = (now: Date): Date => monthsBefore(now, SESSION_RETENTION_YEARS * 12);
export const reconfirmCutoff = (now: Date): Date => monthsBefore(now, SESSION_RECONFIRM_AFTER_MONTHS);

export interface SessionPurgeResult {
  deleted: number;
  /** 표가 없어 건너뛰었다(마이그레이션 0077 전). */
  skipped?: 'table_missing';
}

export const purgeExpiredSessionMusicians = async (now: Date = new Date()): Promise<SessionPurgeResult> => {
  try {
    const result = await getDb().delete(sessionMusicians).where(lt(sessionMusicians.lastConfirmedAt, retentionCutoff(now)));
    return { deleted: Number(result.rowsAffected) };
  } catch (error: unknown) {
    if (isMissingTableError(error, 'session_musicians')) return { deleted: 0, skipped: 'table_missing' };
    throw error;
  }
};

export interface SessionReconfirmResult {
  sent: number;
  /** 보내지 못한 건 — 메일 실패·복호화 실패. 다음 달 크론이 보유 기한 안에서 다시 시도한다. */
  failed: number;
  skipped?: 'table_missing';
}

/**
 * 마지막 확인으로부터 21개월이 지났고 기한(24개월) 안이며 이번 기간에 아직 보내지 않은 등록에 재확인 메일을 보낸다.
 *
 * - **한 기간에 한 번만**: 보내기 전에 `reconfirm_sent_at`을 조건부 UPDATE로 먼저 잡는다(`WHERE reconfirm_sent_at IS NULL`).
 *   크론이 겹쳐도 한 통만 나간다. 본인이 확인·수정하면 이 표시가 NULL로 돌아가 다음 기간에 다시 보낼 수 있다.
 * - 관리 토큰은 해시만 저장하므로 **새 토큰을 발급해** 링크를 만든다(이전 링크는 못 쓰게 된다 — 메일에 그렇게 적혀 있다).
 * - 메일이 실패하면 표시와 이전 토큰을 되돌려 다음 달에 다시 시도한다. 광고성 문구 없음 — 보유 기간 안내다.
 * - 이름만 메일에 싣는다(활동명). 이메일 복호화는 이 발송을 위해서만 하며, 평문을 로그에 남기지 않는다.
 */
export const sendSessionMusicianReconfirmNotices = async (now: Date = new Date()): Promise<SessionReconfirmResult> => {
  const db = getDb();
  let due: Array<{ id: string; stageName: string; privateEnc: string; manageTokenHash: string }>;
  try {
    due = await db
      .select({
        id: sessionMusicians.id,
        stageName: sessionMusicians.stageName,
        privateEnc: sessionMusicians.privateEnc,
        manageTokenHash: sessionMusicians.manageTokenHash,
      })
      .from(sessionMusicians)
      .where(
        and(
          lt(sessionMusicians.lastConfirmedAt, reconfirmCutoff(now)),
          gte(sessionMusicians.lastConfirmedAt, retentionCutoff(now)),
          isNull(sessionMusicians.reconfirmSentAt),
        ),
      );
  } catch (error: unknown) {
    if (isMissingTableError(error, 'session_musicians')) return { sent: 0, failed: 0, skipped: 'table_missing' };
    throw error;
  }

  let sent = 0;
  let failed = 0;
  for (const row of due) {
    const token = generateManageToken();
    const newHash = hashManageToken(token);
    // 먼저 잡는다 — 0행이면 다른 실행이 이미 잡았거나, 읽은 뒤 본인이 확인·수정했거나(기한 창을 벗어남),
    // 관리 링크가 재발송으로 바뀌었다(읽어 둔 토큰이 낡음). 셋 다 이번에는 보내지 않는다(2026-10-23 리뷰).
    const claimed = await db
      .update(sessionMusicians)
      .set({ reconfirmSentAt: now, manageTokenHash: newHash })
      .where(
        and(
          eq(sessionMusicians.id, row.id),
          isNull(sessionMusicians.reconfirmSentAt),
          lt(sessionMusicians.lastConfirmedAt, reconfirmCutoff(now)),
          eq(sessionMusicians.manageTokenHash, row.manageTokenHash),
        ),
      );
    if (claimed.rowsAffected === 0) continue;

    let error: string | null;
    try {
      const { email } = openSessionPrivate(row.privateEnc);
      error = await sendReconfirmMail(email, row.stageName, manageLinkUrl(token));
    } catch (cause: unknown) {
      error = cause instanceof FieldCryptoError ? `decrypt:${cause.code}` : 'unknown';
    }
    if (error === null) {
      sent += 1;
      continue;
    }
    failed += 1;
    console.error(`[session-musicians] 재확인 메일 실패 (id=${row.id}):`, error);
    // 다음 달에 다시 시도할 수 있게 표시와 토큰을 되돌린다 — 새 링크가 본인에게 가지 않았으니 이전 링크를 죽이면 안 된다.
    await db
      .update(sessionMusicians)
      .set({ reconfirmSentAt: null, manageTokenHash: row.manageTokenHash })
      .where(and(eq(sessionMusicians.id, row.id), eq(sessionMusicians.reconfirmSentAt, now), eq(sessionMusicians.manageTokenHash, newHash)));
  }
  return { sent, failed };
};
