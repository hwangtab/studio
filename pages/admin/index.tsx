import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../components/admin/AdminShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FOCUS_RING } from '../../components/ui/focusRing';
import { Notice } from '../../components/ui/Notice';
import { formatKstDateTime } from '../../lib/booking/format';
import { kstDateString } from '../../lib/booking/kst';
import { authenticateAdminRequest } from '../../lib/contracts/admin-auth';
/**
 * 값이 아니라 타입만 가져온다. loadAdminDashboard는 getServerSideProps 안에서만 쓰여 서버 번들에
 * 남지만, 컴포넌트 본문에서 이 모듈의 상수를 하나라도 쓰면 모듈 전체가 클라이언트 번들로
 * 끌려가고, 그 끝에 건강 점검의 googleapis(net·worker_threads)가 있어 페이지가 500이 된다.
 */
import type { AdminDashboard, UpcomingSession } from '../../lib/ops/adminDashboard';
import { loadAdminDashboard } from '../../lib/ops/adminDashboard';
import type { RevenueSnapshot } from '../../lib/ops/revenueSnapshot';
import { loadRevenueSnapshot } from '../../lib/ops/revenueSnapshot';
import { countPendingShopProducts } from '../../lib/shop/adminProducts';
import { countShopAwaitingShipment, type ShopAwaitingShipmentCounts } from '../../lib/shop/adminQueries';

/**
 * 관리자 첫 화면 = 오늘 처리할 일.
 *
 * 2026-10-22 재구성(전문가 검토 회의 — 재무·UX·운영·엔지니어링):
 * - 매출·지출 상세는 재무(`/admin/finance`)로 옮기고, 여기에는 이번 달 **수익 한 장**만 둔다. 숫자는 재무 화면과 같은
 *   buildRevenueSnapshot에서 온다(revenueSnapshot.test.ts가 두 숫자가 같은지 고정한다) — 첫 화면이 따로 계산하지 않는다.
 * - 위계: 맨 위 요약(긴급·확인·대기 작업·오늘 일정) → 왼쪽 넓은 칸에 처리할 일·대기 작업, 오른쪽에 수익·일정.
 * - 대기 카드 약 30종을 "무엇을 해야 하나"(입금 확인·송금·기록·심사·계약) 묶음으로 나누고, 0건은 숨긴다.
 *   할 일이 아니라 상태인 것(믹싱 작업 중·예약 발송 전·오늘 레슨)은 일정 칸으로 옮겼다.
 * - 토스 결제 장부 CSV는 재무 › 장부 내보내기로 옮겼다(그 화면은 DB를 읽지 않아 현황이 죽어도 받을 수 있다).
 *
 * 처리할 일은 운영 점검 메일과 같은 판정식(collectDbIssues)이다 — 판정이 두 벌이면 메일과 화면이 다른 건수를 말하게 된다.
 */
interface AdminIndexPageProps {
  dashboard: AdminDashboard | null;
  /** 상점 대기 건수 — 표가 없거나 조회가 실패하면 null(그 항목은 숨긴다). */
  shopQueues: { pendingProducts: number | null; awaitingShipment: ShopAwaitingShipmentCounts | null };
  /** 이번 달 수익 요약 — 조회가 실패하면 null(그 카드는 숨긴다. 매출 때문에 첫 화면이 죽으면 안 된다). */
  revenue?: RevenueSnapshot | null;
  error?: string;
}

export const getServerSideProps: GetServerSideProps<AdminIndexPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const now = new Date();

  // 셋을 함께 읽는다(예전엔 상점 → 매출 → 현황 차례라 매출 조회 왕복이 첫 화면 앞에 그대로 붙었다).
  // 각 갈래는 실패를 따로 삼킨다 — 상점 표가 없거나 매출 조회가 실패해도 처리할 일은 떠야 한다.
  const [pendingProducts, awaitingShipment, revenue, dashboardResult] = await Promise.all([
    countPendingShopProducts(),
    countShopAwaitingShipment(now),
    loadRevenueSnapshot(now).catch((error: unknown) => {
      console.error('[admin] 매출 요약 조회 실패:', error);
      return null;
    }),
    loadAdminDashboard(now).then(
      (dashboard) => ({ ok: true as const, dashboard }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
  ]);
  const shopQueues = { pendingProducts, awaitingShipment };

  if (dashboardResult.ok) {
    return { props: { dashboard: dashboardResult.dashboard, shopQueues, revenue } };
  }
  // 첫 화면이 죽으면 나머지 관리 화면으로 가는 길까지 막힌다 — 메뉴는 살려 두고 오류만 알린다.
  console.error('[admin] Failed to load dashboard:', dashboardResult.error);
  return {
    props: { dashboard: null, shopQueues, revenue, error: '현황을 불러오지 못했습니다. 각 관리 화면은 위 메뉴에서 열 수 있습니다.' },
  };
};

const SEVERITY_TONE: Record<'high' | 'medium', 'error' | 'warning'> = {
  high: 'error',
  medium: 'warning',
};

const SEVERITY_LABEL: Record<'high' | 'medium', string> = {
  high: '긴급',
  medium: '확인',
};

const SOCIAL_LABELS: Record<string, string> = {
  ig: '인스타그램',
  threads: '스레드',
};

/** 토큰 만료가 이 안으로 들어오면 눈에 띄게 — 주간 갱신 크론이 두 번 실패하면 닿는 거리다. */
const SOCIAL_WARN_DAYS = 14;

/** 카드 겉모양 — 대시보드 칸은 모두 이 한 벌. */
const CARD = 'rounded-2xl bg-white p-4 shadow-sm md:p-6';
const CARD_TITLE = 'text-lg font-bold text-gray-900 dark:text-gray-900';

/** 누를 수 있는 줄·카드의 오른쪽 표시 — 링크인지 알아보게(운영자 지적 2026-10-21: "클릭되는 줄 모르겠다"). */
const Chevron = () => (
  <span aria-hidden="true" className="shrink-0 text-lg leading-none text-gray-400 group-hover:text-primary">
    ›
  </span>
);

/** 줄 전체가 링크인 목록 행. */
const ROW_LINK = `group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 ${FOCUS_RING}`;

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const signedWon = (value: number) => (value < 0 ? `-${won(-value)}` : won(value));

/** 'HH:mm'(KST). */
const kstTime = (iso: string): string => {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
};

// ── 대기 작업 묶음 ────────────────────────────────────────────────────────────

interface QueueItem {
  label: string;
  count: number;
  href: string;
}

interface QueueGroup {
  /** 화면 안 이동용(`/admin#deposits` — 점검 메일의 입금 기한 항목이 여기로 온다). */
  id: string;
  title: string;
  items: QueueItem[];
}

/**
 * 대기 건수를 "무엇을 해야 하나"로 묶는다. 묶음·순서는 화면 쪽 표시일 뿐 데이터(adminDashboard.ts)는 그대로다.
 * 순서는 돈이 걸린 것(입금·송금) → 기한이 있는 기록 → 심사 → 계약·구독.
 */
const queueGroups = (dashboard: AdminDashboard, shopQueues: AdminIndexPageProps['shopQueues']): QueueGroup[] => {
  const q = dashboard.queues;
  const groups: QueueGroup[] = [
    {
      id: 'deposits',
      title: '입금 확인',
      items: [
        { label: '입금 대기 예약·믹싱', count: q.awaitingDeposit.bookings, href: '/admin/bookings?deposit=pending' },
        { label: '입금 대기 펀딩', count: q.awaitingDeposit.funding, href: '/admin/funding?deposit=pending' },
        { label: '입금 대기 공연 티켓', count: q.awaitingDeposit.shows, href: '/admin/shows' },
        { label: '입금 대기 상점 주문', count: q.awaitingDeposit.shop, href: '/admin/shop' },
      ],
    },
    {
      id: 'transfers',
      title: '환불·정산 송금',
      items: [
        { label: '환불 요청 펀딩 후원', count: q.fundingRefundRequests, href: '/admin/funding' },
        { label: '이체 대기 펀딩 정산', count: q.fundingPayoutsPending, href: '/admin/funding/projects?payout=pending' },
        { label: '이체 대기 상점 정산', count: q.shopPayoutsPending, href: '/admin/shop' },
        { label: '이체 대기 공연 정산', count: q.showPayoutsPending, href: '/admin/shows' },
        { label: '이체 대기 아티스트 정산', count: q.artistPayoutsPending, href: '/admin/artists' },
      ],
    },
    {
      id: 'records',
      title: '기록·발송',
      items: [
        { label: '완료·노쇼 표시 대기 세션', count: q.sessionsAwaitingMark, href: '/admin/bookings?session=unmarked' },
        ...(q.lessons !== null ? [{ label: '완료·결석 표시 대기 레슨', count: q.lessons.unmarked, href: '/admin/lessons' }] : []),
        { label: '믹싱 착수 대기', count: q.mixingReceived, href: '/admin/bookings?work=received' },
        ...(shopQueues.awaitingShipment !== null ? [{ label: '발송 대기 상점 주문', count: shopQueues.awaitingShipment.studio, href: '/admin/shop' }] : []),
        { label: '정산 기록 대기 펀딩 (마감됨)', count: q.fundingPayoutsToRecord, href: '/admin/funding/projects?payout=record' },
        { label: '정산 기록 대기 상점 (지난 달)', count: q.shopPayoutsToRecord, href: '/admin/shop' },
        { label: '정산 기록 대기 공연 (종료됨)', count: q.showPayoutsToRecord, href: '/admin/shows' },
      ],
    },
    {
      id: 'reviews',
      title: '심사·확인',
      items: [
        { label: '심사 대기 펀딩 프로젝트', count: q.fundingProjectsAwaitingReview, href: '/admin/funding/projects' },
        ...(q.showSubmissionsAwaitingReview !== null ? [{ label: '심사 대기 주최자 공연', count: q.showSubmissionsAwaitingReview, href: '/admin/shows/submissions' }] : []),
        ...(shopQueues.pendingProducts !== null ? [{ label: '심사 대기 상점 상품', count: shopQueues.pendingProducts, href: '/admin/shop/products' }] : []),
        ...(q.sessionMusiciansNew !== null ? [{ label: '새 세션 연주자 등록', count: q.sessionMusiciansNew, href: '/admin/session-musicians?status=new' }] : []),
      ],
    },
    {
      id: 'contracts',
      title: '계약·구독',
      items: [
        { label: '종료 처리 필요 계약', count: q.contractsAwaitingTermination, href: '/admin/contracts?status=termination' },
        { label: '서명 대기 계약', count: q.contractsAwaitingSignature, href: '/admin/contracts?status=sent' },
        { label: '결제 재시도 중 구독', count: q.subscriptionsPastDue, href: '/admin/subscriptions' },
        { label: '정지된 구독', count: q.subscriptionsPaused, href: '/admin/subscriptions' },
        { label: '카드 등록 대기 구독', count: q.subscriptionsPendingCard, href: '/admin/subscriptions' },
      ],
    },
  ];
  return groups.map((g) => ({ ...g, items: g.items.filter((item) => item.count > 0) })).filter((g) => g.items.length > 0);
};

/** 할 일이 아니라 지금 돌아가는 상태 — 일정 칸 아래에 작게. */
const inProgressItems = (dashboard: AdminDashboard, shopQueues: AdminIndexPageProps['shopQueues']): QueueItem[] =>
  [
    { label: '믹싱 작업 중', count: dashboard.queues.mixingInProgress, href: '/admin/bookings?work=in_progress' },
    { label: '예약 발송일 전 상점 주문', count: shopQueues.awaitingShipment?.preorder ?? 0, href: '/admin/shop' },
    { label: '아티스트 발송 대기 상점 주문', count: shopQueues.awaitingShipment?.artist ?? 0, href: '/admin/shop' },
  ].filter((item) => item.count > 0);

// ── 칸들 ─────────────────────────────────────────────────────────────────────

interface SummaryTile {
  label: string;
  count: number;
  href: string;
  tone: 'error' | 'warning' | 'neutral';
}

const SummaryTiles = ({ tiles }: { tiles: SummaryTile[] }) => (
  <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
    {tiles.map((tile) => {
      const live = tile.count > 0;
      const tone = !live ? 'border-gray-100 bg-white' : tile.tone === 'error' ? 'border-red-200 bg-red-50' : tile.tone === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white';
      return (
        <li key={tile.label}>
          <Link href={tile.href} className={`group flex h-full items-start justify-between gap-2 rounded-xl border p-4 shadow-sm transition-colors hover:bg-gray-50 ${FOCUS_RING} ${tone}`}>
            <span className="min-w-0">
              <span className={`block text-sm ${live ? 'text-gray-700' : 'text-gray-400'}`}>{tile.label}</span>
              <span className={`mt-1 block text-2xl font-bold tabular-nums ${live ? 'text-gray-900' : 'text-gray-400'}`}>{tile.count}</span>
            </span>
            <Chevron />
          </Link>
        </li>
      );
    })}
  </ul>
);

const IssuesCard = ({ issues }: { issues: AdminDashboard['issues'] }) => (
  <section id="todo" className={`${CARD} scroll-mt-20`}>
    <h2 className={`${CARD_TITLE} mb-1`}>처리할 일</h2>
    <p className="mb-3 text-xs text-gray-500">매일 아침 8시 운영 점검 메일과 같은 기준입니다. 처리하면 다음 새로고침에서 사라집니다.</p>
    {issues.length === 0 ? (
      <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">지금 처리할 일이 없어요.</p>
    ) : (
      <ul className="divide-y divide-gray-100">
        {issues.map((issue, index) => {
          const body = (
            <>
              <Badge tone={SEVERITY_TONE[issue.severity]} className="mt-0.5 shrink-0">
                {SEVERITY_LABEL[issue.severity]}
              </Badge>
              <span className="min-w-0 flex-1">
                <span className={`block font-medium ${issue.href ? 'text-primary group-hover:underline' : 'text-gray-900'}`}>{issue.title}</span>
                <span className="mt-1 block whitespace-pre-line break-words text-sm text-gray-600">{issue.detail}</span>
              </span>
            </>
          );
          return (
            // 같은 제목이 두 번 나와도 키가 겹치지 않게 순번을 붙인다.
            <li key={`${index}-${issue.title}`} className="py-1">
              {issue.href ? (
                <Link href={issue.href} className={`${ROW_LINK} items-start`}>
                  {body}
                  <Chevron />
                </Link>
              ) : (
                <div className="flex items-start gap-3 py-2">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

const QueueCard = ({ groups }: { groups: QueueGroup[] }) => (
  <section id="queues" className={`${CARD} scroll-mt-20`}>
    <h2 className={`${CARD_TITLE} mb-1`}>대기 작업</h2>
    <p className="mb-3 text-xs text-gray-500">사람이 손대야 넘어가는 건수입니다. 없는 항목은 숨겼어요.</p>
    {groups.length === 0 ? (
      <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">기다리는 작업이 없어요.</p>
    ) : (
      // 묶음 길이가 제각각이라 격자 대신 단(column)으로 흘린다 — 격자면 짧은 묶음 옆에 빈자리가 생긴다.
      <div className="gap-x-6 md:columns-2">
        {groups.map((group) => (
          <div key={group.id} id={group.id} className="mb-5 break-inside-avoid scroll-mt-20 last:mb-0">
            <h3 className="mb-1 text-sm font-semibold text-gray-700">{group.title}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className={`${ROW_LINK} text-sm`}>
                    <span className="min-w-0 flex-1 text-gray-800 group-hover:text-primary">{item.label}</span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-sm font-semibold tabular-nums text-gray-900">{item.count}</span>
                    <Chevron />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )}
  </section>
);

const ProfitCard = ({ revenue }: { revenue: RevenueSnapshot }) => {
  const rate = revenue.changeRate;
  const profit = revenue.totalProfit;
  const missing = [
    revenue.tenancyMissing ? '월 입주 수입(0066)' : null,
    revenue.manualMissing ? '직접 받은 매출(0063)' : null,
    revenue.lessonMissing ? '레슨 수납(0081)' : null,
  ].filter(Boolean);
  return (
    <section className={CARD}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={CARD_TITLE}>{revenue.month}월 수익</h2>
        <Link href="/admin/finance" aria-label={`${revenue.month}월 매출·지출·수익 자세히 보기`} className={`rounded text-sm font-medium text-primary hover:underline ${FOCUS_RING}`}>
          재무 →
        </Link>
      </div>
      {/* 재무로 가는 링크는 제목 옆 하나만 — 큰 숫자까지 같은 곳으로 걸면 화면 낭독기가 같은 링크를 두 번 읽는다. */}
      {profit === null ? (
        <>
          <p className="text-3xl font-bold tabular-nums text-gray-900">{won(revenue.net)}</p>
          <p className="mt-1 text-xs text-gray-500">순매출 — 지출 표를 읽지 못해 수익을 낼 수 없어요(마이그레이션 0080 확인).</p>
        </>
      ) : (
        <>
          <p className={`text-3xl font-bold tabular-nums ${profit < 0 ? 'text-red-700' : 'text-gray-900'}`}>{signedWon(profit)}</p>
          <p className="mt-1 text-xs text-gray-500">매출 − 지출 (대출 원금은 빼지 않음)</p>
        </>
      )}
      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-600">매출 (환불 제외)</dt>
          <dd className="tabular-nums text-gray-900">{won(revenue.net)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-600">지출</dt>
          <dd className="tabular-nums text-gray-900">{revenue.expenseTotal === null ? '-' : revenue.expenseTotal > 0 ? `-${won(revenue.expenseTotal)}` : '0원'}</dd>
        </div>
      </dl>
      <p className={`mt-1 text-xs font-medium ${rate === null ? 'text-gray-500' : rate >= 0 ? 'text-green-700' : 'text-red-700'}`}>
        {rate === null ? '전월 매출이 없어 비교하지 않습니다' : `매출 ${rate >= 0 ? '▲' : '▼'} ${Math.abs(rate).toFixed(1)}% 전월(${won(revenue.previousNet)}) 전체 대비`}
      </p>
      <ul className="mt-4 border-t border-gray-100 pt-2 text-sm">
        {revenue.lines.map((l) => (
          <li key={l.line}>
            <Link href={`/admin/finance?line=${l.line}`} className={`${ROW_LINK} py-1.5`}>
              <span className="min-w-0 flex-1 text-gray-600 group-hover:text-primary">{l.label}</span>
              <span className={`shrink-0 font-medium tabular-nums ${l.profit !== null && l.profit < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                {l.profit === null ? won(l.net) : signedWon(l.profit)}
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-500">분야 숫자는 그 분야 수익이에요(공통 지출은 전체에서만 뺍니다).</p>
      {missing.length > 0 && (
        <Notice tone="warning" light className="mt-3 text-xs">
          {missing.join(' · ')} 표를 읽지 못해 그 금액이 빠져 있습니다.
        </Notice>
      )}
    </section>
  );
};

const SessionRow = ({ session, showDate }: { session: UpcomingSession; showDate: boolean }) => (
  <li>
    <Link href={`/admin/bookings/${session.orderId}`} className={`${ROW_LINK} text-sm`}>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium tabular-nums text-primary group-hover:underline">
            {showDate ? formatKstDateTime(session.startAt) : kstTime(session.startAt)}–{kstTime(session.endAt)}
          </span>
          {session.kind === 'link' && <Badge tone="warning">결제 링크</Badge>}
        </span>
        <span className="mt-0.5 block text-gray-700">
          {session.customerName} · {session.productName}
          <span className="ml-2 text-xs tabular-nums text-gray-500">{session.orderNo}</span>
        </span>
      </span>
      <Chevron />
    </Link>
  </li>
);

const ScheduleCard = ({ dashboard, inProgress }: { dashboard: AdminDashboard; inProgress: QueueItem[] }) => {
  const today = kstDateString(new Date(dashboard.checkedAt));
  const todaySessions = dashboard.upcomingSessions.filter((s) => kstDateString(new Date(s.startAt)) === today);
  const laterSessions = dashboard.upcomingSessions.filter((s) => kstDateString(new Date(s.startAt)) !== today);
  const todayLessons = dashboard.queues.lessons?.today ?? 0;
  return (
    <section id="schedule" className={`${CARD} scroll-mt-20`}>
      <h2 className={`${CARD_TITLE} mb-3`}>일정</h2>
      <h3 className="text-sm font-semibold text-gray-700">오늘</h3>
      {todaySessions.length === 0 && todayLessons === 0 ? (
        <p className="mt-1 text-sm text-gray-500">오늘 예정된 세션이 없어요.</p>
      ) : (
        <ul className="mt-1 divide-y divide-gray-100">
          {todaySessions.map((session) => (
            <SessionRow key={session.orderId} session={session} showDate={false} />
          ))}
          {todayLessons > 0 && (
            <li>
              <Link href="/admin/lessons" className={`${ROW_LINK} text-sm`}>
                <span className="min-w-0 flex-1 text-gray-800 group-hover:text-primary">오늘 레슨 {todayLessons}회</span>
                <Chevron />
              </Link>
            </li>
          )}
        </ul>
      )}
      <h3 className="mt-4 text-sm font-semibold text-gray-700">이번 주 ({dashboard.upcomingWindowDays}일 안)</h3>
      {laterSessions.length === 0 ? (
        <p className="mt-1 text-sm text-gray-500">예정된 세션이 없어요.</p>
      ) : (
        <ul className="mt-1 divide-y divide-gray-100">
          {laterSessions.map((session) => (
            <SessionRow key={session.orderId} session={session} showDate />
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-gray-500">확정 예약과 결제된 결제 링크의 이용 일정입니다.</p>
      {inProgress.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-gray-700">진행 중</h3>
          <ul className="mt-1">
            {inProgress.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className={`${ROW_LINK} py-1.5 text-sm`}>
                  <span className="min-w-0 flex-1 text-gray-700 group-hover:text-primary">{item.label}</span>
                  <span className="shrink-0 tabular-nums text-gray-900">{item.count}</span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

const CalendarOnlyCard = ({ dashboard }: { dashboard: AdminDashboard }) => (
  <section className={CARD}>
    <h2 className={`${CARD_TITLE} mb-1`}>캘린더에만 있는 일정</h2>
    <p className="mb-3 text-xs text-gray-500">
      녹음실 캘린더에 직접 넣었는데 자동으로 못 가져온 일정이에요(웹 예약 시간은 이미 막혀 있어요). “사이트에 등록”을 누르면 시간을 채운 수기 예약 칸이 열려요.
    </p>
    {dashboard.calendarError && (
      <Notice tone="warning" light className="mb-2 text-sm">
        {dashboard.calendarError}
      </Notice>
    )}
    <ul className="divide-y divide-gray-100">
      {dashboard.calendarEvents.map((event) => (
        <li key={event.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium tabular-nums text-gray-900">{event.allDay ? `${formatKstDateTime(event.startAt).slice(0, 14)} 종일` : formatKstDateTime(event.startAt)}</span>
              <Badge tone="info">캘린더</Badge>
            </span>
            <span className="mt-0.5 block break-words text-gray-700">{event.summary}</span>
          </span>
          {event.adoptable ? (
            <Button asChild light variant="weak" size="sm" className="shrink-0">
              <Link href={`/admin/bookings?${new URLSearchParams({ fromEvent: event.id, start: event.startAt, end: event.endAt, title: event.summary }).toString()}`}>사이트에 등록</Link>
            </Button>
          ) : (
            <span className="shrink-0 text-right text-xs text-gray-500">
              종일 일정은
              <br />
              직접 등록해 주세요
            </span>
          )}
        </li>
      ))}
    </ul>
  </section>
);

const SystemCard = ({ dashboard }: { dashboard: AdminDashboard }) => (
  <section className="rounded-2xl border border-gray-200 bg-white/60 p-4 text-xs text-gray-600">
    <h2 className="mb-1 text-sm font-semibold text-gray-700">시스템</h2>
    <p>현황 확인 {formatKstDateTime(dashboard.checkedAt)}</p>
    {dashboard.socialTokens.length > 0 && (
      <ul className="mt-1 space-y-0.5">
        {dashboard.socialTokens.map((token) => (
          <li key={token.platform} className={token.daysLeft < SOCIAL_WARN_DAYS ? 'font-medium text-amber-800' : ''}>
            {SOCIAL_LABELS[token.platform] ?? token.platform}: 만료까지 {token.daysLeft}일
          </li>
        ))}
      </ul>
    )}
    <p className="mt-2">
      세무용 장부 CSV는{' '}
      <Link href="/admin/finance/export" className={`rounded font-medium text-primary hover:underline ${FOCUS_RING}`}>
        재무 › 장부 내보내기
      </Link>
      에 있어요.
    </p>
  </section>
);

export default function AdminIndexPage({ dashboard, shopQueues, revenue = null, error }: AdminIndexPageProps) {
  const groups = dashboard ? queueGroups(dashboard, shopQueues) : [];
  const inProgress = dashboard ? inProgressItems(dashboard, shopQueues) : [];
  const today = dashboard ? kstDateString(new Date(dashboard.checkedAt)) : '';
  const tiles: SummaryTile[] = dashboard
    ? [
        { label: '긴급', count: dashboard.issues.filter((i) => i.severity === 'high').length, href: '#todo', tone: 'error' },
        { label: '확인', count: dashboard.issues.filter((i) => i.severity === 'medium').length, href: '#todo', tone: 'warning' },
        { label: '대기 작업', count: groups.reduce((sum, g) => sum + g.items.reduce((s, item) => s + item.count, 0), 0), href: '#queues', tone: 'neutral' },
        {
          label: '오늘 일정',
          count: dashboard.upcomingSessions.filter((s) => kstDateString(new Date(s.startAt)) === today).length + (dashboard.queues.lessons?.today ?? 0),
          href: '#schedule',
          tone: 'neutral',
        },
      ]
    : [];

  return (
    <>
      <Head>
        <title>관리자 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell title="대시보드" width="wide">
        <div className="space-y-6">
          {error && (
            <Notice tone="error" light>
              {error}
            </Notice>
          )}

          {dashboard && <SummaryTiles tiles={tiles} />}

          <div className={`grid items-start gap-6 ${dashboard ? 'lg:grid-cols-3' : ''}`}>
            {dashboard && (
              <div className="space-y-6 lg:col-span-2">
                <IssuesCard issues={dashboard.issues} />
                <QueueCard groups={groups} />
              </div>
            )}
            <div className="space-y-6">
              {revenue && <ProfitCard revenue={revenue} />}
              {dashboard && <ScheduleCard dashboard={dashboard} inProgress={inProgress} />}
              {dashboard && (dashboard.calendarEvents.length > 0 || dashboard.calendarError) && <CalendarOnlyCard dashboard={dashboard} />}
              {dashboard && <SystemCard dashboard={dashboard} />}
            </div>
          </div>
        </div>
      </AdminShell>
    </>
  );
}
