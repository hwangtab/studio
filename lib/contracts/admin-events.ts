import { and, desc, eq, gte, lt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { contractAdminEvents, contracts } from '../../db/schema';
import { kstDateTime } from '../booking/kst';
import { CONTRACT_ADMIN_ACTION_LABELS, type ContractAdminAction } from './admin-event-labels';

/**
 * 관리자의 계약 변경 행위 이력 — 누가·언제·무슨 행위를 했는가(db/schema.ts `contractAdminEvents`).
 *
 * 열람은 `contract_view` 접속기록이 남기지만 변경은 행위자가 어디에도 없었다. 서버 로그는 보존 기간이 짧아
 * "누가 이 계약을 종료·삭제했는가"를 몇 달 뒤 묻기 어려웠다.
 */
export type { ContractAdminAction } from './admin-event-labels';

export interface ContractChange {
  contractId: string;
  action: ContractAdminAction;
  actor: string;
  /** 행위 직전 계약 상태. 생성은 null. */
  fromStatus: string | null;
  /** 행위 직후 계약 상태. 삭제는 null(행이 사라진다). */
  toStatus: string | null;
}

/**
 * 변경 행위를 남긴다 — 서버 로그와 DB 양쪽에.
 *
 * **실패해도 던지지 않는다.** 이력은 부가 기록이라 표가 아직 없는 환경(마이그레이션 전 배포)이나 일시적 DB 오류가
 * 이미 끝난 변경을 실패로 만들면 안 된다. 그래서 서버 로그를 항상 먼저 남기고(DB가 죽어도 행위자는 로그에 있다),
 * DB 기록 실패는 로그에 사유를 적는다. 계약 id·행위·수행자만 다루고 개인정보는 싣지 않는다.
 */
export const recordContractChange = async (change: ContractChange): Promise<void> => {
  console.warn(
    `[contracts] 관리자 작업 (contractId=${change.contractId}, action=${change.action}, actor=${change.actor})`,
  );
  try {
    await getDb().insert(contractAdminEvents).values({
      contractId: change.contractId,
      action: change.action,
      actor: change.actor,
      fromStatus: change.fromStatus,
      toStatus: change.toStatus,
    });
  } catch (error: unknown) {
    console.error(`[contracts/admin-events] 이력 저장 실패 (contractId=${change.contractId}, action=${change.action}):`, error);
  }
};

export interface SerializedContractAdminEvent {
  id: string;
  action: string;
  actor: string;
  fromStatus: string | null;
  toStatus: string | null;
  at: string;
}

/** 계약 한 건의 변경 이력, 최신순. 표를 못 읽으면(마이그레이션 전) 빈 목록 — 화면이 깨지지 않는다. */
export const listContractAdminEvents = async (contractId: string): Promise<SerializedContractAdminEvent[]> => {
  try {
    const rows = await getDb()
      .select()
      .from(contractAdminEvents)
      .where(eq(contractAdminEvents.contractId, contractId))
      .orderBy(desc(contractAdminEvents.at));
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      at: row.at.toISOString(),
    }));
  } catch (error: unknown) {
    console.error(`[contracts/admin-events] 이력 조회 실패 (contractId=${contractId}):`, error);
    return [];
  }
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ContractEventFilter {
  actor?: string;
  action?: string;
  contractId?: string;
  /** KST 달력 날짜(YYYY-MM-DD), 양 끝 포함. */
  from?: string;
  to?: string;
  limit: number;
}

export interface ContractEventListRow extends SerializedContractAdminEvent {
  contractId: string;
  /** 계약이 아직 있으면 그 호실. 삭제된 초안이면 null — 이름·연락처는 목록에 싣지 않는다. */
  roomNumber: string | null;
}

/**
 * 전체 이력 검색(관리자 "작업 이력" 화면·CSV). 최신순, `limit`건까지.
 *
 * **표가 없으면 던진다** — 계약 상세의 한 건 조회(`listContractAdminEvents`)와 달리 이 화면은 이력이 목적이라
 * "기록이 없다"로 보이면 마이그레이션 전이라는 사실을 숨긴다. 호출부가 잡아 적용 방법을 알린다.
 * 계약의 이름·연락처는 읽지 않는다(호실만) — 이 목록은 `contract_view` 접속기록을 남기지 않는 자리다.
 */
export const searchContractAdminEvents = async (filter: ContractEventFilter): Promise<ContractEventListRow[]> => {
  const conditions = [];
  if (filter.actor) conditions.push(eq(contractAdminEvents.actor, filter.actor));
  if (filter.action) conditions.push(eq(contractAdminEvents.action, filter.action));
  if (filter.contractId) conditions.push(eq(contractAdminEvents.contractId, filter.contractId));
  if (filter.from && DATE_RE.test(filter.from)) conditions.push(gte(contractAdminEvents.at, kstDateTime(filter.from, 0)));
  if (filter.to && DATE_RE.test(filter.to)) conditions.push(lt(contractAdminEvents.at, kstDateTime(filter.to, 24)));

  const rows = await getDb()
    .select({ event: contractAdminEvents, roomNumber: contracts.roomNumber })
    .from(contractAdminEvents)
    .leftJoin(contracts, eq(contracts.id, contractAdminEvents.contractId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contractAdminEvents.at))
    .limit(filter.limit);

  return rows.map(({ event, roomNumber }) => ({
    id: event.id,
    contractId: event.contractId,
    action: event.action,
    actor: event.actor,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    at: event.at.toISOString(),
    roomNumber: roomNumber ?? null,
  }));
};

/** 필터 선택지용 — 이력에 나온 수행자 목록. 표가 없으면 빈 목록. */
export const listContractEventActors = async (): Promise<string[]> => {
  try {
    const rows = await getDb()
      .selectDistinct({ actor: contractAdminEvents.actor })
      .from(contractAdminEvents)
      .orderBy(contractAdminEvents.actor);
    return rows.map((row) => row.actor);
  } catch {
    return [];
  }
};

/**
 * 쿼리스트링 → 필터. 화면과 CSV가 같은 규칙을 쓴다(둘이 다르면 화면에서 본 건수와 내려받은 건수가 갈린다).
 * 모르는 행위 값·형식이 틀린 날짜는 조용히 무시한다 — 잘못된 URL이 500이 되지 않게.
 */
export const parseContractEventFilter = (
  query: Record<string, string | string[] | undefined>,
  limit: number,
): ContractEventFilter => {
  const one = (key: string): string | undefined => {
    const value = query[key];
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 64) : undefined;
  };
  const action = one('action');
  const from = one('from');
  const to = one('to');
  return {
    actor: one('actor'),
    action: action && Object.prototype.hasOwnProperty.call(CONTRACT_ADMIN_ACTION_LABELS, action) ? action : undefined,
    contractId: one('contract'),
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    limit,
  };
};
