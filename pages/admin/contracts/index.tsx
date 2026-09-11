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
import { TextInput } from '../../../components/ui/Field';
import { getDb } from '../../../db/client';
import { contractStatusEnum } from '../../../db/schema';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import {
  serializeContractForAdmin,
  type AdminSerializedContract,
} from '../../../lib/contracts/serialize';
import { expireOverdueContracts } from '../../../lib/contracts/service';
import { getStatusLabel, needsTermination } from '../../../lib/contracts/status';
import { formatCurrency, formatShortDate as formatDate } from '../../../lib/contracts/format';

/** 한 화면에 싣는 최대 건수. 넘으면 오래된 계약이 잘린다는 사실을 화면에 알린다. */
const LIST_LIMIT = 200;

interface AdminContractsPageProps {
  contracts: AdminSerializedContract[];
  /** 잘린 계약이 있다 — 검색도 실린 목록 안에서만 되므로 반드시 알려야 한다. */
  truncated: boolean;
  /** 만료까지 남은 일수를 서버·클라이언트가 같은 기준으로 계산하도록 넘긴다. */
  now: string;
  error?: string;
}

/** 만료까지 남은 일수. 이미 지났으면 0 이하. */
const daysUntil = (iso: string | null, now: string): number | null => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - new Date(now).getTime()) / (24 * 60 * 60 * 1000));
};

/**
 * 남은 기간을 사람이 읽는 말로.
 *
 * 일수만 올림해서 쓰면 두 시간 남은 링크도 "1일 남음"이 된다. 오늘 안에 손을 써야 하는
 * 상황과 하루 여유가 있는 상황이 같은 문구로 보이면 판단이 늦는다.
 */
const formatTimeLeft = (iso: string | null, now: string): string | null => {
  if (!iso) return null;

  const ms = new Date(iso).getTime() - new Date(now).getTime();
  if (ms <= 0) return '만료됨';

  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return '1시간 내 만료';
  if (hours < 24) return `${hours}시간 남음`;
  return `${Math.floor(hours / 24)}일 남음`;
};

/** 이 안으로 들어오면 재발송을 준비해야 한다. */
const EXPIRY_WARNING_DAYS = 2;

export const getServerSideProps: GetServerSideProps<AdminContractsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  try {
    // 목록을 여는 시점이 곧 만료를 판정할 시점이다(크론 없이 lazy 처리).
    await expireOverdueContracts();

    // 한 건 더 읽어 "잘렸는지"를 판별한다.
    const allContracts = await getDb().query.contracts.findMany({
      orderBy: (contracts, { desc }) => [desc(contracts.createdAt)],
      limit: LIST_LIMIT + 1,
    });

    return {
      props: {
        contracts: allContracts.slice(0, LIST_LIMIT).map((c) => serializeContractForAdmin(c)),
        truncated: allContracts.length > LIST_LIMIT,
        now: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    console.error('[admin/contracts] Failed to load contracts:', error);
    return {
      props: {
        contracts: [],
        truncated: false,
        now: new Date().toISOString(),
        error: '계약 목록을 불러오는 중 오류가 발생했습니다.',
      },
    };
  }
};



const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  terminated: 'bg-gray-200 text-gray-600',
};

export default function AdminContractsPage({
  contracts,
  truncated,
  now,
  error,
}: AdminContractsPageProps) {
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

  // 발송했지만 아직 서명되지 않은 건 중 기한이 얼마 남지 않은 것들.
  const expiringSoon = useMemo(
    () =>
      contracts.filter((c) => {
        if (c.status !== 'sent') return false;
        const left = daysUntil(c.expiresAt, now);
        return left !== null && left <= EXPIRY_WARNING_DAYS;
      }),
    [contracts, now],
  );

  /**
   * 메일이 나가지 않은 계약. 고객은 서명 링크를 못 받았는데 목록에는 '발송완료'로 보인다.
   * 발송은 응답 뒤에 처리되므로 방금 보낸 건은 아직 결과가 없을 수 있다.
   */
  const mailFailed = useMemo(() => contracts.filter((c) => c.notificationError), [contracts]);

  /** 종료 처리를 해야 그 호실로 새 계약을 만들 수 있는 것들. */
  const awaitingTermination = useMemo(
    () => contracts.filter((c) => needsTermination(c, now)),
    [contracts, now],
  );

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
    }
    // 실패했더라도 새로고침한다. 거절 사유는 대개 "화면이 낡았다"는 것이라,
    // 낡은 상태를 그대로 두면 같은 버튼을 계속 누르게 된다.
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  /**
   * 발송은 실제로 고객에게 메일이 나가는 동작이라 확인을 받는다. 상세 화면은 이미 확인창을
   * 띄우는데 목록만 곧바로 나가서, 목록에서 잘못 누르면 되돌릴 방법이 없었다.
   */
  const handleSend = async (contract: AdminSerializedContract) => {
    if (
      !window.confirm(`${contract.customerEmail} 주소로 서명 요청 메일을 보냅니다. 계속할까요?`)
    ) {
      return;
    }
    await withBusy(contract.id, () => mutateContract(contract.id, 'send'));
  };

  const handleResend = async (contract: AdminSerializedContract) => {
    if (!window.confirm('재발송하면 기존 서명 링크는 즉시 무효가 됩니다. 계속할까요?')) return;
    await withBusy(contract.id, () => mutateContract(contract.id, 'resend'));
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
                <Button variant="outline" className="border-white/40 text-white hover:bg-white/10 dark:border-white/40 dark:text-white dark:hover:border-white/40" onClick={handleLogout}>
                  로그아웃
                </Button>
              </div>
            </div>

            <div className="p-6 md:p-8">
              {notice && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>
              )}

              {/* 메일 실패를 가장 먼저 알린다. 고객이 아무것도 못 받은 상태이고,
                  운영자가 알아채지 못하면 계약이 그대로 멈춘다. */}
              {mailFailed.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-900 rounded-lg text-sm">
                  <strong>메일이 발송되지 않은 계약이 {mailFailed.length}건 있습니다</strong> (
                  {mailFailed.map((c) => c.customerName).join(', ')}). 고객이 서명 링크를 받지
                  못했습니다 — 해당 계약을 열어 재발송하거나 링크를 직접 전달해 주세요.
                </div>
              )}

              {expiringSoon.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
                  서명 링크가 곧 만료되는 계약이 {expiringSoon.length}건 있습니다 (
                  {expiringSoon.map((c) => c.customerName).join(', ')}). 고객이 서명하지 못하면
                  재발송해야 합니다.
                </div>
              )}

              {awaitingTermination.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-sm">
                  이용 기간이 지난 계약이 {awaitingTermination.length}건 있습니다 (
                  {awaitingTermination.map((c) => `${c.roomNumber}호 ${c.customerName}`).join(', ')}
                  ). 갱신해서 계속 이용 중이면 그대로 두시고, 끝났다면 종료 처리를 해야 그
                  호실로 새 계약을 만들 수 있습니다.
                </div>
              )}

              {truncated && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
                  최근 {LIST_LIMIT}건만 표시합니다. 아래 검색도 이 목록 안에서만 찾으므로,
                  더 오래된 계약은 나오지 않습니다.
                </div>
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

                <TextInput
                  type="text"
                  placeholder="이름, 이메일, 전화번호, 호실 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  light className="w-auto flex-1 min-w-[240px] px-4"
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
                            {contract.status === 'sent' &&
                              (() => {
                                const left = daysUntil(contract.expiresAt, now);
                                const label = formatTimeLeft(contract.expiresAt, now);
                                if (left === null || label === null) return null;
                                return (
                                  <div
                                    className={`mt-1 text-xs ${
                                      left <= EXPIRY_WARNING_DAYS
                                        ? 'text-red-600 font-medium'
                                        : 'text-gray-500'
                                    }`}
                                  >
                                    {label}
                                  </div>
                                );
                              })()}

                            {/* 메일이 안 나간 계약은 겉보기에 정상 발송과 구별되지 않는다.
                                고객은 링크를 못 받았는데 목록은 '발송완료'로 보인다. */}
                            {contract.notificationError && (
                              <div className="mt-1 text-xs text-amber-700 font-medium">
                                메일 실패
                              </div>
                            )}

                            {/* 종료 처리를 해야 이 호실로 새 계약을 만들 수 있다. */}
                            {needsTermination(contract, now) && (
                              <div className="mt-1 text-xs text-blue-700 font-medium">
                                종료 처리 필요
                              </div>
                            )}
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
                                  onClick={() => handleSend(contract)}
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
                                  onClick={() => handleResend(contract)}
                                >
                                  {busy ? '재발송 중...' : '재발송'}
                                </Button>
                              )}

                              {contract.status === 'signed' && !contract.purgedAt && (
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
