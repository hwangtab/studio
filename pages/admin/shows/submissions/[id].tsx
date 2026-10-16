import React, { useEffect, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { AdminShell } from '../../../../components/admin/AdminShell';
import { CreatorAccountEditor } from '../../../../components/admin/CreatorAccountEditor';
import { CreatorTaxProfilePanel } from '../../../../components/admin/CreatorTaxProfilePanel';
import { patchShowSubmission, type ShowSubmissionActionResult } from '../../../../components/admin/showSubmissionActions';
import { Button } from '../../../../components/ui/Button';
import { Notice } from '../../../../components/ui/Notice';
import { TextArea, TextInput } from '../../../../components/ui/Field';
import { formatPriceAmount } from '../../../../data/pricing';
import { logAdminView } from '../../../../lib/privacy/adminView';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { formatKstDateTimeFull } from '../../../../lib/booking/format';
import { loadSubmissionForAdmin, type AdminSubmissionDetail } from '../../../../lib/shows/organizer/adminSubmissions';

interface AdminShowSubmissionDetailPageProps {
  submission: AdminSubmissionDetail;
}

export const getServerSideProps: GetServerSideProps<AdminShowSubmissionDetailPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  const submission = id ? await loadSubmissionForAdmin(id) : null;
  // 열람 기록 — 주최자 연락처가 props로 실린다(처리방침 19항).
  if (id) await logAdminView(context, auth.actor, 'show_submission_view', id, submission ? 'success' : 'not_found');
  if (!submission) return { notFound: true };
  return { props: { submission } };
};

const STATUS_LABELS: Record<string, string> = {
  draft: '작성중',
  submitted: '심사대기',
  changes_requested: '보완요청',
  approved: '승인',
  rejected: '반려',
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="font-medium text-right whitespace-pre-wrap break-words min-w-0">{children}</dd>
  </div>
);

export default function AdminShowSubmissionDetailPage({ submission }: AdminShowSubmissionDetailPageProps) {
  const router = useRouter();
  const { draft } = submission;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [slug, setSlug] = useState('');
  const [internalNote, setInternalNote] = useState(submission.internalNote ?? '');

  useEffect(() => setInternalNote(submission.internalNote ?? ''), [submission.internalNote]);

  // 판정 버튼이 본문 아래에 있어, 결과 배너로 스크롤·포커스를 옮겨야 운영자가 경고를 놓치지 않는다.
  const feedbackRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if ((notice || success || warnings.length > 0) && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ block: 'start' });
      feedbackRef.current.focus();
    }
  }, [notice, success, warnings]);

  const expectedSubmittedAt = submission.submittedAt ?? '';

  const run = async (task: () => Promise<ShowSubmissionActionResult>, successMessage: (r: ShowSubmissionActionResult) => string) => {
    setBusy(true);
    setNotice(null);
    setSuccess(null);
    setWarnings([]);
    const result = await task();
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message ?? '요청을 처리하지 못했습니다.');
    } else {
      setSuccess(successMessage(result));
      if (result.warnings && result.warnings.length > 0) setWarnings(result.warnings);
    }
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const slugInput = slug.trim();

  const handleApprove = () => {
    if (!slugInput) {
      setNotice('공개 주소(slug)를 적어 주세요.');
      return;
    }
    if (
      !window.confirm(
        `승인하면 이 공연이 /ko/shows/${slugInput} 주소로 바로 공개되고, 판매가 시작됩니다. 회차 일시·정원·티켓 가격·장소·공연 시간·관람 등급·주소는 승인 뒤 바꿀 수 없습니다. 승인할까요?`,
      )
    ) {
      return;
    }
    return run(
      () => patchShowSubmission(submission.id, { action: 'approve', slug: slugInput, expectedSubmittedAt }),
      (r) => `/ko/shows/${r.slug ?? slugInput} 주소로 승인하고 공개했습니다.`,
    );
  };

  const handleRequestChanges = () => {
    const reason = window.prompt('주최자에게 보낼 보완 요청 사유를 적어 주세요.');
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('보완 요청은 사유가 있어야 합니다.');
      return;
    }
    return run(
      () => patchShowSubmission(submission.id, { action: 'request_changes', note: reason.trim(), expectedSubmittedAt }),
      () => '보완 요청을 보냈습니다.',
    );
  };

  const handleReject = () => {
    const reason = window.prompt('반려 사유를 적어 주세요 (주최자에게 전달됩니다).');
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('반려는 사유가 있어야 합니다.');
      return;
    }
    if (!window.confirm('반려하면 주최자에게 반려 사실과 사유가 메일로 전달됩니다. 반려할까요?')) return;
    return run(
      () => patchShowSubmission(submission.id, { action: 'reject', note: reason.trim(), expectedSubmittedAt }),
      () => '반려 처리했습니다.',
    );
  };

  const handleSaveInternalNote = () =>
    run(
      () => patchShowSubmission(submission.id, { action: 'set_internal_note', note: internalNote.trim() || undefined }),
      () => '메모를 저장했습니다.',
    );

  const canDecide = submission.reviewStatus === 'submitted';

  return (
    <>
      <Head>
        <title>{draft.title || '공연'} 심사 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="공연 심사"
        description={`${draft.title || '(제목 없음)'} · ${STATUS_LABELS[submission.reviewStatus] ?? submission.reviewStatus}`}
        backHref="/admin/shows/submissions"
        backLabel="심사 목록"
      >
        <div ref={feedbackRef} tabIndex={-1} className="outline-none space-y-3 mb-4 empty:mb-0">
          {notice && <Notice tone="error" light>{notice}</Notice>}
          {success && <Notice tone="success" light>{success}</Notice>}
          {warnings.length > 0 && (
            <Notice tone="warning" light title="판정은 처리됐지만 후속 처리에 문제가 있었습니다">
              <ul className="list-disc list-inside space-y-1">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Notice>
          )}
        </div>

        {submission.show && (
          <Notice
            tone="info"
            light
            className="mb-4"
            title="공개된 공연"
            actions={
              <>
                <Link href={`/ko/shows/${submission.show.slug}`} target="_blank" rel="noopener noreferrer">
                  /ko/shows/{submission.show.slug}
                </Link>
                <Link href={`/admin/shows/${submission.show.id}`}>공연 운영 화면</Link>
              </>
            }
          />
        )}

        {submission.organizerEditedAt && (
          <Notice tone="warning" light className="mb-4">
            승인 뒤 주최자가 수정했습니다 — 마지막 수정 {formatKstDateTimeFull(submission.organizerEditedAt)}
          </Notice>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8 space-y-8">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">공연 내용</h2>
            {draft.posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- 관리자 심사 화면, next/image 최적화 불필요
              <img src={draft.posterUrl} alt="포스터" className="w-full max-w-xs rounded-xl mb-4 border border-gray-200" />
            )}
            <dl className="space-y-2 text-sm mb-4">
              <Row label="제목">{draft.title}</Row>
              <Row label="부제">{draft.subtitle || '없음'}</Row>
              <Row label="주최">{draft.presenterName}</Row>
              <Row label="관람 등급">{draft.ageRating}</Row>
              <Row label="공연 시간">{draft.runningMinutes !== null ? `${draft.runningMinutes}분` : '없음'}</Row>
              <Row label="장소">{draft.venueName}</Row>
              <Row label="주소">{draft.venueAddress}</Row>
              <Row label="일정 안내">{draft.scheduleNote || '없음'}</Row>
              <Row label="정원">{draft.capacity !== null ? `${draft.capacity}명` : '없음'}</Row>
            </dl>
            <h3 className="text-sm font-bold text-gray-900 mb-1">소개</h3>
            <div className="p-4 bg-gray-50 rounded-xl text-sm whitespace-pre-wrap">{draft.description}</div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">회차</h2>
            {draft.showtimes.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 회차가 없습니다.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {[...draft.showtimes].sort().map((t) => (
                  <li key={t}>{t.replace('T', ' ')}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">티켓 종류</h2>
            <ul className="space-y-1 text-sm">
              {draft.ticketTypes.map((t, i) => (
                <li key={i}>
                  {t.name} · {t.price !== null ? `${formatPriceAmount(t.price)}원` : '가격 없음'}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">출연진</h2>
            {draft.performers.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 출연진이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {draft.performers.map((p, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-gray-50 rounded-xl text-sm">
                    {p.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- 관리자 심사 화면, next/image 최적화 불필요
                      <img src={p.photoUrl} alt={p.name} className="w-20 h-20 rounded-lg object-cover shrink-0 border border-gray-200" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <p className="text-gray-600 whitespace-pre-wrap">{p.bio}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">안내 사항</h2>
            {draft.notices.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 안내가 없습니다.</p>
            ) : (
              <ul className="list-disc list-inside space-y-1 text-sm">
                {draft.notices.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">주최자</h2>
            <dl className="space-y-2 text-sm">
              <Row label="이름">{submission.creatorName}</Row>
              <Row label="이메일">{submission.creatorEmail}</Row>
              <Row label="계정 수정"><CreatorAccountEditor creatorId={submission.creatorId} name={submission.creatorName} email={submission.creatorEmail} /></Row>
              <Row label="제출 시각">{submission.submittedAt ? formatKstDateTimeFull(submission.submittedAt) : '미제출'}</Row>
              <Row label="동의한 약관">{submission.organizerTermsVersion ?? '없음'}</Row>
            </dl>
          </div>

          <CreatorTaxProfilePanel creatorId={submission.creatorId} />

          {submission.reviewNote && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3">주최자에게 보낸 사유</h2>
              <p className="p-4 bg-gray-50 rounded-xl text-sm whitespace-pre-wrap">{submission.reviewNote}</p>
            </div>
          )}

          {canDecide && (
            <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">심사 판정</h2>
              <p className="mb-3 text-sm text-gray-600">
                승인하면 공연이 바로 공개되고 티켓 판매가 시작됩니다. 공개 주소는 운영자가 정합니다.
              </p>
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-gray-900" htmlFor="show-slug">공개 주소 (/ko/shows/…)</label>
                <TextInput
                  id="show-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="영문 소문자·숫자·하이픈"
                  light
                  className="max-w-md text-sm"
                  disabled={busy}
                />
                <div className="flex flex-wrap gap-2">
                  <Button light disabled={busy} onClick={handleApprove}>승인하고 공개</Button>
                  <Button light variant="weak" disabled={busy} onClick={handleRequestChanges}>보완 요청</Button>
                  <Button light variant="weak" disabled={busy} onClick={handleReject}>반려</Button>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">내부 메모</h2>
            <p className="mb-2 text-sm text-gray-600">운영자만 봅니다. 주최자에게 나가지 않습니다.</p>
            <div className="flex flex-col gap-3">
              <TextArea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                rows={3}
                aria-label="내부 메모"
                light
                className="min-h-0 text-sm"
                disabled={busy}
              />
              <Button light disabled={busy} onClick={handleSaveInternalNote} className="self-start">
                메모 저장
              </Button>
            </div>
          </div>
        </div>
      </AdminShell>
    </>
  );
}
