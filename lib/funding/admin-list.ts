import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges } from '../../db/schema';
import { backerIdentitySql, type FundingOrder } from './service';

/**
 * 관리자 목록·CSV export가 공유하는 조회.
 *
 * API 라우트 파일(pages/api/admin/funding/pledges/index.ts)에서 named export하면
 * Next가 페이지 export로 오인해 빌드 경고를 낼 수 있어 처음부터 여기에 둔다.
 *
 * slug 필터는 반드시 DB 쪽 where에 넣는다 — limit 201로 잘라낸 뒤 JS에서 걸러내면
 * 특정 프로젝트 건이 다른 프로젝트 건에 밀려 잘려 나갈 수 있고, 그러면 프로젝트별
 * 합계·CSV가 조용히 누락된다.
 */
export const listFundingOrders = async (slug: string | null): Promise<FundingOrder[]> => {
  const db = getDb();
  const rows = await db.query.orders.findMany({
    where: (t, { eq: e, and, inArray }) =>
      slug
        ? and(
            e(t.type, 'funding'),
            inArray(
              t.id,
              db.select({ id: fundingPledges.orderId }).from(fundingPledges).where(e(fundingPledges.projectSlug, slug)),
            ),
          )
        : e(t.type, 'funding'),
    with: { fundingPledge: true, payments: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 201,
  });
  return (rows as FundingOrder[]).filter((o) => o.fundingPledge);
};

/**
 * CSV export 전용 조회 — 관리자 목록과 달리 **201건 상한이 없다**.
 *
 * export는 배송 실무에 쓰는 전량 다운로드다. 목록용 limit 201을 그대로 물려 쓰면 202번째
 * 후원자의 주소가 조용히 빠진 CSV가 나가고, 그건 발송 누락으로 직결된다. 상태도 paid만이
 * 아니라 partially_refunded까지 싣는다 — 일부만 환불한 건도 리워드는 나가야 하고,
 * 집계(aggregateProjectStatus)가 이미 두 상태를 같이 본다.
 */
export const listFundingOrdersForExport = async (slug: string | null): Promise<FundingOrder[]> => {
  const db = getDb();
  const rows = await db.query.orders.findMany({
    where: (t, { eq: e, and, inArray }) => {
      const statusFilter = inArray(t.status, ['paid', 'partially_refunded']);
      return slug
        ? and(
            e(t.type, 'funding'),
            statusFilter,
            inArray(
              t.id,
              db.select({ id: fundingPledges.orderId }).from(fundingPledges).where(e(fundingPledges.projectSlug, slug)),
            ),
          )
        : and(e(t.type, 'funding'), statusFilter);
    },
    with: { fundingPledge: true, payments: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return (rows as FundingOrder[]).filter((o) => o.fundingPledge);
};

/**
 * 관리자 상단 KPI. **목록과 분리해 집계 SQL로 센다.**
 *
 * 예전엔 화면이 `listFundingOrders`가 돌려준 최대 200건을 JS에서 합산했다. 즉 201번째
 * 후원이 들어오는 순간 관리자 수치가 공개 진행률(aggregateProjectStatus — SQL 집계)과
 * 갈라지고, 캠페인이 성공할수록 오차가 커진다. 목록의 201건 상한은 화면 렌더 비용 때문에
 * 남겨 두되(그 사실은 `truncated` 배너가 목록에 대해서만 알린다), 숫자는 전건을 본다.
 *
 * 한 번의 조건부 집계로 끝낸다 — 확정/대기 두 벌을 따로 쿼리하면 두 시점 사이에 들어온
 * 입금 확인이 어느 쪽에도 안 잡히거나 양쪽에 잡힌다.
 */
export interface AdminFundingTotals {
  /** 확정(paid·partially_refunded) 후원 금액 합계. */
  confirmedAmount: number;
  /**
   * 확정 후원 **건수**. COUNT(*)라 같은 사람이 두 번 후원하면 2다 — '명'이 아니라 '건'이다.
   * 공개 집계(aggregateProjectStatus.backerCount)와 같은 것을 센다.
   */
  confirmedCount: number;
  /**
   * 확정 후원 **인원**. 신원 키는 service.ts의 backerIdentitySql — 이메일+전화 조합이되
   * 수기 등록 플레이스홀더는 주문 단위로 떨어뜨린다. 항상 confirmedCount 이하다.
   * 리워드 수량이 아니라 "몇 사람이 참여했나"를 말해야 하는 자리에서만 쓴다.
   */
  confirmedPersonCount: number;
  /** 무통장 입금 대기(pending + bank_transfer) 금액 합계. */
  pendingAmount: number;
  /** 무통장 입금 대기 건수. */
  pendingCount: number;
}

interface TotalsRow {
  confirmed_amount: number | null;
  confirmed_count: number | null;
  confirmed_person_count: number | null;
  pending_amount: number | null;
  pending_count: number | null;
}

export const aggregateAdminFundingTotals = async (slug: string | null): Promise<AdminFundingTotals> => {
  const db = getDb();
  // slug 필터는 listFundingOrders와 같은 이유로 DB 쪽에 둔다 — JS에서 걸러내면 프로젝트
  // 탭을 눌렀을 때 숫자와 목록이 서로 다른 모집단을 말하게 된다.
  const slugFilter = slug ? sql` AND fp.project_slug = ${slug}` : sql.empty();
  const rows = await db.all<TotalsRow>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN o.status IN ('paid', 'partially_refunded') THEN o.total_amount END), 0) AS confirmed_amount,
      COUNT(CASE WHEN o.status IN ('paid', 'partially_refunded') THEN 1 END) AS confirmed_count,
      COUNT(DISTINCT CASE WHEN o.status IN ('paid', 'partially_refunded')
        THEN ${backerIdentitySql()} END) AS confirmed_person_count,
      COALESCE(SUM(CASE WHEN o.status = 'pending' AND fp.payment_method = 'bank_transfer' THEN o.total_amount END), 0) AS pending_amount,
      COUNT(CASE WHEN o.status = 'pending' AND fp.payment_method = 'bank_transfer' THEN 1 END) AS pending_count
    FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE o.type = 'funding'${slugFilter}
  `);
  const r = rows[0];
  return {
    confirmedAmount: Number(r?.confirmed_amount ?? 0),
    confirmedCount: Number(r?.confirmed_count ?? 0),
    confirmedPersonCount: Number(r?.confirmed_person_count ?? 0),
    pendingAmount: Number(r?.pending_amount ?? 0),
    pendingCount: Number(r?.pending_count ?? 0),
  };
};
