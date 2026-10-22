import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../../components/admin/AdminShell';
import {
  SESSION_GENRES,
  SESSION_INSTRUMENTS,
  SESSION_STATUS_LABEL,
  formatSessionRate,
  genreLabel,
  instrumentLabel,
  readingLabel,
} from '../../../data/sessionMusicians';
import { formatKstDateTimeFull } from '../../../lib/booking/format';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { isMissingTableError } from '../../../lib/dbErrors';
import { Notice } from '../../../components/ui/Notice';
import {
  LIST_LIMIT,
  listSessionMusicians,
  parseSessionMusicianSort,
  type SessionMusicianFilters,
  type SessionMusicianProfile,
} from '../../../lib/sessionMusicians/repository';

/**
 * 세션 연주자 명단 — 운영자만 본다. **실명·연락처는 props에 싣지 않는다**(상세에서 버튼을 눌러 따로 연다).
 * 목록은 접속기록을 남기지 않는다 — 표에 안 나오는 개인정보를 싣지 않기 때문이다(`profile`에 `private`가 없다).
 */

/**
 * 목록 표에 나오는 칸만 props에 싣는다 — 운영자 메모(개인정보로 취급)·소개·연주비 메모·샘플 링크는 상세 화면에서만 연다.
 * 목록은 접속기록을 남기지 않으므로 표에 안 나오는 개인정보를 페이지 데이터에 실으면 안 된다(CLAUDE.md "관리자 매출 현황·수기 등록·메뉴").
 */
type ListRow = Pick<
  SessionMusicianProfile,
  'id' | 'stageName' | 'primaryInstrument' | 'instruments' | 'genres' | 'reading' | 'remoteRecording' | 'region' | 'status' | 'createdAt' | 'ratePerSong'
>;

const toListRow = (row: SessionMusicianProfile): ListRow => ({
  id: row.id,
  stageName: row.stageName,
  primaryInstrument: row.primaryInstrument,
  instruments: row.instruments,
  genres: row.genres,
  reading: row.reading,
  remoteRecording: row.remoteRecording,
  region: row.region,
  status: row.status,
  createdAt: row.createdAt,
  ratePerSong: row.ratePerSong,
});

interface Props {
  rows: ListRow[];
  filters: { status: string; instrument: string; genre: string; remote: boolean; sort: string };
  /** 마이그레이션 0077 전. 표가 없으면 목록 대신 안내를 띄운다. */
  migrationNeeded: boolean;
  error: string | null;
}

const one = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? '';

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };

  const status = one(context.query.status);
  const instrument = one(context.query.instrument);
  const genre = one(context.query.genre);
  const filters: SessionMusicianFilters = {};
  // 쿼리는 목록에 있는 값만 받는다(LIKE 패턴에 임의 문자열이 들어가지 않게).
  if (Object.hasOwn(SESSION_STATUS_LABEL, status)) filters.status = status as keyof typeof SESSION_STATUS_LABEL;
  if (SESSION_INSTRUMENTS.some((o) => o.id === instrument)) filters.instrument = instrument;
  if (SESSION_GENRES.some((o) => o.id === genre)) filters.genre = genre;
  if (one(context.query.remote) === '1') filters.remoteOnly = true;
  // 정렬은 고정 목록의 값만 받는다. 기본(최신 등록순)은 쿼리에 싣지 않는다.
  filters.sort = parseSessionMusicianSort(one(context.query.sort));

  const shown = { status: filters.status ?? '', instrument: filters.instrument ?? '', genre: filters.genre ?? '', remote: Boolean(filters.remoteOnly), sort: filters.sort };
  try {
    return { props: { rows: (await listSessionMusicians(filters)).map(toListRow), filters: shown, migrationNeeded: false, error: null } };
  } catch (error: unknown) {
    if (isMissingTableError(error, 'session_musicians')) {
      return { props: { rows: [], filters: shown, migrationNeeded: true, error: null } };
    }
    console.error('[admin/session-musicians] 목록 조회 실패', error instanceof Error ? error.name : 'unknown');
    return { props: { rows: [], filters: shown, migrationNeeded: false, error: '명단을 불러오지 못했습니다.' } };
  }
};

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-amber-100 text-amber-800',
  reviewed: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function AdminSessionMusiciansPage({ rows, filters, migrationNeeded, error }: Props) {
  return (
    <>
      <Head>
        <title>세션 연주자 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell
        title="세션 연주자"
        description="연주자가 스스로 등록한 비공개 명단입니다. 녹음·편곡·발매 프로젝트에 맞는 연주자를 찾아 섭외하세요. 연락처는 상세 화면에서 따로 열며 열람이 접속기록에 남습니다."
        width="wide"
      >
        {migrationNeeded && (
          <div role="alert" className="mb-4 p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-sm">
            마이그레이션 0077(session_musicians)이 아직 적용되지 않았습니다. 적용하기 전에는 등록을 받을 수 없고 명단도 비어 있습니다.
          </div>
        )}
        {error && <Notice tone="error" light className="mb-4">{error}</Notice>}

        <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-gray-600">상태</span>
            <select name="status" defaultValue={filters.status} className="rounded-lg border border-gray-300 bg-white px-3 py-2">
              <option value="">전체</option>
              {Object.entries(SESSION_STATUS_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-600">악기</span>
            <select name="instrument" defaultValue={filters.instrument} className="rounded-lg border border-gray-300 bg-white px-3 py-2">
              <option value="">전체</option>
              {SESSION_INSTRUMENTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-600">장르</span>
            <select name="genre" defaultValue={filters.genre} className="rounded-lg border border-gray-300 bg-white px-3 py-2">
              <option value="">전체</option>
              {SESSION_GENRES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-600">정렬</span>
            <select name="sort" defaultValue={filters.sort} className="rounded-lg border border-gray-300 bg-white px-3 py-2">
              <option value="newest">최근 등록순</option>
              <option value="rate">곡당 연주비 낮은 순</option>
            </select>
          </label>
          <label className="flex min-h-[40px] items-center gap-2">
            <input type="checkbox" name="remote" value="1" defaultChecked={filters.remote} className="h-4 w-4 accent-primary" />
            <span>원격 녹음 가능만</span>
          </label>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark">찾기</button>
          <Link href="/admin/session-musicians" className="px-2 py-2 text-gray-600 underline">초기화</Link>
        </form>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-lg:p-3">
            <table className="admin-table w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">활동명</th>
                  <th className="px-4 py-3">주 악기</th>
                  <th className="px-4 py-3">다루는 악기</th>
                  <th className="px-4 py-3">장르</th>
                  <th className="px-4 py-3">리딩</th>
                  <th className="px-4 py-3">곡당</th>
                  <th className="px-4 py-3">원격</th>
                  <th className="px-4 py-3">지역</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 rounded-r-lg">등록일</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td data-label="활동명" className="px-4 py-3 font-medium">
                      <Link href={`/admin/session-musicians/${row.id}`} className="text-primary hover:underline">{row.stageName}</Link>
                    </td>
                    <td data-label="주 악기" className="px-4 py-3">{instrumentLabel(row.primaryInstrument)}</td>
                    <td data-label="다루는 악기" className="px-4 py-3">
                      {row.instruments.map((i) => (typeof i === 'string' ? instrumentLabel(i) : i.other)).join(', ') || '-'}
                    </td>
                    <td data-label="장르" className="px-4 py-3">{row.genres.map(genreLabel).join(', ') || '-'}</td>
                    <td data-label="리딩" className="px-4 py-3">{readingLabel(row.reading) || '-'}</td>
                    <td data-label="곡당" className="px-4 py-3 whitespace-nowrap">{formatSessionRate(row.ratePerSong)}</td>
                    <td data-label="원격" className="px-4 py-3">{row.remoteRecording ? '가능' : '-'}</td>
                    <td data-label="지역" className="px-4 py-3">{row.region ?? '-'}</td>
                    <td data-label="상태" className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {SESSION_STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td data-label="등록일" className="px-4 py-3 whitespace-nowrap">{formatKstDateTimeFull(new Date(row.createdAt).toISOString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && !migrationNeeded && !error && <div className="text-center py-12 text-gray-500">등록된 연주자가 없습니다.</div>}
          {rows.length >= LIST_LIMIT && (
            <p className="px-4 py-3 text-xs text-gray-500">최근 {LIST_LIMIT}명까지만 보여 줍니다. 필터로 좁혀 주세요.</p>
          )}
        </div>
      </AdminShell>
    </>
  );
}
