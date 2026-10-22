import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../../components/admin/AdminShell';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { CONTRACT_ADMIN_ACTION_LABELS, type ContractAdminAction } from '../../../lib/contracts/admin-event-labels';
import {
  listContractEventActors,
  parseContractEventFilter,
  searchContractAdminEvents,
  type ContractEventListRow,
} from '../../../lib/contracts/admin-events';
import { formatAdminDateTime } from '../../../lib/admin/displayDate';
import { getStatusLabel } from '../../../lib/contracts/status';

const LIST_LIMIT = 200;

interface AdminContractHistoryPageProps {
  events: ContractEventListRow[];
  actors: string[];
  /** 지금 적용된 필터(폼 기본값 + CSV 링크). */
  filter: { actor: string; action: string; contract: string; from: string; to: string };
  truncated: boolean;
  error?: string;
}

export const getServerSideProps: GetServerSideProps<AdminContractHistoryPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };

  const parsed = parseContractEventFilter(context.query, LIST_LIMIT + 1);
  const filter = {
    actor: parsed.actor ?? '',
    action: parsed.action ?? '',
    contract: parsed.contractId ?? '',
    from: parsed.from ?? '',
    to: parsed.to ?? '',
  };

  try {
    const [rows, actors] = await Promise.all([searchContractAdminEvents(parsed), listContractEventActors()]);
    return { props: { events: rows.slice(0, LIST_LIMIT), actors, filter, truncated: rows.length > LIST_LIMIT } };
  } catch (error: unknown) {
    console.error('[admin/contracts/history] 이력 조회 실패:', error);
    return {
      props: {
        events: [],
        actors: [],
        filter,
        truncated: false,
        error: '이력을 불러오지 못했습니다. 운영 DB에 마이그레이션 0075(contract_admin_events)이 적용됐는지 확인해 주세요.',
      },
    };
  }
};

const queryString = (filter: AdminContractHistoryPageProps['filter']): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : '';
};

export default function AdminContractHistoryPage({ events, actors, filter, truncated, error }: AdminContractHistoryPageProps) {
  return (
    <>
      <Head>
        <title>계약 작업 이력 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="계약 작업 이력"
        description="관리자가 계약에 한 발송·수정·취소·삭제·종료의 기록입니다. 이름·연락처는 담지 않습니다."
        backHref="/admin/contracts"
        backLabel="계약 목록"
        width="wide"
        actions={
          <a
            href={`/api/admin/contracts/history-export${queryString(filter)}`}
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
          >
            CSV 내려받기
          </a>
        }
      >
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
          <form method="GET" className="mb-6 flex flex-wrap items-end gap-3" role="search" aria-label="이력 검색">
            <Field id="history-actor" label="수행자" className={lightOnlyField}>
              <Select name="actor" defaultValue={filter.actor} light className="text-sm">
                <option value="">전체</option>
                {actors.map((actor) => (
                  <option key={actor} value={actor}>
                    {actor}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="history-action" label="행위" className={lightOnlyField}>
              <Select name="action" defaultValue={filter.action} light className="text-sm">
                <option value="">전체</option>
                {(Object.keys(CONTRACT_ADMIN_ACTION_LABELS) as ContractAdminAction[]).map((action) => (
                  <option key={action} value={action}>
                    {CONTRACT_ADMIN_ACTION_LABELS[action]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="history-from" label="시작일" className={lightOnlyField}>
              <TextInput type="date" name="from" defaultValue={filter.from} light className="text-sm" />
            </Field>
            <Field id="history-to" label="종료일" className={lightOnlyField}>
              <TextInput type="date" name="to" defaultValue={filter.to} light className="text-sm" />
            </Field>
            <Field id="history-contract" label="계약 ID" className={lightOnlyField}>
              <TextInput type="text" name="contract" defaultValue={filter.contract} light className="text-sm" />
            </Field>
            <Button light type="submit" variant="weak">
              검색
            </Button>
            <Link href="/admin/contracts/history" className="self-center text-sm text-primary hover:underline">
              초기화
            </Link>
          </form>

          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
              {error}
            </div>
          )}
          {truncated && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
              최근 {LIST_LIMIT}건만 표시합니다. 조건을 좁히거나 CSV로 전체를 받아 주세요.
            </div>
          )}

          {events.length === 0 && !error ? (
            <p className="text-sm text-gray-600">조건에 맞는 이력이 없습니다. (이력은 마이그레이션 0075 적용 이후의 작업부터 남습니다.)</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">일시</th>
                    <th className="px-4 py-3">행위</th>
                    <th className="px-4 py-3">수행자</th>
                    <th className="px-4 py-3">상태 변화</th>
                    <th className="px-4 py-3">호실</th>
                    <th className="px-4 py-3 rounded-r-lg">계약</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-b border-gray-100">
                      <td data-label="일시" className="px-4 py-3 tabular-nums whitespace-nowrap">{formatAdminDateTime(event.at)}</td>
                      <td data-label="행위" className="px-4 py-3 font-medium text-gray-900">
                        {CONTRACT_ADMIN_ACTION_LABELS[event.action as ContractAdminAction] ?? event.action}
                      </td>
                      <td data-label="수행자" className="px-4 py-3">{event.actor}</td>
                      <td data-label="상태 변화" className="px-4 py-3 text-gray-600">
                        {event.fromStatus === event.toStatus
                          ? '-'
                          : `${event.fromStatus ? getStatusLabel(event.fromStatus as never) : '-'} → ${event.toStatus ? getStatusLabel(event.toStatus as never) : '삭제'}`}
                      </td>
                      <td data-label="호실" className="px-4 py-3">{event.roomNumber ?? '-'}</td>
                      <td data-label="계약" className="px-4 py-3">
                        {event.roomNumber === null ? (
                          <span className="text-gray-500">삭제됨</span>
                        ) : (
                          <Link href={`/admin/contracts/${event.contractId}`} className="text-primary hover:underline">
                            상세
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminShell>
    </>
  );
}
