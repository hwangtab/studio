/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 기획자 현황 토큰이 실린다)의 이탈 링크는 문서 이동이어야 한다.
 * 근거: lib/analytics/privatePaths.ts, tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';

import { Badge, type BadgeTone } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { PageHeader, PageShell } from '../../../../components/ui/PageHeader';
import { Panel } from '../../../../components/ui/Panel';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { withI18nServerProps } from '../../../../lib/getStatic';
import { loadShowReport, type ShowReport, type ShowReportShowtime } from '../../../../lib/shows/report';
import { verifyReportLink } from '../../../../lib/shows/reportLink';

interface ReportPageProps {
  report: ShowReport;
  linkLabel: string;
  expiresAt: number;
  generatedAt: number;
}

/**
 * 기획자 현황 — 토큰이 인증의 전부다. 없거나 만료·폐기면 notFound(구분해 알려 주지 않는다).
 * **집계만** 내려보낸다(lib/shows/report.ts) — 예매자 개인정보·주문번호는 props에 없다.
 * 로케일은 ko만, 캐시는 막는다(scan 페이지와 같다).
 */
export const getServerSideProps = withI18nServerProps<ReportPageProps>(async (context) => {
  denyContractPageCaching(context.res);
  const { locale, token } = context.params as { locale: string; token: string };
  if (locale !== 'ko') return { notFound: true };
  const access = await verifyReportLink(token);
  if (!access.ok) return { notFound: true };
  const report = await loadShowReport(access.link.showId);
  if (!report) return { notFound: true };
  return {
    props: {
      report,
      linkLabel: access.link.label,
      expiresAt: access.link.expiresAt,
      generatedAt: Math.floor(Date.now() / 1000),
    },
  };
});

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

const kstDateTime = (sec: number) => {
  const k = new Date(sec * 1000 + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
};

/** 회차 상태 배지 — 라벨과 tone. */
const showtimeBadge = (t: ShowReportShowtime, nowSec: number): { label: string; tone: BadgeTone } => {
  if (t.status === 'cancelled') return { label: '취소된 회차', tone: 'error' };
  if (t.status === 'ended') return { label: '종료', tone: 'neutral' };
  return t.salesCloseAt > nowSec ? { label: '판매 중', tone: 'success' } : { label: '판매 마감', tone: 'neutral' };
};

/** 숫자 한 칸 — 카드 안의 한 단계 낮은 면(Panel inset). dl 안에서 dt·dd를 감싼다. */
function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Panel variant="inset">
      <dt className="typo-card-meta text-gray-600 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 typo-card-subtitle tabular-nums text-gray-900 dark:text-white">{value}</dd>
      {note && <dd className="mt-0.5 typo-caption text-gray-600 dark:text-gray-400">{note}</dd>}
    </Panel>
  );
}

function ShowtimeCard({ t, nowSec }: { t: ShowReportShowtime; nowSec: number }) {
  const taken = t.sold + t.comp;
  const pct = t.capacity > 0 ? Math.min(100, Math.round((taken / t.capacity) * 100)) : 0;
  const cancelled = t.status === 'cancelled';
  const badge = showtimeBadge(t, nowSec);
  const salesOpen = badge.label === '판매 중';
  return (
    <section className="glass-card rounded-2xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="typo-card-subtitle text-gray-900 dark:text-white">{t.label}</h2>
        <Badge size="md" tone={badge.tone} className="shrink-0">{badge.label}</Badge>
      </div>
      {salesOpen && <p className="mt-1 typo-card-meta text-gray-600 dark:text-gray-400">{kstDateTime(t.salesCloseAt)} 판매 마감</p>}

      {cancelled ? (
        <p className="mt-6 typo-body text-gray-700 dark:text-gray-300">이 회차는 취소되어 판매 금액을 합계에서 뺐어요.</p>
      ) : (
        <div className="mt-6">
          <div className="flex items-baseline justify-between typo-card-meta text-gray-700 dark:text-gray-300">
            <span>좌석 {taken} / {t.capacity}</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
            <div className="h-2 rounded-full bg-primary dark:bg-primary-lighter" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="판매" value={`${t.sold}매`} />
        <Stat label="초대" value={`${t.comp}매`} />
        <Stat label="판매 금액" value={won(t.amount)} />
        <Stat label="결제·입금 대기" value={`${t.held}매`} note={t.awaitingDeposit > 0 ? `계좌 입금 대기 ${t.awaitingDeposit}건` : undefined} />
        <Stat label="환불" value={`${t.refunded}매`} />
        <Stat label="입장" value={`${t.checkedIn}명`} />
      </dl>

      {t.ticketTypes.length > 1 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm text-gray-900 dark:text-gray-100">
            <thead>
              <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                <th scope="col" className="py-2 pr-3 typo-card-meta font-medium text-gray-600 dark:text-gray-400">티켓</th>
                <th scope="col" className="py-2 pr-3 text-right typo-card-meta font-medium text-gray-600 dark:text-gray-400">판매</th>
                <th scope="col" className="py-2 pr-3 text-right typo-card-meta font-medium text-gray-600 dark:text-gray-400">초대</th>
                <th scope="col" className="py-2 text-right typo-card-meta font-medium text-gray-600 dark:text-gray-400">금액</th>
              </tr>
            </thead>
            <tbody>
              {t.ticketTypes.map((tt) => (
                <tr key={tt.name} className="border-b border-gray-200 last:border-0 dark:border-gray-700">
                  <td className="py-2 pr-3">{tt.name} <span className="text-gray-600 dark:text-gray-400">{won(tt.price)}</span></td>
                  <td className="py-2 pr-3 text-right tabular-nums">{tt.sold}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{tt.comp}</td>
                  <td className="py-2 text-right tabular-nums">{won(tt.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ShowReportPage({ report, linkLabel, expiresAt, generatedAt }: ReportPageProps) {
  const live = report.showtimes.filter((t) => t.status !== 'cancelled');
  return (
    <>
      <Head>
        <title>{`${report.title} 예매 현황 | 스튜디오 놀`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="wide">
        {/* 사이트 헤더를 두르지 않는 화면이라 여기가 브랜드를 밝히는 유일한 자리다(privateLinkNavigation.test.ts). */}
        <p className="typo-card-meta">스튜디오 놀</p>
        <PageHeader
          title={`${report.title} 예매 현황`}
          lead={
            <>
              {report.venueName} · {linkLabel} 님께 공유된 화면이에요.
              <span className="mt-1 block typo-card-meta text-gray-600 dark:text-gray-400">
                {kstDateTime(generatedAt)} 기준 · 이 링크는 {kstDateTime(expiresAt)}까지 열려요
              </span>
            </>
          }
        />

        <div className="space-y-6">
          {live.length > 1 && (
            <section className="glass-card rounded-2xl p-6 sm:p-8">
              <h2 className="typo-card-subtitle text-gray-900 dark:text-white">전체 회차 합계</h2>
              <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="판매" value={`${report.totals.sold}매`} />
                <Stat label="초대" value={`${report.totals.comp}매`} />
                <Stat label="좌석" value={`${report.totals.sold + report.totals.comp} / ${report.totals.capacity}`} />
                <Stat label="판매 금액" value={won(report.totals.amount)} />
              </dl>
            </section>
          )}

          {report.showtimes.map((t) => <ShowtimeCard key={t.id} t={t} nowSec={generatedAt} />)}
        </div>

        <div className="mt-8">
          <Button variant="weak" size="sm" shape="block" onClick={() => window.location.reload()}>새로 고침</Button>
        </div>

        <p className="mt-6 typo-caption text-gray-600 dark:text-gray-400">
          판매 금액은 결제가 확정되고 환불되지 않은 티켓의 가격 합계예요. 결제 수수료·환불 수수료를 반영하지 않은 현황 참고용이며 정산 금액이 아니에요.
          결제·입금 대기는 결제창을 열어 둔 좌석과 계좌 입금을 기다리는 좌석으로, 결제가 끝나면 판매로 옮겨 가요.
        </p>

        {/* private 페이지(URL에 현황 토큰이 실린다)의 이탈 링크는 문서 이동 + noreferrer —
            lib/analytics/privatePaths.ts, tests/pages/privateLinkNavigation.test.ts */}
        <p className="mt-10 text-center text-sm">
          <a href={`/ko/shows/${report.slug}`} rel="noreferrer" className="underline">공연 안내 보기</a>
        </p>
      </PageShell>
    </>
  );
}

// 디자인 판 — lib/designEdition.ts
ShowReportPage.designEdition = 'v2';
