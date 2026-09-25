import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { privacyAccessLogs, privacyAccessActionEnum } from '../../db/schema';
import type { PrivacyAccessAction, PrivacyAccessResult } from './accessLog';

/**
 * 접속기록을 **읽는** 경로.
 *
 * 기록만 쌓이고 읽을 길이 없으면 사람별로 나눠 놓은 효과를 확인할 수 없다. 여기서
 * 하는 일은 조회 하나뿐이다 — 쓰기·수정·삭제 경로는 만들지 않는다. 2년이 지난 행을
 * 지우는 것은 `purgeExpiredPrivacyAccessLogs`(cron) 한 곳의 몫이다.
 */

/** 화면이 한 번에 보여 주는 최대 행수. 최신순이라 앞쪽이 지금 필요한 것들이다. */
export const PRIVACY_LOG_PAGE_SIZE = 200;

export interface PrivacyAccessLogRow {
  id: string;
  actor: string;
  action: PrivacyAccessAction;
  targetId: string;
  result: PrivacyAccessResult;
  rowCount: number | null;
  ip: string | null;
  at: string;
}

export interface PrivacyAccessLogFilter {
  actor?: string | null;
  action?: string | null;
}

/** 드롭다운에 들어가는 행위 목록 — 스키마의 enum을 그대로 쓴다(둘이 갈리지 않게). */
export const PRIVACY_ACCESS_ACTIONS: readonly string[] = privacyAccessActionEnum;

const isKnownAction = (value: string): value is PrivacyAccessAction =>
  (privacyAccessActionEnum as readonly string[]).includes(value);

/** 쿼리스트링으로 들어온 행위 이름을 거른다 — 모르는 값은 필터 없음으로 본다. */
export const normalizeActionFilter = (value: unknown): PrivacyAccessAction | null =>
  typeof value === 'string' && isKnownAction(value) ? value : null;

/**
 * 수행자 필터 값. 목록 자체가 기록에서 나오므로 형식만 본다 —
 * `admin`·`kyungha` 같은 계정 id와 `creator:<id>` 두 꼴이 들어온다.
 */
export const normalizeActorFilter = (value: unknown): string | null =>
  typeof value === 'string' && /^[A-Za-z0-9_:-]{1,80}$/.test(value) ? value : null;

/** 최신순 200건. 필터는 있으면 걸고 없으면 전부. */
export const listPrivacyAccessLogs = async (
  filter: PrivacyAccessLogFilter = {},
  limit: number = PRIVACY_LOG_PAGE_SIZE,
): Promise<PrivacyAccessLogRow[]> => {
  const conditions = [
    filter.actor ? eq(privacyAccessLogs.actor, filter.actor) : undefined,
    filter.action ? eq(privacyAccessLogs.action, filter.action as PrivacyAccessAction) : undefined,
  ].filter(Boolean);

  const rows = await getDb()
    .select()
    .from(privacyAccessLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(privacyAccessLogs.at))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    targetId: row.targetId,
    result: row.result,
    rowCount: row.rowCount,
    ip: row.ip,
    at: row.at.toISOString(),
  }));
};

/**
 * 드롭다운에 채울 수행자 목록.
 *
 * 계정 설정(`ADMIN_ACCOUNTS`)이 아니라 **기록에 실제로 있는 값**에서 뽑는다 — 그래야
 * 지금은 빠진 옛 담당자나 개설자(`creator:<id>`)도 걸러 볼 수 있다.
 */
export const listPrivacyAccessActors = async (): Promise<string[]> => {
  const rows = await getDb()
    .selectDistinct({ actor: privacyAccessLogs.actor })
    .from(privacyAccessLogs);
  return rows.map((r) => r.actor).sort((a, b) => a.localeCompare(b));
};
