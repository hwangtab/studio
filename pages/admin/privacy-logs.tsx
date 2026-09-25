import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { AdminShell } from '../../components/admin/AdminShell';
import { authenticateAdminRequest } from '../../lib/contracts/admin-auth';
import {
  listPrivacyAccessActors,
  listPrivacyAccessLogs,
  normalizeActionFilter,
  normalizeActorFilter,
  PRIVACY_ACCESS_ACTIONS,
  PRIVACY_LOG_PAGE_SIZE,
  type PrivacyAccessLogRow,
} from '../../lib/privacy/accessLogQuery';

/**
 * 개인정보 접속기록 — **읽기 전용** 화면.
 *
 * 주민등록번호·정산 계좌·후원자 CSV를 누가 언제 열었는지가 `privacy_access_logs`에
 * 쌓이는데, 그동안 그것을 조회하는 코드가 하나도 없었다. 볼 수 없으면 계정을 사람별로
 * 나눈 효과도 확인할 수 없다.
 *
 * **이 화면을 연 것은 기록하지 않는다.** 이유는 둘이다.
 *
 * 1. 이 표에는 **열람한 값이 애초에 담기지 않는다**(`recordPrivacyAccess`의 시그니처가
 *    그렇게 생겼다). 그래서 여기서 드러나는 것은 주민등록번호도 계좌번호도 연락처도
 *    아니고 "누가 무엇을 언제 열었는가"라는 사실뿐이다. 접속기록이 감시하려는 대상은
 *    개인정보를 꺼내는 행위이고, 그 목록은 `privacyAccessActionEnum` 한 곳에 있다.
 * 2. 기록하면 목록 앞쪽이 "누가 접속기록을 봤다"로 채워진다. 최신 200건만 보여 주므로,
 *    정작 확인하러 온 조회 기록이 자기 열람 기록에 밀려난다.
 *
 * **다만 이 화면에도 개인정보가 하나 실린다 — IP다**(관리자뿐 아니라 개설자의 IP도
 * `creator:<id>` 행에 들어 있다). 그래서 관리자 세션 뒤에 두고 noindex로 내린다.
 * 이 정도로 충분하지 않다는 판단이 서면 숨기지 말고 `privacyAccessActionEnum`에 값을
 * 더해 정식으로 남길 것 — 재귀 걱정 때문에 못 하는 일이 아니다(행이 하나 늘 뿐이다).
 *
 * 쓰기 경로는 만들지 않는다. 2년이 지난 행을 지우는 것은 cron 한 곳의 몫이다
 * (`purgeExpiredPrivacyAccessLogs`).
 */

interface AdminPrivacyLogsPageProps {
  rows: PrivacyAccessLogRow[];
  actors: string[];
  actorFilter: string | null;
  actionFilter: string | null;
  error?: string;
}

/** 행위 이름 → 사람이 읽는 말. 없는 값은 원문 그대로 보여 준다(지어내지 않는다). */
const ACTION_LABEL: Record<string, string> = {
  funding_resident_number_view: '주민등록번호 조회',
  funding_resident_number_decrypt_check: '주민등록번호 복호화 점검',
  funding_payout_account_view: '정산 계좌 조회',
  funding_payout_account_decrypt_check: '정산 계좌 복호화 점검',
  funding_payout_account_email: '정산 안내 메일의 계좌 복호화',
  funding_pledge_export: '펀딩 주문 CSV',
  sales_ledger_export: '매출장부 CSV',
  artist_supporter_export: '아티스트 후원자 CSV',
  funding_creator_shipping_export: '개설자 배송 목록 CSV',
  contract_pdf_download: '계약서 PDF',
};

const RESULT_LABEL: Record<string, string> = {
  success: '성공',
  not_found: '대상 없음',
  decrypt_failed: '복호화 실패',
  error: '오류',
};

const RESULT_CLASS: Record<string, string> = {
  success: 'bg-green-50 text-green-700',
  not_found: 'bg-gray-100 text-gray-600',
  decrypt_failed: 'bg-red-50 text-red-700',
  error: 'bg-red-50 text-red-700',
};

const formatAt = (iso: string): string => {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace('T', ' ').slice(0, 19);
};

export const getServerSideProps: GetServerSideProps<AdminPrivacyLogsPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };

  const actorFilter = normalizeActorFilter(context.query.actor);
  const actionFilter = normalizeActionFilter(context.query.action);

  try {
    const [rows, actors] = await Promise.all([
      listPrivacyAccessLogs({ actor: actorFilter, action: actionFilter }),
      listPrivacyAccessActors(),
    ]);
    return { props: { rows, actors, actorFilter, actionFilter } };
  } catch (error: unknown) {
    console.error('[admin/privacy-logs] 접속기록 조회 실패:', error);
    return {
      props: {
        rows: [],
        actors: [],
        actorFilter,
        actionFilter,
        error: '접속기록을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.',
      },
    };
  }
};

export default function AdminPrivacyLogsPage({
  rows,
  actors,
  actorFilter,
  actionFilter,
  error,
}: AdminPrivacyLogsPageProps) {
  const router = useRouter();

  const applyFilter = (key: 'actor' | 'action', value: string) => {
    const query: Record<string, string> = {};
    if (actorFilter) query.actor = actorFilter;
    if (actionFilter) query.action = actionFilter;
    if (value) query[key] = value;
    else delete query[key];
    void router.push({ pathname: '/admin/privacy-logs', query });
  };

  return (
    <>
      <Head>
        <title>개인정보 접속기록 | Studio NOL 관리자</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="개인정보 접속기록"
        description={`주민등록번호·정산 계좌·개인정보 목록을 누가 언제 열었는지. 최신 ${PRIVACY_LOG_PAGE_SIZE}건까지 보여 줍니다. 열람한 값 자체는 기록하지 않습니다.`}
        width="wide"
      >
        {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

        <div className="mb-6 flex flex-wrap gap-3">
          <label className="text-sm text-gray-700">
            <span className="block mb-1">수행자</span>
            <select
              aria-label="수행자로 거르기"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={actorFilter ?? ''}
              onChange={(e) => applyFilter('actor', e.target.value)}
            >
              <option value="">전체</option>
              {actors.map((actor) => (
                <option key={actor} value={actor}>
                  {actor}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700">
            <span className="block mb-1">행위</span>
            <select
              aria-label="행위로 거르기"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={actionFilter ?? ''}
              onChange={(e) => applyFilter('action', e.target.value)}
            >
              <option value="">전체</option>
              {PRIVACY_ACCESS_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABEL[action] ?? action}
                </option>
              ))}
            </select>
          </label>
        </div>

        {rows.length === 0 && !error ? (
          <p className="text-sm text-gray-600">해당하는 기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <caption className="sr-only">개인정보 접속기록 목록</caption>
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">시각(KST)</th>
                  <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">수행자</th>
                  <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">행위</th>
                  <th scope="col" className="px-3 py-2 font-semibold">대상</th>
                  <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">결과</th>
                  <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">건수</th>
                  <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatAt(row.at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{row.actor}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{ACTION_LABEL[row.action] ?? row.action}</td>
                    <td className="px-3 py-2 break-all">{row.targetId}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${RESULT_CLASS[row.result] ?? 'bg-gray-100 text-gray-600'}`}>
                        {RESULT_LABEL[row.result] ?? row.result}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{row.rowCount ?? ''}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.ip ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminShell>
    </>
  );
}
