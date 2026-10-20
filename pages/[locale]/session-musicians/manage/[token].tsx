/* eslint-disable @next/next/no-html-link-for-pages --
 * 비공개 경로(URL에 관리 토큰이 실린다)라 이탈 링크는 문서 이동으로 둔다 — lib/analytics/privatePaths.ts,
 * tests/pages/privateLinkNavigation.test.ts.
 */
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

import SessionMusicianForm, {
  EMPTY_SESSION_FORM,
  type SessionFormValues,
  type SubmitResult,
} from '../../../../components/sessionMusicians/SessionMusicianForm';
import { Button } from '../../../../components/ui/Button';
import { Notice } from '../../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../../components/ui/PageHeader';
import { Panel } from '../../../../components/ui/Panel';
import { SESSION_RETENTION_YEARS } from '../../../../data/sessionMusicians';
import { withI18nServerProps } from '../../../../lib/getStatic';

/**
 * 세션 연주자 본인 관리 — 접수 메일의 링크로 들어와 등록 정보를 보고·고치고·"계속 활동 중"을 확인하고·지운다.
 * 로그인은 없다. 토큰은 **경로에서 읽어 헤더(`x-manage-token`)로** API에 보낸다(쿼리로 보내면 접근 로그·Referer에 남는다).
 * getServerSideProps는 토큰을 props에 싣지 않는다. noindex, no-store(next.config PRIVATE_NO_STORE_SOURCES), 측정 제외(privatePaths).
 */

interface Profile {
  stageName: string;
  primaryInstrument: string;
  instruments: Array<string | { other: string }>;
  genres: string[];
  yearsExperience: number | null;
  reading: string | null;
  remoteRecording: boolean;
  region: string | null;
  bio: string | null;
  sampleLinks: Array<{ url: string; label: string }>;
  rateNote: string | null;
  private: { realName: string; phone: string; email: string; kakaoId?: string };
}

const toFormValues = (p: Profile): SessionFormValues => ({
  stageName: p.stageName,
  realName: p.private.realName,
  primaryInstrument: p.primaryInstrument,
  instruments: p.instruments.filter((i): i is string => typeof i === 'string'),
  otherInstruments: p.instruments
    .filter((i): i is { other: string } => typeof i !== 'string')
    .map((i) => i.other)
    .join(', '),
  genres: p.genres,
  yearsExperience: p.yearsExperience === null ? '' : String(p.yearsExperience),
  reading: p.reading ?? '',
  remoteRecording: p.remoteRecording,
  region: p.region ?? '',
  bio: p.bio ?? '',
  sampleLinks: p.sampleLinks.length > 0 ? p.sampleLinks.map((l) => ({ url: l.url, label: l.label })) : [{ url: '', label: '' }],
  rateNote: p.rateNote ?? '',
  phone: p.private.phone,
  email: p.private.email,
  kakaoId: p.private.kakaoId ?? '',
});

type Phase = 'loading' | 'ready' | 'not_found' | 'deleted' | 'error';

const api = async (token: string, method: string, body?: unknown) => {
  const res = await fetch('/api/session-musicians/manage', {
    method,
    headers: { 'x-manage-token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => null)) as (Record<string, unknown> & { ok?: boolean; message?: string; field?: string }) | null;
  return { status: res.status, ok: res.ok && data?.ok === true, data };
};

export default function SessionMusicianManagePage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [phase, setPhase] = useState<Phase>('loading');
  const [initial, setInitial] = useState<SessionFormValues>(EMPTY_SESSION_FORM);
  const [formVersion, setFormVersion] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api(token, 'GET');
      if (result.ok && result.data?.profile) {
        setInitial(toFormValues(result.data.profile as Profile));
        setFormVersion((v) => v + 1);
        setPhase('ready');
      } else {
        setPhase(result.status === 404 ? 'not_found' : 'error');
      }
    } catch {
      setPhase('error');
    }
  }, [token]);

  useEffect(() => {
    if (!router.isReady) return;
    void load();
  }, [router.isReady, load]);

  const save = async (payload: Record<string, unknown>): Promise<SubmitResult> => {
    setNotice(null);
    const result = await api(token, 'PATCH', payload);
    if (result.ok) {
      setNotice({ tone: 'success', text: `저장했어요. 보유 기간이 오늘부터 ${SESSION_RETENTION_YEARS}년으로 이어져요.` });
      return { ok: true };
    }
    if (result.status === 404) setPhase('not_found');
    return { ok: false, message: result.data?.message, field: result.data?.field };
  };

  const confirmActive = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await api(token, 'POST', { action: 'confirm' });
      if (result.ok) setNotice({ tone: 'success', text: `확인했어요. 보관 기간이 오늘부터 ${SESSION_RETENTION_YEARS}년으로 이어져요.` });
      else if (result.status === 404) setPhase('not_found');
      else setNotice({ tone: 'error', text: result.data?.message || '처리하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    } catch {
      setNotice({ tone: 'error', text: '네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await api(token, 'DELETE');
      if (result.ok) setPhase('deleted');
      else if (result.status === 404) setPhase('not_found');
      else setNotice({ tone: 'error', text: result.data?.message || '지우지 못했어요. 잠시 후 다시 시도해 주세요.' });
    } catch {
      setNotice({ tone: 'error', text: '네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <>
      <Head>
        <title>세션 연주자 등록 관리 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <PageShell>
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>
        {phase === 'loading' && <p className="text-center text-gray-600 dark:text-gray-400" role="status">불러오는 중…</p>}

        {phase === 'not_found' && (
          <>
            <PageHeader title="이 링크는 쓸 수 없어요" align="center" />
            <Notice tone="warning">
              이미 삭제했거나, 새 관리 링크가 발급돼 이 링크가 더는 쓸 수 없게 됐을 수 있어요. 가장 최근에 받은 메일의 링크를 열어 보세요.
              그래도 안 되면 같은 이메일로 다시 등록하시면 새 링크를 보내 드려요.
            </Notice>
            <p className="mt-8 text-center typo-card-meta">
              <a href="/ko/session-musicians" rel="noreferrer" className="underline">세션 연주자 등록 페이지</a>
            </p>
          </>
        )}

        {phase === 'error' && (
          <>
            <PageHeader title="불러오지 못했어요" align="center" />
            <Notice tone="error">잠시 후 다시 시도해 주세요. 계속 안 되면 카카오톡이나 전화로 알려 주세요.</Notice>
          </>
        )}

        {phase === 'deleted' && (
          <>
            <PageHeader title="등록 정보를 지웠어요" align="center" />
            <Notice tone="success">입력하신 정보를 모두 지웠어요. 나중에 다시 하고 싶으시면 언제든 새로 등록하실 수 있어요.</Notice>
            <p className="mt-8 text-center typo-card-meta">
              <a href="/ko" rel="noreferrer" className="underline">스튜디오 놀 홈으로</a>
            </p>
          </>
        )}

        {phase === 'ready' && (
          <>
            <PageHeader
              title="내 등록 정보"
              lead="고치고 저장하거나, 계속 활동 중이라고 알려 주세요. 필요 없어지면 지우실 수 있어요."
              className="mb-6"
            />
            {notice && (
              <Notice tone={notice.tone} className="mb-6">
                {notice.text}
              </Notice>
            )}
            <Panel variant="outline" padding="compact" className="mb-8">
              <p className="mb-3 text-sm">
                아직 세션 연주를 하고 계신가요? 버튼을 한 번 누르시면 보관 기간이 오늘부터 {SESSION_RETENTION_YEARS}년으로 이어져요.
              </p>
              <Button type="button" variant="weak" onClick={confirmActive} disabled={busy}>
                계속 활동 중이에요
              </Button>
            </Panel>
            <SessionMusicianForm
              key={formVersion}
              mode="manage"
              initial={initial}
              submitLabel="저장하기"
              onSubmit={save}
              footer={
                <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
                  <h2 className="typo-card-title mb-2">등록 지우기</h2>
                  <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">지우면 등록 정보가 바로 사라져요. 되돌릴 수 없어요.</p>
                  {confirmingDelete ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={remove} disabled={busy}>
                        {busy ? '지우는 중…' : '네, 지울게요'}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                        그만두기
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="secondary" onClick={() => setConfirmingDelete(true)}>
                      등록 지우기
                    </Button>
                  )}
                </div>
              }
            />
          </>
        )}
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Record<string, never>>(async ({ params, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (params?.locale !== 'ko') {
    const token = typeof params?.token === 'string' ? encodeURIComponent(params.token) : '';
    return { redirect: { destination: `/ko/session-musicians/manage/${token}`, permanent: false } };
  }
  return { props: {} };
});

// 디자인 판 — lib/designEdition.ts
SessionMusicianManagePage.designEdition = 'v2';
