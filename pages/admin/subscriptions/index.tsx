import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../../components/admin/AdminShell';
import { FilterPill } from '../../../components/admin/FilterPill';
import { Button } from '../../../components/ui/Button';
import { TextInput } from '../../../components/ui/Field';
import { artistSupportTierLabel, subscriptionOrderName } from '../../../lib/billing/amounts';
import { getDb } from '../../../db/client';
import { subscriptionPayments } from '../../../db/schema';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatPriceAmount } from '../../../data/pricing';
import { endExpiredSubscriptions } from '../../../lib/billing/service';
import { serializeSubscription, type SerializedSubscription } from '../../../lib/billing/admin-serialize';
import { formatKstDateTimeFull } from '../../../lib/booking/format';
import { eq, or, sql } from 'drizzle-orm';

const LIST_LIMIT = 200;

interface AdminSubscriptionsPageProps {
  subscriptions: (SerializedSubscription & { failedCount: number })[];
  truncated: boolean;
  /** 이름·연락처·이메일 검색어. 서버에서 걸러 오래된 구독도 찾는다. */
  q: string;
}

export const getServerSideProps: GetServerSideProps<AdminSubscriptionsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  await endExpiredSubscriptions(new Date());

  const db = getDb();
  const qParam = context.query.q;
  const q = typeof qParam === 'string' ? qParam.trim().slice(0, 60) : '';
  // 부분 일치 — `%`·`_`는 이스케이프한다. 목록은 최근 200건이라 그 밖의 구독은 이 검색이 없으면 열 방법이 없었다.
  const pattern = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const rows = await db.query.subscriptions.findMany({
    where: pattern
      ? (t) =>
          or(
            sql`${t.customerName} LIKE ${pattern} ESCAPE '\\'`,
            sql`${t.customerPhone} LIKE ${pattern} ESCAPE '\\'`,
            sql`${t.customerEmail} LIKE ${pattern} ESCAPE '\\'`,
          )
      : undefined,
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
      q,
    },
  };
};

const KIND_LABELS: Record<string, string> = {
  'practice-room': '연습실',
  lesson: '레슨',
  'artist-support': '아티스트',
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

const KIND_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'practice-room', label: '연습실' },
  { key: 'lesson', label: '레슨' },
  { key: 'artist-support', label: '아티스트' },
] as const;

const STATUS_FILTERS = [
  { key: 'all', label: '전체 상태' },
  { key: 'attention', label: '손볼 것 (카드 대기·재시도·정지)' },
  { key: 'active', label: '정상' },
  { key: 'closed', label: '해지·종료' },
] as const;

const matchesStatus = (status: string, key: (typeof STATUS_FILTERS)[number]['key']): boolean =>
  key === 'all' ||
  (key === 'attention' && ['pending_card', 'past_due', 'paused'].includes(status)) ||
  (key === 'active' && status === 'active') ||
  (key === 'closed' && ['cancelled', 'ended'].includes(status));

export default function AdminSubscriptionsPage({ subscriptions: allSubscriptions, truncated, q = '' }: AdminSubscriptionsPageProps) {
  const [kindFilter, setKindFilter] = useState<(typeof KIND_FILTERS)[number]['key']>('all');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['key']>('all');
  const subscriptions = allSubscriptions.filter((s) => (kindFilter === 'all' || s.kind === kindFilter) && matchesStatus(s.status, statusFilter));
  const countOf = (key: string) => (key === 'all' ? allSubscriptions.length : allSubscriptions.filter((s) => s.kind === key).length);
  const statusCountOf = (key: (typeof STATUS_FILTERS)[number]['key']) => allSubscriptions.filter((s) => matchesStatus(s.status, key)).length;
  return (
    <>
      <Head>
        <title>구독 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="구독 관리"
        width="wide"
        actions={
          <Button asChild light>
            <Link href="/admin/subscriptions/new">레슨 구독 만들기</Link>
          </Button>
        }
      >
        {truncated && (
          <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
            최근 {LIST_LIMIT}건만 표시됩니다. 오래된 구독은 위 검색(이름·연락처·이메일)으로 찾을 수 있습니다.
          </div>
        )}

        <form method="GET" action="/admin/subscriptions" className="mb-4 flex flex-wrap items-center gap-2" role="search">
          <TextInput type="search" name="q" defaultValue={q} placeholder="이름, 연락처, 이메일 검색" aria-label="구독 검색" light className="w-auto flex-1 min-w-[240px] px-4" />
          <Button light type="submit" variant="weak">검색</Button>
          {q && (
            <Link href="/admin/subscriptions" className="text-sm text-primary hover:underline">
              검색 해제
            </Link>
          )}
        </form>

        <div className="mb-2 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <FilterPill key={f.key} active={statusFilter === f.key} onClick={() => setStatusFilter(f.key)}>
              {f.label} ({statusCountOf(f.key)})
            </FilterPill>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {KIND_FILTERS.map((f) => (
            <FilterPill key={f.key} active={kindFilter === f.key} onClick={() => setKindFilter(f.key)}>
              {f.label} ({countOf(f.key)})
            </FilterPill>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-lg:p-3">
            <table className="admin-table w-full text-sm">
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
                    <td data-label="종류" className="px-4 py-3">
                      <Link href={`/admin/subscriptions/${sub.id}`} className="text-primary hover:underline">
                        {KIND_LABELS[sub.kind] ?? sub.kind}
                      </Link>
                    </td>
                    <td data-label="고객" className="px-4 py-3">
                      <div className="font-medium text-gray-900">{sub.customerName}</div>
                      <div className="text-gray-500 text-xs">{sub.customerPhone || sub.customerEmail}</div>
                      {sub.kind === 'artist-support' && (
                        <div className="text-xs text-primary mt-0.5">
                          {subscriptionOrderName(sub)}
                          {artistSupportTierLabel(sub.tierId) ? ` · ${artistSupportTierLabel(sub.tierId)}` : ''}
                        </div>
                      )}
                    </td>
                    <td data-label="상태" className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[sub.status]}`}
                      >
                        {STATUS_LABELS[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td data-label="다음 결제일" className="px-4 py-3 text-gray-600">{nextBillingLabel(sub)}</td>
                    <td data-label="미납 회차" className="px-4 py-3 text-right">
                      {sub.failedCount > 0 ? (
                        <span className="text-red-600 font-medium">{sub.failedCount}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td data-label="금액" className="px-4 py-3 text-right font-medium">
                      {formatPriceAmount(sub.totalAmount)}원
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {q || statusFilter !== 'all' || kindFilter !== 'all' ? '조건에 맞는 구독이 없습니다.' : '구독이 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AdminShell>
    </>
  );
}
