import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import ContractNotice from '../../../../../components/contracts/ContractNotice';
import { Button } from '../../../../../components/ui/Button';
import { TextInput } from '../../../../../components/ui/Field';
import { Notice } from '../../../../../components/ui/Notice';
import { formatCurrency, formatDate } from '../../../../../lib/contracts/format';
import { IDENTITY_DIGITS } from '../../../../../lib/contracts/identity';
import { denyContractPageCaching } from '../../../../../lib/contracts/page-cache';
import { productionCompletePath, productionSignPath } from '../../../../../lib/contracts/production/links';
import { hasPortalAccess } from '../../../../../lib/contracts/production/portal-session';
import { ensureContractPaymentLink } from '../../../../../lib/contracts/production/payment-link';
import { loadProgressContext } from '../../../../../lib/contracts/production/progress';
import { buildClientProgressView, type ProgressView, type StageView } from '../../../../../lib/contracts/production/progress-view';
import { hasSignedDocument } from '../../../../../lib/contracts/production/status';
import { depositWordFor, isMixMasterKind, releaseTitle, sourceLabelFor } from '../../../../../lib/contracts/production/terms';
import { withI18nServerProps } from '../../../../../lib/getStatic';
import { loadRefundAccountSummary } from '../../../../../lib/payments/refundAccount';

interface ProgressPageProps {
  locale: string;
  token: string;
  contractId: string;
  clientName: string;
  releaseLabel: string | null;
  /** 머리 줄의 서비스 이름 — "음원 제작" 또는 "믹싱·마스터링". */
  serviceLabel: string;
  /** 의뢰인이 처음 보내는 자료 — "1차 완성본" 또는 "작업 파일"(sourceLabelFor). */
  sourceLabel: string;
  /** "계약금" 또는(50만원 이하 일시불) "대금". */
  depositWord: string;
  /** 지금 받을 돈의 결제 페이지(payment-link.ts). 없으면 버튼이 없다. 확인 전(locked)에는 싣지 않는다. */
  payment: { url: string; amount: number; label: string } | null;
  /** 링크 계약으로 서명했는가(연락처 대조 없음) — 본인 확인 안내를 "서명할 때 적으신 번호"로 바꾼다(complete.tsx와 같다). */
  openLinkSigned: boolean;
  /** 잔금 기한(마지막 마스터 승인일부터 며칠) — 마지막 단계 승인 확인 문구에 쓴다. */
  balanceDueDays: number;
  /** 연락처 뒷자리를 아직 확인하지 않았다 — 진행 내용을 싣지 않는다. */
  locked: boolean;
  /** 진행이 끝난 계약 — 승인·수정 버튼이 없다. */
  closed: boolean;
  view: ProgressView | null;
  /**
   * 해지된 계약의 환불(제10조 정산). 돌려받을 금액과, 이미 적은 계좌의 은행·예금주(계좌번호는 싣지 않는다 —
   * lib/crypto/CLAUDE.md). 해지가 아니면 null.
   */
  refund: { refundable: number; account: { bankName: string; accountHolder: string; refunded: boolean } | null } | null;
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
    releaseLabel: null,
    serviceLabel: '음원 제작',
    sourceLabel: '1차 완성본',
    depositWord: '계약금',
    openLinkSigned: false,
    balanceDueDays: 7,
    payment: null,
    locked: true,
    closed: false,
    view: null,
    refund: null,
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
    let refund: ProgressPageProps['refund'] = null;
    if (!locked && progress.contract.status === 'terminated') {
      const summary = await loadRefundAccountSummary({ kind: 'production', orderNo: id });
      refund = {
        refundable: progress.ledger.refund.refundable,
        account:
          summary.status === 'present'
            ? { bankName: summary.bankName, accountHolder: summary.accountHolder, refunded: summary.refundedAt !== null }
            : null,
      };
    }
    return {
      props: {
        ...empty,
        clientName: progress.contract.clientName,
        releaseLabel: releaseTitle(progress.contract.kind, progress.terms),
        serviceLabel: isMixMasterKind(progress.contract.kind) ? '믹싱·마스터링' : '음원 제작',
        sourceLabel: sourceLabelFor(progress.contract.kind),
        depositWord: depositWordFor(progress.terms),
        openLinkSigned: client.identityVerifiedAt === null,
        balanceDueDays: progress.terms.amount.balanceDueDays,
        locked,
        closed: progress.contract.status !== 'signed',
        view: locked ? null : buildClientProgressView(progress.terms, progress.ledger),
        payment: await (async () => {
          if (locked || progress.contract.status !== 'signed') return null;
          const link = await ensureContractPaymentLink(progress.contract.id);
          return link ? { url: link.url, amount: link.amount, label: link.purpose === 'deposit' ? depositWordFor(progress.terms) : '잔금' } : null;
        })(),
        refund,
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

/** 수정 요청 기한이 지나 자동으로 승인된 것 — 계약서 제5조 5항을 모르는 사람도 읽히게 풀어 쓴다. */
const DEEMED_APPROVED_LABEL = '수정 요청 기한이 지나 승인됨';

const stageStatus = (stage: StageView): string => {
  if (stage.approved) return stage.approved.mode === 'deemed' ? DEEMED_APPROVED_LABEL : '승인됨';
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
  finalNote,
  onDone,
}: {
  stage: StageView;
  contractId: string;
  token: string;
  closed: boolean;
  extraFee: number;
  /** 마지막 단계(마스터링) 승인이 부르는 일 — 남은 대금과 기한. 승인 확인 상자에 보인다. */
  finalNote: string | null;
  onDone: (message: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'revision'>('idle');
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
      // 메모는 수정 요청에만 — 쓰다 취소한 수정 요청 글이 승인 기록에 남지 않게.
      ...(action === 'revision' ? { note, acceptFee } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? '처리하지 못했어요.');
      return;
    }
    // 보낸 요청이 남지 않게 닫는다(수정 요청 글은 보냈으니 비운다). 성공 안내는 화면 위쪽에 한 번 띄운다 — 이 카드는 답할 일이
    // 없어지면 같이 사라지기 때문이다.
    setMode('idle');
    if (action === 'revision') {
      setNote('');
      setAcceptFee(false);
    }
    await onDone(action === 'approve' ? `「${stage.label}」 단계를 승인했어요.` : `「${stage.label}」 수정 요청을 보냈어요. 스튜디오가 확인하는 대로 반영해 드려요.`);
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
            {formatDate(stage.pending.deliveredAt)}에 결과물을 보내 드렸어요.
            {/* 통지가 아직 안 나간 전달은 기한이 성립하지 않는다(통지가 나가는 날부터 다시 정해진다). */}
            {!closed && stage.pending.noticeSent && (
              <>
                {' '}
                <strong>{formatDate(stage.pending.lastDayToRespond)}까지</strong> 수정 요청이 없으면 승인된 것으로 봐요(계약서 제5조 5항).
              </>
            )}
          </p>
          {stage.pending.link && (
            <a href={stage.pending.link} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-primary underline">
              결과물 듣기
            </a>
          )}

          {!closed && mode === 'idle' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button light disabled={busy} onClick={() => setMode('approve')}>
                이대로 승인해요
              </Button>
              <Button light variant="weak" disabled={busy} onClick={() => setMode('revision')}>
                수정을 요청해요
              </Button>
            </div>
          )}

          {/* 승인은 되돌릴 수 없다 — 한 번 더 확인받는다(window.confirm 대신 화면 안에서). */}
          {!closed && mode === 'approve' && (
            <Notice
              tone="warning"
              light
              className="mt-4"
              title="이대로 승인할까요?"
              actions={
                <>
                  <Button light disabled={busy} onClick={() => submit('approve')}>
                    {busy ? '처리 중…' : '네, 승인할게요'}
                  </Button>
                  <Button light variant="weak" disabled={busy} onClick={() => setMode('idle')}>
                    취소
                  </Button>
                </>
              }
            >
              <span className="block">승인하면 이 단계는 더 수정 요청할 수 없어요.</span>
              {finalNote && <span className="block mt-1">{finalNote}</span>}
            </Notice>
          )}

          {!closed && mode === 'revision' && (
            <div className="mt-4 space-y-3">
              <label htmlFor={`note-${stage.stage}-${stage.song ?? "album"}`} className="block text-sm text-gray-700 dark:text-gray-700">
                수정할 내용을 한 번에 정리해 적어 주세요. 한 번 보낸 요청이 1회로 계산돼요(계약서 제5조 2항).
              </label>
              <textarea
                id={`note-${stage.stage}-${stage.song ?? "album"}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                maxLength={1000}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-300 bg-white dark:bg-white p-3 text-sm text-gray-900 dark:text-gray-900"
              />
              {needsFee && (
                <label className="flex items-start gap-3 rounded-xl bg-white p-4 text-sm text-gray-700 cursor-pointer dark:bg-white dark:text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/70 focus-visible:ring-offset-white"
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
                <Button
                  light
                  variant="weak"
                  disabled={busy}
                  // 닫기만 한다 — 길게 적은 수정 내용을 지우지 않는다(다시 열면 그대로 있다).
                  onClick={() => setMode('idle')}
                >
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

function RefundSection({
  contractId,
  token,
  refund,
  onDone,
}: {
  contractId: string;
  token: string;
  refund: NonNullable<ProgressPageProps['refund']>;
  onDone: () => Promise<void>;
}) {
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await post(contractId, { action: 'refund-account', token, bankName, accountNumber, accountHolder });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? '접수하지 못했어요.');
      return;
    }
    await onDone();
  };

  return (
    <section className="bg-white dark:bg-white rounded-2xl shadow-sm p-6 md:p-8">
      <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-2">환불</h2>
      <p className="text-sm text-gray-700 dark:text-gray-700">
        {refund.refundable > 0 ? (
          <>
            계약이 해지되어, 진행한 작업분을 정산하고 남은 <strong>{formatCurrency(refund.refundable)}원</strong>을 돌려드려요(계약서 제10조).
          </>
        ) : (
          '계약이 해지되었고, 진행한 작업분을 정산한 결과 돌려드릴 금액은 없어요(계약서 제10조).'
        )}
      </p>
      {refund.refundable <= 0 ? null : refund.account ? (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-600">
          {refund.account.refunded
            ? `${refund.account.bankName} (예금주 ${refund.account.accountHolder}) 계좌로 보내 드렸어요.`
            : `${refund.account.bankName} (예금주 ${refund.account.accountHolder}) 계좌를 받았어요. 확인 후 보내 드릴게요.`}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {(
            [
              ['refund-bank', '은행', bankName, setBankName, '예: 카카오뱅크'],
              ['refund-account', '계좌번호', accountNumber, setAccountNumber, '숫자와 하이픈(-)'],
              ['refund-holder', '예금주', accountHolder, setAccountHolder, ''],
            ] as const
          ).map(([inputId, label, value, setter, placeholder]) => (
            <div key={inputId}>
              <label htmlFor={inputId} className="block text-sm text-gray-700 dark:text-gray-700 mb-1">
                {label}
              </label>
              <TextInput id={inputId} light value={value} placeholder={placeholder} autoComplete="off" onChange={(e) => setter(e.target.value)} />
            </div>
          ))}
          <Button light disabled={busy || !bankName || !accountNumber || !accountHolder} onClick={submit}>
            {busy ? '접수 중…' : '환불 계좌 보내기'}
          </Button>
          {error && (
            <Notice tone="error" light>
              {error}
            </Notice>
          )}
        </div>
      )}
    </section>
  );
}

export default function ProductionProgressPage({
  locale,
  token,
  contractId,
  clientName,
  releaseLabel,
  serviceLabel,
  sourceLabel,
  depositWord,
  openLinkSigned,
  balanceDueDays,
  payment,
  locked,
  closed,
  view,
  refund,
  unavailable,
}: ProgressPageProps) {
  const router = useRouter();
  // 승인·수정 요청을 보낸 직후 한 번 띄우는 성공 안내. 카드는 답할 일이 없어지면 사라지므로 페이지가 들고 있는다.
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [flash]);
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
    setFlash(null);
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

      <main className="min-h-screen bg-gray-50 dark:bg-gray-50 [color-scheme:light] py-8 md:py-12">
        <div className="max-w-2xl mx-auto px-4 space-y-6">
          <div className="bg-white dark:bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <p className="text-sm font-medium text-gray-400 dark:text-gray-400">스튜디오 놀 · {serviceLabel}</p>
            <h1 className="typo-page-title text-gray-900 dark:text-gray-900 mt-1">{releaseLabel ?? '작업 진행'}</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-600">{clientName}님의 작업 진행 상황이에요.</p>
            {/* 같은 비공개 경로 안의 이동이라도 문서 이동으로 간다(complete.tsx의 진행 링크와 같은 이유). */}
            <a
              href={productionCompletePath(contractId, token, locale)}
              rel="noreferrer"
              className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-primary underline underline-offset-2"
            >
              계약서 보기·내려받기
            </a>
          </div>

          {locked || !view ? (
            <form
              className="bg-white dark:bg-white rounded-2xl shadow-sm p-6 md:p-8"
              onSubmit={(event) => {
                event.preventDefault();
                if (!busy && digits.length === IDENTITY_DIGITS) void unlock();
              }}
            >
              <label htmlFor="progress-digits" className="block text-sm text-gray-700 dark:text-gray-700 mb-3">
                발매 전 음원이 있는 페이지라 본인 확인이 필요해요.{' '}
                {openLinkSigned ? '서명할 때 적으신 휴대폰 번호' : '계약서에 등록된 연락처'} 뒤 {IDENTITY_DIGITS}자리를 입력해 주세요.
              </label>
              <TextInput
                id="progress-digits"
                inputMode="numeric"
                autoComplete="off"
                maxLength={IDENTITY_DIGITS}
                value={digits}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                aria-describedby={unlockError ? 'progress-digits-error' : undefined}
                aria-invalid={unlockError ? true : undefined}
                invalid={Boolean(unlockError)}
                light
                className="mb-4 px-4 py-3 text-center text-lg tracking-[0.5em]"
              />
              <Button type="submit" light size="lg" fullWidth disabled={busy || digits.length !== IDENTITY_DIGITS}>
                {busy ? '확인 중…' : '진행 상황 보기'}
              </Button>
              {unlockError && (
                <Notice id="progress-digits-error" tone="error" light className="mt-3">
                  {unlockError}
                </Notice>
              )}
            </form>
          ) : (
            <>
              {refund && <RefundSection contractId={contractId} token={token} refund={refund} onDone={reload} />}

              {flash && (
                <Notice tone="success" light>
                  {flash}
                </Notice>
              )}

              <section className="bg-white dark:bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-4">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900">단계별 확인</h2>
                {closed && (
                  <p className="text-sm text-gray-600 dark:text-gray-600">이 계약은 마무리됐어요. 아래는 지금까지의 기록이에요.</p>
                )}
                {view.stages.map((stage) => (
                  <StageCard
                    key={`${stage.stage}-${stage.song ?? "album"}`}
                    stage={stage}
                    contractId={contractId}
                    token={token}
                    closed={closed}
                    extraFee={view.extraRevisionFee[stage.stage]}
                    finalNote={
                      stage.stage === 'mastering' && view.payments.remaining > 0
                        ? `마스터링을 승인하면 남은 대금 ${formatCurrency(view.payments.remaining)}원을 승인한 날부터 ${balanceDueDays}일 안에 보내 주셔야 해요. 입금을 확인한 뒤 최종 파일을 드려요.`
                        : null
                    }
                    onDone={async (message) => {
                      await reload();
                      setFlash(message);
                    }}
                  />
                ))}
              </section>

              <section className="bg-white dark:bg-white rounded-2xl shadow-sm p-6 md:p-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-4">대금과 일정</h2>
                <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <dt className="text-gray-500 dark:text-gray-500">받은 금액</dt>
                  <dd className="text-right font-medium text-gray-900 dark:text-gray-900">{formatCurrency(view.payments.received)}원</dd>
                  {!closed && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-500">남은 금액</dt>
                      <dd className="text-right font-medium text-gray-900 dark:text-gray-900">{formatCurrency(view.payments.remaining)}원</dd>
                    </>
                  )}
                  {!closed && !view.payments.depositMetAt && view.payments.depositLastDay && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-500">{depositWord} 기한</dt>
                      <dd className="text-right font-medium text-gray-900 dark:text-gray-900">{formatDate(view.payments.depositLastDay)}</dd>
                    </>
                  )}
                  {!closed && !view.payments.paidInFull && view.payments.balanceLastDay && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-500">잔금 기한</dt>
                      <dd className="text-right font-medium text-gray-900 dark:text-gray-900">{formatDate(view.payments.balanceLastDay)}</dd>
                    </>
                  )}
                  {!closed && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-500">납품 기한</dt>
                      <dd className="text-right font-medium text-gray-900 dark:text-gray-900">
                        {view.work.dueOn
                          ? `${formatDate(view.work.dueOn)}까지`
                          : view.payments.deposit === 0
                            ? `${sourceLabel}을 받은 뒤 정해져요`
                            : `${depositWord}·${sourceLabel}을 받은 뒤 정해져요`}
                      </dd>
                    </>
                  )}
                </dl>
                {!closed && payment && (
                  <Button asChild className="mt-5 w-full">
                    {/* 카드·간편결제·계좌 입금 — 결제되면 이 기록에 입금이 자동으로 남는다(payment-link.ts). */}
                    <a href={payment.url}>
                      {payment.label} {formatCurrency(payment.amount)}원 결제하기
                    </a>
                  </Button>
                )}
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
                          {item.type === 'stage_approved' && item.mode === 'deemed' ? DEEMED_APPROVED_LABEL : item.label.replace(/ \(의뢰인 대신 기록\)$/, '')}
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
