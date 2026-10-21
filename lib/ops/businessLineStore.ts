import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { safeDbErrorSummary } from '../payments/dbErrorSummary';
import type { BusinessLine } from './businessLine';
import { parseBusinessLine } from './businessLine';

/**
 * 분야 지정 표(`revenue_line_assignments`, 마이그레이션 0084)의 읽기·쓰기. **raw SQL로만** 다룬다 — 표가 없는 DB(0084 전)에서
 * 읽기는 빈 지정을 돌려주고(행은 유형의 기본 분야로 떨어진다), 쓰기는 false를 돌려준다. 결제 링크·수기 매출 자체의 생성은 막지 않는다.
 */
export type LineSubjectKind = 'payment_link' | 'manual_revenue';

/** 분야 지정 한 건 — 마지막으로 바꾼 사람·시각(`created_by`·`created_at`은 덮어쓸 때마다 갱신된다: "마지막으로 정한" 사람·시각이다). */
export interface LineAssignment {
  line: BusinessLine;
  by: string | null;
  /** unix 초. */
  at: number | null;
}

export const loadLineAssignmentDetails = async (kind: LineSubjectKind, ids: readonly string[]): Promise<Map<string, LineAssignment>> => {
  const out = new Map<string, LineAssignment>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;
  try {
    const rows = await getDb().all<{ subject_id: string; business_line: string; created_by: string | null; created_at: number | null }>(sql`
      SELECT subject_id, business_line, created_by, created_at FROM revenue_line_assignments
      WHERE subject_kind = ${kind} AND subject_id IN (${sql.join(unique.map((id) => sql`${id}`), sql`, `)})
    `);
    for (const r of rows) {
      const line = parseBusinessLine(r.business_line);
      if (line) out.set(r.subject_id, { line, by: r.created_by ?? null, at: r.created_at === null ? null : Number(r.created_at) });
    }
  } catch (error) {
    console.error('[revenue/line] 분야 지정 조회 실패(마이그레이션 0084 전일 수 있음) — 기본 분야로 셉니다:', safeDbErrorSummary(error));
  }
  return out;
};

export const loadLineAssignments = async (kind: LineSubjectKind, ids: readonly string[]): Promise<Map<string, BusinessLine>> =>
  new Map([...(await loadLineAssignmentDetails(kind, ids))].map(([id, a]) => [id, a.line]));

/**
 * 분야를 적는다(덮어쓰기). 표가 없거나 실패하면 false — 호출부가 "분야는 저장되지 않았다"고 알린다.
 * 덮어쓸 때 `created_by`·`created_at`도 지금 사람·시각으로 바꾼다 — 이 표에는 수정 이력 칸이 없어(컬럼을 더하면 마이그레이션이 필요하다)
 * "마지막으로 정한 사람·시각"으로 읽는다. 바꾸기 전 값은 호출부가 로그(결제 링크)나 메모(수기 매출)에 남긴다.
 */
export const saveLineAssignment = async (kind: LineSubjectKind, id: string, line: BusinessLine, actor: string | null): Promise<boolean> => {
  try {
    await getDb().run(sql`
      INSERT INTO revenue_line_assignments (subject_kind, subject_id, business_line, created_by)
      VALUES (${kind}, ${id}, ${line}, ${actor})
      ON CONFLICT (subject_kind, subject_id) DO UPDATE SET business_line = excluded.business_line, created_by = excluded.created_by, created_at = unixepoch()
    `);
    return true;
  } catch (error) {
    console.error('[revenue/line] 분야 지정 저장 실패(마이그레이션 0084 전일 수 있음):', safeDbErrorSummary(error));
    return false;
  }
};

/** 분야 지정을 지운다(유형의 기본 분야로 되돌린다). 표가 없거나 실패하면 false. */
export const clearLineAssignment = async (kind: LineSubjectKind, id: string): Promise<boolean> => {
  try {
    await getDb().run(sql`DELETE FROM revenue_line_assignments WHERE subject_kind = ${kind} AND subject_id = ${id}`);
    return true;
  } catch (error) {
    console.error('[revenue/line] 분야 지정 삭제 실패(마이그레이션 0084 전일 수 있음):', safeDbErrorSummary(error));
    return false;
  }
};

const safeAll = async <T>(label: string, run: () => Promise<T[]>): Promise<T[]> => {
  try {
    return await run();
  } catch (error) {
    console.error(`[revenue/line] ${label} 조회 실패 — 결제 링크는 녹음·제작으로 셉니다:`, safeDbErrorSummary(error));
    return [];
  }
};

/** 결제 링크의 분야 판정. 제작·믹싱 계약 링크(`fixed`)면 매출 유형도 계약 종류를 따른다(`type` — 아래 assignDepositLines). */
export interface PaymentLinkLine {
  line: BusinessLine;
  fixed: boolean;
  /** 제작 계약 링크의 매출 유형 — 믹싱·마스터링 계약은 'mixing', 나머지(싱글·EP·정규)는 'production'(productionRevenue.ts와 같다). */
  type?: 'mixing' | 'production';
  /** 운영자가 고른 분야를 마지막으로 정한 사람·시각(unix 초). 고른 적 없으면 없다. */
  by?: string | null;
  at?: number | null;
}

/**
 * 결제 링크(slug)의 분야. 제작·믹싱 계약의 링크(`production_contract_payment_links`)면 **항상 녹음·제작**(`fixed`),
 * 아니면 운영자가 고른 분야(`revenue_line_assignments`). 둘 다 없는 slug는 결과에 없다 — 호출부가 기본(녹음·제작)으로 둔다.
 */
export const loadPaymentLinkLines = async (slugs: readonly string[]): Promise<Map<string, PaymentLinkLine>> => {
  const out = new Map<string, PaymentLinkLine>();
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return out;
  // 계약 종류 판정은 isMixMasterKind(lib/contracts/production/terms.ts)와 같다 — 이 모듈은 계약 모듈을 끌어오지 않으려고 SQL로 가른다.
  // 계약 행을 못 찾으면(지워졌거나 테스트 데이터) 음원 제작으로 본다.
  const production = await safeAll('제작 계약 결제 링크', () => getDb().all<{ slug: string; kind: string | null }>(sql`
    SELECT l.slug AS slug, c.kind AS kind FROM production_contract_payment_links l
    LEFT JOIN production_contracts c ON c.id = l.contract_id
    WHERE l.slug IN (${sql.join(unique.map((s) => sql`${s}`), sql`, `)})
  `));
  const fixedSlugs = new Set<string>();
  for (const p of production) {
    fixedSlugs.add(p.slug);
    out.set(p.slug, { line: 'recording', fixed: true, type: p.kind === 'mixmaster' ? 'mixing' : 'production' });
  }
  const chosen = await loadLineAssignmentDetails('payment_link', unique.filter((s) => !fixedSlugs.has(s)));
  for (const [slug, a] of chosen) out.set(slug, { line: a.line, fixed: false, by: a.by, at: a.at });
  return out;
};

/**
 * 결제 링크 주문(`type = 'deposit'`)의 분야를 채운다(loadPaymentLinkLines). 주문 → 링크는 `payment_link_orders.slug`로 잇는다 —
 * 그 기록이 없는 옛 주문·파일 링크는 기본값(녹음·제작, lineOfType). 표가 하나라도 없으면 그 단계만 건너뛴다.
 */
export const assignDepositLines = async <R extends { type: string; orderNo: string; line?: BusinessLine }>(rows: R[]): Promise<R[]> => {
  const orderNos = [...new Set(rows.filter((r) => r.type === 'deposit' && !r.line).map((r) => r.orderNo))];
  if (orderNos.length === 0) return rows;
  const links = await safeAll('결제 링크 주문', () => getDb().all<{ order_no: string; slug: string }>(sql`
    SELECT order_no, slug FROM payment_link_orders WHERE order_no IN (${sql.join(orderNos.map((n) => sql`${n}`), sql`, `)})
  `));
  if (links.length === 0) return rows;
  const lineOfSlug = await loadPaymentLinkLines(links.map((l) => l.slug));
  const found = new Map<string, PaymentLinkLine>();
  for (const l of links) {
    const f = lineOfSlug.get(l.slug);
    if (f) found.set(l.order_no, f);
  }
  return rows.map((r) => {
    if (r.type !== 'deposit' || r.line) return r;
    const f = found.get(r.orderNo);
    if (!f) return r;
    // 제작 계약 링크 결제는 유형도 계약 종류로 옮긴다 — 유형별 표에서 한 계약이 '예약금'과 '음원 제작'으로 갈라지지 않게
    // (직접 기록한 입금은 productionRevenue.ts가 'production'/'mixing'으로 싣는다).
    return f.type ? { ...r, type: f.type, line: f.line } : { ...r, line: f.line };
  });
};
