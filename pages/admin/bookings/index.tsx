import React, { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { createBlock, deleteBlock } from '../../../components/admin/bookingActions';
import { AdminShell } from '../../../components/admin/AdminShell';
import { FilterPill } from '../../../components/admin/FilterPill';
import { ManualBookingPanel } from '../../../components/admin/ManualBookingPanel';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { getDb } from '../../../db/client';
import { loadPaymentLinkOrderInfo } from '../../../lib/payments/paymentLinkOrders';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { orders } from '../../../db/schema';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatPriceAmount } from '../../../data/pricing';
import {
  serializeBlockForAdmin,
  serializeBookingForAdmin,
  type AdminBlockItem,
  type AdminBookingListItem,
} from '../../../lib/booking/admin-serialize';
import { formatKstDateTime } from '../../../lib/booking/format';
import { kstDateString } from '../../../lib/booking/kst';
import { STATUS_VIEWS, STATUS_VIEW_LABELS, statusViewOf, type StatusView } from '../../../lib/booking/statusView';
import { BOOKING_LINES, BOOKING_LINE_LABELS, bookingLineOf, parseBookingLine } from '../../../lib/booking/line';
import { expireStaleOrders } from '../../../lib/booking/service';
import { unmarkedSessionRange } from '../../../lib/booking/unmarkedSessions';
import { describeNotificationError } from '../../../lib/ops/notificationSentinel';
import { Notice } from '../../../components/ui/Notice';

/** 한 화면에 싣는 최대 건수. 넘으면 오래된 주문이 잘린다는 사실을 화면에 알린다(contracts와 동일). */
const LIST_LIMIT = 200;

interface AdminBookingsPageProps {
  bookings: AdminBookingListItem[];
  truncated: boolean;
  /** `?deposit=pending` — 계좌 입금 대기 건만(기간·건수 제한 없음). */
  depositPending?: boolean;
  /** 계좌 입금 대기 세션·믹싱 주문 수(전 기간). */
  depositPendingCount?: number;
  /**
   * `?work=received|in_progress` — 그 단계의 믹싱·마스터링 주문만(기간·건수 제한 없음). 대시보드 "믹싱 착수 대기·작업 중" 카드가 오는 곳이다.
   * 전체 목록은 최근 200건이라 오래된 착수 대기 주문이 밀려나 카드 건수와 화면이 어긋났다.
   */
  workFilter?: 'received' | 'in_progress';
  /** `?session=unmarked` — 끝난 지 7일 안인데 완료·노쇼 표시가 없는 세션만(`lib/booking/unmarkedSessions.ts`). */
  sessionUnmarked?: boolean;
  blocks: AdminBlockItem[];
  error?: string;
}

export const getServerSideProps: GetServerSideProps<AdminBookingsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const depositPending = context.query?.deposit === 'pending';
  const workQuery = context.query?.work;
  const workFilter = workQuery === 'received' || workQuery === 'in_progress' ? workQuery : undefined;
  const sessionUnmarked = context.query?.session === 'unmarked';
  // 조건이 걸린 목록은 건수 제한이 없다 — 대시보드 카드 건수와 화면이 같아야 한다.
  const unlimited = depositPending || workFilter !== undefined || sessionUnmarked;
  const unmarkedRange = unmarkedSessionRange(new Date());

  try {
    // 목록을 여는 시점이 곧 만료를 판정할 시점이다 — 크론 없이 lazy 처리(contracts와 동일 관례).
    await expireStaleOrders(new Date());

    // 두 조회는 서로를 기다릴 이유가 없다 — 순차로 두면 Turso 왕복이 한 번 더 붙는다.
    const [allOrders, allBlocks, pendingCountRow] = await Promise.all([
      getDb().query.orders.findMany({
        /**
         * **예약 목록의 모집단은 session·mixing 둘뿐이다.**
         *
         * orders.type enum은 ['session','mixing','subscription','funding']이고, 후원 1건도
         * 구독 월 청구 1회도 orders 행을 하나씩 만든다. where 절이 없던 동안 그 행들이 이
         * 목록에 섞여 indigo '세션' 배지 + 일시 '-' + 상품 '-'로 나왔고(표 분기가
         * `orderType === 'mixing'` 두 갈래뿐이다), 상태 카운트와 미정합·메일실패·캘린더
         * 배너까지 함께 셌다. 더 나쁜 건 200건 상한을 잠식한다는 것이다 — 후원이 200건을
         * 넘는 캠페인에서는 실제 예약이 목록에서 통째로 밀려나고, 그 상태에서 배너들은
         * '최근 200개 주문 안의 예약'만 보게 된다.
         *
         * 후원·구독은 각자의 관리 화면(/admin/funding, /admin/subscriptions)이 정본이다.
         */
        //
        // `?deposit=pending`이면 계좌 입금 대기 전부(전 기간·건수 제한 없음) — 자동 취소가 없어
        // 오래 열린 대기가 200건 상한 밖으로 밀려나면 영영 안 보인다.
        // 예약금 결제 링크 주문(type 'deposit')은 계좌 입금 흐름(대기·취소)과 결제 완료·환불 건만 싣는다 —
        // 카드 결제창을 열다 만 pending/failed/expired 행은 목록만 어지럽히고 200건 상한을 잠식한다.
        where: depositPending
          ? (ordersTable, { and: all, inArray: within, eq: same }) =>
              all(within(ordersTable.type, ['session', 'mixing', 'deposit']), same(ordersTable.status, 'awaiting_deposit'))
          : sessionUnmarked
          ? (ordersTable, { and: all, eq: same }) =>
              all(
                same(ordersTable.type, 'session'),
                sql`EXISTS (SELECT 1 FROM bookings b WHERE b.order_id = ${ordersTable.id} AND b.status = 'confirmed'
                      AND b.end_at >= ${Math.floor(unmarkedRange.from.getTime() / 1000)} AND b.end_at < ${Math.floor(unmarkedRange.to.getTime() / 1000)})`,
              )
          : workFilter
          ? (ordersTable, { and: all, eq: same }) =>
              all(
                same(ordersTable.type, 'mixing'),
                sql`EXISTS (SELECT 1 FROM work_orders w WHERE w.order_id = ${ordersTable.id} AND w.status = ${workFilter})`,
              )
          : (ordersTable, { and: all, or: either, inArray: within }) =>
              either(
                within(ordersTable.type, ['session', 'mixing']),
                all(
                  within(ordersTable.type, ['deposit']),
                  within(ordersTable.status, ['awaiting_deposit', 'deposit_cancelled', 'paid', 'partially_refunded', 'refunded']),
                ),
              ),
        orderBy: (ordersTable, { desc }) => [desc(ordersTable.createdAt)],
        limit: unlimited ? undefined : LIST_LIMIT + 1,
        // payments를 함께 읽는다 — 주문 상태와 결제 기록의 미정합(스펙 §10) 판정에 쓴다.
        // workOrders는 믹싱·마스터링 주문(Phase 2)의 상태·곡 수·튜닝 여부를 싣는다.
        with: { bookings: true, payments: true, workOrders: true },
      }),
      getDb().query.availabilityBlocks.findMany({
        orderBy: (t, { asc }) => [asc(t.startAt)],
      }),
      getDb()
        .select({ n: sql<number>`count(*)` })
        .from(orders)
        .where(and(inArray(orders.type, ['session', 'mixing', 'deposit']), eq(orders.status, 'awaiting_deposit')))
        .get(),
    ]);

    // 결제 링크 주문의 상품명(0061) — 같은 고객에게 링크를 여럿 보냈을 때 어느 건인지 보이게. 조회 실패는 "예약금"으로 내려간다.
    const linkInfo = await loadPaymentLinkOrderInfo(allOrders.filter((o) => o.type === 'deposit').map((o) => o.orderNo));

    return {
      props: {
        bookings: (unlimited ? allOrders : allOrders.slice(0, LIST_LIMIT)).map((order) => serializeBookingForAdmin(order, linkInfo.get(order.orderNo))),
        truncated: !unlimited && allOrders.length > LIST_LIMIT,
        depositPending,
        ...(workFilter ? { workFilter } : {}),
        ...(sessionUnmarked ? { sessionUnmarked } : {}),
        depositPendingCount: Number(pendingCountRow?.n ?? 0),
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
  awaiting_deposit: '계좌 입금 대기',
  deposit_cancelled: '입금 전 취소',
  auto_cancel_pending: '자동 취소 처리 중',
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

/** work_orders 상태 라벨 — bookingStatus와 별개 어휘를 쓴다(계획서 §4: 접수됨/작업 중/납품 완료/취소됨). */
const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '결제대기',
  received: '접수됨',
  in_progress: '작업 중',
  delivered: '납품 완료',
  cancelled: '취소됨',
};

const WORK_ORDER_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  received: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  delivered: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-gray-200 text-gray-600',
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function AdminBookingsPage({
  bookings,
  truncated,
  depositPending = false,
  depositPendingCount = 0,
  workFilter,
  sessionUnmarked = false,
  blocks,
  error,
}: AdminBookingsPageProps) {
  const router = useRouter();
  const { fromEvent, start: fromStart, end: fromEnd, title: fromTitle } = router.query;
  const prefill = useMemo(
    () =>
      typeof fromEvent === 'string' && typeof fromStart === 'string' && typeof fromEnd === 'string'
        ? { eventId: fromEvent, startAt: fromStart, endAt: fromEnd, title: typeof fromTitle === 'string' ? fromTitle : '' }
        : null,
    [fromEvent, fromStart, fromEnd, fromTitle],
  );
  // 대시보드 묶음(입금 대기·믹싱 단계·표시 대기)으로 들어왔으면 그 목록 전부를 본다 — 확정만 보이면 입금 대기 목록이 비어 보인다.
  const serverFiltered = depositPending || Boolean(workFilter) || sessionUnmarked;
  const [view, setView] = useState<StatusView>(serverFiltered ? 'all' : 'confirmed');
  useEffect(() => {
    setView(serverFiltered ? 'all' : 'confirmed');
  }, [serverFiltered]);
  const [search, setSearch] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [blockDate, setBlockDate] = useState('');
  const [blockStartHour, setBlockStartHour] = useState(10);
  const [blockEndHour, setBlockEndHour] = useState(22);
  const [blockMemo, setBlockMemo] = useState('');
  // 비우면 녹음실 블록. 연습실 방을 막으려면 'R02'처럼 방 번호를 적는다(월세 입주 예정 등).
  const [blockRoom, setBlockRoom] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);

  // 메뉴가 연습실 / 녹음실 / 믹싱으로 갈라 걸어 주는 라인. 없으면 전체(예약금 결제 링크 주문 포함).
  const line = parseBookingLine(router.query.line);
  const lineBookings = useMemo(
    () => (line ? bookings.filter((booking) => bookingLineOf(booking) === line) : bookings),
    [bookings, line],
  );

  /** 지금 라인을 지킨 이 화면 주소(+추가 쿼리) — 입금 대기·작업 묶음을 풀어도 보던 라인에 남는다. */
  const lineHref = (extra?: string) => {
    const params = [line ? `line=${line}` : null, extra ?? null].filter(Boolean);
    return params.length > 0 ? `/admin/bookings?${params.join('&')}` : '/admin/bookings';
  };

  const matchesSearch = (booking: AdminBookingListItem, term: string) =>
    !term ||
    booking.customerName.toLowerCase().includes(term) ||
    booking.customerEmail.toLowerCase().includes(term) ||
    booking.customerPhone.includes(term) ||
    booking.orderNo.toLowerCase().includes(term);

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = lineBookings.filter((booking) => (view === 'all' || statusViewOf(booking) === view) && matchesSearch(booking, term));
    if (view !== 'confirmed') return rows;
    // 확정 보기는 앞으로 올 세션을 가까운 순으로 먼저 — "다음에 누가 오나"가 궁금해서 여는 화면이다. 지난 것·믹싱은 그 뒤에 원래 순서(최근순)대로.
    const todayStart = new Date(`${kstDateString(new Date())}T00:00:00+09:00`).getTime();
    const upcomingAt = (b: AdminBookingListItem): number | null => {
      const at = b.orderType === 'deposit' ? b.linkSessionAt : b.startAt;
      if (!at) return null;
      const ms = new Date(at).getTime();
      return ms >= todayStart ? ms : null;
    };
    const upcoming = rows.filter((b) => upcomingAt(b) !== null).sort((a, b) => (upcomingAt(a) as number) - (upcomingAt(b) as number));
    return [...upcoming, ...rows.filter((b) => upcomingAt(b) === null)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineBookings, view, search]);

  const viewCounts = useMemo(() => {
    const result: Record<StatusView, number> = { confirmed: 0, awaiting: 0, cancelled: 0, failed: 0, all: lineBookings.length };
    for (const b of lineBookings) result[statusViewOf(b)] += 1;
    return result;
  }, [lineBookings]);

  /** 검색어가 지금 보기 밖에서만 맞으면 알려 준다 — 확정 보기에서 입금 대기 고객을 찾다가 "없다"로 끝나지 않게. */
  const searchElsewhere = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || view === 'all') return 0;
    return lineBookings.filter((b) => statusViewOf(b) !== view && matchesSearch(b, term)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineBookings, view, search]);

  const mailFailed = useMemo(() => bookings.filter((b) => b.notificationError), [bookings]);

  /**
   * 구글 캘린더에 등록되지 않은 예약. 결제·확정은 정상이라 목록에서는 완전히 정상으로
   * 보이는데, 정작 운영자 캘린더에는 그 시간이 비어 있다. 그 상태로 전화 예약을 받으면
   * 오프라인 이중예약이 난다 — 알림 실패보다 위에 둔다(고객이 이미 돈을 냈고 온다).
   *
   * gcalError(시도했다가 실패)만이 아니라 gcalMissing(시도 자체가 없음 — 확정 직후 후처리가
   * 죽어 gcal_event_id·gcal_error가 둘 다 NULL)도 함께 센다. 운영 점검 메일
   * (lib/ops/healthCheck.ts)과 같은 판정이어야 화면과 메일이 같은 건수를 말한다.
   */
  const gcalFailed = useMemo(
    () => bookings.filter((b) => b.bookingStatus !== 'cancelled' && (b.gcalError || b.gcalMissing)),
    [bookings],
  );
  // 취소했는데 캘린더 일정을 못 지운 예약 — "등록 안 됨"과 반대 문제다(일정이 남아 그 시간을 계속 막는다).
  const gcalStaleDelete = useMemo(
    () => bookings.filter((b) => b.bookingStatus === 'cancelled' && b.gcalError?.startsWith('delete: ')),
    [bookings],
  );

  // 결제 기록과 주문 상태가 어긋난 건 — 돈이 걸린 문제라 알림 실패보다 위에 둔다(스펙 §10).
  const mismatched = useMemo(() => bookings.filter((b) => b.mismatch), [bookings]);

  // 끝난 블록은 접어 둔다 — 쌓이면 지금 걸린 블록이 목록 아래로 밀린다.
  const [showPastBlocks, setShowPastBlocks] = useState(false);
  const { pastBlocks, visibleBlocks } = useMemo(() => {
    const nowMs = Date.now();
    const past = blocks.filter((b) => new Date(b.endAt).getTime() <= nowMs);
    const upcoming = blocks.filter((b) => new Date(b.endAt).getTime() > nowMs);
    return { pastBlocks: past, visibleBlocks: showPastBlocks ? [...past, ...upcoming] : upcoming };
  }, [blocks, showPastBlocks]);

  const refresh = async () => {
    // 캘린더에서 가져온 등록이 끝났으면 fromEvent 주소를 비운다 — 새로고침하면 지워진 일정으로 칸이 다시 열린다.
    // 라인(`?line=`)은 남긴다 — 녹음실 화면에서 가져왔으면 등록 뒤에도 녹음실 목록이어야 한다.
    await router.replace(prefill ? (line ? `/admin/bookings?line=${line}` : '/admin/bookings') : router.asPath, undefined, { scroll: false });
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
    const blockInput = {
      date: blockDate,
      startHour: blockStartHour,
      endHour: blockEndHour,
      memo: blockMemo.trim() || undefined,
      roomNumber: blockRoom.trim() || undefined,
    };
    let result = await createBlock(blockInput);
    if (!result.ok && result.conflict) {
      // 이미 잡힌 예약과 겹친다 — 그대로 걸면 그 예약은 남은 채 시간만 "휴무"가 된다. 운영자가 알고도 걸겠다고 해야 통과한다.
      if (window.confirm(`${result.message}\n\n그래도 이 시간을 막을까요?`)) {
        result = await createBlock({ ...blockInput, force: true });
      } else {
        setBusy(false);
        return;
      }
    }
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
      <>
        <Head>
          <title>예약 관리 | Studio NOL</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <AdminShell title="예약 관리" description="세션 예약 현황을 확인하고 관리합니다." width="wide">
          <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-900 mb-2">오류</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </AdminShell>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>예약 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell title="예약 관리" description="세션 예약 현황을 확인하고 관리합니다." width="wide">
        <div className="space-y-6">
          <ManualBookingPanel today={kstDateString(new Date())} onCreated={refresh} prefill={prefill} line={line} />
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 md:p-8">
              {notice && (
                <Notice tone="info" light className="mb-4">{notice}</Notice>
              )}

              {mismatched.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">
                  <strong>결제 기록과 주문 상태가 어긋난 주문이 {mismatched.length}건 있습니다</strong>{' '}
                  (
                  {mismatched
                    .map((b) => `${b.orderNo}${b.latestPaymentKeyPrefix ? ` · ${b.latestPaymentKeyPrefix}…` : ''}`)
                    .join(', ')}
                  ). 토스 콘솔에서 실제 결제·취소 상태를 확인한 뒤 처리해 주세요.
                </div>
              )}

              {gcalFailed.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">
                  <strong>구글 캘린더에 등록되지 않은 예약이 {gcalFailed.length}건 있습니다</strong> (
                  {gcalFailed.map((b) => `${b.orderNo} · ${b.customerName}`).join(', ')}). 결제는
                  정상이지만 캘린더에는 이 시간이 비어 있습니다 — 그대로 두면 같은 시간에 전화
                  예약을 받아 겹칠 수 있습니다. 상세 화면에서 재시도하거나 캘린더에 직접
                  넣어 주세요.
                </div>
              )}

              {gcalStaleDelete.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-sm">
                  <strong>취소했지만 캘린더 일정을 지우지 못한 예약이 {gcalStaleDelete.length}건 있습니다</strong> (
                  {gcalStaleDelete.map((b) => `${b.orderNo} · ${b.customerName}`).join(', ')}). 남은 일정이 그 시간을 계속 막고
                  있습니다 — 상세 화면의 “캘린더 일정 지우기”를 눌러 주세요.
                </div>
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

              <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="라인">
                {[null, ...BOOKING_LINES].map((value) => {
                  const active = line === value;
                  const count = value ? bookings.filter((b) => bookingLineOf(b) === value).length : bookings.length;
                  return (
                    <FilterPill key={value ?? 'all'} active={active} href={value ? `/admin/bookings?line=${value}` : '/admin/bookings'}>
                      {value ? BOOKING_LINE_LABELS[value] : '전체'} ({count})
                    </FilterPill>
                  );
                })}
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                {/*
                  상태는 드롭다운 하나(lib/booking/statusView.ts — 확정 / 결제·입금 대기 / 취소·환불 / 실패·만료 / 전체, 기본 확정).
                  예전엔 주문 상태 아홉 개를 알약으로 늘어놓아 지저분했다(운영자 지적 2026-10-23).
                  "입금 대기" 알약은 따로 둔다 — 서버가 200건 상한 없이 전부 세는 처리할 일 목록이라 1건 이상일 때만 보인다.
                */}
                <div className="flex flex-wrap gap-2" role="group" aria-label="상태">
                  {sessionUnmarked && (
                    <FilterPill active tone="violet" href={lineHref()}>
                      완료·노쇼 표시 대기 ({bookings.length}) · 전체 보기
                    </FilterPill>
                  )}
                  {workFilter && (
                    <FilterPill active tone="violet" href={lineHref()}>
                      {workFilter === 'received' ? '믹싱 착수 대기' : '믹싱 작업 중'} ({bookings.length}) · 전체 보기
                    </FilterPill>
                  )}
                  {(depositPending || depositPendingCount > 0) && (
                    <FilterPill active={depositPending} tone="sky" href={depositPending ? lineHref() : lineHref('deposit=pending')}>
                      입금 대기 ({depositPendingCount})
                    </FilterPill>
                  )}
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <span className="shrink-0">상태</span>
                    <Select value={view} onChange={(e) => setView(e.target.value as StatusView)} light aria-label="상태 보기" className="w-auto py-1.5 text-sm">
                      {STATUS_VIEWS.map((v) => (
                        <option key={v} value={v}>
                          {STATUS_VIEW_LABELS[v]} ({viewCounts[v]})
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>

                <TextInput
                  type="text"
                  placeholder="이름, 이메일, 전화번호, 주문번호 검색"
                  aria-label="예약 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  light className="w-auto flex-1 min-w-[240px] px-4"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="admin-table admin-table-compact w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">유형</th>
                      <th className="px-4 py-3">일시 / 상품</th>
                      <th className="px-4 py-3">고객</th>
                      <th className="px-4 py-3">상품</th>
                      <th className="px-4 py-3">금액</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3 rounded-r-lg">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((booking) => {
                      const isMixing = booking.orderType === 'mixing';
                      const isDeposit = booking.orderType === 'deposit';
                      const isPracticeRoom = booking.serviceType === 'practice-room';
                      return (
                        <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td data-label="유형" className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                isMixing ? 'bg-purple-100 text-purple-700'
                                  : isDeposit ? 'bg-amber-100 text-amber-800'
                                  : isPracticeRoom ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              {isMixing ? '믹싱' : isDeposit ? '예약금' : isPracticeRoom ? '연습실' : '세션'}
                            </span>
                            {booking.roomNumber && (
                              <span className="ml-1 inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                {booking.roomNumber}
                              </span>
                            )}
                          </td>
                          <td data-label="일시 / 상품" className="px-4 py-3 whitespace-nowrap">
                            {isMixing
                              ? `${booking.productName} × ${booking.workOrder?.songCount ?? '-'}곡${booking.workOrder?.vocalTuning ? ' (튜닝)' : ''}`
                              : isDeposit ? (booking.linkSessionAt ? formatKstDateTime(booking.linkSessionAt) : '-') : formatKstDateTime(booking.startAt)}
                          </td>
                          <td data-label="고객" className="px-4 py-3 font-medium text-gray-900">
                            {booking.customerName}
                            <div className="text-xs text-gray-500 font-normal">
                              {booking.customerPhone}
                            </div>
                          </td>
                          <td data-label="상품" className="px-4 py-3">{booking.productName}</td>
                          <td data-label="금액" className="px-4 py-3 whitespace-nowrap">
                            {formatPriceAmount(booking.totalAmount)}원
                          </td>
                          <td data-label="상태" className="px-4 py-3">
                            {isMixing
                              ? booking.workOrder && (
                                  <span
                                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${WORK_ORDER_STATUS_CLASS[booking.workOrder.status]}`}
                                  >
                                    {WORK_ORDER_STATUS_LABELS[booking.workOrder.status]}
                                  </span>
                                )
                              : booking.bookingStatus && (
                                  <span
                                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${BOOKING_STATUS_CLASS[booking.bookingStatus]}`}
                                  >
                                    {BOOKING_STATUS_LABELS[booking.bookingStatus]}
                                  </span>
                                )}
                            <div className="mt-1 text-xs text-gray-500">
                              {ORDER_STATUS_LABELS[booking.orderStatus] ?? booking.orderStatus}
                            </div>
                            {booking.bankDeposit === 'awaiting' && (
                              <div className="mt-1">
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-semibold">
                                  계좌 입금 대기
                                </span>
                              </div>
                            )}
                            {booking.mismatch && (
                              <div className="mt-1">
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                                  미정합
                                </span>
                              </div>
                            )}
                            {/* 원문 대신 배지 문구 — `send_pending`·`send_inflight`는 실패가
                                아니라 진행/대기 상태다(lib/ops/notificationSentinel.ts). */}
                            {booking.notificationError && (
                              <div className="mt-1 text-xs text-amber-700 font-medium">
                                {describeNotificationError(booking.notificationError)?.badge}
                              </div>
                            )}
                          </td>
                          <td data-label="관리" className="px-4 py-3">
                            <Button asChild light size="sm" variant="weak">
                              <Link href={`/admin/bookings/${booking.id}`}>
                                상세
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {searchElsewhere > 0 && (
                <p className="mt-3 text-sm text-gray-600">
                  다른 상태에 맞는 예약이 {searchElsewhere}건 더 있어요 ·{' '}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setView('all')}>
                    전체에서 보기
                  </button>
                </p>
              )}

              {filteredBookings.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  {bookings.length === 0
                    ? '아직 접수된 예약이 없습니다.'
                    : search.trim()
                      ? '검색 결과가 없습니다.'
                      : `${STATUS_VIEW_LABELS[view]} 예약이 없습니다.`}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-1">예약 불가 블록</h2>
            <p className="text-sm text-gray-500 mb-6">
              점검·휴무 등으로 예약을 받지 않을 시간대를 등록합니다. 이 시간대와 겹치는 새 예약은
              슬롯 조회에서부터 제외됩니다.
            </p>

            <form
              onSubmit={handleCreateBlock}
              className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-gray-50 rounded-xl"
            >
              <Field id="block-date" label="날짜" required className={lightOnlyField}>
                <TextInput
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  light className="w-auto text-sm"
                  required
                />
              </Field>
              <Field id="block-start" label="시작" className={lightOnlyField}>
                <Select
                  value={blockStartHour}
                  onChange={(e) => setBlockStartHour(Number(e.target.value))}
                  light className="w-auto text-sm"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="block-end" label="종료" className={lightOnlyField}>
                <Select
                  value={blockEndHour}
                  onChange={(e) => setBlockEndHour(Number(e.target.value))}
                  light className="w-auto text-sm"
                >
                  {[...HOURS, 24].map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="block-room" label="방 (선택)" className={lightOnlyField + ' w-32'}>
                <TextInput
                  id="block-room"
                  value={blockRoom}
                  onChange={(e) => setBlockRoom(e.target.value)}
                  placeholder="비우면 녹음실"
                  light className="text-sm"
                />
              </Field>
              <Field id="block-memo" label="메모 (선택)" className={lightOnlyField + ' flex-1 min-w-[160px]'}>
                <TextInput
                  type="text"
                  value={blockMemo}
                  onChange={(e) => setBlockMemo(e.target.value)}
                  placeholder="예: 장비 점검"
                  light className="text-sm"
                />
              </Field>
              <Button light type="submit" size="sm" disabled={busy}>
                등록
              </Button>
            </form>

            {blockError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{blockError}</div>
            )}

            {pastBlocks.length > 0 && (
              <button
                type="button"
                className="mb-3 text-sm text-primary hover:underline"
                aria-expanded={showPastBlocks}
                onClick={() => setShowPastBlocks((v) => !v)}
              >
                {showPastBlocks ? '지난 블록 숨기기' : `지난 블록 ${pastBlocks.length}개 보기`}
              </button>
            )}
            {visibleBlocks.length === 0 ? (
              <p className="text-sm text-gray-500">{blocks.length === 0 ? '등록된 블록이 없습니다.' : '지금 이후의 블록이 없습니다.'}</p>
            ) : (
              <ul className="space-y-2">
                {visibleBlocks.map((block) => (
                  <li
                    key={block.id}
                    className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg text-sm"
                  >
                    <span>
                      {formatKstDateTime(block.startAt)} ~ {formatKstDateTime(block.endAt)}
                      {block.roomNumber && <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{block.roomNumber}</span>}
                      {block.memo && <span className="text-gray-500 ml-2">({block.memo})</span>}
                    </span>
                    <Button light
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
      </AdminShell>
    </>
  );
}
