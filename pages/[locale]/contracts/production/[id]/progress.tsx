import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import ContractNotice from '../../../../../components/contracts/ContractNotice';
import { Button } from '../../../../../components/ui/Button';
import { TextInput } from '../../../../../components/ui/Field';
import { Notice } from '../../../../../components/ui/Notice';
import { formatCurrency, formatDate } from '../../../../../lib/contracts/format';
import { IDENTITY_DIGITS } from '../../../../../lib/contracts/identity';
import { denyContractPageCaching } from '../../../../../lib/contracts/page-cache';
import { productionSignPath } from '../../../../../lib/contracts/production/links';
import { hasPortalAccess } from '../../../../../lib/contracts/production/portal-session';
import { loadProgressContext } from '../../../../../lib/contracts/production/progress';
import { buildClientProgressView, type ProgressView, type StageView } from '../../../../../lib/contracts/production/progress-view';
import { hasSignedDocument } from '../../../../../lib/contracts/production/status';
import { withI18nServerProps } from '../../../../../lib/getStatic';

interface ProgressPageProps {
  locale: string;
  token: string;
  contractId: string;
  clientName: string;
  songTitle: string | null;
  /** 연락처 뒷자리를 아직 확인하지 않았다 — 진행 내용을 싣지 않는다. */
  locked: boolean;
  /** 진행이 끝난 계약 — 승인·수정 버튼이 없다. */
  closed: boolean;
  view: ProgressView | null;
  unavailable?: 'not-found' | 'error';
}

const OPERATOR_PHONE = '010-4255-7893';

/**
 * 의뢰인 진행 페이지 — 받은 결과물, 승인·수정 요청, 입금 안내, 확인 기한.
 *
 * 진행 내용(발매 전 음원 링크)은 연락처 뒷자리를 확인한 뒤에만 props에 싣는다(portal-session.ts). 확인 전에는
 * 이름과 곡 제목만 — 완료 화면이 싣는 정도다.
 */
export const getServerSideProps = withI18nServerProps<ProgressPageProps>(async (context) => {
  denyContractPageCaching(context.res);

  const { locale, id } = context.params as { locale: string; id: string };
  const { token } = context.query;
  const empty = {
    locale,
    token: typeof token === 'string' ? token : '',
    contractId: id,
    clientName: '',
    songTitle: null,
    locked: true,
    closed: false,
    view: null,
  };
  if (!id || typeof token !== 'string' || token.trim() === '') {
    return { props: { ...empty, unavailable: 'not-found' as const } };
  }

  try {
    const progress = await loadProgressContext(id);
    const client = progress?.contract.signers.find((s) => s.role === 'client' && s.signToken === token);
    if (!progress || !client || progress.contract.purgedAt) {
      return { props: { ...empty, unavailable: 'not-found' as const } };
    }
    if (!hasSignedDocument(progress.contract.status)) {
      return { redirect: { destination: productionSignPath(id, token, locale), permanent: false } };
    }

    const locked = !hasPortalAccess(context.req, id, token);
    return {
      props: {
        ...empty,
        clientName: progress.contract.clientName,
        songTitle: progress.terms.songTitle,
        locked,
        closed: progress.contract.status !== 'signed',
        view: locked ? null : buildClientProgressView(progress.terms, progress.ledger),
      },
    };
  } catch (error: unknown) {
    console.error('[contracts/production/[id]/progress] Failed to load:', error);
    return { props: { ...empty, unavailable: 'error' as const } };
  }
});

const post = async (contractId: string, body: Record<string, unknown>) => {
  try {
    const response = await fetch(`/api/contracts/production/${contractId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    return { ok: response.ok && result.ok === true, message: result.message };
  } catch {
    return { ok: false, message: '연결이 끊겼어요. 잠시 후 다시 시도해 주세요.' };
  }
};

const stageStatus = (stage: StageView): string => {
  if (stage.approved) return stage.approved.mode === 'deemed' ? '승인됨 (기한 경과)' : '승인됨';
  if (stage.pending) return '확인을 기다려요';
  if (stage.revising) return '수정 반영 중';
  return stage.deliveries > 0 ? '진행 중' : '준비 중';
};

function StageCard({
  stage,
  contractId,
  token,
  closed,
  extraFee,
  onDone,
}: {
  stage: StageView;
  contractId: string;
  token: string;
  closed: boolean;
  extraFee: number;
  onDone: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'idle' | 'revision'>('idle');
  const [note, setNote] = useState('');
  const [acceptFee, setAcceptFee] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsFee = stage.freeRemaining === 0;

  const submit = async (action: 'approve' | 'revision') => {
    if (!stage.pending) return;
    setBusy(true);
    setError(null);
    const result = await post(contractId, {
      action,
      token,
      stage: stage.stage,
      deliveryEventId: stage.pending.deliveryEventId,
      note,
      acceptFee,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? '처리하지 못했어요.');
      return;
    }
    await onDone();
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-200 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-900">{stage.label}</h3>
        <span className="text-sm text-gray-600 dark:text-gray-600">{stageStatus(stage)}</span>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
        전달 {stage.deliveries}회 · 수정 요청 {stage.revisions}회 · 남은 무료 수정 {stage.freeRemaining}회
      </p>

      {stage.pending && !stage.approved && (
        <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-50 p-4 text-sm text-gray-700 dark:text-gray-700">
          <p>
            {formatDate(stage.pending.deliveredAt)}에 결과물을 보내 드렸어요.{' '}
            <strong>{formatDate(stage.pending.lastDayToRespond)}까지</strong> 수정 요청이 없으면 승인된 것으로 봐요(계약서 제5조 5항).
          </p>
          {stage.pending.link && (
            <a href={stage.pending.link} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-primary underline">
              결과물 듣기
            </a>
          )}

          {!closed && mode === 'idle' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button light disabled={busy} onClick={() => submit('approve')}>
                이대로 승인해요
              </Button>
              <Button light variant="weak" disabled={busy} onClick={() => setMode('revision')}>
                수정을 요청해요
              </Button>
            </div>
          )}

          {!closed && mode === 'revision' && (
            <div className="mt-4 space-y-3">
              <label htmlFor={`note-${stage.stage}`} className="block text-sm text-gray-700 dark:text-gray-700">
                수정할 내용을 한 번에 정리해 적어 주세요. 한 번 보낸 요청이 1회로 셉니다(계약서 제5조 2항).
              </label>
              <textarea
                id={`note-${stage.stage}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                maxLength={1000}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-300 bg-white dark:bg-white p-3 text-sm text-gray-900 dark:text-gray-900"
              />
              {needsFee && (
                <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary"
                    checked={acceptFee}
                    onChange={(e) => setAcceptFee(e.target.checked)}
                  />
                  <span>
                    무료 수정 횟수를 모두 썼어요. 이번 수정에는 <strong>{formatCurrency(extraFee)}원</strong>이 더해지는 데
                    동의해요(계약서 제5조 3항).
                  </span>
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <Button light disabled={busy || note.trim() === '' || (needsFee && !acceptFee)} onClick={() => submit('revision')}>
                  수정 요청 보내기
                </Button>
                <Button light variant="weak" disabled={busy} onClick={() => setMode('idle')}>
                  취소
                </Button>
              </div>
            </div>
          )}
          {error && (
            <Notice tone="error" light className="mt-3">
              {error}
            </Notice>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductionProgressPage({
  locale,
  token,
  contractId,
  clientName,
  songTitle,
  locked,
  closed,
  view,
  unavailable,
}: ProgressPageProps) {
  const router = useRouter();
  const [digits, setDigits] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = () => router.replace(router.asPath, undefined, { scroll: false }).then(() => undefined);

  if (unavailable) {
    const title = unavailable === 'error' ? '진행 상황을 불러오지 못했어요' : '진행 페이지를 찾을 수 없어요';
    return (
      <>
        <Head>
          <title>{`${title} | Studio NOL`}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <ContractNotice
          title={title}
          description={
            unavailable === 'error'
              ? `잠시 후 다시 열어 주세요. 계속 안 되면 ${OPERATOR_PHONE}으로 연락해 주세요.`
              : '메일에 있는 링크를 다시 확인해 주세요.'
          }
        />
      </>
    );
  }

  const unlock = async () => {
    setBusy(true);
    setUnlockError(null);
    const result = await post(contractId, { action: 'unlock', token, identityDigits: digits });
    setBusy(false);
    if (!result.ok) {
      setUnlockError(result.message ?? '확인하지 못했어요.');
      return;
    }
    await reload();
  };

  return (
    <>
      <Head>
        <title>작업 진행 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main className="min-h-screen bg-gray-50 dark:bg-gray-50 py-8 md:py-12">
        <div className="max-w-2xl mx-auto px-4 space-y-6">
          <div className="bg-white dark:bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <p className="text-sm font-medium text-gray-400 dark:text-gray-400">스튜디오 놀 · 음원 제작</p>
            <h1 className="typo-page-title text-gray-900 dark:text-gray-900 mt-1">{songTitle ?? '작업 진행'}</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-600">{clientName}님의 작업 진행 상황이에요.</p>
          </div>

          {locked || !view ? (
            <div className="bg-white dark:bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <label htmlFor="progress-digits" className="block text-sm text-gray-700 dark:text-gray-700 mb-3">
                발매 전 음원이 있는 페이지라 본인 확인이 필요해요. 계약서에 등록된 연락처 뒤 {IDENTITY_DIGITS}자리를 입력해 주세요.
              </label>
              <TextInput
                id="progress-digits"
                inputMode="numeric"
                autoComplete="off"
                maxLength={IDENTITY_DIGITS}
                value={digits}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                light
                className="mb-4 px-4 py-3 text-center text-lg tracking-[0.5em]"
              />
              <Button light size="lg" fullWidth disabled={busy || digits.length !== IDENTITY_DIGITS} onClick={unlock}>
                {busy ? '확인 중…' : '진행 상황 보기'}
              </Button>
              {unlockError && (
                <Notice tone="error" light className="mt-3">
                  {unlockError}
                </Notice>
              )}
            </div>
          ) : (
            <>
              <section className="bg-white dark:bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-4">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900">단계별 확인</h2>
                {closed && (
                  <p className="text-sm text-gray-600 dark:text-gray-600">이 계약은 마무리됐어요. 아래는 지금까지의 기록이에요.</p>
                )}
                {view.stages.map((stage) => (
                  <StageCard
                    key={stage.stage}
                    stage={stage}
                    contractId={contractId}
                    token={token}
                    closed={closed}
                    extraFee={view.extraRevisionFee[stage.stage]}
                    onDone={reload}
                  />
                ))}
              </section>

              <section className="bg-white dark:bg-white rounded-2xl shadow-sm p-6 md:p-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-4">대금과 일정</h2>
                <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <dt className="text-gray-500 dark:text-gray-500">받은 금액</dt>
                  <dd className="text-right font-medium text-gray-900 dark:text-gray-900">{formatCurrency(view.payments.received)}원</dd>
                  <dt className="text-gray-500 dark:text-gray-500">남은 금액</dt>
                  <dd className="text-right font-medium text-gray-900 dark:text-gray-900">{formatCurrency(view.payments.remaining)}원</dd>
                  {!view.payments.depositMetAt && view.payments.depositLastDay && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-500">계약금 기한</dt>
                      <dd className="text-right font-medium text-gray-900 dark:text-gray-900">{formatDate(view.payments.depositLastDay)}</dd>
                    </>
                  )}
                  {!view.payments.paidInFull && view.payments.balanceLastDay && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-500">잔금 기한</dt>
                      <dd className="text-right font-medium text-gray-900 dark:text-gray-900">{formatDate(view.payments.balanceLastDay)}</dd>
                    </>
                  )}
                  <dt className="text-gray-500 dark:text-gray-500">작업 완료 예정</dt>
                  <dd className="text-right font-medium text-gray-900 dark:text-gray-900">
                    {view.work.dueOn ? `${formatDate(view.work.dueOn)} 무렵` : '계약금·1차 완성본을 받은 뒤 정해져요'}
                  </dd>
                </dl>
              </section>

              <section className="bg-white dark:bg-white rounded-2xl shadow-sm p-6 md:p-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-4">지금까지의 기록</h2>
                {view.timeline.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-500">아직 기록이 없어요.</p>
                ) : (
                  <ol className="space-y-3">
                    {view.timeline.map((item) => (
                      <li key={item.id} className="text-sm">
                        <span className="text-gray-400 dark:text-gray-400">{formatDate(item.occurredAt)}</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-900">
                          {item.stage ? `${item.stage} ` : ''}
                          {item.type === 'stage_approved' && item.mode === 'deemed' ? '승인 (기한 경과)' : item.label.replace(/ \(의뢰인 대신 기록\)$/, '')}
                        </span>
                        {item.amount !== null && <span className="text-gray-600 dark:text-gray-600"> · {formatCurrency(item.amount)}원</span>}
                        {item.note && <p className="mt-1 whitespace-pre-line text-gray-600 dark:text-gray-600">{item.note}</p>}
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noreferrer noopener" className="text-primary underline">
                            파일 열기
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}

          {/* 문서 이동으로 나간다 — 토큰이 실린 주소가 측정 스크립트에 남지 않게(lib/analytics/privatePaths.ts). */}
          <Button asChild light size="lg" variant="weak" fullWidth>
            <a href={`/${locale}`} rel="noreferrer">
              스튜디오 홈으로
            </a>
          </Button>
        </div>
      </main>
    </>
  );
}

// 디자인 판 — lib/designEdition.ts
ProductionProgressPage.designEdition = 'v2';
