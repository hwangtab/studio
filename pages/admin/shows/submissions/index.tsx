import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../../../components/admin/AdminShell';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { formatKstDateTimeFull } from '../../../../lib/booking/format';
import { listSubmissionsForAdmin, type AdminSubmissionSummary } from '../../../../lib/shows/organizer/adminSubmissions';

interface AdminShowSubmissionsPageProps {
  submissions: AdminSubmissionSummary[];
  error?: string;
}

// 심사 대기가 먼저, 그다음 보완요청·승인·반려. 같은 상태 안에서는 제출 시각 내림차순(조회가 이미 정렬).
const STATUS_PRIORITY: Record<string, number> = { submitted: 0, changes_requested: 1, approved: 2, rejected: 3 };
const STATUS_LABELS: Record<string, string> = {
  draft: '작성중',
  submitted: '심사대기',
  changes_requested: '보완요청',
  approved: '승인',
  rejected: '반려',
};
const STATUS_BADGE_CLASS: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  changes_requested: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export const getServerSideProps: GetServerSideProps<AdminShowSubmissionsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  try {
    const list = await listSubmissionsForAdmin();
    const submissions = [...list].sort((a, b) => (STATUS_PRIORITY[a.reviewStatus] ?? 9) - (STATUS_PRIORITY[b.reviewStatus] ?? 9));
    return { props: { submissions } };
  } catch (error: unknown) {
    console.error('[admin/shows/submissions] 목록 조회 실패:', error);
    return { props: { submissions: [], error: '제출물 목록을 불러오지 못했습니다. 마이그레이션 0055가 적용됐는지 확인해 주세요.' } };
  }
};

export default function AdminShowSubmissionsPage({ submissions, error }: AdminShowSubmissionsPageProps) {
  return (
    <>
      <Head>
        <title>공연 심사 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="공연 심사"
        description="주최자가 제출한 공연을 검토하고 승인·보완 요청·반려합니다."
        backHref="/admin/shows"
        backLabel="공연 관리"
        width="wide"
      >
        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">{error}</div>
        )}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">제목</th>
                  <th className="px-4 py-3">주최자</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">제출 시각</th>
                  <th className="px-4 py-3 rounded-r-lg">첫 회차</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td data-label="제목" className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/admin/shows/submissions/${s.id}`} className="text-primary font-medium hover:underline">
                        {s.title || '(제목 없음)'}
                      </Link>
                    </td>
                    <td data-label="주최자" className="px-4 py-3">{s.creatorEmail}</td>
                    <td data-label="상태" className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE_CLASS[s.reviewStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[s.reviewStatus] ?? s.reviewStatus}
                      </span>
                    </td>
                    <td data-label="제출 시각" className="px-4 py-3 whitespace-nowrap">
                      {s.submittedAt ? formatKstDateTimeFull(s.submittedAt) : '미제출'}
                    </td>
                    <td data-label="첫 회차" className="px-4 py-3 whitespace-nowrap">
                      {s.firstShowtime ? s.firstShowtime.replace('T', ' ') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {submissions.length === 0 && !error && (
            <div className="text-center py-12 text-gray-500">제출된 공연이 없습니다.</div>
          )}
        </div>
      </AdminShell>
    </>
  );
}
