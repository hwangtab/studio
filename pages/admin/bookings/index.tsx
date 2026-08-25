import React, { useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { createBlock, deleteBlock } from '../../../components/admin/bookingActions';
import { logoutAdmin } from '../../../components/admin/contractActions';
import { Button } from '../../../components/ui/Button';
import { getDb } from '../../../db/client';
import { orderStatusEnum } from '../../../db/schema';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatPriceAmount } from '../../../data/pricing';
import {
  serializeBlockForAdmin,
  serializeBookingForAdmin,
  type AdminBlockItem,
  type AdminBookingListItem,
} from '../../../lib/booking/admin-serialize';
import { formatKstDateTime } from '../../../lib/booking/format';
import { expireStaleOrders } from '../../../lib/booking/service';

/** 한 화면에 싣는 최대 건수. 넘으면 오래된 주문이 잘린다는 사실을 화면에 알린다(contracts와 동일). */
const LIST_LIMIT = 200;

interface AdminBookingsPageProps {
  bookings: AdminBookingListItem[];
  truncated: boolean;
  blocks: AdminBlockItem[];
  error?: string;
}

export const getServerSideProps: GetServerSideProps<AdminBookingsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  try {
    // 목록을 여는 시점이 곧 만료를 판정할 시점이다 — 크론 없이 lazy 처리(contracts와 동일 관례).
    await expireStaleOrders(new Date());

    const allOrders = await getDb().query.orders.findMany({
      orderBy: (ordersTable, { desc }) => [desc(ordersTable.createdAt)],
      limit: LIST_LIMIT + 1,
      with: { bookings: true },
    });

    const allBlocks = await getDb().query.availabilityBlocks.findMany({
      orderBy: (t, { asc }) => [asc(t.startAt)],
    });

    return {
      props: {
        bookings: allOrders.slice(0, LIST_LIMIT).map((order) => serializeBookingForAdmin(order)),
        truncated: allOrders.length > LIST_LIMIT,
        blocks: allBlocks.map(serializeBlockForAdmin),
      },
    };
  } catch (error: unknown) {
    console.error('[admin/bookings] Failed to load bookings:', error);
    return {
      props: {
        bookings: [],
        truncated: false,
        blocks: [],
        error: '예약 목록을 불러오는 중 오류가 발생했습니다.',
      },
    };
  }
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '결제대기',
  paid: '결제완료',
  partially_refunded: '부분환불',
  refunded: '환불완료',
  failed: '결제실패',
  expired: '만료',
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  confirmed: '확정',
  completed: '완료',
  no_show: '노쇼',
  cancelled: '취소',
};

const BOOKING_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  no_show: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-600',
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function AdminBookingsPage({
  bookings,
  truncated,
  blocks,
  error,
}: AdminBookingsPageProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [blockDate, setBlockDate] = useState('');
  const [blockStartHour, setBlockStartHour] = useState(10);
  const [blockEndHour, setBlockEndHour] = useState(22);
  const [blockMemo, setBlockMemo] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesFilter = filter === 'all' || booking.orderStatus === filter;
      const matchesSearch =
        !term ||
        booking.customerName.toLowerCase().includes(term) ||
        booking.customerEmail.toLowerCase().includes(term) ||
        booking.customerPhone.includes(term) ||
        booking.orderNo.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [bookings, filter, search]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: bookings.length };
    for (const status of orderStatusEnum) {
      result[status] = bookings.filter((b) => b.orderStatus === status).length;
    }
    return result;
  }, [bookings]);

  const mailFailed = useMemo(() => bookings.filter((b) => b.notificationError), [bookings]);

  const refresh = async () => {
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const handleLogout = async () => {
    await logoutAdmin();
    await router.replace('/admin/login');
  };

  const handleDeleteBlock = async (block: AdminBlockItem) => {
    if (!window.confirm('이 블록을 삭제할까요? 해당 시간대가 다시 예약 가능해집니다.')) return;

    setBusy(true);
    setNotice(null);
    const result = await deleteBlock(block.id);
    setBusy(false);

    if (!result.ok) {
      setNotice(result.message ?? '블록을 삭제하지 못했습니다.');
    }
    await refresh();
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockError(null);

    if (!blockDate) {
      setBlockError('날짜를 선택해 주세요.');
      return;
    }
    if (blockEndHour <= blockStartHour) {
      setBlockError('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    setBusy(true);
    const result = await createBlock({
      date: blockDate,
      startHour: blockStartHour,
      endHour: blockEndHour,
      memo: blockMemo.trim() || undefined,
    });
    setBusy(false);

    if (!result.ok) {
      setBlockError(result.message ?? '블록 등록에 실패했습니다.');
      return;
    }

    setBlockMemo('');
    await refresh();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">오류</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>예약 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-6xl mx-auto px-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">예약 관리</h1>
                <p className="text-white/80 mt-2">세션 예약 현황을 확인하고 관리합니다.</p>
              </div>
              <div className="flex gap-2">
                <Link href="/admin/contracts" passHref>
                  <Button variant="secondary">계약 관리</Button>
                </Link>
                <Button
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white/10"
                  onClick={handleLogout}
                >
                  로그아웃
                </Button>
              </div>
            </div>

            <div className="p-6 md:p-8">
              {notice && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>
              )}

              {mailFailed.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-900 rounded-lg text-sm">
                  <strong>알림 발송에 실패한 예약이 {mailFailed.length}건 있습니다</strong> (
                  {mailFailed.map((b) => b.customerName).join(', ')}). 상세 화면에서 재발송하거나
                  고객에게 직접 연락해 주세요.
                </div>
              )}

              {truncated && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
                  최근 {LIST_LIMIT}건만 표시합니다. 아래 검색도 이 목록 안에서만 찾으므로, 더
                  오래된 예약은 나오지 않습니다.
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <div className="flex flex-wrap gap-2">
                  {['all', ...orderStatusEnum].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        filter === status
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status === 'all'
                        ? `전체 (${counts.all})`
                        : `${ORDER_STATUS_LABELS[status] ?? status} (${counts[status] ?? 0})`}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="이름, 이메일, 전화번호, 주문번호 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 min-w-[240px] px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">일시</th>
                      <th className="px-4 py-3">고객</th>
                      <th className="px-4 py-3">상품</th>
                      <th className="px-4 py-3">금액</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3 rounded-r-lg">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatKstDateTime(booking.startAt)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {booking.customerName}
                          <div className="text-xs text-gray-500 font-normal">
                            {booking.customerPhone}
                          </div>
                        </td>
                        <td className="px-4 py-3">{booking.productName}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatPriceAmount(booking.totalAmount)}원
                        </td>
                        <td className="px-4 py-3">
                          {booking.bookingStatus && (
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${BOOKING_STATUS_CLASS[booking.bookingStatus]}`}
                            >
                              {BOOKING_STATUS_LABELS[booking.bookingStatus]}
                            </span>
                          )}
                          <div className="mt-1 text-xs text-gray-500">
                            {ORDER_STATUS_LABELS[booking.orderStatus] ?? booking.orderStatus}
                          </div>
                          {booking.notificationError && (
                            <div className="mt-1 text-xs text-amber-700 font-medium">알림 실패</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/bookings/${booking.id}`} passHref>
                            <Button size="sm" variant="outline">
                              상세
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredBookings.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  {bookings.length === 0 ? '아직 접수된 예약이 없습니다.' : '검색 결과가 없습니다.'}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-1">예약 불가 블록</h2>
            <p className="text-sm text-gray-500 mb-6">
              점검·휴무 등으로 예약을 받지 않을 시간대를 등록합니다. 이 시간대와 겹치는 새 예약은
              슬롯 조회에서부터 제외됩니다.
            </p>

            <form
              onSubmit={handleCreateBlock}
              className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-gray-50 rounded-xl"
            >
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
                <input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">시작</label>
                <select
                  value={blockStartHour}
                  onChange={(e) => setBlockStartHour(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">종료</label>
                <select
                  value={blockEndHour}
                  onChange={(e) => setBlockEndHour(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {[...HOURS, 24].map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">메모 (선택)</label>
                <input
                  type="text"
                  value={blockMemo}
                  onChange={(e) => setBlockMemo(e.target.value)}
                  placeholder="예: 장비 점검"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <Button type="submit" size="sm" disabled={busy}>
                등록
              </Button>
            </form>

            {blockError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{blockError}</div>
            )}

            {blocks.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 블록이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {blocks.map((block) => (
                  <li
                    key={block.id}
                    className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg text-sm"
                  >
                    <span>
                      {formatKstDateTime(block.startAt)} ~ {formatKstDateTime(block.endAt)}
                      {block.memo && <span className="text-gray-500 ml-2">({block.memo})</span>}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      disabled={busy}
                      onClick={() => handleDeleteBlock(block)}
                    >
                      삭제
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
