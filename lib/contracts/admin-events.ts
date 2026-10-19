import { desc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { contractAdminEvents } from '../../db/schema';
import type { ContractAdminAction } from './admin-event-labels';

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
