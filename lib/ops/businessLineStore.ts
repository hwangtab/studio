import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { safeDbErrorSummary } from '../payments/refundAccount';
import type { BusinessLine } from './businessLine';
import { parseBusinessLine } from './businessLine';

/**
 * 분야 지정 표(`revenue_line_assignments`, 마이그레이션 0084)의 읽기·쓰기. **raw SQL로만** 다룬다 — 표가 없는 DB(0084 전)에서
 * 읽기는 빈 지정을 돌려주고(행은 유형의 기본 분야로 떨어진다), 쓰기는 false를 돌려준다. 결제 링크·수기 매출 자체의 생성은 막지 않는다.
 */
export type LineSubjectKind = 'payment_link' | 'manual_revenue';

export const loadLineAssignments = async (kind: LineSubjectKind, ids: readonly string[]): Promise<Map<string, BusinessLine>> => {
  const out = new Map<string, BusinessLine>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;
  try {
    const rows = await getDb().all<{ subject_id: string; business_line: string }>(sql`
      SELECT subject_id, business_line FROM revenue_line_assignments
      WHERE subject_kind = ${kind} AND subject_id IN (${sql.join(unique.map((id) => sql`${id}`), sql`, `)})
    `);
    for (const r of rows) {
      const line = parseBusinessLine(r.business_line);
      if (line) out.set(r.subject_id, line);
    }
  } catch (error) {
    console.error('[revenue/line] 분야 지정 조회 실패(마이그레이션 0084 전일 수 있음) — 기본 분야로 셉니다:', safeDbErrorSummary(error));
  }
  return out;
};

/** 분야를 적는다(덮어쓰기). 표가 없거나 실패하면 false — 호출부가 "분야는 저장되지 않았다"고 알린다. */
export const saveLineAssignment = async (kind: LineSubjectKind, id: string, line: BusinessLine, actor: string | null): Promise<boolean> => {
  try {
    await getDb().run(sql`
      INSERT INTO revenue_line_assignments (subject_kind, subject_id, business_line, created_by)
      VALUES (${kind}, ${id}, ${line}, ${actor})
      ON CONFLICT (subject_kind, subject_id) DO UPDATE SET business_line = excluded.business_line, created_by = excluded.created_by
    `);
    return true;
  } catch (error) {
    console.error('[revenue/line] 분야 지정 저장 실패(마이그레이션 0084 전일 수 있음):', safeDbErrorSummary(error));
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

/**
 * 결제 링크(slug)의 분야. 제작·믹싱 계약의 링크(`production_contract_payment_links`)면 **항상 녹음·제작**(`fixed`),
 * 아니면 운영자가 고른 분야(`revenue_line_assignments`). 둘 다 없는 slug는 결과에 없다 — 호출부가 기본(녹음·제작)으로 둔다.
 */
export const loadPaymentLinkLines = async (slugs: readonly string[]): Promise<Map<string, { line: BusinessLine; fixed: boolean }>> => {
  const out = new Map<string, { line: BusinessLine; fixed: boolean }>();
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return out;
  const production = new Set((await safeAll('제작 계약 결제 링크', () => getDb().all<{ slug: string }>(sql`
    SELECT slug FROM production_contract_payment_links WHERE slug IN (${sql.join(unique.map((s) => sql`${s}`), sql`, `)})
  `))).map((p) => p.slug));
  for (const slug of production) out.set(slug, { line: 'recording', fixed: true });
  const chosen = await loadLineAssignments('payment_link', unique.filter((s) => !production.has(s)));
  for (const [slug, line] of chosen) out.set(slug, { line, fixed: false });
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
  const lineOfOrder = new Map<string, BusinessLine>();
  for (const l of links) {
    const found = lineOfSlug.get(l.slug);
    if (found) lineOfOrder.set(l.order_no, found.line);
  }
  return rows.map((r) => (r.type === 'deposit' && !r.line && lineOfOrder.has(r.orderNo) ? { ...r, line: lineOfOrder.get(r.orderNo) } : r));
};
