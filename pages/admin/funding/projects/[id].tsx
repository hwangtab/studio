import React, { useEffect, useRef, useState } from 'react';
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
import { normalizeFundingSlug } from '../../../../lib/funding/reservedSlugs';
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
    /**
     * 화면이 렌더하는 필드만 담는다 — `creator.bio`·`creator.links`는 이 화면 어디에도
     * 그리지 않으므로 props에도 싣지 않는다(화이트리스트 원칙, 안 쓰는 개인정보를 굳이
     * 클라이언트로 내보낼 이유가 없다).
     */
    creator: {
      contactName: string | null;
      phone: string | null;
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
        creator: { contactName: project.creator.contactName, phone: project.creator.phone },
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

/** 공개 상태(`status`) 라벨. `approved`가 아닐 때는 항상 `draft`라 화면에 큰 의미는 없지만,
 * 승인 직후 `hidden`이 켜져 있으면 "승인했는데 안 보인다"의 원인이 여기 있다는 것을
 * 운영자가 이 화면에서 바로 알아야 한다. */
const PROJECT_STATUS_LABELS: Record<string, string> = { auto: '공개중', draft: '비공개(작성중)', closed: '종료' };

export default function AdminFundingProjectDetailPage({ project }: AdminFundingProjectDetailPageProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [slug, setSlug] = useState(project.slug);
  const [reviewNote, setReviewNote] = useState(project.reviewNote ?? '');

  // 서버 값이 바뀌면(판정 뒤 router.replace가 이 컴포넌트를 remount하지 않으므로) 입력을
  // 따라가게 한다 — pages/admin/funding/[id].tsx의 메모 textarea와 같은 이유·같은 패턴.
  useEffect(() => setSlug(project.slug), [project.slug]);
  useEffect(() => setReviewNote(project.reviewNote ?? ''), [project.reviewNote]);

  /**
   * 결과 배너(오류·성공·경고)로 스크롤·포커스를 옮긴다.
   *
   * 이 화면은 판정 버튼이 대표 이미지·본문 전문·리워드 카드·연락처 아래, 문서 한참
   * 아래에 있다. `router.replace`는 `scroll: false`라 스크롤 위치가 그대로 유지되므로,
   * 배너를 문서 맨 위에 그리기만 하면 운영자는 버튼을 누른 자리에 남아 있고 "메일 발송에
   * 실패했습니다" 같은 배너는 뷰포트 밖에서 조용히 렌더된다 — 경고를 띄우는 것이 이
   * 화면의 존재 이유인데 띄운 자리가 안 보이면 의미가 없다. 최초 렌더(서버에서 내려온
   * 빈 상태)에는 스크롤하지 않는다.
   */
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

  const run = async (
    task: () => Promise<{ ok: boolean; message?: string; warnings?: string[] }>,
    successMessage: string,
  ) => {
    setBusy(true);
    setNotice(null);
    setSuccess(null);
    setWarnings([]);
    const result = await task();
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message ?? '요청을 처리하지 못했습니다.');
    } else {
      // 성공 신호가 상태 배지뿐이면 운영자는 버튼이 실제로 먹혔는지 화면 밖 정보로만
      // 확인해야 한다 — 경고가 없어도 짧게 알린다.
      setSuccess(successMessage);
      if (result.warnings && result.warnings.length > 0) {
        // 판정 자체는 성공했지만 재검증·메일 같은 후속 처리가 실패했을 수 있다 — 조용히
        // 넘기면 운영자가 개설자에게 통보가 갔다고 착각하게 되므로 그대로 노출한다.
        setWarnings(result.warnings);
      }
    }
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  // 슬러그 입력칸을 비우면 API도 개설자가 고른 기존 값을 그대로 쓴다 — 확인창·화면 모두
  // 같은 계산을 써야 "무슨 주소로 공개되는지" 표시가 실제 결과와 어긋나지 않는다.
  // API는 받은 값을 normalizeFundingSlug로 소문자화해 확정하므로 여기서도 같은 함수를 통과시킨다.
  // 형식이 틀려 null이면 서버가 400으로 돌려보낼 값이라, 입력을 그대로 보여 주는 편이 정직하다.
  const slugInput = slug.trim();
  const effectiveSlug = slugInput ? normalizeFundingSlug(slugInput) ?? slugInput : project.slug;

  const handleApprove = () => {
    if (
      !window.confirm(
        `승인하면 이 프로젝트가 /funding/${effectiveSlug} 주소로 공개되고, 리워드 주소·금액·수량 제한 여부·배송 여부를 더는 바꿀 수 없습니다. 승인할까요?`,
      )
    ) {
      return;
    }
    return run(
      () => patchFundingProject(project.id, { action: 'approve', slug: slug.trim() || undefined }),
      `/funding/${effectiveSlug} 주소로 승인했습니다.`,
    );
  };

  const handleRequestChanges = () => {
    const reason = window.prompt('개설자에게 보낼 보완 요청 사유를 적어 주세요.');
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('보완 요청은 사유가 있어야 합니다.');
      return;
    }
    return run(
      () => patchFundingProject(project.id, { action: 'request_changes', note: reason.trim() }),
      '보완 요청을 보냈습니다.',
    );
  };

  const handleReject = () => {
    const reason = window.prompt('반려 사유를 적어 주세요 (개설자에게 전달됩니다).');
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('반려는 사유가 있어야 합니다.');
      return;
    }
    if (!window.confirm('반려하면 개설자에게 반려 사실과 사유가 메일로 전달됩니다. 반려할까요?')) return;
    return run(() => patchFundingProject(project.id, { action: 'reject', note: reason.trim() }), '반려 처리했습니다.');
  };

  const handleSaveNote = () =>
    run(
      () => patchFundingProject(project.id, { action: 'set_review_note', note: reviewNote.trim() || undefined }),
      '메모를 저장했습니다.',
    );

  const handleArchive = () => {
    const reason = window.prompt(
      '보관 사유를 적어 주세요 (개설자에게 메일로 전달되며, 개설자 화면에도 그대로 노출됩니다).',
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('보관은 사유가 있어야 합니다.');
      return;
    }
    if (
      !window.confirm(
        '보관하면 이 프로젝트는 되돌릴 수 없이 반려와 같은 상태가 되고, 개설자는 더 이상 편집·재제출할 수 없습니다. 보관할까요?',
      )
    ) {
      return;
    }
    return run(() => patchFundingProject(project.id, { action: 'archive', note: reason.trim() }), '보관 처리했습니다.');
  };

  const canDecide = project.reviewStatus === 'submitted';
  // 보관은 심사 대기중뿐 아니라 작성중·보완요청 상태의 방치된 프로젝트를 치우는 것이
  // 목적이라 세 상태 모두에서 가능하다. 승인된 프로젝트는 공개된 것이라 status를
  // closed로 닫아야지 심사 상태를 되감지 않는다(reviewTransition.ts) — 반려된 프로젝트도
  // 이미 종결 상태라 다시 보관할 수 없다.
  const canArchive =
    project.reviewStatus === 'draft' ||
    project.reviewStatus === 'submitted' ||
    project.reviewStatus === 'changes_requested';

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
        {/* tabIndex=-1 + ref: 판정 버튼이 이 배너보다 한참 아래에 있어, 결과가 나온 뒤
            스크롤·포커스를 여기로 옮기지 않으면 운영자는 누른 자리에 그대로 남는다. */}
        <div ref={feedbackRef} tabIndex={-1} className="outline-none">
          {notice && (
            <div role="alert" className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
              {notice}
            </div>
          )}

          {success && (
            <div role="status" className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
              {success}
            </div>
          )}

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
        </div>

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
              {/* 승인해서 status가 열려도 hidden이면 공개되지 않는다 — "승인했는데 안
                  보인다"의 원인을 이 화면에서 바로 알 수 있어야 한다. */}
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">공개 상태</dt>
                <dd className="font-medium text-right">
                  {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                  {project.hidden && (
                    <span className="ml-2 inline-flex px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                      숨김
                    </span>
                  )}
                </dd>
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
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold">
                        잠김
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-1">{r.description}</p>
                  <p className="text-xs text-gray-500">
                    {r.totalQuantity !== null ? `한정 ${r.totalQuantity}개` : '수량 제한 없음'} ·{' '}
                    {r.requiresShipping ? '배송 필요' : '배송 없음'} · {r.estimatedDelivery}
                  </p>
                  {/* title 툴팁은 터치·키보드 사용자에게 안 보인다 — 배지 옆 텍스트로 뺀다. */}
                  {r.locked && (
                    <p className="text-xs text-gray-500 mt-1">
                      승인된 리워드라 주소·금액·수량 제한·배송 여부를 바꿀 수 없습니다.
                    </p>
                  )}
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
            <p className="mb-3 text-xs text-gray-500">확정될 주소: /funding/{effectiveSlug}</p>
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
            <h2 className="text-lg font-bold text-gray-900 mb-3">보관</h2>
            <p className="mb-3 text-sm text-gray-500">
              작성중·심사대기·보완요청 상태에서 방치된 프로젝트를 정리합니다. 되돌릴 수 없고, 사유는 개설자
              화면과 메일에 그대로 노출됩니다. 승인된 프로젝트는 공개를 닫는 것(종료)이 필요하지 여기서 보관할 수
              없습니다.
            </p>
            {!canArchive && (
              <p className="mb-3 text-sm text-gray-500">
                이 프로젝트는 현재 &ldquo;{REVIEW_STATUS_LABELS[project.reviewStatus]}&rdquo; 상태라 보관할 수
                없습니다.
              </p>
            )}
            <Button light variant="outline" disabled={!canArchive || busy} onClick={handleArchive}>
              보관
            </Button>
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
