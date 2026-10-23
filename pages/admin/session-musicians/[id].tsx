import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { AdminShell } from '../../../components/admin/AdminShell';
import { DANGER_WEAK_CLASS } from '../../../components/admin/adminDanger';
import { Button } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Notice';
import { TextArea, TextInput } from '../../../components/ui/Field';
import {
  SESSION_LIMITS,
  SESSION_STATUS_LABEL,
  formatSessionRate,
  genreLabel,
  instrumentLabel,
  readingLabel,
} from '../../../data/sessionMusicians';
import { formatKstDateTimeFull } from '../../../lib/booking/format';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { isMissingTableError } from '../../../lib/dbErrors';
import { logAdminView } from '../../../lib/privacy/adminView';
import { getSessionMusician, toProfile, type SessionMusicianProfile } from '../../../lib/sessionMusicians/repository';

/**
 * 세션 연주자 상세 — 활동명·악기·소개·샘플 링크·운영자 메모·상태. **연락처(실명·휴대전화·이메일·카카오톡 ID)는 props에 싣지 않는다.**
 * 상세를 여는 일은 `session_musician_view`로, "연락처 보기"를 누른 순간의 복호화는 `session_musician_private_view`로 따로 기록한다
 * (월 입주 `tenancy_private_view`와 같은 구조). 샘플 링크는 새 창으로 열기만 하고 임베드하지 않는다.
 */

interface Props {
  profile: SessionMusicianProfile;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  if (!id) return { notFound: true };
  try {
    const row = await getSessionMusician(id);
    await logAdminView(context, auth.actor, 'session_musician_view', id, row ? 'success' : 'not_found');
    if (!row) return { notFound: true };
    return { props: { profile: toProfile(row) } };
  } catch (error: unknown) {
    if (isMissingTableError(error, 'session_musicians')) return { redirect: { destination: '/admin/session-musicians', permanent: false } };
    throw error;
  }
};

interface PrivateInfo {
  realName: string;
  phone: string;
  email: string;
  kakaoId?: string;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="font-medium text-right whitespace-pre-wrap break-words min-w-0">{children}</dd>
  </div>
);

export default function AdminSessionMusicianDetailPage({ profile }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(profile.status);
  const [memo, setMemo] = useState(profile.operatorMemo ?? '');
  const [rate, setRate] = useState(profile.ratePerSong === null ? '' : profile.ratePerSong.toLocaleString('ko-KR'));
  const [rateNote, setRateNote] = useState(profile.rateNote ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [privateInfo, setPrivateInfo] = useState<PrivateInfo | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const call = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: res.ok && data?.ok === true, data };
  };

  // 마지막으로 저장된(또는 처음 받은) 값 — "바뀐 칸"은 이것과 비교하고, 위쪽 프로필 표도 이 값을 그린다.
  // 저장 뒤 페이지를 다시 불러오지 않는다: 다시 불러오면 입력 칸은 옛 값 그대로라 다음 저장이 본인이 그 사이 고친 연주비를
  // 덮을 수 있고, 저장할 때마다 상세 열람 접속기록이 한 줄씩 늘었다(2026-10-23 리뷰).
  const [saved, setSaved] = useState({
    status: profile.status as string,
    memo: profile.operatorMemo ?? '',
    rate: profile.ratePerSong === null ? '' : profile.ratePerSong.toLocaleString('ko-KR'),
    rateNote: profile.rateNote ?? '',
  });
  const changedFields = (): Record<string, string> => {
    const fields: Record<string, string> = {};
    if (status !== saved.status) fields.status = status;
    if (memo.trim() !== saved.memo) fields.operatorMemo = memo;
    if (rate !== saved.rate) fields.ratePerSong = rate;
    if (rateNote.trim() !== saved.rateNote) fields.rateNote = rateNote;
    return fields;
  };

  const save = async () => {
    if (Object.keys(changedFields()).length === 0) {
      setMessage({ tone: 'success', text: '바뀐 내용이 없어요.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await call(`/api/admin/session-musicians/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // 바꾼 칸만 보낸다 — 화면을 연 뒤 본인이 관리 링크로 고친 연주비를, 상태만 바꾸려던 저장이 옛 값으로 덮지 않게.
        body: JSON.stringify(changedFields()),
      });
      setMessage(result.ok ? { tone: 'success', text: '저장했어요.' } : { tone: 'error', text: String(result.data?.message ?? '저장하지 못했어요.') });
      if (result.ok) {
        // 서버가 앞뒤 공백을 걷어 저장하므로 화면도 같은 값으로 맞춘다.
        setMemo(memo.trim());
        setRateNote(rateNote.trim());
        setSaved({ status, memo: memo.trim(), rate, rateNote: rateNote.trim() });
      }
    } catch {
      setMessage({ tone: 'error', text: '네트워크 오류가 났어요.' });
    } finally {
      setBusy(false);
    }
  };

  const showPrivate = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await call(`/api/admin/session-musicians/${profile.id}/private`);
      if (result.ok && result.data?.private) setPrivateInfo(result.data.private as PrivateInfo);
      else setMessage({ tone: 'error', text: String(result.data?.message ?? '연락처를 열지 못했어요.') });
    } catch {
      setMessage({ tone: 'error', text: '네트워크 오류가 났어요.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await call(`/api/admin/session-musicians/${profile.id}`, { method: 'DELETE' });
      if (result.ok) await router.replace('/admin/session-musicians');
      else setMessage({ tone: 'error', text: String(result.data?.message ?? '지우지 못했어요.') });
    } catch {
      setMessage({ tone: 'error', text: '네트워크 오류가 났어요.' });
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  const instruments = profile.instruments.map((i) => (typeof i === 'string' ? instrumentLabel(i) : i.other));

  return (
    <>
      <Head>
        <title>{`${profile.stageName} | 세션 연주자 | Studio NOL`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title={profile.stageName} description="세션 연주자 등록 상세" backHref="/admin/session-musicians" backLabel="세션 연주자" width="narrow">
        {message && <Notice tone={message.tone} light className="mb-4">{message.text}</Notice>}

        <section className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">프로필</h2>
          <dl className="space-y-2 text-sm">
            <Row label="주 악기">{instrumentLabel(profile.primaryInstrument)}</Row>
            <Row label="다루는 악기">{instruments.join(', ') || '-'}</Row>
            <Row label="장르">{profile.genres.map(genreLabel).join(', ') || '-'}</Row>
            <Row label="경력">{profile.yearsExperience === null ? '-' : `${profile.yearsExperience}년`}</Row>
            <Row label="악보 리딩">{readingLabel(profile.reading) || '-'}</Row>
            <Row label="원격 녹음">{profile.remoteRecording ? '가능' : '-'}</Row>
            <Row label="방문 가능 지역">{profile.region ?? '-'}</Row>
            <Row label="곡당 희망 연주비">{saved.rate ? `${saved.rate}원` : formatSessionRate(null)}</Row>
            <Row label="연주비 메모">{saved.rateNote || '-'}</Row>
            <Row label="등록">{formatKstDateTimeFull(new Date(profile.createdAt).toISOString())}</Row>
            <Row label="마지막 확인">{formatKstDateTimeFull(new Date(profile.lastConfirmedAt).toISOString())}</Row>
          </dl>
          {profile.bio && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-gray-500 text-sm mb-1">경력·참여작 소개</p>
              <p className="whitespace-pre-wrap break-words text-sm">{profile.bio}</p>
            </div>
          )}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-gray-500 text-sm mb-1">샘플 링크 ({profile.sampleLinks.length})</p>
            <ul className="space-y-1 text-sm">
              {profile.sampleLinks.map((link) => (
                <li key={link.url} className="break-all">
                  {/* 새 창으로 열기만 한다 — 임베드하지 않는다(외부 스크립트·CSP 변경 없음). */}
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {link.label || link.url}
                  </a>
                  {link.label && <span className="ml-2 text-xs text-gray-500">{link.url}</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-2">연락처</h2>
          {privateInfo ? (
            <dl className="space-y-2 text-sm">
              <Row label="실명">{privateInfo.realName}</Row>
              <Row label="휴대전화">{privateInfo.phone}</Row>
              <Row label="이메일">{privateInfo.email}</Row>
              <Row label="카카오톡 ID">{privateInfo.kakaoId ?? '-'}</Row>
            </dl>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">실명·휴대전화·이메일은 암호화돼 있어요. 열면 열람이 접속기록에 남습니다.</p>
              <Button type="button" variant="weak" onClick={showPrivate} disabled={busy}>연락처 보기</Button>
            </>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">운영 상태·연주비·메모</h2>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600">곡당 연주비(원)</span>
              <TextInput
                value={rate}
                inputMode="numeric"
                placeholder="비워 두면 미정"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setRate(digits ? Number(digits).toLocaleString('ko-KR') : '');
                }}
                light
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600">연주비 메모</span>
              <TextInput value={rateNote} onChange={(e) => setRateNote(e.target.value)} maxLength={SESSION_LIMITS.rateNote.max} light />
            </label>
          </div>
          <p className="mb-3 text-xs text-gray-500">원격·스튜디오 모두 곡당 기준이에요. 가격이 바뀌면 여기서 고치세요 — 본인도 관리 링크로 고칠 수 있고, 나중에 고친 쪽이 남아요.</p>
          <label className="mb-3 flex flex-col gap-1 text-sm">
            <span className="text-gray-600">상태</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2">
              {Object.entries(SESSION_STATUS_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">운영자 메모 (개인정보로 취급해요 — 행과 함께 지워져요)</span>
            <TextArea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={SESSION_LIMITS.operatorMemo.max} rows={4} light />
          </label>
          <div className="mt-3">
            <Button type="button" onClick={save} disabled={busy}>저장</Button>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">삭제</h2>
          <p className="text-sm text-gray-600 mb-3">본인이 관리 링크를 잃고 삭제를 요청했을 때 쓰세요. 바로 지워지고 되돌릴 수 없어요.</p>
          {confirmingDelete ? (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" light onClick={() => setConfirmingDelete(false)} disabled={busy}>그만두기</Button>
              <Button type="button" variant="weak" light className={DANGER_WEAK_CLASS} onClick={remove} disabled={busy}>네, 지울게요</Button>
            </div>
          ) : (
            <Button type="button" variant="secondary" light onClick={() => setConfirmingDelete(true)}>이 등록 삭제</Button>
          )}
        </section>
      </AdminShell>
    </>
  );
}
