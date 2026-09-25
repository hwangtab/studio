import React, { useEffect, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { patchFundingProject } from '../../../../components/admin/fundingProjectActions';
import { AdminShell } from '../../../../components/admin/AdminShell';
import { FundingPayoutSection, type AdminPayoutView } from '../../../../components/admin/FundingPayoutSection';
import { Button } from '../../../../components/ui/Button';
import { Field, TextArea, TextInput } from '../../../../components/ui/Field';
import { lightOnlyField } from '../../../../components/ui/adminFieldClass';
import { formatPriceAmount, FUNDING_DESIGN_PRICE } from '../../../../data/pricing';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { formatKstDateTimeFull } from '../../../../lib/booking/format';
import { VAT_RATE } from '../../../../lib/booking/amounts';
import { loadProjectForAdmin, type AdminProjectSummary } from '../../../../lib/funding/adminProjects';
import { loadProjectService, PROJECT_SERVICE_LABELS, type LoadServiceResult } from '../../../../lib/funding/projectServices';
import { buildFundingPayoutPreview } from '../../../../lib/funding/payout';
import { computeProjectState } from '../../../../lib/funding/projectState';
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
    /** 운영자 전용. 개설자에게 보이지 않는다 — `reviewNote`와 헷갈리지 말 것. */
    internalNote: string | null;
    /** 개설자가 승인 뒤에 마지막으로 고친 시각. null이면 승인 후 고친 적이 없다. */
    creatorEditedAt: string | null;
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
  /**
   * 정산 미리보기. `project`와 **형제 필드로 둔다** — `project` 안에 넣으면 그 객체가
   * "심사 화면이 보는 프로젝트"라는 화이트리스트의 의미를 잃는다.
   *
   * 계좌·세금 처리 구분은 여기 없다(`AdminPayoutView` 주석 참고). 승인 전 프로젝트와
   * 조회 실패 시 null이다 — 정산 계산이 죽어도 심사 화면 자체는 열려야 한다.
   */
  payout: AdminPayoutView | null;
  /**
   * 스튜디오 서비스(설계 대행·발매 프로젝트 연계). `project`의 형제 필드 — 별도 테이블이고
   * (마이그레이션 0037) 운영 DB에 아직 없으면 `{ available: false }`로 화면만 "미적용"을 띄운다.
   */
  service: LoadServiceResult;
}

/**
 * 정산 미리보기를 props로 좁힌다. `FundingPayoutPreview`를 그대로 스프레드하지 않는다 —
 * 그 타입에는 `taxType`이 있고, Pages Router는 props를 `__NEXT_DATA__`로 페이지 HTML에
 * 싣는다. 여기서 필드를 하나씩 고르는 것이 그 유출을 막는 자리다.
 */
const loadPayoutView = async (projectId: string): Promise<AdminPayoutView | null> => {
  try {
    const preview = await buildFundingPayoutPreview(projectId);
    if (!preview) return null;
    const r = preview.recorded;
    return {
      grossAmount: preview.grossAmount,
      refundAmount: preview.refundAmount,
      manualGrossAmount: preview.manualGrossAmount,
      supplyAmount: preview.supplyAmount,
      platformFeeAmount: preview.platformFeeAmount,
      paymentFeeAmount: preview.paymentFeeAmount,
      feeAmount: preview.feeAmount,
      shareAmount: preview.shareAmount,
      withholdingAmount: preview.withholdingAmount,
      netAmount: preview.netAmount,
      backerCount: preview.backerCount,
      closed: preview.closed,
      hasPayoutAccount: preview.hasPayoutAccount,
      // 값이 아니라 있고 없음만 싣는다 — 이 props는 __NEXT_DATA__로 나간다. 이 화면이
      // taxType으로 하는 일은 "등록됐는가"로 정산 기록을 막는 것뿐이라 불리언으로 충분하다.
      //
      // 개설자 편집 화면(`components/funding/creator/types.ts`의 `EditorPayoutSummary`)은
      // 같은 값을 그대로 싣는다. 거기는 본인 인증된 자기 정보를 고치는 폼이라, 불리언으로
      // 좁히면 열 때마다 선택이 '미선택'으로 되돌아간다. 한쪽을 다른 쪽에 맞추지 말 것.
      hasTaxType: preview.taxType !== null,
      // 주민등록번호도 값이 아니라 **게이트 판정 하나만** 싣는다. 등록 여부 자체가 아니라
      // "원천징수 대상인데 없다"로 접는 이유: 화면이 하는 일이 정산 기록을 막고 왜 막혔는지
      // 적는 것뿐이고, 사업자에게는 애초에 해당이 없는 조건이라서다. 서버 게이트
      // (`recordFundingPayout`의 no_resident_number)와 같은 식이어야 화면과 기록이 갈리지 않는다.
      needsResidentNumber: preview.taxType === 'withholding' && !preview.hasResidentNumber,
      recorded: r
        ? {
            id: r.id,
            grossAmount: r.grossAmount,
            refundAmount: r.refundAmount,
            supplyAmount: r.supplyAmount,
            feeAmount: r.feeAmount,
            platformFeeAmount: r.platformFeeAmount,
            paymentFeeAmount: r.paymentFeeAmount,
            shareAmount: r.shareAmount,
            withholdingAmount: r.withholdingAmount,
            netAmount: r.netAmount,
            backerCount: r.backerCount,
            status: r.status,
            paidAt: r.paidAt?.toISOString() ?? null,
            memo: r.memo,
            createdAt: r.createdAt.toISOString(),
          }
        : null,
    };
  } catch (error: unknown) {
    // 정산 집계가 실패해도 심사 화면은 열려야 한다 — 판정·메모 같은 다른 조작까지 막히면
    // 운영자가 할 수 있는 일이 사라진다.
    console.error(`[admin] 정산 미리보기 실패 (id=${projectId}):`, error);
    return null;
  }
};

export const getServerSideProps: GetServerSideProps<AdminFundingProjectDetailPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { id } = context.query;
  if (typeof id !== 'string') return { notFound: true };

  const project = await loadProjectForAdmin(id);
  if (!project) return { notFound: true };

  // 승인 전에는 후원도 정산도 있을 수 없다 — 쓸모없는 집계 질의를 돌리지 않는다.
  const payout = project.reviewStatus === 'approved' ? await loadPayoutView(id) : null;

  const service = await loadProjectService(id);

  return {
    props: {
      service,
      payout,
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
        internalNote: project.internalNote,
        creatorEditedAt: project.creatorEditedAt,
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

// rejected는 보관(archive)도 같은 DB 값이라(reviewTransition.ts), 개설자 화면과 같은
// 라벨로 맞춘다 — 구분은 reviewNote뿐이라 운영자도 배지만 보고 반려로 단정하면 안 된다.
const REVIEW_STATUS_LABELS: Record<FundingReviewStatus, string> = {
  draft: '작성중',
  submitted: '심사대기',
  changes_requested: '보완요청',
  approved: '승인',
  rejected: '반려·보관',
};

/** 공개 상태(`status`) 라벨. `approved`가 아닐 때는 항상 `draft`라 화면에 큰 의미는 없지만,
 * 승인 직후 `hidden`이 켜져 있으면 "승인했는데 안 보인다"의 원인이 여기 있다는 것을
 * 운영자가 이 화면에서 바로 알아야 한다. */
const PROJECT_STATUS_LABELS: Record<string, string> = { auto: '공개중', draft: '비공개(작성중)', closed: '종료' };

export default function AdminFundingProjectDetailPage({ project, payout, service }: AdminFundingProjectDetailPageProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [slug, setSlug] = useState(project.slug);
  const [reviewNote, setReviewNote] = useState(project.reviewNote ?? '');
  const [internalNote, setInternalNote] = useState(project.internalNote ?? '');
  const [creatorName, setCreatorName] = useState(project.creatorName);
  const [creatorEmail, setCreatorEmail] = useState(project.creatorEmail);

  // 서버 값이 바뀌면(판정 뒤 router.replace가 이 컴포넌트를 remount하지 않으므로) 입력을
  // 따라가게 한다 — pages/admin/funding/[id].tsx의 메모 textarea와 같은 이유·같은 패턴.
  useEffect(() => setSlug(project.slug), [project.slug]);
  useEffect(() => setReviewNote(project.reviewNote ?? ''), [project.reviewNote]);
  useEffect(() => setInternalNote(project.internalNote ?? ''), [project.internalNote]);
  useEffect(() => setCreatorName(project.creatorName), [project.creatorName]);
  useEffect(() => setCreatorEmail(project.creatorEmail), [project.creatorEmail]);

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

  const handleSetService = (kind: 'none' | 'design' | 'release') => {
    if (kind === 'none' && service.available && service.service) {
      // 약정가·입금 기록은 지우지 않고 보존한다(lib/funding/projectServices.ts) — 예전 문구는
      // "지워집니다"였고, 실제로 지우던 동안 재지정이 약정가를 그때의 정가로 재발행했다.
      if (!window.confirm('직접 개설로 되돌릴까요? 약정 설계비·입금 기록은 보존되고, 다시 지정하면 그 값으로 돌아갑니다.')) return;
    }
    return run(
      () => patchFundingProject(project.id, { action: 'set_studio_service', kind }),
      `서비스를 "${PROJECT_SERVICE_LABELS[kind]}"(으)로 저장했습니다.`,
    );
  };

  const handleDesignFeePaid = (paid: boolean) =>
    run(
      () => patchFundingProject(project.id, { action: 'set_design_fee_paid', paid }),
      paid ? '설계비 입금을 확인으로 기록했습니다.' : '설계비 입금 확인을 취소했습니다.',
    );

  const handleSaveInternalNote = () =>
    run(
      () => patchFundingProject(project.id, { action: 'set_internal_note', note: internalNote.trim() || undefined }),
      '내부 기록을 저장했습니다.',
    );

  /**
   * 개설자 계정 수정. 사유는 서버가 필수로 받고 어느 컬럼에도 저장하지 않는다 — 개설자
   * 메일과 서버 로그에만 남는다(`lib/funding/creatorAccountDecision.ts`).
   */
  const askAccountReason = (what: string): string | null => {
    const reason = window.prompt(`${what}을(를) 바꾸는 사유를 적어 주세요 (개설자에게 메일로 전달되고 서버 로그에 남습니다).`);
    if (reason === null) return null;
    if (!reason.trim()) {
      setNotice('계정 변경은 사유가 있어야 합니다.');
      return null;
    }
    return reason.trim();
  };

  const handleSaveCreatorName = () => {
    const next = creatorName.trim();
    if (!next) {
      setNotice('개설자 이름을 적어 주세요.');
      return;
    }
    if (next === project.creatorName) {
      setNotice('지금 저장된 이름과 같습니다.');
      return;
    }
    const reason = askAccountReason('개설자 이름');
    if (reason === null) return;
    if (
      !window.confirm(
        `개설자 이름을 "${project.creatorName}" → "${next}"로 바꿉니다. 이 개설자의 승인된 프로젝트 페이지에 표시되는 개설자 이름이 모두 함께 바뀝니다. 진행할까요?`,
      )
    ) {
      return;
    }
    return run(
      () => patchFundingProject(project.id, { action: 'set_creator_name', value: next, reason }),
      '개설자 이름을 바꿨습니다.',
    );
  };

  const handleSaveCreatorEmail = () => {
    const next = creatorEmail.trim();
    if (!next) {
      setNotice('개설자 이메일을 적어 주세요.');
      return;
    }
    if (next.toLowerCase() === project.creatorEmail) {
      setNotice('지금 저장된 이메일과 같습니다.');
      return;
    }
    const reason = askAccountReason('로그인 이메일');
    if (reason === null) return;
    if (
      !window.confirm(
        `로그인 이메일을 "${project.creatorEmail}" → "${next}"로 바꿉니다. 이 계정의 로그인 링크는 모두 무효가 되고, 옛 주소와 새 주소 양쪽에 변경 사실을 알립니다. 진행할까요?`,
      )
    ) {
      return;
    }
    return run(
      () => patchFundingProject(project.id, { action: 'set_creator_email', value: next, reason }),
      '로그인 이메일을 바꿨습니다. 기존 로그인 링크는 모두 무효가 됐습니다.',
    );
  };

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

  const handleClose = () => {
    const reason = window.prompt('종료 사유를 적어 주세요 (개설자에게 메일로 전달됩니다).');
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('종료는 사유가 있어야 합니다.');
      return;
    }
    if (
      !window.confirm(
        // 마감일 전 종료의 부수효과를 미리 말한다. 배송지·발송 상태는 **날짜** 마감 뒤에만
        // 열린다(lib/funding/projectState.ts의 isPastFundingEnd) — 그 규칙이 기존 후원자의
        // 셀프 취소권을 지키므로 코드로 완화하지 않고, 대신 운영자가 알고 누르게 한다.
        `종료하면 /funding/${project.slug} 페이지는 그대로 남지만 더 이상 새 후원을 받지 않습니다. `
        + '기존 후원자는 원래 마감일까지 후원 확인 페이지에서 스스로 취소할 수 있습니다. '
        + '같은 이유로 **마감일 전에 종료하면 개설자는 마감일까지 배송 목록을 받지 못하고 발송 상태도 바꿀 수 없습니다.** '
        + '나중에 다시 열 수 있습니다(단, 정산을 기록한 뒤에는 다시 열 수 없습니다). 종료할까요?',
      )
    ) {
      return;
    }
    return run(() => patchFundingProject(project.id, { action: 'close', note: reason.trim() }), '종료했습니다.');
  };

  // 다시 열어도 status만 auto가 될 뿐 모금 기간(startAt·endAt)은 승인 뒤 잠겨 있어
  // 바뀌지 않는다(basicLockedViolation) — computeProjectState로 실제 어떤 상태가 되는지
  // 미리 보고 확인창 문구를 거기 맞춘다. "다시 열면 즉시 후원을 받습니다"는 기간이
  // 이미 지났거나 아직 시작 전이면 사실이 아니다.
  const reopenState = computeProjectState({ status: 'auto', startAt: project.startAt, endAt: project.endAt }, new Date());

  const handleReopen = () => {
    const message =
      reopenState === 'live'
        ? `다시 열면 /funding/${project.slug}에서 즉시 새 후원을 받습니다. 다시 열까요?`
        : reopenState === 'upcoming'
          ? `다시 열어도 모금 시작일(${formatKstDateTimeFull(project.startAt)})부터 후원을 받습니다. 그전까지는 페이지만 보이고 후원은 받지 않습니다. 다시 열까요?`
          : `다시 열어도 모금 종료일(${formatKstDateTimeFull(project.endAt)})이 이미 지나 지금은 후원을 받지 않습니다. 그래도 다시 열까요?`;
    if (!window.confirm(message)) return;
    return run(() => patchFundingProject(project.id, { action: 'reopen' }), '다시 열었습니다.');
  };

  const handleHide = () => {
    // 숨김은 종료와 달리 페이지·결제가 그대로 열려 있는 조치라 사유를 강제하지 않는다
    // (decidePublicStatus도 hide에는 note를 요구하지 않는다) — 하지만 신고 대응처럼
    // 개설자가 "무엇을 고쳐야 하는지" 알아야 하는 경우가 있으므로 적을 수는 있게 한다.
    const reason = window.prompt(
      '숨김 사유를 적어 주세요 (선택 — 적으면 개설자에게 메일로 전달됩니다. 비워 두고 진행할 수도 있습니다).',
    );
    if (reason === null) return;
    if (
      !window.confirm(
        `숨기면 /funding 목록과 사이트맵에서 빠지지만, /funding/${project.slug} 주소를 아는 사람은 여전히 볼 수 있고 후원도 계속 받습니다. 숨길까요?`,
      )
    ) {
      return;
    }
    return run(
      () => patchFundingProject(project.id, { action: 'hide', note: reason.trim() || undefined }),
      '목록에서 숨겼습니다.',
    );
  };

  /**
   * 정산 기록. 확인창에 실이체액을 그대로 적는다 — 이 버튼은 그 시점 숫자를 영구히
   * 고정하므로, 누르기 전 마지막으로 눈으로 검산하는 자리가 여기다.
   *
   * 그래서 확인창이 말한 금액을 그대로 서버에 실어 보낸다. 이 페이지의 `payout`은
   * 페이지를 띄운 시점의 값이고, 서버는 기록할 때 다시 계산한다 — 그 사이에 환불이 한 건
   * 들어오면 운영자가 승인한 금액과 다른 숫자가 불변 기록으로 굳어버린다. 서버는 둔 값이 다르면
   * 기록 없이 409를 돌려준다(`lib/funding/payout.ts`의 `amount_changed`).
   */
  const handleRecordPayout = () => {
    if (!payout) return;
    const expectedNetAmount = payout.netAmount;
    if (
      !window.confirm(
        `실이체액 ${formatPriceAmount(expectedNetAmount)}원으로 정산을 기록합니다. 기록하면 그 시점 숫자가 고정되고 다시 기록할 수 없습니다. 화면을 띄운 뒤 환불이 들어와 금액이 바뀌었다면 기록하지 않고 바뀐 금액을 알려 드립니다. 진행할까요?`,
      )
    ) {
      return;
    }
    return run(
      () => patchFundingProject(project.id, { action: 'record_payout', expectedNetAmount }),
      '정산을 기록하고 개설자에게 알렸습니다.',
    );
  };

  const handleMarkPayoutPaid = () => {
    const recorded = payout?.recorded;
    if (!recorded) return;
    const memo = window.prompt('이체 메모를 적어 주세요 (선택 — 개설자에게 가는 메일에 함께 나갑니다).');
    if (memo === null) return;
    if (
      !window.confirm(
        `${formatPriceAmount(recorded.netAmount)}원을 실제로 이체하셨나요? 지급 완료로 기록하면 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }
    return run(
      () => patchFundingProject(project.id, { action: 'mark_payout_paid', memo: memo.trim() || undefined }),
      '지급 완료로 기록하고 개설자에게 알렸습니다.',
    );
  };

  const handleUnhide = () => {
    if (!window.confirm('다시 노출하면 /funding 목록과 사이트맵에 다시 나타납니다. 다시 노출할까요?')) return;
    return run(() => patchFundingProject(project.id, { action: 'unhide' }), '다시 노출했습니다.');
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

        {project.creatorEditedAt && (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            승인 뒤 개설자가 수정했습니다 — 마지막 수정 {formatKstDateTimeFull(project.creatorEditedAt)}
          </p>
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

            <div className="mt-5 rounded-lg border border-gray-300 bg-gray-50 p-4">
              <h3 className="text-base font-bold text-gray-900 mb-1">개설자 계정 수정</h3>
              <p className="mb-3 text-sm text-gray-600">
                이름은 승인된 프로젝트 페이지에 개설자로 표시됩니다. 승인 뒤에는 개설자 본인이 바꿀 수 없으므로,
                잘못 저장된 이름을 고치는 경로는 여기뿐입니다. 이메일은 개설자의 유일한 로그인 수단이라, 바꾸면
                기존 로그인 링크가 전부 무효가 됩니다.
              </p>
              {/* 화면과 보고서에 함께 적어 둘 한계 — 서버가 일방적으로 끊을 수 없는 것이 무엇인지
                  운영자가 알고 조치해야 한다(탈취 대응이면 그 사람에게 연락해 로그아웃을 요청). */}
              <p className="mb-4 text-sm text-amber-700">
                이미 로그인해 있는 브라우저 세션은 이메일을 바꿔도 끊기지 않습니다 — 쿠키 수명(최대 7일)이
                지나거나 본인이 로그아웃해야 끝납니다.
              </p>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end gap-3">
                  <Field id="creator-name" label="개설자 이름" className={lightOnlyField}>
                    <TextInput
                      type="text"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                      light
                      className="text-sm"
                      disabled={busy}
                    />
                  </Field>
                  <Button light variant="outline" disabled={busy} onClick={handleSaveCreatorName}>
                    이름 저장
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <Field
                    id="creator-email"
                    label="로그인 이메일"
                    hint="이미 다른 개설자가 쓰는 주소는 저장되지 않습니다."
                    className={lightOnlyField}
                  >
                    <TextInput
                      type="email"
                      value={creatorEmail}
                      onChange={(e) => setCreatorEmail(e.target.value)}
                      light
                      className="text-sm"
                      disabled={busy}
                    />
                  </Field>
                  <Button light variant="outline" disabled={busy} onClick={handleSaveCreatorEmail}>
                    이메일 저장
                  </Button>
                </div>
              </div>
            </div>
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

          {project.reviewStatus === 'approved' && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">공개 상태</h2>
              <p className="mb-3 text-sm text-gray-500">
                종료는 &ldquo;모금을 멈춘다&rdquo;이고 숨김은 &ldquo;목록·사이트맵에서 뺀다&rdquo;입니다 — 서로
                다른 조작이라 둘 다 필요할 수도, 하나만 필요할 수도 있습니다. 둘 다 되돌릴 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {project.status === 'closed' ? (
                  <Button light disabled={busy} onClick={handleReopen}>
                    다시 열기
                  </Button>
                ) : (
                  <Button light variant="outline" disabled={busy} onClick={handleClose}>
                    종료
                  </Button>
                )}
                {project.hidden ? (
                  <Button light variant="secondary" disabled={busy} onClick={handleUnhide}>
                    목록에 다시 노출
                  </Button>
                ) : (
                  <Button light variant="secondary" disabled={busy} onClick={handleHide}>
                    목록에서 숨기기
                  </Button>
                )}
              </div>
            </div>
          )}

          {project.reviewStatus === 'approved' && (
            <FundingPayoutSection
              projectId={project.id}
              payout={payout}
              busy={busy}
              onRecord={handleRecordPayout}
              onMarkPaid={handleMarkPayoutPaid}
            />
          )}

          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">개설자에게 보이는 메모</h2>
            <p className="mb-2 text-sm text-amber-700">
              개설자 화면과 메일에 그대로 나갑니다. 보완 요청·반려·보관 사유도 이 칸을 씁니다 —
              저장하면 방금 보낸 사유를 덮어쓸 수 있습니다.
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

          {/*
            스튜디오 서비스 — 운영자 전용(개설자에게 보이지 않는다). 설계비는 모금 정산과 별개로
            청구·입금된다(성공 수수료 없음). 테이블은 마이그레이션 0037이라, 운영 DB에 없으면
            조작을 막고 적용 방법을 적는다(lib/funding/projectServices.ts).
          */}
          <div className="mb-6 rounded-lg border border-gray-300 bg-gray-50 p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">스튜디오 서비스</h2>
            <p className="mb-3 text-sm text-gray-600">개설자에게 보이지 않습니다. 설계비는 모금 정산과 따로 청구합니다(성공 수수료 없음).</p>
            {!service.available ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {service.reason === 'missing_table'
                  ? '운영 DB에 마이그레이션 0037(funding_project_services)이 아직 적용되지 않았습니다. main에서 npm run db:migrate를 실행하면 이 칸이 열립니다. 다른 기능은 영향이 없습니다.'
                  : '서비스 정보를 불러오지 못했습니다(서버 로그 참조). 심사·정산은 그대로 쓸 수 있습니다. 잠시 뒤 새로고침해 주세요.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex flex-wrap gap-2" role="group" aria-label="서비스 종류">
                  {(['none', 'design', 'release'] as const).map((kind) => {
                    const current = service.service?.kind ?? 'none';
                    return (
                      <Button
                        key={kind}
                        light
                        variant={current === kind ? 'solid' : 'outline'}
                        disabled={busy || current === kind}
                        aria-pressed={current === kind}
                        onClick={() => handleSetService(kind)}
                      >
                        {PROJECT_SERVICE_LABELS[kind]}
                      </Button>
                    );
                  })}
                </div>
                {service.service && service.service.kind !== 'none' ? (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-gray-700">
                    <dt>약정 설계비</dt>
                    <dd>
                      {formatPriceAmount(service.service.designFee)}원 (부가세 별도 · 청구액{' '}
                      {formatPriceAmount(Math.round(service.service.designFee * (1 + VAT_RATE)))}원)
                      {service.service.designFee !== FUNDING_DESIGN_PRICE && (
                        <span className="ml-2 text-xs text-gray-500">현재 정가 {formatPriceAmount(FUNDING_DESIGN_PRICE)}원과 다름 — 지정 당시 금액</span>
                      )}
                    </dd>
                    <dt>입금</dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      {service.service.designFeePaidAt ? (
                        <>
                          <span className="font-medium text-green-700">확인 {formatKstDateTimeFull(service.service.designFeePaidAt)}</span>
                          <Button light disabled={busy} onClick={() => handleDesignFeePaid(false)}>확인 취소</Button>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-amber-700">미입금</span>
                          <Button light disabled={busy} onClick={() => handleDesignFeePaid(true)}>입금 확인</Button>
                        </>
                      )}
                    </dd>
                  </dl>
                ) : (
                  <>
                    <p className="text-gray-600">직접 개설한 프로젝트입니다. 설계비가 없습니다.</p>
                    {/* 되돌린 프로젝트의 옛 약정은 보존돼 있다 — 다시 지정할 때 무엇으로
                        돌아가는지 알아야 이중 청구·누락을 막을 수 있다. */}
                    {service.service && (
                      <p className="text-xs text-gray-500">
                        이전 약정 보존 — 설계비 {formatPriceAmount(service.service.designFee)}원
                        {' · '}
                        {service.service.designFeePaidAt
                          ? `입금 확인 ${formatKstDateTimeFull(service.service.designFeePaidAt)}`
                          : '미입금'}
                        . 다시 지정하면 이 값으로 돌아갑니다.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mb-6 rounded-lg border border-gray-300 bg-gray-50 p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">내부 기록</h2>
            <p className="mb-2 text-sm text-gray-600">개설자에게 보이지 않습니다.</p>
            <div className="flex flex-col gap-3">
              <TextArea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                rows={3}
                aria-label="내부 기록"
                light
                className="min-h-0 text-sm"
                disabled={busy}
              />
              <Button light disabled={busy} onClick={handleSaveInternalNote} className="self-start">
                내부 기록 저장
              </Button>
            </div>
          </div>
        </div>
      </AdminShell>
    </>
  );
}
