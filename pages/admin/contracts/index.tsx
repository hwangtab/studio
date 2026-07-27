import React, { useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import {
  copyToClipboard,
  downloadContractPdf,
  logoutAdmin,
  mutateContract,
} from '../../../components/admin/contractActions';
import { Button } from '../../../components/ui/Button';
import { db } from '../../../db/client';
import { contractStatusEnum } from '../../../db/schema';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import {
  serializeContractForAdmin,
  type AdminSerializedContract,
} from '../../../lib/contracts/serialize';
import { expireOverdueContracts } from '../../../lib/contracts/service';
import { getStatusLabel } from '../../../lib/contracts/status';

interface AdminContractsPageProps {
  contracts: AdminSerializedContract[];
  error?: string;
}

export const getServerSideProps: GetServerSideProps<AdminContractsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  try {
    // 목록을 여는 시점이 곧 만료를 판정할 시점이다(크론 없이 lazy 처리).
    await expireOverdueContracts();

    const allContracts = await db.query.contracts.findMany({
      orderBy: (contracts, { desc }) => [desc(contracts.createdAt)],
      limit: 200,
    });

    return { props: { contracts: allContracts.map((c) => serializeContractForAdmin(c)) } };
  } catch (error: unknown) {
    console.error('[admin/contracts] Failed to load contracts:', error);
    return { props: { contracts: [], error: '계약 목록을 불러오는 중 오류가 발생했습니다.' } };
  }
};

const formatDate = (date: string | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatCurrency = (amount: number): string => new Intl.NumberFormat('ko-KR').format(amount);

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-yellow-100 text-yellow-700',
};

export default function AdminContractsPage({ contracts, error }: AdminContractsPageProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredContracts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      const matchesFilter = filter === 'all' || contract.status === filter;
      const matchesSearch =
        !term ||
        contract.customerName.toLowerCase().includes(term) ||
        contract.customerEmail.toLowerCase().includes(term) ||
        contract.customerPhone.includes(term) ||
        contract.roomNumber.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [contracts, filter, search]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: contracts.length };
    for (const status of contractStatusEnum) {
      result[status] = contracts.filter((c) => c.status === status).length;
    }
    return result;
  }, [contracts]);

  const withBusy = async (id: string, task: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusyId(id);
    setNotice(null);
    const result = await task();
    setBusyId(null);

    if (!result.ok) {
      setNotice(result.message ?? '요청을 처리하지 못했습니다.');
      return;
    }
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const handleCopyLink = async (contract: AdminSerializedContract) => {
    const copied = await copyToClipboard(contract.signUrl);
    setNotice(copied ? '서명 링크를 복사했습니다.' : '링크 복사에 실패했습니다.');
  };

  const handleLogout = async () => {
    await logoutAdmin();
    await router.replace('/admin/login');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">오류</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>계약 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">계약 관리</h1>
                <p className="text-white/80 mt-2">전자계약 현황을 확인하고 관리합니다.</p>
              </div>
              <div className="flex gap-2">
                <Link href="/admin/contracts/new" passHref>
                  <Button variant="secondary">새 계약 작성</Button>
                </Link>
                <Button variant="outline" className="border-white/40 text-white hover:bg-white/10" onClick={handleLogout}>
                  로그아웃
                </Button>
              </div>
            </div>

            <div className="p-6 md:p-8">
              {notice && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>
              )}

              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <div className="flex flex-wrap gap-2">
                  {['all', ...contractStatusEnum].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        filter === status
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status === 'all'
                        ? `전체 (${counts.all})`
                        : `${getStatusLabel(status as never)} (${counts[status] ?? 0})`}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="이름, 이메일, 전화번호, 호실 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 min-w-[240px] px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">상태</th>
                      <th className="px-4 py-3">이용자</th>
                      <th className="px-4 py-3">호실</th>
                      <th className="px-4 py-3">기간</th>
                      <th className="px-4 py-3">월 이용료</th>
                      <th className="px-4 py-3">서명일</th>
                      <th className="px-4 py-3 rounded-r-lg">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.map((contract) => {
                      const busy = busyId === contract.id;
                      return (
                        <tr key={contract.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[contract.status]}`}
                            >
                              {getStatusLabel(contract.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {contract.customerName}
                            <div className="text-xs text-gray-500 font-normal">
                              {contract.customerEmail}
                            </div>
                          </td>
                          <td className="px-4 py-3">{contract.roomNumber}호</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatDate(contract.startDate)} ~ {formatDate(contract.endDate)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatCurrency(contract.monthlyRent)}원
                          </td>
                          <td className="px-4 py-3">{formatDate(contract.signedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link href={`/admin/contracts/${contract.id}`} passHref>
                                <Button size="sm" variant="outline">
                                  상세
                                </Button>
                              </Link>

                              {contract.status === 'draft' && (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    withBusy(contract.id, () => mutateContract(contract.id, 'send'))
                                  }
                                >
                                  {busy ? '발송 중...' : '발송'}
                                </Button>
                              )}

                              {contract.status === 'sent' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleCopyLink(contract)}
                                >
                                  링크 복사
                                </Button>
                              )}

                              {(contract.status === 'expired' || contract.status === 'cancelled') && (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    withBusy(contract.id, () =>
                                      mutateContract(contract.id, 'resend'),
                                    )
                                  }
                                >
                                  {busy ? '재발송 중...' : '재발송'}
                                </Button>
                              )}

                              {contract.status === 'signed' && (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    withBusy(contract.id, () =>
                                      downloadContractPdf(contract.id, contract.customerName),
                                    )
                                  }
                                >
                                  PDF
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredContracts.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  {contracts.length === 0
                    ? '아직 작성된 계약이 없습니다. “새 계약 작성”으로 시작하세요.'
                    : '검색 결과가 없습니다.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
