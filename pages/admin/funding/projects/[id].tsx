import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { patchFundingProject } from '../../../../components/admin/fundingProjectActions';
import { AdminShell } from '../../../../components/admin/AdminShell';
import { Button } from '../../../../components/ui/Button';
import { Field, TextArea, TextInput } from '../../../../components/ui/Field';
import { lightOnlyField } from '../../../../components/ui/adminFieldClass';
import { formatPriceAmount } from '../../../../data/pricing';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { formatKstDateTimeFull } from '../../../../lib/booking/format';
import { loadProjectForAdmin, type AdminProjectSummary } from '../../../../lib/funding/adminProjects';
import type { FundingReviewStatus } from '../../../../lib/funding/reviewTransition';

/** 화면이 쓰는 리워드 모양. `lockedAt`은 `Date | null`이라 GSSP props로 그대로 못 내려서
 * 불리언 하나(`locked`)로 좁힌다 — 잠금 여부만 보여주면 되고, 시각까지는 필요 없다. */
interface DetailReward {
  rewardId: string;
  title: string;
  description: string;
  amount: number;
  totalQuantity: number | null;
  requiresShipping: boolean;
  estimatedDelivery: string;
  locked: boolean;
}

/**
 * 화면 props. `AdminProjectDetail`을 그대로 스프레드하지 않고 필드를 하나씩 고른다 —
 * 나중에 `adminProjects.ts`에 컬럼이 늘어도(예: 정산 관련) 이 화면이 그것을 조용히
 * 실어 나르는 통로가 되지 않게 하려는 것과, `lockedAt`(Date)처럼 그대로는 직렬화가
 * 안 되는 필드를 걸러내려는 것 둘 다다.
 */
interface AdminFundingProjectDetailPageProps {
  project: AdminProjectSummary & {
    summary: string;
    content: string;
    coverUrl: string;
    reviewNote: string | null;
    creator: {
      contactName: string | null;
      phone: string | null;
      bio: string | null;
      links: string[] | null;
    };
    rewards: DetailReward[];
  };
}

export const getServerSideProps: GetServerSideProps<AdminFundingProjectDetailPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { id } = context.query;
  if (typeof id !== 'string') return { notFound: true };

  const project = await loadProjectForAdmin(id);
  if (!project) return { notFound: true };

  return {
    props: {
      project: {
        id: project.id,
        slug: project.slug,
        title: project.title,
        reviewStatus: project.reviewStatus,
        status: project.status,
        hidden: project.hidden,
        submittedAt: project.submittedAt,
        approvedAt: project.approvedAt,
        creatorName: project.creatorName,
        creatorEmail: project.creatorEmail,
        goalAmount: project.goalAmount,
        startAt: project.startAt,
        endAt: project.endAt,
        summary: project.summary,
        content: project.content,
        coverUrl: project.coverUrl,
        reviewNote: project.reviewNote,
        creator: project.creator,
        rewards: project.rewards.map((r) => ({
          rewardId: r.rewardId,
          title: r.title,
          description: r.description,
          amount: r.amount,
          totalQuantity: r.totalQuantity,
          requiresShipping: r.requiresShipping,
          estimatedDelivery: r.estimatedDelivery,
          locked: r.lockedAt !== null,
        })),
      },
    },
  };
};

const REVIEW_STATUS_LABELS: Record<FundingReviewStatus, string> = {
  draft: '작성중',
  submitted: '심사대기',
  changes_requested: '보완요청',
  approved: '승인',
  rejected: '반려',
};

export default function AdminFundingProjectDetailPage({ project }: AdminFundingProjectDetailPageProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [slug, setSlug] = useState(project.slug);
  const [reviewNote, setReviewNote] = useState(project.reviewNote ?? '');

  // 서버 값이 바뀌면(판정 뒤 router.replace가 이 컴포넌트를 remount하지 않으므로) 입력을
  // 따라가게 한다 — pages/admin/funding/[id].tsx의 메모 textarea와 같은 이유·같은 패턴.
  useEffect(() => setSlug(project.slug), [project.slug]);
  useEffect(() => setReviewNote(project.reviewNote ?? ''), [project.reviewNote]);

  const run = async (task: () => Promise<{ ok: boolean; message?: string; warnings?: string[] }>) => {
    setBusy(true);
    setNotice(null);
    setWarnings([]);
    const result = await task();
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message ?? '요청을 처리하지 못했습니다.');
    } else if (result.warnings && result.warnings.length > 0) {
      // 판정 자체는 성공했지만 재검증·메일 같은 후속 처리가 실패했을 수 있다 — 조용히
      // 넘기면 운영자가 개설자에게 통보가 갔다고 착각하게 되므로 그대로 노출한다.
      setWarnings(result.warnings);
    }
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const handleApprove = () => {
    if (
      !window.confirm(
        '승인하면 리워드 주소·금액·수량 제한 여부·배송 여부를 더는 바꿀 수 없습니다. 승인할까요?',
      )
    ) {
      return;
    }
    return run(() => patchFundingProject(project.id, { action: 'approve', slug: slug.trim() || undefined }));
  };

  const handleRequestChanges = () => {
    const reason = window.prompt('개설자에게 보낼 보완 요청 사유를 적어 주세요.');
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('보완 요청은 사유가 있어야 합니다.');
      return;
    }
    return run(() => patchFundingProject(project.id, { action: 'request_changes', note: reason.trim() }));
  };

  const handleReject = () => {
    const reason = window.prompt('반려 사유를 적어 주세요 (개설자에게 전달됩니다).');
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('반려는 사유가 있어야 합니다.');
      return;
    }
    if (!window.confirm('반려하면 개설자에게 반려 사실과 사유가 메일로 전달됩니다. 반려할까요?')) return;
    return run(() => patchFundingProject(project.id, { action: 'reject', note: reason.trim() }));
  };

  const handleSaveNote = () =>
    run(() => patchFundingProject(project.id, { action: 'set_review_note', note: reviewNote.trim() || undefined }));

  const canDecide = project.reviewStatus === 'submitted';

  return (
    <>
      <Head>
        <title>{project.title} 심사 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="펀딩 프로젝트 심사"
        description={`${project.title} · ${REVIEW_STATUS_LABELS[project.reviewStatus]}`}
        backHref="/admin/funding/projects"
        backLabel="심사 목록"
      >
        {notice && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">{notice}</div>}

        {warnings.length > 0 && (
          <div role="alert" className="mb-4 p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-sm">
            <strong className="block mb-1">판정은 처리됐지만 후속 처리에 문제가 있었습니다</strong>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-8">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">프로젝트 내용</h2>
            {/* eslint-disable-next-line @next/next/no-img-element -- 관리자 심사 화면, next/image 최적화 불필요 */}
            <img src={project.coverUrl} alt="" className="w-full max-w-md rounded-xl mb-4 border border-gray-200" />
            <dl className="space-y-2 text-sm mb-4">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">제목</dt>
                <dd className="font-medium text-right">{project.title}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">요약</dt>
                <dd className="font-medium text-right">{project.summary}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">목표액</dt>
                <dd className="font-medium text-right">{formatPriceAmount(project.goalAmount)}원</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">기간</dt>
                <dd className="font-medium text-right">
                  {formatKstDateTimeFull(project.startAt)} ~ {formatKstDateTimeFull(project.endAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">개설자가 고른 주소</dt>
                <dd className="font-medium text-right">{project.slug}</dd>
              </div>
            </dl>
            <div className="p-4 bg-gray-50 rounded-xl text-sm whitespace-pre-wrap">{project.content}</div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">리워드</h2>
            <div className="space-y-3">
              {project.rewards.map((r) => (
                <div key={r.rewardId} className="p-4 bg-gray-50 rounded-xl text-sm">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{r.title}</span>
                    <span>{formatPriceAmount(r.amount)}원</span>
                    {r.locked && (
                      <span
                        className="inline-flex px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold"
                        title="승인된 리워드는 주소·금액·수량 제한·배송 여부를 바꿀 수 없습니다."
                      >
                        잠김
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-1">{r.description}</p>
                  <p className="text-xs text-gray-500">
                    {r.totalQuantity !== null ? `한정 ${r.totalQuantity}개` : '수량 제한 없음'} ·{' '}
                    {r.requiresShipping ? '배송 필요' : '배송 없음'} · {r.estimatedDelivery}
                  </p>
                </div>
              ))}
              {project.rewards.length === 0 && <p className="text-sm text-gray-500">등록된 리워드가 없습니다.</p>}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">개설자 연락처</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">이름</dt>
                <dd className="font-medium text-right">{project.creatorName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">이메일</dt>
                <dd className="font-medium text-right">{project.creatorEmail}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">담당자</dt>
                <dd className="font-medium text-right">{project.creator.contactName ?? '없음'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">연락처</dt>
                <dd className="font-medium text-right">{project.creator.phone ?? '없음'}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">판정</h2>
            {!canDecide && (
              <p className="mb-3 text-sm text-gray-500">
                이 프로젝트는 현재 &ldquo;{REVIEW_STATUS_LABELS[project.reviewStatus]}&rdquo; 상태라 판정 버튼을 쓸 수
                없습니다. 심사 대기 상태에서만 승인·보완 요청·반려를 할 수 있습니다.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <Field
                id="approve-slug"
                label="승인 시 확정할 주소(slug)"
                hint="비워 두면 개설자가 고른 값을 그대로 씁니다."
                className={lightOnlyField}
              >
                <TextInput
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  light
                  className="text-sm"
                  disabled={!canDecide || busy}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button light disabled={!canDecide || busy} onClick={handleApprove}>
                승인
              </Button>
              <Button light variant="secondary" disabled={!canDecide || busy} onClick={handleRequestChanges}>
                보완 요청
              </Button>
              <Button light variant="outline" disabled={!canDecide || busy} onClick={handleReject}>
                반려
              </Button>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">개설자에게 보이는 메모</h2>
            <p className="mb-2 text-xs text-gray-500">
              여기 적는 내용은 개설자 화면에 &ldquo;운영자 메모&rdquo;로 그대로 노출됩니다 — 내부 기록이 아닙니다.
              보완 요청·반려 사유와 같은 자리라, 저장하면 방금 보낸 사유를 덮어쓸 수 있습니다.
            </p>
            <div className="flex flex-col gap-3">
              <TextArea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                aria-label="개설자에게 보이는 메모"
                light
                className="min-h-0 text-sm"
                disabled={busy}
              />
              <Button light disabled={busy} onClick={handleSaveNote} className="self-start">
                메모 저장
              </Button>
            </div>
          </div>
        </div>
      </AdminShell>
    </>
  );
}
