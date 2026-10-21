import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../components/admin/AdminShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Disclosure } from '../../components/ui/Disclosure';
import { FOCUS_RING } from '../../components/ui/focusRing';
import { Field, TextInput } from '../../components/ui/Field';
import { lightOnlyField } from '../../components/ui/adminFieldClass';
import { formatKstDateTime } from '../../lib/booking/format';
import { kstDateString } from '../../lib/booking/kst';
import { authenticateAdminRequest } from '../../lib/contracts/admin-auth';
/**
 * 값이 아니라 타입만 가져온다. loadAdminDashboard는 getServerSideProps 안에서만 쓰여 서버 번들에
 * 남지만, 컴포넌트 본문에서 이 모듈의 상수를 하나라도 쓰면 모듈 전체가 클라이언트 번들로
 * 끌려가고, 그 끝에 건강 점검의 googleapis(net·worker_threads)가 있어 페이지가 500이 된다.
 */
import type { AdminDashboard } from '../../lib/ops/adminDashboard';
import { loadAdminDashboard } from '../../lib/ops/adminDashboard';
import type { RevenueSnapshot } from '../../lib/ops/revenueSnapshot';
import { loadRevenueSnapshot } from '../../lib/ops/revenueSnapshot';
import { countPendingShopProducts } from '../../lib/shop/adminProducts';
import { countShopAwaitingShipment, type ShopAwaitingShipmentCounts } from '../../lib/shop/adminQueries';

/**
 * 관리자 첫 화면 = 오늘 처리할 일.
 *
 * 링크 네 개만 있던 시절엔 조용한 실패(메일 미발송·캘린더 누락·환불 대기)가 각 목록을 열어야
 * 배너로 보였고, 크론 메일이 유일한 알림이었다. 여기서는 그 크론과 같은 판정식으로 항목을
 * 맨 위에 놓는다 — 판정이 두 벌이면 메일과 화면이 다른 건수를 말하게 된다.
 */
interface AdminIndexPageProps {
  dashboard: AdminDashboard | null;
  /** 상점 대기 건수 — 표가 없거나 조회가 실패하면 null(그 카드는 숨긴다). */
  shopQueues: { pendingProducts: number | null; awaitingShipment: ShopAwaitingShipmentCounts | null };
  /** 이번 달 매출 요약 — 조회가 실패하면 null(그 카드는 숨긴다. 매출 때문에 첫 화면이 죽으면 안 된다). */
  revenue?: RevenueSnapshot | null;
  /** 이번 달 1일·오늘(KST) — 장부 폼의 기본 기간. */
  ledgerFrom: string;
  ledgerTo: string;
  error?: string;
}

export const getServerSideProps: GetServerSideProps<AdminIndexPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const now = new Date();
  const today = kstDateString(now);
  const ledgerFrom = `${today.slice(0, 7)}-01`;

  // 상점 건수는 따로 읽는다 — 상점 표가 없는 DB에서도 대시보드가 그대로 열려야 한다(각 함수가 실패를 삼키고 null).
  const [pendingProducts, awaitingShipment] = await Promise.all([countPendingShopProducts(), countShopAwaitingShipment(now)]);
  const shopQueues = { pendingProducts, awaitingShipment };
  // 매출도 따로 읽는다 — 결제 표 조회가 느리거나 실패해도 처리할 일 목록은 그대로 떠야 한다.
  const revenue = await loadRevenueSnapshot(now).catch((error: unknown) => {
    console.error('[admin] 매출 요약 조회 실패:', error);
    return null;
  });

  try {
    const dashboard = await loadAdminDashboard(now);
    return { props: { dashboard, shopQueues, revenue, ledgerFrom, ledgerTo: today } };
  } catch (error: unknown) {
    // 첫 화면이 죽으면 나머지 관리 화면으로 가는 길까지 막힌다 — 링크는 살려 두고 오류만 알린다.
    console.error('[admin] Failed to load dashboard:', error);
    return {
      props: { dashboard: null, shopQueues, revenue, ledgerFrom, ledgerTo: today, error: '현황을 불러오지 못했습니다. 각 관리 화면은 열 수 있습니다.' },
    };
  }
};

const SEVERITY_TONE: Record<'high' | 'medium', 'error' | 'warning'> = {
  high: 'error',
  medium: 'warning',
};

/** 누를 수 있는 줄·카드의 오른쪽 표시 — 링크인지 알아보게(운영자 지적 2026-10-21: "클릭되는 줄 모르겠다"). */
const Chevron = () => (
  <span aria-hidden="true" className="shrink-0 text-lg leading-none text-gray-400 group-hover:text-primary">
    ›
  </span>
);

/** 줄 전체가 링크인 목록 행. */
const ROW_LINK = `group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 ${FOCUS_RING}`;

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

interface QueueItem {
  label: string;
  count: number;
  href: string;
  alert?: boolean;
}

const QueueCard = ({ label, count, href, alert }: QueueItem) => (
  <Link
    href={href}
    className={`group flex items-start justify-between gap-2 rounded-xl border p-4 transition-colors hover:bg-gray-50 ${FOCUS_RING} ${
      count === 0 ? 'border-gray-100 bg-gray-50/60' : alert ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
    }`}
  >
    <span className="min-w-0">
      <span className={`block text-sm ${count === 0 ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
      <span className={`mt-1 block text-2xl font-bold tabular-nums ${count === 0 ? 'text-gray-400' : 'text-gray-900'}`}>{count}</span>
    </span>
    <Chevron />
  </Link>
);

/** 할 일이 있는 카드를 앞에, 0건 카드는 접어 둔다. */
const QueueGrid = ({ items }: { items: QueueItem[] }) => {
  const active = items.filter((item) => item.count > 0);
  const idle = items.filter((item) => item.count === 0);
  return (
    <>
      {active.length === 0 ? (
        <p className="text-sm text-gray-600">기다리는 일이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {active.map((item) => (
            <QueueCard key={item.label} {...item} />
          ))}
        </div>
      )}
      {idle.length > 0 && (
        <Disclosure summary={`할 일 없는 항목 ${idle.length}개`} variant="plain" className="mt-4" bodyClassName="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          {idle.map((item) => (
            <QueueCard key={item.label} {...item} />
          ))}
        </Disclosure>
      )}
    </>
  );
};

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

const RevenueSummaryCard = ({ revenue }: { revenue: RevenueSnapshot }) => {
  const rate = revenue.changeRate;
  return (
    <section className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">{revenue.month}월 매출</h2>
        <Link href="/admin/revenue" className={`rounded text-sm font-medium text-primary hover:underline ${FOCUS_RING}`}>
          매출 현황 →
        </Link>
      </div>
      <Link href="/admin/revenue" className={`group -mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-1 hover:bg-gray-50 ${FOCUS_RING}`}>
        <span className="min-w-0">
          <span className="block text-3xl font-bold tabular-nums text-gray-900">{won(revenue.net)}</span>
          <span className="mt-1 block text-xs text-gray-500">
            환불을 뺀 순매출(부가세 포함) · {revenue.count}건
            {revenue.refunded > 0 ? ` · 환불 -${won(revenue.refunded)}` : ''}
          </span>
        </span>
        <Chevron />
      </Link>
      <p className={`mt-1 text-sm font-medium ${rate === null ? 'text-gray-500' : rate >= 0 ? 'text-green-700' : 'text-red-700'}`}>
        {rate === null ? '전월 매출이 없어 비교하지 않습니다' : `${rate >= 0 ? '▲' : '▼'} ${Math.abs(rate).toFixed(1)}% 전월(${won(revenue.previousNet)}) 전체 대비`}
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        {revenue.lines.map((l) => (
          <li key={l.line}>
            <Link
              href={`/admin/revenue?line=${l.line}`}
              className={`group flex h-full items-start justify-between gap-2 rounded-xl border border-gray-200 p-3 transition-colors hover:bg-gray-50 ${FOCUS_RING}`}
            >
              <span className="min-w-0">
                <span className="block text-gray-500">{l.label}</span>
                <span className="mt-0.5 block font-semibold tabular-nums text-gray-900">{won(l.net)}</span>
                <span className={`mt-0.5 block text-xs tabular-nums ${l.profit !== null && l.profit < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                  수익 {l.profit === null ? '-' : won(l.profit)}
                </span>
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 rounded-xl bg-gray-50 p-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-600">공통 지출 (분야에 나누지 않음)</dt>
          <dd className="tabular-nums text-gray-900">{revenue.commonExpense === null ? '-' : revenue.commonExpense > 0 ? `-${won(revenue.commonExpense)}` : '0원'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-semibold text-gray-900">전체 수익 (매출 − 지출)</dt>
          <dd className={`font-bold tabular-nums ${revenue.totalProfit !== null && revenue.totalProfit < 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {revenue.totalProfit === null ? '지출 표 미적용' : won(revenue.totalProfit)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-gray-500">
        분야별 수익은 그 분야로 적은 지출만 뺀 값이고, 공통 지출은 전체 수익에서만 뺍니다. 플랫폼은 정산 몫을 뺀 수수료만 매출이고, 대출 원금 상환은 수익에서 빼지 않아요 ·{' '}
        <Link href="/admin/expenses" className={`rounded font-medium text-primary hover:underline ${FOCUS_RING}`}>지출 관리 →</Link>
      </p>
      {revenue.tenancyMissing && (
        <p className="mt-3 text-xs text-amber-800">월 입주 수입을 읽지 못해 그 금액이 빠져 있습니다(마이그레이션 0066 확인).</p>
      )}
      {revenue.manualMissing && (
        <p className="mt-3 text-xs text-amber-800">직접 받은 매출 표를 읽지 못해 그 금액이 빠져 있습니다(마이그레이션 0063 확인).</p>
      )}
    </section>
  );
};

/** "대기 중" 카드 목록 — 순서는 예전 그대로이고, 화면에서 할 일이 있는 카드가 앞으로 온다(QueueGrid). */
const queueItems = (dashboard: AdminDashboard, shopQueues: AdminIndexPageProps['shopQueues']): QueueItem[] => {
  const q = dashboard.queues;
  const items: QueueItem[] = [
    { label: '믹싱 착수 대기', count: q.mixingReceived, href: '/admin/bookings?work=received', alert: true },
    { label: '믹싱 작업 중', count: q.mixingInProgress, href: '/admin/bookings?work=in_progress' },
    { label: '서명 대기 계약', count: q.contractsAwaitingSignature, href: '/admin/contracts?status=sent' },
    { label: '종료 처리 필요 계약', count: q.contractsAwaitingTermination, href: '/admin/contracts?status=termination', alert: true },
    { label: '카드 등록 대기 구독', count: q.subscriptionsPendingCard, href: '/admin/subscriptions' },
    { label: '결제 재시도 중 구독', count: q.subscriptionsPastDue, href: '/admin/subscriptions', alert: true },
    { label: '정지된 구독', count: q.subscriptionsPaused, href: '/admin/subscriptions', alert: true },
    { label: '이체 대기 아티스트 정산', count: q.artistPayoutsPending, href: '/admin/artists', alert: true },
    { label: '심사 대기 펀딩 프로젝트', count: q.fundingProjectsAwaitingReview, href: '/admin/funding/projects', alert: true },
    { label: '정산 기록 대기 펀딩 (마감됨)', count: q.fundingPayoutsToRecord, href: '/admin/funding/projects?payout=record', alert: true },
    { label: '이체 대기 펀딩 정산', count: q.fundingPayoutsPending, href: '/admin/funding/projects?payout=pending', alert: true },
    { label: '입금 대기 예약·믹싱', count: q.awaitingDeposit.bookings, href: '/admin/bookings?deposit=pending', alert: true },
    { label: '입금 대기 펀딩', count: q.awaitingDeposit.funding, href: '/admin/funding?deposit=pending', alert: true },
    { label: '환불 요청 펀딩 후원', count: q.fundingRefundRequests, href: '/admin/funding', alert: true },
    { label: '입금 대기 공연 티켓', count: q.awaitingDeposit.shows, href: '/admin/shows', alert: true },
    { label: '입금 대기 상점 주문', count: q.awaitingDeposit.shop, href: '/admin/shop', alert: true },
    { label: '정산 기록 대기 상점 (지난 달)', count: q.shopPayoutsToRecord, href: '/admin/shop', alert: true },
    { label: '이체 대기 상점 정산', count: q.shopPayoutsPending, href: '/admin/shop', alert: true },
    { label: '정산 기록 대기 공연 (종료됨)', count: q.showPayoutsToRecord, href: '/admin/shows', alert: true },
    { label: '이체 대기 공연 정산', count: q.showPayoutsPending, href: '/admin/shows', alert: true },
  ];
  if (shopQueues.pendingProducts !== null) items.push({ label: '심사 대기 상점 상품', count: shopQueues.pendingProducts, href: '/admin/shop/products', alert: true });
  if (shopQueues.awaitingShipment !== null) {
    // 스튜디오가 지금 보낼 주문만 — 아티스트가 보낼 주문·예약 발송일이 안 된 주문은 따로 센다(할 일이 아니다).
    items.push({ label: '발송 대기 상점 주문', count: shopQueues.awaitingShipment.studio, href: '/admin/shop', alert: true });
    if (shopQueues.awaitingShipment.preorder > 0) items.push({ label: '예약 발송일 전 상점 주문', count: shopQueues.awaitingShipment.preorder, href: '/admin/shop' });
    if (shopQueues.awaitingShipment.artist > 0) items.push({ label: '아티스트 발송 대기 상점 주문', count: shopQueues.awaitingShipment.artist, href: '/admin/shop' });
  }
  items.push({ label: '완료·노쇼 표시 대기 세션', count: q.sessionsAwaitingMark, href: '/admin/bookings?session=unmarked', alert: true });
  if (q.showSubmissionsAwaitingReview !== null) items.push({ label: '심사 대기 주최자 공연', count: q.showSubmissionsAwaitingReview, href: '/admin/shows/submissions', alert: true });
  if (q.lessons !== null) {
    items.push({ label: '오늘 레슨', count: q.lessons.today, href: '/admin/lessons' });
    items.push({ label: '완료·결석 표시 대기 레슨', count: q.lessons.unmarked, href: '/admin/lessons', alert: true });
  }
  if (q.sessionMusiciansNew !== null) items.push({ label: '새 세션 연주자 등록', count: q.sessionMusiciansNew, href: '/admin/session-musicians?status=new', alert: true });
  return items;
};

export default function AdminIndexPage({ dashboard, shopQueues, revenue = null, ledgerFrom, ledgerTo, error }: AdminIndexPageProps) {
  return (
    <>
      <Head>
        <title>관리자 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell title="대시보드">
        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">{error}</div>}

        {revenue && <RevenueSummaryCard revenue={revenue} />}

        {dashboard && (
          <>
            <section className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-1">처리할 일</h2>
              <p className="text-xs text-gray-500 mb-4">
                매일 23시 운영 점검 메일과 같은 기준입니다. 처리하면 다음 새로고침에서 사라집니다.
              </p>
              {dashboard.issues.length === 0 ? (
                <p className="text-sm text-gray-600">지금 처리할 일이 없습니다.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {dashboard.issues.map((issue) => {
                    const body = (
                      <>
                        <Badge tone={SEVERITY_TONE[issue.severity]} className="mt-0.5 shrink-0">
                          {SEVERITY_LABEL[issue.severity]}
                        </Badge>
                        <span className="min-w-0 flex-1">
                          <span className={`block font-medium ${issue.href ? 'text-primary group-hover:underline' : 'text-gray-900'}`}>{issue.title}</span>
                          <span className="mt-1 block text-sm text-gray-600 whitespace-pre-line break-words">{issue.detail}</span>
                        </span>
                      </>
                    );
                    return (
                      <li key={issue.title} className="py-1">
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

            <section className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">대기 중</h2>
              <QueueGrid items={queueItems(dashboard, shopQueues)} />
            </section>

            <section className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-1">이번 주 세션</h2>
              <p className="text-xs text-gray-500 mb-4">오늘부터 {dashboard.upcomingWindowDays}일 안의 확정 예약과, 결제된 결제 링크의 이용 일정입니다.</p>
              {dashboard.upcomingSessions.length === 0 ? (
                <p className="text-sm text-gray-600">예정된 세션이 없습니다.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {dashboard.upcomingSessions.map((session) => (
                    <li key={session.orderId}>
                      <Link href={`/admin/bookings/${session.orderId}`} className={`${ROW_LINK} text-sm`}>
                        <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <span className="font-medium text-gray-900 tabular-nums">{formatKstDateTime(session.startAt)}</span>
                          <span className="text-gray-700">
                            {session.customerName} · {session.productName}
                            {session.kind === 'link' && (
                              <Badge tone="warning" className="ml-2">
                                결제 링크
                              </Badge>
                            )}
                          </span>
                          <span className="text-primary group-hover:underline">{session.orderNo}</span>
                        </span>
                        <Chevron />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(dashboard.calendarEvents.length > 0 || dashboard.calendarError) && (
              <section className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-1">캘린더에만 있는 일정</h2>
                <p className="text-xs text-gray-500 mb-4">
                  녹음실 캘린더에 직접 넣은 일정이라 사이트에는 아직 없어요(웹 예약 시간은 이미 막혀 있어요). “사이트에 등록”을 누르면 시간을 채운 수기 예약 등록 칸이 열려요 — 고객·상품·금액은 거기서 채우세요.
                </p>
                {dashboard.calendarError && <p className="text-sm text-amber-800">{dashboard.calendarError}</p>}
                <ul className="divide-y divide-gray-100">
                  {dashboard.calendarEvents.map((event) => (
                    <li key={event.id} className="py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                      <span className="font-medium text-gray-900 tabular-nums">{event.allDay ? `${formatKstDateTime(event.startAt).slice(0, 14)} 종일` : formatKstDateTime(event.startAt)}</span>
                      <span className="text-gray-700">
                        {event.summary}
                        <Badge tone="info" className="ml-2">
                          캘린더
                        </Badge>
                      </span>
                      {event.adoptable ? (
                        <Button asChild light variant="weak" size="sm">
                          <Link href={`/admin/bookings?${new URLSearchParams({ fromEvent: event.id, start: event.startAt, end: event.endAt, title: event.summary }).toString()}`}>
                            사이트에 등록
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-500">종일 일정은 직접 등록해 주세요</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {dashboard.socialTokens.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-1">소셜 발행 토큰</h2>
                <p className="text-xs text-gray-500 mb-3">매주 월요일 크론이 갱신합니다. 만료가 가까우면 갱신 실패 메일을 확인해 주세요.</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {dashboard.socialTokens.map((token) => (
                    <li key={token.platform} className={token.daysLeft < SOCIAL_WARN_DAYS ? 'text-amber-800 font-medium' : ''}>
                      {SOCIAL_LABELS[token.platform] ?? token.platform}: 만료까지 {token.daysLeft}일
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* 장부는 현황 데이터를 쓰지 않는다 — 건강 점검이 죽어도 정산 CSV는 받을 수 있어야 한다. */}
          <section className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-1">토스 결제 장부</h2>
            <p className="text-xs text-gray-500 mb-4">
              기간 안에 승인된 카드 결제 전부를 한 CSV로 내려받습니다(예약·믹싱·펀딩·구독). 환불은 같은
              행에 합산됩니다. 무통장 펀딩과 수기 등록은 펀딩 CSV에 있습니다.
            </p>
            <form method="GET" action="/api/admin/orders/export" className="flex flex-wrap items-end gap-3">
              <Field id="ledger-from" label="시작일" className={lightOnlyField}>
                <TextInput type="date" name="from" defaultValue={ledgerFrom} required light className="text-sm" />
              </Field>
              <Field id="ledger-to" label="종료일" className={lightOnlyField}>
                <TextInput type="date" name="to" defaultValue={ledgerTo} required light className="text-sm" />
              </Field>
              <Button light type="submit" variant="weak">
                CSV 내려받기
              </Button>
            </form>
          </section>
      </AdminShell>
    </>
  );
}
