import { getDb } from '../../db/client';
import type { FundingOrder } from './service';

/**
 * 관리자 목록·CSV export가 공유하는 조회.
 *
 * API 라우트 파일(pages/api/admin/funding/pledges/index.ts)에서 named export하면
 * Next가 페이지 export로 오인해 빌드 경고를 낼 수 있어 처음부터 여기에 둔다.
 */
export const listFundingOrders = async (slug: string | null): Promise<FundingOrder[]> => {
  const rows = await getDb().query.orders.findMany({
    where: (t, { eq: e }) => e(t.type, 'funding'),
    with: { fundingPledge: true, payments: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 201,
  });
  return (rows as FundingOrder[]).filter((o) => o.fundingPledge && (!slug || o.fundingPledge.projectSlug === slug));
};
