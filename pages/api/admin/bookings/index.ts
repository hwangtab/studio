import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { serializeBookingForAdmin } from '../../../../lib/booking/admin-serialize';
import { expireStaleOrders } from '../../../../lib/booking/service';

const LIST_LIMIT = 200;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      // 목록을 여는 시점이 곧 만료를 판정할 시점이다(계약의 expireOverdueContracts와 동일한
      // lazy 처리 — pages/api/contracts/index.ts 참조).
      await expireStaleOrders(new Date());

      const allOrders = await getDb().query.orders.findMany({
        orderBy: (ordersTable, { desc }) => [desc(ordersTable.createdAt)],
        limit: LIST_LIMIT,
        // payments를 함께 읽는다 — 주문 상태와 결제 기록의 미정합(스펙 §10) 판정에 쓴다.
        with: { bookings: true, payments: true, workOrders: true },
      });

      return res.status(200).json({
        ok: true,
        bookings: allOrders.map((order) => serializeBookingForAdmin(order)),
      });
    } catch (error: unknown) {
      console.error('[API/admin/bookings] Failed to list bookings:', error);
      return res.status(500).json({ ok: false, message: '예약 목록을 불러오지 못했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
