import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../../components/admin/AdminShell';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { listAdminShows, type AdminShowListItem } from '../../../lib/shows/adminQueries';

interface AdminShowsPageProps {
  shows: AdminShowListItem[];
  error?: string;
}

export const getServerSideProps: GetServerSideProps<AdminShowsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  try {
    return { props: { shows: await listAdminShows() } };
  } catch (error: unknown) {
    console.error('[admin/shows] 목록 조회 실패:', error);
    return { props: { shows: [], error: '공연 목록을 불러오지 못했습니다. 마이그레이션 0045가 적용됐는지 확인해 주세요.' } };
  }
};

const STATUS_LABEL: Record<string, string> = { draft: '초안(비공개)', published: '공개', cancelled: '취소' };
const SHOWTIME_STATUS_LABEL: Record<string, string> = { scheduled: '예정', cancelled: '취소됨', ended: '종료' };

export default function AdminShowsPage({ shows, error }: AdminShowsPageProps) {
  return (
    <>
      <Head>
        <title>공연 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title="공연 관리" description="직영 공연의 회차별 판매 현황입니다. 공연 정의 변경은 scripts/seed-show.ts로 합니다." width="wide">
        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">{error}</div>
        )}
        {shows.length === 0 && !error && (
          <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8 text-center text-gray-600">등록된 공연이 없습니다.</div>
        )}
        <div className="space-y-6">
          {shows.map((show) => (
            <section key={show.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 md:p-6 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">{show.title}</h2>
                  <p className="text-xs text-gray-500 mt-1">/{show.slug}</p>
                  {show.showtimes.reduce((n, t) => n + t.awaitingDeposit, 0) > 0 && (
                    <span className="mt-2 inline-block rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900">
                      입금 대기 {show.showtimes.reduce((n, t) => n + t.awaitingDeposit, 0)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${show.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABEL[show.status] ?? show.status}
                  </span>
                  <Link href={`/admin/shows/${show.id}`} className="text-sm font-medium text-primary hover:underline">상세·운영 →</Link>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="admin-table w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">회차</th>
                      <th className="text-left px-4 py-2 font-medium">상태</th>
                      <th className="text-right px-4 py-2 font-medium">발권</th>
                      <th className="text-right px-4 py-2 font-medium">결제대기</th>
                      <th className="text-right px-4 py-2 font-medium">초대</th>
                      <th className="text-right px-4 py-2 font-medium">정원</th>
                      <th className="text-right px-4 py-2 font-medium">입장</th>
                      <th className="text-right px-4 py-2 font-medium">매출</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-900">
                    {show.showtimes.map((t) => (
                      <tr key={t.id}>
                        <td data-label="회차" className="px-4 py-2 whitespace-nowrap">{t.label}</td>
                        <td data-label="상태" className="px-4 py-2">{SHOWTIME_STATUS_LABEL[t.status] ?? t.status}</td>
                        <td data-label="발권" className="px-4 py-2 text-right">{t.issued}</td>
                        <td data-label="결제대기" className="px-4 py-2 text-right">{t.held}</td>
                        <td data-label="초대" className="px-4 py-2 text-right">{t.comp}</td>
                        <td data-label="정원" className="px-4 py-2 text-right">{t.capacity}</td>
                        <td data-label="입장" className="px-4 py-2 text-right">{t.checkedIn}</td>
                        <td data-label="매출" className="px-4 py-2 text-right">{t.grossAmount.toLocaleString('ko-KR')}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </AdminShell>
    </>
  );
}
