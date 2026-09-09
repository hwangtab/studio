import { getDb } from '../../db/client';
import { fundingPledges } from '../../db/schema';
import type { FundingOrder } from './service';

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
