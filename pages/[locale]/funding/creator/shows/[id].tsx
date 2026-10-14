import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { REVIEW_STATUS_LABEL } from '../../../../../components/funding/creator/types';
import {
  ShowDraftForm, toDraftPayload, toEditorDraft, type EditorShowDraft,
} from '../../../../../components/shows/organizer/ShowDraftForm';
import { saveShowDraft, submitShowSubmission, withdrawShowSubmission } from '../../../../../components/shows/organizer/api';
import { Badge, type BadgeTone } from '../../../../../components/ui/Badge';
import { Button } from '../../../../../components/ui/Button';
import { Checkbox } from '../../../../../components/ui/Checkbox';
import { Notice } from '../../../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../../../components/ui/PageHeader';
import { Panel } from '../../../../../components/ui/Panel';
import { authenticateCreatorRequest } from '../../../../../lib/funding/creatorAuth';
import { withI18nServerProps } from '../../../../../lib/getStatic';
import type { ShowSubmissionDraft } from '../../../../../lib/shows/organizer/draft';
import { loadSubmissionForCreator } from '../../../../../lib/shows/organizer/submissions';
import { beforePopStateForScroll } from '../../../../../lib/routeScroll';

/** 화면이 쓰는 신청서 — `SubmissionView`에서 `submittedAt`(Date, 직렬화 불가)을 뺀 것. */
export interface EditorShowSubmission {
  id: string;
  reviewStatus: string;
  reviewNote: string | null;
  draft: ShowSubmissionDraft;
  showSlug: string | null;
}

interface Props {
  submission: EditorShowSubmission;
}

/** 심사 상태 → 배지 색. 펀딩 편집 화면(`../[id].tsx`)과 같은 표 — 페이지 모듈끼리 import하지 않으므로 복제. */
const REVIEW_STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral', submitted: 'info', changes_requested: 'warning', approved: 'success', rejected: 'error',
};

const STATUS_NOTICE: Record<string, string> = {
  submitted: '심사 중이에요. 심사가 끝날 때까지는 고칠 수 없어요. 고치고 싶으면 맨 아래에서 제출을 철회해 주세요.',
  approved: '공개된 공연이에요. 제목·부제·주최 이름·소개·포스터·출연진은 지금도 고칠 수 있고, 저장하면 공개 페이지에도 반영돼요. 회차·정원·티켓·장소·공연 시간·관람 등급은 바꿀 수 없어요.',
  rejected: '이 신청서는 종결되어 더 고칠 수 없어요. 사유는 위 운영자 메모를 확인해 주세요. 다시 등록하려면 새 공연을 만들어 주세요.',
};

const UNSAVED_CHANGES_MESSAGE = '저장하지 않은 변경이 있어요. 지금 나가면 그 내용이 사라져요. 계속할까요?';

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'success'; message: string } | { kind: 'error'; message: string; problems?: string[] };
const IDLE: Status = { kind: 'idle' };

export default function ShowSubmissionEditor({ submission }: Props) {
  const router = useRouter();
  const [reviewStatus, setReviewStatus] = useState(submission.reviewStatus);
  const [draft, setDraft] = useState<EditorShowDraft>(() => toEditorDraft(submission.draft));
  // 저장된 값과의 비교는 서버로 보내는 모양(toDraftPayload)으로 한다 — 화면 전용 key·빈 회차 줄은 변경이 아니다.
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(toDraftPayload(toEditorDraft(submission.draft))));
  const [save, setSave] = useState<Status>(IDLE);
  const [submit, setSubmit] = useState<Status>(IDLE);
  const [withdraw, setWithdraw] = useState<Status>(IDLE);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const editable = reviewStatus === 'draft' || reviewStatus === 'changes_requested' || reviewStatus === 'approved';
  const canSubmit = reviewStatus === 'draft' || reviewStatus === 'changes_requested';
  const dirty = editable && JSON.stringify(toDraftPayload(draft)) !== savedJson;
  const busy = save.kind === 'busy' || submit.kind === 'busy' || withdraw.kind === 'busy';
  const notice = STATUS_NOTICE[reviewStatus];

  // 이탈 경고 — 펀딩 개설자 편집 화면(`../[id].tsx`)과 같은 세 겹(새로고침·앱 내 이동·뒤로가기). 이유는 그 파일 주석.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      if (!dirty || url === router.asPath) return;
      // eslint-disable-next-line no-alert
      if (window.confirm(UNSAVED_CHANGES_MESSAGE)) return;
      router.events.emit('routeChangeError');
      // eslint-disable-next-line no-throw-literal
      throw 'routeChange aborted (저장하지 않은 변경 확인 취소)';
    };
    router.events.on('routeChangeStart', handleRouteChangeStart);
    return () => router.events.off('routeChangeStart', handleRouteChangeStart);
  }, [dirty, router]);

  useEffect(() => {
    router.beforePopState((state) => {
      if (!dirty) return beforePopStateForScroll(state);
      // eslint-disable-next-line no-alert
      if (window.confirm(UNSAVED_CHANGES_MESSAGE)) return beforePopStateForScroll(state);
      window.history.forward();
      return false;
    });
    return () => {
      router.beforePopState(beforePopStateForScroll);
    };
  }, [dirty, router]);

  const onChange = (fn: (prev: EditorShowDraft) => EditorShowDraft) => {
    setDraft(fn);
    // 저장·제출 결과 표시는 그때의 입력에 대한 것이다 — 입력이 바뀌면 낡은 안내가 된다.
    setSave((s) => (s.kind === 'idle' ? s : IDLE));
    setSubmit((s) => (s.kind === 'idle' ? s : IDLE));
  };

  /** 지금 입력을 저장한다. 성공하면 true. */
  const persist = async (): Promise<{ ok: true; warnings?: string[] } | { ok: false; message: string; problems?: string[] }> => {
    const sent = toDraftPayload(draft);
    const result = await saveShowDraft(submission.id, sent);
    if (result.ok) setSavedJson(JSON.stringify(sent));
    return result;
  };

  const handleSave = async () => {
    setSave({ kind: 'busy' });
    const result = await persist();
    if (result.ok) {
      setSave({ kind: 'success', message: result.warnings?.[0] ?? '저장했어요.' });
    } else {
      setSave({ kind: 'error', message: result.message, problems: result.problems });
    }
  };

  // 제출 API는 **저장된** 초안을 검사한다 — 화면의 입력을 먼저 저장하고 제출한다.
  const handleSubmit = async () => {
    setSubmit({ kind: 'busy' });
    setSave(IDLE);
    if (dirty) {
      const saved = await persist();
      if (!saved.ok) {
        setSubmit({ kind: 'error', message: saved.message, problems: saved.problems });
        return;
      }
    }
    const result = await submitShowSubmission(submission.id, agreedTerms);
    if (result.ok) {
      setReviewStatus('submitted');
      setWithdraw(IDLE);
      setSubmit({ kind: 'success', message: result.warnings?.[0] ?? '제출했어요. 심사 결과는 메일로 알려 드려요.' });
    } else {
      setSubmit({ kind: 'error', message: result.message, problems: result.problems });
    }
  };

  const handleWithdraw = async () => {
    setWithdraw({ kind: 'busy' });
    const result = await withdrawShowSubmission(submission.id);
    if (result.ok) {
      setReviewStatus('draft');
      setSubmit(IDLE);
      setAgreedTerms(false);
      setWithdraw({ kind: 'success', message: '제출을 철회했어요. 고친 뒤 다시 제출해 주세요.' });
    } else {
      setWithdraw({ kind: 'error', message: result.message });
    }
  };

  const problemsNotice = (s: Status) =>
    s.kind === 'error' && s.problems && s.problems.length > 0 ? (
      <Notice tone="warning" className="mt-4" title={s.message}>
        <ul className="list-disc space-y-1 pl-5">
          {s.problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </Notice>
    ) : null;

  const plainError = (s: Status) =>
    s.kind === 'error' && !(s.problems && s.problems.length > 0) ? (
      <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{s.message}</span>
    ) : null;

  return (
    <>
      <Head>
        <title>{`${draft.title || '공연 등록'} | 스튜디오 놀`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="wide">
        <PageHeader
          backHref="/ko/funding/creator/shows"
          backLabel="내 공연"
          title={draft.title || '(제목 없음)'}
          meta={
            <Badge tone={REVIEW_STATUS_TONE[reviewStatus] ?? 'neutral'} size="md">
              {REVIEW_STATUS_LABEL[reviewStatus] ?? reviewStatus}
            </Badge>
          }
          className="mb-3"
        />

        {/* review_note는 주최자에게 보이는 칸이다(운영자 내부 메모와 다른 칸). */}
        {submission.reviewNote && (
          <Notice tone="warning" className="mt-3" title="운영자 메모">{submission.reviewNote}</Notice>
        )}
        {notice && <Panel className="mt-3 text-sm">{notice}</Panel>}
        {reviewStatus === 'approved' && submission.showSlug && (
          <Link
            href={`/ko/shows/${encodeURIComponent(submission.showSlug)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block typo-caption text-primary underline underline-offset-2 dark:text-primary-lighter"
          >
            공개된 페이지 보기
          </Link>
        )}

        <div className="mt-10">
          <ShowDraftForm
            submissionId={submission.id}
            value={draft}
            onChange={onChange}
            readOnly={!editable}
            locked={reviewStatus === 'approved'}
          />
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 dark:border-gray-700">
          {editable && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant={canSubmit ? 'weak' : 'solid'} onClick={handleSave} disabled={busy || !dirty}>
                  {save.kind === 'busy' ? '저장 중…' : '임시 저장'}
                </Button>
                {save.kind === 'success' && <span className="typo-caption text-green-600 dark:text-green-400">{save.message}</span>}
                {plainError(save)}
              </div>
              {problemsNotice(save)}
            </>
          )}

          {canSubmit && (
            <div className="mt-8">
              <Checkbox
                className="mb-4"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                label={
                  <>
                    <Link href="/ko/shows/organizer-terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      주최자 약관
                    </Link>
                    에 동의해요.
                  </>
                }
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={handleSubmit} disabled={busy || !agreedTerms}>
                  {submit.kind === 'busy' ? '제출 중…' : '제출하기'}
                </Button>
                {plainError(submit)}
              </div>
              {problemsNotice(submit)}
            </div>
          )}
          {submit.kind === 'success' && (
            <p className="typo-caption text-green-600 dark:text-green-400">{submit.message}</p>
          )}

          {/* 철회 성공 순간 상태가 draft로 바뀌므로, 성공 문구는 상태와 무관하게 남긴다(펀딩 편집 화면과 같다). */}
          {(reviewStatus === 'submitted' || withdraw.kind === 'success') && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {reviewStatus === 'submitted' && (
                <Button type="button" variant="weak" onClick={handleWithdraw} disabled={busy}>
                  {withdraw.kind === 'busy' ? '철회 중…' : '제출 철회'}
                </Button>
              )}
              {withdraw.kind === 'success' && (
                <span className="typo-caption text-green-600 dark:text-green-400">{withdraw.message}</span>
              )}
              {plainError(withdraw)}
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}

// 주석을 달지 않는다 — withI18nServerProps는 Props에 locale·i18nResources를 더한 타입을 돌려준다.
export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  // 주최자 화면은 한국어만 쓴다 — 비-ko 경로는 같은 화면을 ko로 되돌린다(펀딩 편집 화면과 같다).
  if (context.params?.locale !== 'ko') {
    return { redirect: { destination: `/ko/funding/creator/shows/${encodeURIComponent(id)}`, permanent: false } };
  }
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };
  if (!id) return { notFound: true };

  const view = await loadSubmissionForCreator(auth.creatorId, id);
  if (!view) return { notFound: true };
  return {
    props: {
      submission: {
        id: view.id,
        reviewStatus: view.reviewStatus,
        reviewNote: view.reviewNote,
        draft: view.draft,
        showSlug: view.showSlug,
      },
    },
  };
});

// 디자인 판 — lib/designEdition.ts
ShowSubmissionEditor.designEdition = 'v2';
