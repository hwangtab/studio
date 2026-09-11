import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { logoutAdmin } from '../../../components/admin/contractActions';
import { Button } from '../../../components/ui/Button';
import { getDb } from '../../../db/client';
import { subscriptionPayments } from '../../../db/schema';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatPriceAmount } from '../../../data/pricing';
import { endExpiredSubscriptions } from '../../../lib/billing/service';
import { serializeSubscription, type SerializedSubscription } from '../../../lib/billing/admin-serialize';
import { formatKstDateTimeFull } from '../../../lib/booking/format';
import { eq, sql } from 'drizzle-orm';

const LIST_LIMIT = 200;

interface AdminSubscriptionsPageProps {
  subscriptions: (SerializedSubscription & { failedCount: number })[];
  truncated: boolean;
}

export const getServerSideProps: GetServerSideProps<AdminSubscriptionsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  await endExpiredSubscriptions(new Date());

  const db = getDb();
  const rows = await db.query.subscriptions.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: LIST_LIMIT + 1,
  });

  const failedCounts = await db
    .select({ subscriptionId: subscriptionPayments.subscriptionId, count: sql<number>`count(*)` })
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.status, 'failed'))
    .groupBy(subscriptionPayments.subscriptionId);
  const failedCountBySubscription = new Map(failedCounts.map((row) => [row.subscriptionId, row.count]));

  const truncated = rows.length > LIST_LIMIT;
  const visible = truncated ? rows.slice(0, LIST_LIMIT) : rows;

  return {
    props: {
      subscriptions: visible.map((row) => ({
        ...serializeSubscription(row),
        failedCount: failedCountBySubscription.get(row.id) ?? 0,
      })),
      truncated,
    },
  };
};

const KIND_LABELS: Record<string, string> = {
  'practice-room': '연습실',
  lesson: '레슨',
};

const STATUS_LABELS: Record<string, string> = {
  pending_card: '카드 등록 대기',
  active: '정상',
  past_due: '결제 재시도 중',
  paused: '정지',
  cancelled: '해지 예약',
  ended: '종료',
};

const STATUS_CLASS: Record<string, string> = {
  pending_card: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-amber-100 text-amber-800',
  paused: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-600',
  ended: 'bg-gray-200 text-gray-500',
};

/** paused·cancelled·ended는 nextBillingAt이 지난 날짜로 남아 있을 수 있어 노출하지 않는다 —
 * 상태 라벨이 더 정확한 정보다(계획서 §6 목록 요건). */
const nextBillingLabel = (sub: SerializedSubscription): string => {
  if (sub.status === 'paused' || sub.status === 'cancelled' || sub.status === 'ended') {
    return STATUS_LABELS[sub.status];
  }
  return sub.nextBillingAt ? formatKstDateTimeFull(sub.nextBillingAt) : '-';
};

export default function AdminSubscriptionsPage({ subscriptions, truncated }: AdminSubscriptionsPageProps) {
  return (
    <>
      <Head>
        <title>구독 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900">구독 관리</h1>
            <div className="flex gap-2">
              <Link href="/admin/subscriptions/new" passHref>
                <Button light>레슨 구독 만들기</Button>
              </Link>
              <Link href="/admin" passHref>
                <Button light variant="outline">관리자 홈</Button>
              </Link>
              <Button light variant="ghost" onClick={() => logoutAdmin()}>
                로그아웃
              </Button>
            </div>
          </div>

          {truncated && (
            <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
              최근 {LIST_LIMIT}건만 표시됩니다. 오래된 구독은 목록에서 잘렸습니다.
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">종류</th>
                    <th className="px-4 py-3 text-left">고객</th>
                    <th className="px-4 py-3 text-left">상태</th>
                    <th className="px-4 py-3 text-left">다음 결제일</th>
                    <th className="px-4 py-3 text-right">미납 회차</th>
                    <th className="px-4 py-3 text-right">금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/subscriptions/${sub.id}`} className="text-primary hover:underline">
                          {KIND_LABELS[sub.kind] ?? sub.kind}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{sub.customerName}</div>
                        <div className="text-gray-500 text-xs">{sub.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[sub.status]}`}
                        >
                          {STATUS_LABELS[sub.status] ?? sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{nextBillingLabel(sub)}</td>
                      <td className="px-4 py-3 text-right">
                        {sub.failedCount > 0 ? (
                          <span className="text-red-600 font-medium">{sub.failedCount}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatPriceAmount(sub.totalAmount)}원
                      </td>
                    </tr>
                  ))}
                  {subscriptions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        구독이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
