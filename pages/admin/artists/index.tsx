import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { AdminShell } from '../../../components/admin/AdminShell';
import { markPayoutPaid, recordPayout } from '../../../components/admin/artistActions';
import { Button } from '../../../components/ui/Button';
import { Field, TextInput } from '../../../components/ui/Field';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { SUPPORTED_ARTISTS } from '../../../data/artists';
import { ARTIST_SUPPORT_SHARE_PERCENT, formatPriceAmount } from '../../../data/pricing';
import { isArtistSupportOpen } from '../../../lib/artistSupport/open';
import { buildAllArtistPayoutPreviews, listArtistPayouts, PERIOD_PATTERN } from '../../../lib/artistSupport/payout';
import { countSupportersByArtist } from '../../../lib/artistSupport/supporters';
import { cycleYmOf } from '../../../lib/billing/schedule';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';

/**
 * 관리자 아티스트 구역 — 후원자 수와 월 정산(스펙 §10·§12).
 *
 * 흐름: 기간을 고른다 → 아티스트별 미리보기(그 달 결제 합계 → 아티스트 실수령) → "정산 기록"으로
 * 숫자를 고정 → 운영자가 이체 → "지급 완료". 기록은 (아티스트, 달)당 한 번뿐이다.
 */
interface PreviewRow {
  artistSlug: string;
  artistName: string;
  taxType: 'withholding' | 'invoice';
  period: string;
  subscriberCount: number;
  grossAmount: number;
  refundAmount: number;
  supplyAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  netAmount: number;
  recorded: { id: string; status: 'pending' | 'paid'; netAmount: number; paidAt: string | null; memo: string | null } | null;
}

interface PayoutHistoryRow {
  id: string;
  artistSlug: string;
  artistName: string;
  period: string;
  netAmount: number;
  subscriberCount: number;
  status: 'pending' | 'paid';
  paidAt: string | null;
}

interface AdminArtistsPageProps {
  supportOpen: boolean;
  period: string;
  artists: Array<{ slug: string; name: string; supportActive: boolean; taxType: string; supporterCount: number }>;
  previews: PreviewRow[];
  history: PayoutHistoryRow[];
  error?: string;
}

/** 기본 정산 대상은 지난달 — 이번 달은 아직 청구가 다 안 돌았다. */
const previousPeriod = (now: Date): string => {
  const [y, m] = cycleYmOf(now).split('-').map(Number);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${prev.y}-${String(prev.m).padStart(2, '0')}`;
};

export const getServerSideProps: GetServerSideProps<AdminArtistsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };

  const now = new Date();
  const requested = typeof context.query.period === 'string' ? context.query.period : '';
  const period = PERIOD_PATTERN.test(requested) ? requested : previousPeriod(now);
  const nameOf = new Map(SUPPORTED_ARTISTS.map((a) => [a.slug, a.name]));

  try {
    const [counts, previews, history] = await Promise.all([
      countSupportersByArtist(),
      buildAllArtistPayoutPreviews(period),
      listArtistPayouts(),
    ]);
    return {
      props: {
        supportOpen: isArtistSupportOpen(),
        period,
        artists: SUPPORTED_ARTISTS.map((a) => ({
          slug: a.slug,
          name: a.name,
          supportActive: a.supportActive,
          taxType: a.taxType,
          supporterCount: counts.get(a.slug) ?? 0,
        })),
        previews: previews.map((p) => ({
          artistSlug: p.artistSlug,
          artistName: p.artistName,
          taxType: p.taxType,
          period: p.period,
          subscriberCount: p.subscriberCount,
          grossAmount: p.grossAmount,
          refundAmount: p.refundAmount,
          supplyAmount: p.supplyAmount,
          shareAmount: p.shareAmount,
          withholdingAmount: p.withholdingAmount,
          netAmount: p.netAmount,
          recorded: p.recorded
            ? { id: p.recorded.id, status: p.recorded.status, netAmount: p.recorded.netAmount, paidAt: p.recorded.paidAt?.toISOString() ?? null, memo: p.recorded.memo }
            : null,
        })),
        history: history.map((h) => ({
          id: h.id,
          artistSlug: h.artistSlug,
          artistName: nameOf.get(h.artistSlug) ?? h.artistSlug,
          period: h.period,
          netAmount: h.netAmount,
          subscriberCount: h.subscriberCount,
          status: h.status,
          paidAt: h.paidAt?.toISOString() ?? null,
        })),
      },
    };
  } catch (error: unknown) {
    console.error('[admin/artists] Failed to load:', error);
    return {
      props: { supportOpen: isArtistSupportOpen(), period, artists: [], previews: [], history: [], error: '아티스트 현황을 불러오지 못했습니다.' },
    };
  }
};

const TAX_LABELS: Record<string, string> = { withholding: '원천징수 3.3%', invoice: '세금계산서' };

export default function AdminArtistsPage({ supportOpen, period, artists, previews, history, error }: AdminArtistsPageProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [periodInput, setPeriodInput] = useState(period);

  const run = async (key: string, task: () => Promise<{ ok: boolean; message?: string }>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(key);
    setNotice(null);
    const result = await task();
    setBusy(null);
    if (!result.ok) setNotice(result.message ?? '요청을 처리하지 못했습니다.');
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  return (
    <>
      <Head>
        <title>아티스트 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="아티스트"
        description={`구독자 현황과 월 정산. 구독료 공급가의 ${ARTIST_SUPPORT_SHARE_PERCENT}%를 아티스트에게 지급합니다.`}
        width="wide"
      >
        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">{error}</div>}
        {notice && <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>}

        <div
          className={`mb-6 p-4 rounded-lg text-sm border ${
            supportOpen ? 'bg-green-50 border-green-200 text-green-900' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          {supportOpen ? (
            <>
              <strong>구독 신청이 열려 있습니다.</strong> 아티스트 페이지에 등급 카드가 보이고 신청을 받습니다.
            </>
          ) : (
            <>
              <strong>구독 신청이 닫혀 있습니다.</strong> 토스 빌링 심사가 끝나면 Vercel 환경 변수{' '}
              <code className="font-mono">NEXT_PUBLIC_ARTIST_SUPPORT_OPEN=1</code>을 넣고 재배포하세요. 아티스트 페이지는 그때까지
              &ldquo;준비 중&rdquo;으로 보입니다.
            </>
          )}
        </div>

        <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-1">등록 아티스트</h2>
          <p className="text-xs text-gray-500 mb-4">
            아티스트는 코드(data/artists)로 등록합니다. 후원자 수는 결제한 달이 끝나지 않은 사람 전부입니다.
          </p>
          {artists.length === 0 ? (
            <p className="text-sm text-gray-600">등록된 아티스트가 없습니다. 사진 권리와 소개 자료가 오면 data/artists/index.ts에 추가합니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">아티스트</th>
                    <th className="px-4 py-3 text-left">구독 받음</th>
                    <th className="px-4 py-3 text-left">세금 처리</th>
                    <th className="px-4 py-3 text-right">후원자</th>
                    <th className="px-4 py-3 text-right">연락처</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {artists.map((a) => (
                    <tr key={a.slug}>
                      <td className="px-4 py-3">
                        <Link href={`/ko/artists/${a.slug}`} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                          {a.name}
                        </Link>
                        <span className="ml-2 text-xs text-gray-400 font-mono">{a.slug}</span>
                      </td>
                      <td className="px-4 py-3">{a.supportActive ? '예' : '아니오'}</td>
                      <td className="px-4 py-3 text-gray-600">{TAX_LABELS[a.taxType] ?? a.taxType}</td>
                      <td className="px-4 py-3 text-right font-medium">{a.supporterCount}명</td>
                      <td className="px-4 py-3 text-right">
                        <a href={`/api/admin/artists/${a.slug}/supporters-export`} className="text-primary hover:underline text-xs">
                          CSV
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mb-6">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-1">월 정산</h2>
              <p className="text-xs text-gray-500">
                결제 합계 − 환불 − VAT = 공급가 → {ARTIST_SUPPORT_SHARE_PERCENT}% → 원천징수 차감 = 실수령. 기록하면 그 시점 숫자로 고정됩니다.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (PERIOD_PATTERN.test(periodInput)) void router.push(`/admin/artists?period=${periodInput}`);
              }}
              className="flex items-end gap-2"
            >
              <Field id="payout-period" label="정산 월" className={lightOnlyField}>
                <TextInput type="month" value={periodInput} onChange={(e) => setPeriodInput(e.target.value)} light className="text-sm" />
              </Field>
              <Button light type="submit" variant="outline" size="sm">
                조회
              </Button>
            </form>
          </div>

          {previews.length === 0 ? (
            <p className="text-sm text-gray-600">등록된 아티스트가 없어 정산할 것이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-3 text-left">아티스트</th>
                    <th className="px-3 py-3 text-right">후원자</th>
                    <th className="px-3 py-3 text-right">결제 합계</th>
                    <th className="px-3 py-3 text-right">환불</th>
                    <th className="px-3 py-3 text-right">공급가</th>
                    <th className="px-3 py-3 text-right">{ARTIST_SUPPORT_SHARE_PERCENT}%</th>
                    <th className="px-3 py-3 text-right">원천징수</th>
                    <th className="px-3 py-3 text-right">실수령</th>
                    <th className="px-3 py-3 text-left">상태</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previews.map((p) => {
                    const key = `${p.artistSlug}:${p.period}`;
                    const drift = p.recorded && p.recorded.netAmount !== p.netAmount;
                    return (
                      <tr key={key}>
                        <td className="px-3 py-3 font-medium text-gray-900">{p.artistName}</td>
                        <td className="px-3 py-3 text-right">{p.subscriberCount}</td>
                        <td className="px-3 py-3 text-right">{formatPriceAmount(p.grossAmount)}</td>
                        <td className="px-3 py-3 text-right text-gray-500">{p.refundAmount ? `−${formatPriceAmount(p.refundAmount)}` : '-'}</td>
                        <td className="px-3 py-3 text-right">{formatPriceAmount(p.supplyAmount)}</td>
                        <td className="px-3 py-3 text-right">{formatPriceAmount(p.shareAmount)}</td>
                        <td className="px-3 py-3 text-right text-gray-500">{p.withholdingAmount ? `−${formatPriceAmount(p.withholdingAmount)}` : '-'}</td>
                        <td className="px-3 py-3 text-right font-bold">{formatPriceAmount(p.netAmount)}원</td>
                        <td className="px-3 py-3">
                          {p.recorded ? (
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                p.recorded.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {p.recorded.status === 'paid' ? '지급 완료' : '이체 대기'}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">미기록</span>
                          )}
                          {drift && (
                            <span className="block mt-1 text-xs text-red-600">
                              기록 {formatPriceAmount(p.recorded!.netAmount)}원과 다름 — 뒤늦은 환불
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {!p.recorded && p.grossAmount > 0 && (
                            <Button
                              light
                              size="sm"
                              variant="outline"
                              disabled={busy === key}
                              onClick={() =>
                                run(key, () => recordPayout(p.artistSlug, p.period), `${p.artistName} ${p.period} 정산을 ${formatPriceAmount(p.netAmount)}원으로 기록할까요?`)
                              }
                            >
                              정산 기록
                            </Button>
                          )}
                          {p.recorded?.status === 'pending' && (
                            <Button
                              light
                              size="sm"
                              disabled={busy === key}
                              onClick={() =>
                                run(
                                  key,
                                  () => markPayoutPaid(p.recorded!.id, ''),
                                  `${p.artistName}에게 ${formatPriceAmount(p.recorded!.netAmount)}원을 이체했나요? 지급 완료로 기록합니다.`,
                                )
                              }
                            >
                              지급 완료
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">정산 기록</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-600">아직 기록된 정산이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">월</th>
                    <th className="px-4 py-3 text-left">아티스트</th>
                    <th className="px-4 py-3 text-right">후원자</th>
                    <th className="px-4 py-3 text-right">실수령</th>
                    <th className="px-4 py-3 text-left">상태</th>
                    <th className="px-4 py-3 text-left">지급일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-3 font-mono text-xs">{h.period}</td>
                      <td className="px-4 py-3">{h.artistName}</td>
                      <td className="px-4 py-3 text-right">{h.subscriberCount}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatPriceAmount(h.netAmount)}원</td>
                      <td className="px-4 py-3">{h.status === 'paid' ? '지급 완료' : '이체 대기'}</td>
                      <td className="px-4 py-3 text-gray-500">{h.paidAt ? h.paidAt.slice(0, 10) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AdminShell>
    </>
  );
}
