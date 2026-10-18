import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../../../components/admin/AdminShell';
import { Button } from '../../../../components/ui/Button';
import { getDb } from '../../../../db/client';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { formatCurrency, formatShortDate } from '../../../../lib/contracts/format';
import { expireOverdueProductionContracts } from '../../../../lib/contracts/production/service';
import { getEffectiveProductionStatus, getProductionStatusLabel } from '../../../../lib/contracts/production/status';
import { parseStoredTerms } from '../../../../lib/contracts/production/terms';
import type { ProductionContractStatus } from '../../../../db/schema';

/** 한 화면에 싣는 최대 건수. 넘으면 잘린다는 사실을 알린다(연습실 목록과 같다). */
const LIST_LIMIT = 200;

/** 목록 한 줄 — 상세에서 볼 개인정보(연락처·주소)는 싣지 않는다. */
interface ListRow {
  id: string;
  status: ProductionContractStatus;
  clientName: string;
  clientStageName: string | null;
  songTitle: string | null;
  totalAmount: number;
  createdAt: string;
  sentAt: string | null;
  signedAt: string | null;
  notificationError: boolean;
}

interface ProductionContractsPageProps {
  rows: ListRow[];
  truncated: boolean;
  error?: string;
}

export const getServerSideProps: GetServerSideProps<ProductionContractsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  try {
    await expireOverdueProductionContracts();
    const contracts = await getDb().query.productionContracts.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: LIST_LIMIT + 1,
      columns: { template: false, content: false },
    });

    return {
      props: {
        truncated: contracts.length > LIST_LIMIT,
        rows: contracts.slice(0, LIST_LIMIT).map((contract) => ({
          id: contract.id,
          status: getEffectiveProductionStatus(contract),
          clientName: contract.clientName,
          clientStageName: contract.clientStageName,
          songTitle: parseStoredTerms(contract.termsJson).songTitle,
          totalAmount: contract.totalAmount,
          createdAt: contract.createdAt.toISOString(),
          sentAt: contract.sentAt?.toISOString() ?? null,
          signedAt: contract.signedAt?.toISOString() ?? null,
          notificationError: Boolean(contract.notificationError),
        })),
      },
    };
  } catch (error: unknown) {
    console.error('[admin/contracts/production] Failed to load contracts:', error);
    return { props: { rows: [], truncated: false, error: '계약 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.' } };
  }
};

const STATUS_CLASS: Record<ProductionContractStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  completed: 'bg-gray-200 text-gray-700',
  terminated: 'bg-gray-200 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};

export default function ProductionContractsPage({ rows, truncated, error }: ProductionContractsPageProps) {
  return (
    <>
      <Head>
        <title>제작 계약 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="제작 계약"
        description="음원 제작 용역 계약 — 작성, 서명하고 발송, 체결 확인"
        actions={
          <Link href="/admin/contracts/production/new" passHref>
            <Button light>새 제작 계약</Button>
          </Link>
        }
      >
        {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
        {truncated && (
          <div className="mb-4 p-3 bg-amber-50 text-amber-900 rounded-lg text-sm">
            최근 {LIST_LIMIT}건만 보여 줍니다. 그보다 오래된 계약은 이 목록에 없습니다.
          </div>
        )}

        {rows.length === 0 && !error ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">아직 제작 계약이 없습니다.</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/contracts/production/${row.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[row.status]}`}>
                      {getProductionStatusLabel(row.status)}
                    </span>
                    <span className="font-medium text-gray-900">
                      {row.clientName}
                      {row.clientStageName && <span className="text-gray-500"> ({row.clientStageName})</span>}
                    </span>
                    <span className="text-sm text-gray-600">{row.songTitle ?? '곡 제목 미정'}</span>
                    <span className="text-sm text-gray-600">{formatCurrency(row.totalAmount)}원</span>
                    {row.notificationError && <span className="text-xs font-medium text-amber-700">메일 실패</span>}
                    <span className="ml-auto text-xs text-gray-400">
                      {row.signedAt
                        ? `체결 ${formatShortDate(row.signedAt)}`
                        : row.sentAt
                          ? `발송 ${formatShortDate(row.sentAt)}`
                          : `작성 ${formatShortDate(row.createdAt)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AdminShell>
    </>
  );
}
