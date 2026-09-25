import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { FUNDING_DESIGN_PRICE } from '../../data/pricing';
import {
  fundingProjects,
  fundingProjectServices,
  type FundingProjectService,
  type FundingProjectServiceKind,
} from '../../db/schema';

/**
 * 펀딩 프로젝트의 스튜디오 서비스(설계 대행·발매 프로젝트 연계) — 운영자 전용.
 * 스키마 주석: db/schema.ts fundingProjectServices.
 *
 * **읽기는 던지지 않는다.** 이 테이블을 읽는 곳은 관리자 심사 화면뿐이고, 서비스 칸 하나 때문에
 * 심사·정산 화면 전체가 500이 되면 안 된다(정산 집계 실패를 다루는 방식과 같다). 대신 실패를
 * 두 갈래로 나눠 돌려준다 — `missing_table`(마이그레이션 0037 미적용: 화면이 적용 방법을 안내)과
 * `error`(그 밖의 DB 장애: 로그에 남기고 화면은 "불러오지 못함"). 둘을 합치면 진짜 장애가
 * "마이그레이션을 돌리세요"로 가려져 운영자가 엉뚱한 조치를 한다.
 *
 * 쓰기는 테이블 부재만 `unavailable`로 바꾸고 나머지 오류는 그대로 던진다(라우트가 500).
 */

export type ProjectServiceView = {
  kind: FundingProjectServiceKind;
  /** 약정 설계비(공급가, 부가세 별도). */
  designFee: number;
  /** ISO 문자열 — getServerSideProps로 직렬화된다. null이면 미입금. */
  designFeePaidAt: string | null;
};

export const PROJECT_SERVICE_LABELS: Record<FundingProjectServiceKind, string> = {
  none: '직접 개설',
  design: '펀딩 설계 대행',
  release: '발매 프로젝트 연계',
};

export const isMissingServicesTable = (error: unknown): boolean => {
  const texts: string[] = [];
  let current: unknown = error;
  // libsql은 원인을 cause로 감싸기도 한다 — 사슬을 따라가며 문구를 모은다.
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof Error) {
      texts.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      texts.push(String(current));
      break;
    }
  }
  return texts.some((t) => /no such table:?\s*`?funding_project_services`?/i.test(t));
};

const toView = (row: FundingProjectService): ProjectServiceView => ({
  kind: row.kind,
  designFee: row.designFee,
  designFeePaidAt: row.designFeePaidAt ? row.designFeePaidAt.toISOString() : null,
});

export type ServiceUnavailableReason = 'missing_table' | 'error';

export type LoadServiceResult =
  | { available: true; service: ProjectServiceView | null }
  | { available: false; reason: ServiceUnavailableReason };

const unavailable = (error: unknown, where: string): { available: false; reason: ServiceUnavailableReason } => {
  if (isMissingServicesTable(error)) return { available: false, reason: 'missing_table' };
  console.error(`[funding] ${where} 실패`, error);
  return { available: false, reason: 'error' };
};

export const loadProjectService = async (projectId: string): Promise<LoadServiceResult> => {
  try {
    const rows = await getDb()
      .select()
      .from(fundingProjectServices)
      .where(eq(fundingProjectServices.projectId, projectId))
      .limit(1);
    return { available: true, service: rows[0] ? toView(rows[0]) : null };
  } catch (error) {
    return unavailable(error, 'loadProjectService');
  }
};

export type LoadServiceMapResult =
  | { available: true; byProjectId: Record<string, ProjectServiceView> }
  | { available: false; reason: ServiceUnavailableReason };

export const loadProjectServiceMap = async (): Promise<LoadServiceMapResult> => {
  try {
    const rows = await getDb().select().from(fundingProjectServices);
    return { available: true, byProjectId: Object.fromEntries(rows.map((r) => [r.projectId, toView(r)])) };
  } catch (error) {
    return unavailable(error, 'loadProjectServiceMap');
  }
};

export type ServiceWriteResult =
  | { ok: true; service: ProjectServiceView | null }
  | { ok: false; code: 'not_found' | 'unavailable' | 'no_service' };

/**
 * 서비스 종류를 정한다.
 *
 * 이미 행이 있으면 **종류만 바꾸고 약정 설계비·입금 시각은 그대로 둔다** — 설계 대행으로
 * 시작했다가 제작까지 맡기로 해도(design → release) 이미 약정·입금한 설계비는 같은 돈이다.
 * 새로 만들 때만 지금의 FUNDING_DESIGN_PRICE를 약정가로 복사한다.
 *
 * **`none`(직접 개설로 되돌림)도 행을 지우지 않는다.** 예전에는 DELETE였는데, 그러면 되돌렸다
 * 재지정하는 왕복 한 번에 약정가가 **그때의 정가로 재발행**되고 입금 확인 시각이 사라졌다 —
 * 정가가 50만 → 60만으로 오른 뒤라면 이미 받은 55만원이 화면에서 "미입금"이 되고 청구액이
 * 66만으로 바뀐다. 게다가 그 어긋남을 드러내라고 만든 "현재 정가와 다름" 배지는 재발행값이
 * 정의상 현재 정가와 같아서 침묵한다. 행을 남기면 재지정이 위 onConflictDoUpdate를 타고
 * 금액·입금 시각을 그대로 되살린다.
 *
 * 행이 **처음부터 없으면** `none`은 아무것도 만들지 않는다 — 약정한 적 없는 설계비를 적을
 * 이유가 없다.
 */
export const setProjectService = async (
  projectId: string,
  kind: FundingProjectServiceKind,
  now: Date,
  actor: string,
): Promise<ServiceWriteResult> => {
  const db = getDb();
  const project = await db
    .select({ id: fundingProjects.id })
    .from(fundingProjects)
    .where(eq(fundingProjects.id, projectId))
    .limit(1);
  if (!project[0]) return { ok: false, code: 'not_found' };

  try {
    if (kind === 'none') {
      const [reverted] = await db
        .update(fundingProjectServices)
        .set({ kind, updatedAt: now })
        .where(eq(fundingProjectServices.projectId, projectId))
        .returning();
      console.warn(`[funding] 스튜디오 서비스 지정 (projectId=${projectId}, kind=none, actor=${actor})`);
      return { ok: true, service: reverted ? toView(reverted) : null };
    }
    const [row] = await db
      .insert(fundingProjectServices)
      .values({ projectId, kind, designFee: FUNDING_DESIGN_PRICE, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: fundingProjectServices.projectId,
        set: { kind, updatedAt: now },
      })
      .returning();
    console.warn(`[funding] 스튜디오 서비스 지정 (projectId=${projectId}, kind=${kind}, actor=${actor})`);
    return { ok: true, service: toView(row) };
  } catch (error) {
    if (isMissingServicesTable(error)) return { ok: false, code: 'unavailable' };
    throw error;
  }
};

/**
 * 설계비 입금 확인을 켜거나 끈다. 서비스가 지정되지 않은 프로젝트면 no_service.
 *
 * **수행자를 서버 로그에 남긴다.** 이 자리는 시스템 밖의 돈(55만원 = 공급가 50만 + 부가세)이
 * 통장에 들어온 것을 사람이 눈으로 확인해 기록하는 곳인데, 남는 것이 타임스탬프 하나뿐이라
 * 나중에 통장 대사에서 그 돈이 안 보일 때 누가 무엇을 보고 눌렀는지 물을 수단이 없었다.
 * 개설자 계정 변경과 같은 방식이다(새 컬럼 없이 서버 로그 — pages/api/admin/funding/projects/[id].ts).
 * 정산 쪽이 쓰는 privacy_access_logs는 개인정보 복호화 기록이라 이 액션에는 맞지 않는다.
 */
export const setDesignFeePaid = async (
  projectId: string,
  paid: boolean,
  now: Date,
  actor: string,
): Promise<ServiceWriteResult> => {
  try {
    const rows = await getDb()
      .update(fundingProjectServices)
      .set({ designFeePaidAt: paid ? now : null, updatedAt: now })
      .where(eq(fundingProjectServices.projectId, projectId))
      .returning();
    if (!rows[0]) return { ok: false, code: 'no_service' };
    console.warn(
      `[funding] 설계비 입금 ${paid ? '확인' : '확인 취소'} `
        + `(projectId=${projectId}, designFee=${rows[0].designFee}, actor=${actor})`,
    );
    return { ok: true, service: toView(rows[0]) };
  } catch (error) {
    if (isMissingServicesTable(error)) return { ok: false, code: 'unavailable' };
    throw error;
  }
};
