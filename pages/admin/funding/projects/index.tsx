import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../../../components/admin/AdminShell';
import { formatPriceAmount } from '../../../../data/pricing';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { formatKstDateTimeFull } from '../../../../lib/booking/format';
import { listProjectsForAdmin, type AdminProjectSummary } from '../../../../lib/funding/adminProjects';
import { loadProjectServiceMap, PROJECT_SERVICE_LABELS, type LoadServiceMapResult } from '../../../../lib/funding/projectServices';
import type { FundingReviewStatus } from '../../../../lib/funding/reviewTransition';

interface AdminFundingProjectsPageProps {
  projects: AdminProjectSummary[];
  /** 스튜디오 서비스(마이그레이션 0037). 운영 DB에 테이블이 없으면 available: false. */
  services: LoadServiceMapResult;
}

/**
 * 목록 정렬 우선순위. 운영자가 처음 열었을 때 눈에 들어와야 하는 순서다 — 심사 대기가
 * 밀리면 개설자는 승인 여부를 계속 기다리게 된다. `listProjectsForAdmin`이 이미
 * submittedAt 내림차순으로 주므로, 여기서는 상태 우선순위만 얹어 안정 정렬한다.
 */
const STATUS_PRIORITY: Record<FundingReviewStatus, number> = {
  submitted: 0,
  changes_requested: 1,
  draft: 2,
  approved: 3,
  rejected: 4,
};

// rejected는 보관(archive)도 같은 DB 값이라(reviewTransition.ts), 개설자 화면과 같은
// 라벨로 맞춘다 — 구분은 reviewNote뿐이라 운영자도 배지만 보고 반려로 단정하면 안 된다.
const STATUS_LABELS: Record<FundingReviewStatus, string> = {
  draft: '작성중',
  submitted: '심사대기',
  changes_requested: '보완요청',
  approved: '승인',
  rejected: '반려·보관',
};

const STATUS_BADGE_CLASS: Record<FundingReviewStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-amber-100 text-amber-800',
  changes_requested: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export const getServerSideProps: GetServerSideProps<AdminFundingProjectsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const projects = await listProjectsForAdmin();
  const sorted = [...projects].sort((a, b) => STATUS_PRIORITY[a.reviewStatus] - STATUS_PRIORITY[b.reviewStatus]);

  const services = await loadProjectServiceMap();
  return { props: { projects: sorted, services } };
};

export default function AdminFundingProjectsPage({ projects, services }: AdminFundingProjectsPageProps) {
  return (
    <>
      <Head>
        <title>펀딩 프로젝트 심사 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="펀딩 프로젝트 심사"
        description="개설자가 제출한 펀딩 프로젝트를 검토하고 승인·반려합니다."
        backHref="/admin/funding"
        backLabel="펀딩 목록"
        width="wide"
      >
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">제목</th>
                  <th className="px-4 py-3">개설자</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">서비스</th>
                  <th className="px-4 py-3">제출 시각</th>
                  <th className="px-4 py-3 rounded-r-lg">목표액</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/admin/funding/projects/${p.id}`} className="text-primary font-medium hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {p.creatorName}
                      <div className="text-xs text-gray-500 font-normal">{p.creatorEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE_CLASS[p.reviewStatus]}`}>
                        {STATUS_LABELS[p.reviewStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {!services.available ? (
                        <span className="text-gray-400">
                          {services.reason === 'missing_table'
                            ? '미적용(0037)'
                            : services.reason === 'schema_mismatch' ? '스키마 불일치' : '불러오지 못함'}
                        </span>
                      ) : services.byProjectId[p.id] && services.byProjectId[p.id].kind !== 'none' ? (
                        <>
                          <span className="font-semibold text-gray-800">{PROJECT_SERVICE_LABELS[services.byProjectId[p.id].kind]}</span>
                          <div className={services.byProjectId[p.id].designFeePaidAt ? 'text-green-700' : 'text-amber-700'}>
                            {services.byProjectId[p.id].designFeePaidAt ? '설계비 입금' : '설계비 미입금'}
                          </div>
                        </>
                      ) : (
                        // 되돌린 프로젝트는 행이 kind='none'으로 남아 있다(약정가·입금 기록
                        // 보존). 목록에서는 행이 없는 경우와 같이 보여야 한다 — 직접 개설인데
                        // "설계비 입금" 줄이 붙으면 지금 청구할 돈이 있는 것처럼 읽힌다.
                        <span className="text-gray-500">{PROJECT_SERVICE_LABELS.none}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.submittedAt ? formatKstDateTimeFull(p.submittedAt) : '미제출'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPriceAmount(p.goalAmount)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {projects.length === 0 && (
            <div className="text-center py-12 text-gray-500">등록된 펀딩 프로젝트가 없습니다.</div>
          )}
        </div>
      </AdminShell>
    </>
  );
}
