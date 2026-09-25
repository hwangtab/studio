import { eq, sql } from 'drizzle-orm';

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

/** libsql은 원인을 cause로 감싸기도 한다 — 사슬을 따라가며 문구를 모은다. */
const errorTexts = (error: unknown): string[] => {
  const texts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof Error) {
      texts.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      texts.push(String(current));
      break;
    }
  }
  return texts;
};

export const isMissingServicesTable = (error: unknown): boolean =>
  errorTexts(error).some((t) => /no such table:?\s*`?funding_project_services`?/i.test(t));

/**
 * 테이블은 있는데 **컬럼이 없는** 부분 스키마인가.
 *
 * 마이그레이션이 수동이라 0037이 손으로 일부만 적용될 수 있고, 앞으로 이 테이블에 컬럼을
 * 더하는 마이그레이션이 배포보다 늦으면 같은 상태가 된다(= 이 테이블을 따로 둔 애초의 이유가
 * 다시 발생할 때). 그때 `no such table`은 안 나므로 테이블 부재 판정이 못 잡고, 화면이
 * "잠시 뒤 새로고침해 주세요"를 띄웠다 — 새로고침으로 낫지 않는 상태에 새로고침을 시킨다.
 *
 * SQLite는 **두 가지 문구**를 쓴다: 조회·UPDATE는 `no such column: design_fee`,
 * INSERT는 `table funding_project_services has no column named design_fee`. 둘 다 본다 —
 * 하나만 보면 읽기는 잡히는데 쓰기가 그대로 던진다.
 *
 * 이 판정은 **이 테이블을 겨눈 질의가 던진 오류에만** 쓴다. 컬럼 이름만 보므로 다른 테이블의
 * 같은 이름을 구분하지 못한다.
 */
const SERVICE_COLUMNS = ['project_id', 'kind', 'design_fee', 'design_fee_paid_at', 'created_at', 'updated_at'];
export const isServicesSchemaMismatch = (error: unknown): boolean =>
  errorTexts(error).some((t) =>
    SERVICE_COLUMNS.some((column) =>
      new RegExp(`no such column:?\\s*\`?(\\w+\\.)?${column}\`?`, 'i').test(t)
      || new RegExp(`has no column named\\s+\`?${column}\`?`, 'i').test(t)));

const toView = (row: FundingProjectService): ProjectServiceView => ({
  kind: row.kind,
  designFee: row.designFee,
  designFeePaidAt: row.designFeePaidAt ? row.designFeePaidAt.toISOString() : null,
});

export type ServiceUnavailableReason = 'missing_table' | 'schema_mismatch' | 'error';

export type LoadServiceResult =
  | { available: true; service: ProjectServiceView | null }
  | { available: false; reason: ServiceUnavailableReason };

const unavailable = (error: unknown, where: string): { available: false; reason: ServiceUnavailableReason } => {
  if (isMissingServicesTable(error)) return { available: false, reason: 'missing_table' };
  // 부분 스키마도 로그에 남긴다 — 어느 컬럼이 없는지는 오류 본문에만 있다.
  console.error(`[funding] ${where} 실패`, error);
  if (isServicesSchemaMismatch(error)) return { available: false, reason: 'schema_mismatch' };
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
  | { ok: false; code: 'not_found' | 'unavailable' | 'schema_mismatch' | 'no_service' };

/**
 * 쓰기가 던진 오류를 코드로 바꾼다. 스키마 문제는 **사람이 읽을 안내로 돌려주고**(라우트가
 * 503), 그 밖의 오류는 그대로 던진다 — 진짜 장애가 "마이그레이션을 돌리세요"로 가려지면
 * 운영자가 엉뚱한 조치를 한다. 어느 쪽이든 원문은 서버 로그에 남는다.
 */
const writeFailure = (error: unknown, where: string, projectId: string): ServiceWriteResult => {
  if (isMissingServicesTable(error)) return { ok: false, code: 'unavailable' };
  console.error(`[funding] ${where} 실패 (projectId=${projectId})`, error);
  if (isServicesSchemaMismatch(error)) return { ok: false, code: 'schema_mismatch' };
  throw error;
};

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
    return writeFailure(error, 'setProjectService', projectId);
  }
};

/**
 * 설계비 입금 확인을 켜거나 끈다. 서비스가 지정되지 않았거나 **직접 개설로 되돌린**
 * (`kind: 'none'`) 프로젝트면 no_service, 프로젝트 자체가 없으면 not_found.
 *
 * `none`을 거부하는 이유: 그 행은 옛 약정을 보존하려고 남겨 둔 것일 뿐 지금 청구할 설계비가
 * 아니다. 행을 지우던 시절에는 UPDATE가 0행이라 자연히 막혔는데, 보존으로 바꾸면서 그 방어가
 * 사라졌다. 화면은 이미 버튼을 감추므로 여기는 API 방어선이다.
 *
 * **`paid: true`는 멱등이다** — 이미 확인 시각이 있으면 덮지 않는다(COALESCE). 예전에는
 * 두 번째 요청이 최초 확인 날짜를 지금 시각으로 밀어냈다: 중복 클릭·뒤로가기 재전송으로
 * 충분히 나고, 세금계산서는 공급 시기 기준으로 끊어야 하는데 원래 날짜를 되찾을 방법이
 * DB에 없다. 확인을 **취소**하면 NULL로 비우므로, 다시 확인하면 그때가 새 기준이다.
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
    const db = getDb();
    // 컬럼을 좁히지 않는다 — 부분 스키마(컬럼 누락)를 이 조회에서 드러내야 아래 UPDATE 없이도
    // schema_mismatch로 갈라진다(행이 없으면 UPDATE에 닿지 않아 탐지 기회가 사라진다).
    const existing = await db
      .select()
      .from(fundingProjectServices)
      .where(eq(fundingProjectServices.projectId, projectId))
      .limit(1);
    if (!existing[0] || existing[0].kind === 'none') {
      /**
       * 쓸 행이 없는 경우는 둘이다 — 서비스가 아직 지정되지 않았거나(되돌린 것도 포함),
       * 프로젝트 자체가 없다. 예전에는 둘을 합쳐 no_service로 돌려줘서, 없는 id에도 "먼저
       * 서비스 종류를 지정해 주세요"가 나갔다(그쪽을 시도하면 setProjectService가 404를 준다 —
       * 두 액션이 같은 id에 다른 진단을 냈다).
       */
      if (existing[0]) return { ok: false, code: 'no_service' };
      const project = await db
        .select({ id: fundingProjects.id })
        .from(fundingProjects)
        .where(eq(fundingProjects.id, projectId))
        .limit(1);
      return { ok: false, code: project[0] ? 'no_service' : 'not_found' };
    }
    const rows = await db
      .update(fundingProjectServices)
      .set({
        designFeePaidAt: paid
          ? sql`COALESCE(${fundingProjectServices.designFeePaidAt}, ${Math.floor(now.getTime() / 1000)})`
          : null,
        updatedAt: now,
      })
      .where(eq(fundingProjectServices.projectId, projectId))
      .returning();
    // 위 조회와 UPDATE 사이에 행이 사라졌다(none으로 되돌림·프로젝트 삭제).
    if (!rows[0]) return { ok: false, code: 'no_service' };
    console.warn(
      `[funding] 설계비 입금 ${paid ? '확인' : '확인 취소'} `
        + `(projectId=${projectId}, designFee=${rows[0].designFee}, actor=${actor})`,
    );
    return { ok: true, service: toView(rows[0]) };
  } catch (error) {
    return writeFailure(error, 'setDesignFeePaid', projectId);
  }
};
