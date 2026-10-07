/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 기획자 현황 토큰이 실린다)의 이탈 링크는 문서 이동이어야 한다.
 * 근거: lib/analytics/privatePaths.ts, tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';

import { Button } from '../../../../components/ui/Button';
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

const SHOWTIME_STATUS: Record<string, string> = { cancelled: '취소된 회차', ended: '종료' };

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <dt className="text-xs text-gray-600">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-900">{value}</dd>
      {note && <dd className="text-xs text-gray-600">{note}</dd>}
    </div>
  );
}

function ShowtimeCard({ t, nowSec }: { t: ShowReportShowtime; nowSec: number }) {
  const taken = t.sold + t.comp;
  const pct = t.capacity > 0 ? Math.min(100, Math.round((taken / t.capacity) * 100)) : 0;
  const cancelled = t.status === 'cancelled';
  const salesOpen = !cancelled && t.status === 'scheduled' && t.salesCloseAt > nowSec;
  return (
    <section className="bg-white rounded-2xl shadow-sm p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">{t.label}</h2>
        <span className="text-sm text-gray-600">
          {SHOWTIME_STATUS[t.status] ?? (salesOpen ? `판매 중 · ${kstDateTime(t.salesCloseAt)} 마감` : '판매 마감')}
        </span>
      </header>

      {cancelled ? (
        <p className="text-sm text-gray-700">이 회차는 취소되어 판매 금액을 합계에서 뺐습니다.</p>
      ) : (
        <div>
          <div className="flex items-baseline justify-between text-sm text-gray-700">
            <span>좌석 {taken} / {t.capacity}</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-gray-200" aria-hidden>
            <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat label="판매" value={`${t.sold}매`} />
        <Stat label="초대" value={`${t.comp}매`} />
        <Stat label="판매 금액" value={won(t.amount)} />
        <Stat label="결제·입금 대기" value={`${t.held}매`} note={t.awaitingDeposit > 0 ? `계좌 입금 대기 ${t.awaitingDeposit}건` : undefined} />
        <Stat label="환불" value={`${t.refunded}매`} />
        <Stat label="입장" value={`${t.checkedIn}명`} />
      </dl>

      {t.ticketTypes.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-900">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-600">
                <th scope="col" className="py-2 pr-3 font-medium">티켓</th>
                <th scope="col" className="py-2 pr-3 font-medium text-right">판매</th>
                <th scope="col" className="py-2 pr-3 font-medium text-right">초대</th>
                <th scope="col" className="py-2 font-medium text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {t.ticketTypes.map((tt) => (
                <tr key={tt.name} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3">{tt.name} <span className="text-gray-500">{won(tt.price)}</span></td>
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
        <title>{`${report.title} 예매 현황 | Studio NOL`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="min-h-screen bg-gray-100 text-gray-900 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <header className="space-y-1">
            <p className="text-sm text-gray-600">스튜디오 놀</p>
            <h1 className="typo-page-title dark:text-gray-900">{report.title} 예매 현황</h1>
            <p className="text-sm text-gray-600">{report.venueName} · {linkLabel} 님께 공유된 화면</p>
            <p className="text-sm text-gray-600">{kstDateTime(generatedAt)} 기준 · 이 링크는 {kstDateTime(expiresAt)}까지 열립니다</p>
          </header>

          {live.length > 1 && (
            <section className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-700 mb-2">전체 회차 합계</h2>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="판매" value={`${report.totals.sold}매`} />
                <Stat label="초대" value={`${report.totals.comp}매`} />
                <Stat label="좌석" value={`${report.totals.sold + report.totals.comp} / ${report.totals.capacity}`} />
                <Stat label="판매 금액" value={won(report.totals.amount)} />
              </dl>
            </section>
          )}

          {report.showtimes.map((t) => <ShowtimeCard key={t.id} t={t} nowSec={generatedAt} />)}

          <div className="flex flex-wrap items-center gap-3">
            <Button light variant="outline" size="sm" onClick={() => window.location.reload()}>새로 고침</Button>
            <a href={`/ko/shows/${report.slug}`} rel="noreferrer" className="text-sm text-gray-700 underline">공연 페이지 보기</a>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            판매 금액은 결제가 확정되고 환불되지 않은 티켓의 가격 합계입니다. 결제 수수료·환불 수수료를 반영하지 않은 현황 참고용이며 정산 금액이 아닙니다.
            결제·입금 대기는 결제창을 열어 둔 좌석과 계좌 입금을 기다리는 좌석으로, 결제가 끝나면 판매로 옮겨 갑니다.
          </p>
        </div>
      </main>
    </>
  );
}
