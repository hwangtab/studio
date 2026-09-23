import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import { BasicSectionForm, type BasicSectionValue } from '../../../../components/funding/creator/BasicSectionForm';
import { CreatorSectionForm } from '../../../../components/funding/creator/CreatorSectionForm';
import { PayoutSectionForm } from '../../../../components/funding/creator/PayoutSectionForm';
import { ProjectStatsPanel } from '../../../../components/funding/creator/ProjectStatsPanel';
import { RewardSectionForm } from '../../../../components/funding/creator/RewardSectionForm';
import { StorySectionForm } from '../../../../components/funding/creator/StorySectionForm';
import { submitProject, withdrawProject } from '../../../../components/funding/creator/api';
import {
  IDLE_SAVE_STATE, REVIEW_STATUS_LABEL, REVIEW_STATUS_NOTICE, canEditSectionInBrowser,
  type CreatorSectionName, type EditorCreatorProfile, type EditorPayoutSummary, type EditorProject,
  type EditorReward, type SaveState,
} from '../../../../components/funding/creator/types';
import { Button } from '../../../../components/ui/Button';
import { computeEarliestStartDate, toKstDateString } from '../../../../lib/funding/creatorDateInput';
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
import {
  isCreatorNameLocked, loadPayoutSummary, loadProjectForCreator, type CreatorProjectDetail,
} from '../../../../lib/funding/creatorProjectWrite';
import { loadCreatorProjectStats, type CreatorProjectStats } from '../../../../lib/funding/creatorStats';
import { CREATOR_LIMITS } from '../../../../lib/funding/creatorValidation';
import { FUNDING_CREATOR_TERMS_VERSION } from '../../../../lib/funding/policy';
import { withI18nServerProps } from '../../../../lib/getStatic';

interface Props {
  project: EditorProject;
  /**
   * GSSP가 요청 시각(서버의 `now`) 기준으로 미리 계산한, 시작일로 고를 수 있는 가장 이른
   * KST 날짜. 브라우저 시계로 다시 계산하면 SSR과 CSR의 `now`가 갈려 하이드레이션
   * 불일치가 나고, 그 값이 서버 검증(`validateBasicSection`)이 실제로 쓰는 `now`와도
   * 어긋난다(2026-09-17 리뷰 지적).
   */
  earliestStartDate: string;
  /**
   * 지금 개설자 이름이 잠겨 있는지 — `lib/funding/creatorProjectWrite.ts`의
   * `isCreatorNameLocked`가 편집 화면 로드 시점에 한 번 판정한 결과다. 판정에 쓰인
   * 이메일·현재 이름 같은 원자료는 화면에 내려보내지 않는다(결과 불리언 하나만).
   * 저장 시점의 실제 집행은 여전히 `saveCreatorSection`이 한다 — 이 값은 안내일 뿐이다.
   */
  nameLocked: boolean;
  /**
   * 정산 정보의 **등록 여부·계좌번호 뒤 4자리·세금 유형**뿐이다. 은행명·예금주·계좌번호
   * 전체는 여기 담지 않는다 — 이 props는 `__NEXT_DATA__` JSON으로 페이지 HTML에 그대로
   * 실려 나가므로 담는 순간 계좌번호가 페이지 소스에 평문으로 박힌다. 개설자 본인 화면도
   * 예외가 아니다(어깨너머·브라우저 캐시·화면 공유). 값을 실어 보내면 편하겠다는 생각이
   * 들면 `lib/funding/creatorProjectWrite.ts`의 `CreatorPayoutSummary` 주석을 읽을 것.
   */
  payout: EditorPayoutSummary;
  /**
   * 모금 현황(집계만). 승인 전 프로젝트와 집계를 못 읽은 경우는 null이고 화면은 구획을
   * 통째로 감춘다 — `lib/funding/creatorStats.ts`의 `loadCreatorProjectStats` 주석 참조.
   * 후원자 이름·응원 메시지·연락처·배송지는 이 값에 들어 있지 않다(개설자 약관 제8조).
   *
   * 선택적이다 — 현황 구획은 편집기의 부가 정보라, 없으면 그 구획만 빠지고 나머지는
   * 그대로 동작한다.
   */
  stats?: CreatorProjectStats | null;
}

/**
 * `CreatorProjectDetail` → 화면이 실제로 쓰는 `EditorProject`.
 *
 * `loadProjectForCreator`가 `fundingCreators`를 `select()`(전 컬럼)로 읽지만 화면에는
 * `{ name, contactName, phone, bio, links }` 다섯 필드만 골라 넣은 채로 돌려준다 — 이 함수는
 * 그 필드만 옮겨 담을 뿐, `taxType`·`payoutBankName`·`payoutAccount`·`payoutHolder`는 애초에
 * `CreatorProjectDetail.creator`에 없다(data/artists/index.ts의 `toArtistCardData`와 같은
 * 자리, 같은 이유). `email`은 `CreatorProjectDetail.creator`에 있지만(심사 신청이
 * `isDefaultCreatorName` 판정에 쓴다) 이 함수가 옮겨 담지 않으므로 화면 props로는 나가지
 * 않는다 — `tests/pages/funding/creator/edit.test.ts`가 이 누수를 테스트로 고정한다. 날짜는
 * KST 달력 날짜 문자열로 바꾼다(`lib/funding/creatorDateInput.ts`
 * 참조 — `Date` 그대로면 `__NEXT_DATA__` 직렬화도 안 되고, ISO 타임스탬프 그대로 두면
 * 폼이 다시 저장할 때 하루가 밀린다). 리워드는 `lockedAt`(승인 시각) 대신 화면이
 * 필요로 하는 `locked` 불리언 하나만 남긴다.
 */
export const toEditorProject = (p: CreatorProjectDetail): EditorProject => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  summary: p.summary,
  content: p.content,
  coverUrl: p.coverUrl,
  goalAmount: p.goalAmount,
  startAt: toKstDateString(p.startAt),
  endAt: toKstDateString(p.endAt),
  reviewStatus: p.reviewStatus,
  reviewNote: p.reviewNote,
  creator: {
    name: p.creator.name,
    contactName: p.creator.contactName,
    phone: p.creator.phone,
    bio: p.creator.bio,
    links: p.creator.links,
  },
  rewards: p.rewards.map((r) => ({
    rewardId: r.rewardId,
    title: r.title,
    description: r.description,
    amount: r.amount,
    totalQuantity: r.totalQuantity,
    requiresShipping: r.requiresShipping,
    estimatedDelivery: r.estimatedDelivery,
    imageUrl: r.imageUrl,
    locked: r.lockedAt !== null,
  })),
});

const TABS = ['basic', 'story', 'rewards', 'creator', 'payout'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  basic: '기본정보', story: '스토리', rewards: '리워드', creator: '개설자 정보', payout: '정산 정보',
};

/** 이탈 시 잃는 것을 구체적으로 말한다 — beforeunload와 routeChangeStart 양쪽에서 같은 문구를 쓴다. */
const UNSAVED_CHANGES_MESSAGE = '저장하지 않은 변경이 있습니다. 지금 나가면 그 내용이 사라집니다. 계속하시겠습니까?';

export default function CreatorProjectEditor({
  project: initial, earliestStartDate, nameLocked, payout: initialPayout, stats,
}: Props) {
  const router = useRouter();
  const [project, setProject] = useState<EditorProject>(initial);
  const [payout, setPayout] = useState<EditorPayoutSummary>(initialPayout);
  const [tab, setTab] = useState<Tab>('basic');
  const [submit, setSubmit] = useState<SaveState>(IDLE_SAVE_STATE);
  const [withdraw, setWithdraw] = useState<SaveState>(IDLE_SAVE_STATE);
  const [agreedTerms, setAgreedTerms] = useState(false);

  // 구획별 저장 안 한 입력 여부. 네 폼이 각자 onDirtyChange로 보고한다 — 폼이 하나라도
  // dirty면 이탈 전에 확인을 건다("저장 안 한 입력이 경고 없이 사라진다" 대응,
  // 2026-09-22). 콜백을 useMemo로 한 번만 만들어 두는 이유: 매 렌더 새 함수를 내려주면
  // 각 폼의 `useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])`가 dirty
  // 값이 안 바뀌어도 매번 다시 실행된다 — 동작은 맞지만(진 setState는 no-op) 불필요한
  // 호출이 계속 쌓인다.
  const [dirtyTabs, setDirtyTabs] = useState<Record<Tab, boolean>>({
    basic: false, story: false, rewards: false, creator: false, payout: false,
  });
  const onDirtyChangeBySection = useMemo(() => {
    const handlers = {} as Record<Tab, (dirty: boolean) => void>;
    for (const t of TABS) {
      handlers[t] = (dirty: boolean) => {
        setDirtyTabs((prev) => (prev[t] === dirty ? prev : { ...prev, [t]: dirty }));
      };
    }
    return handlers;
  }, []);
  const hasUnsavedChanges = TABS.some((t) => dirtyTabs[t]);

  // 브라우저 이탈(새로고침·닫기·주소창 이동) 경고.
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 브라우저는 이 문구를 대개 무시하고 자체 확인창을 띄운다 — 값을 채우는 것
      // 자체가 신호다(components/admin/ContractForm.tsx와 같은 처방).
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // 앱 내부 이동(상단 "← 내 프로젝트 목록" 등 클라이언트 내비게이션) 경고 — 실제 사고
  // 경로다. Pages Router에는 이동을 취소하는 공식 API가 없어, routeChangeStart에서
  // 확인 후 거부하면 이동을 강제로 중단시키는 표준 우회(Next.js 이슈 트래커에 오래
  // 정착된 패턴)를 쓴다: 라우터 이벤트에 routeChangeError를 emit하고 예외를 던진다.
  // 이 우회의 알려진 부작용은 콘솔에 `Uncaught (in promise) routeChange aborted (...)`가
  // 남는 것이다(next/dist/client/link.js의 linkClicked가 router.push()에 .catch를
  // 안 달아서다) — "Abort fetching component for route..."가 아니다. 그 메시지는
  // 진행 중이던 다른 이동이 취소될 때 나는 것이라 여기서는 뜨지 않는다(2026-09-22
  // 리뷰 지적 — 실제로 안 나는 로그를 적어 두면 다음 사람이 그 로그를 찾다가 헤맨다).
  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      if (!hasUnsavedChanges) return;
      if (url === router.asPath) return;
      // eslint-disable-next-line no-alert
      if (window.confirm(UNSAVED_CHANGES_MESSAGE)) return;
      router.events.emit('routeChangeError');
      // eslint-disable-next-line no-throw-literal
      throw 'routeChange aborted (저장하지 않은 변경 확인 취소)';
    };
    router.events.on('routeChangeStart', handleRouteChangeStart);
    return () => router.events.off('routeChangeStart', handleRouteChangeStart);
  }, [hasUnsavedChanges, router]);

  // 브라우저 뒤로/앞으로가기(popstate) 경고 — routeChangeStart만으로는 안 잡힌다.
  // Next 내부(onPopState)는 브라우저가 **이미 히스토리를 옮긴 뒤** changeState를 불러
  // 그 안에서 routeChangeStart를 emit한다. 그래서 위 핸들러에서 throw해도 주소창은
  // 이미 목적지로 바뀐 채 남고, 화면(getServerSideProps 결과)만 안 바뀌어 주소와 화면이
  // 어긋난다 — 그 뒤 뒤로가기 히스토리도 한 칸씩 밀린다(2026-09-22 리뷰 지적).
  // beforePopState는 그 changeState보다 앞서 불려 이동 자체를 취소(false 반환)할 수
  // 있고, 취소하면 routeChangeStart 자체가 안 나므로 confirm이 두 번 뜨지도 않는다.
  useEffect(() => {
    router.beforePopState(() => {
      if (!hasUnsavedChanges) return true;
      // eslint-disable-next-line no-alert
      if (window.confirm(UNSAVED_CHANGES_MESSAGE)) return true;
      // 브라우저가 이미 옮겨 둔 히스토리 엔트리를 제자리로 되돌린다 — 안 하면 주소창만
      // 목적지로 남고 화면은 편집기 그대로인 상태가 된다.
      window.history.forward();
      return false;
    });
    return () => {
      router.beforePopState(() => true);
    };
  }, [hasUnsavedChanges, router]);

  // 구획별 판정 — 서버(lib/funding/reviewTransition.ts의 canCreatorEditSection)와 같은 단위다.
  // 승인 뒤에는 basic·story만 열리고 rewards는 통째로 닫힌다.
  const ro = (section: CreatorSectionName) => !canEditSectionInBrowser(project.reviewStatus, section);
  // 심사 신청은 draft·changes_requested에서만 가능하다(reviewTransition.ts의 TABLE에
  // approved → submit 전이가 없다). approved도 basic 구획 자체는 열려 있어 `ro('basic')`만
  // 보면 이미 공개된 프로젝트에서도 버튼이 활성화된다 — 서버가 409로 막아 기능은
  // 안전하지만, 상단 "공개된 프로젝트입니다" 안내와 모순되는 버튼·체크박스가 남는다.
  const canSubmitForReview = !ro('basic') && project.reviewStatus !== 'approved';
  const notice = REVIEW_STATUS_NOTICE[project.reviewStatus];
  // 본문이 3차 범위라 판본이 빈 문자열인 동안은 화면도 동의를 요구하지 않는다 —
  // lib/funding/policy.ts의 FUNDING_CREATOR_TERMS_VERSION 주석과 같은 조건이다.
  const requiresTerms = FUNDING_CREATOR_TERMS_VERSION !== '';

  const handleSubmitReview = async () => {
    setSubmit({ status: 'saving' });
    const result = await submitProject(project.id, requiresTerms ? FUNDING_CREATOR_TERMS_VERSION : undefined);
    if (result.ok) {
      setSubmit({ status: 'success' });
      // handleWithdraw가 성공 시 setSubmit(IDLE_SAVE_STATE)로 반대 상태를 지우는 것과
      // 대칭이다. 없으면: 철회(withdraw.status='success') → 같은 화면에서 오타 고쳐
      // 재제출 → reviewStatus는 'submitted'로 바뀌는데 withdraw.status는 'success'로
      // 남아, 철회 버튼이 (withdraw.status !== 'success' 조건에 걸려) 다시 나타나지
      // 않는다. 상단 안내는 "철회할 수 있다"고 말하는데 버튼이 없는 거짓 상태가 된다.
      setWithdraw(IDLE_SAVE_STATE);
      setProject((p) => ({ ...p, reviewStatus: 'submitted' }));
    } else {
      setSubmit({ status: 'error', message: result.message });
    }
  };

  const handleWithdraw = async () => {
    setWithdraw({ status: 'saving' });
    const result = await withdrawProject(project.id);
    if (result.ok) {
      setWithdraw({ status: 'success' });
      setSubmit(IDLE_SAVE_STATE);
      setProject((p) => ({ ...p, reviewStatus: 'draft' }));
    } else {
      setWithdraw({ status: 'error', message: result.message });
    }
  };

  return (
    <>
      <Head>
        <title>{project.title || '프로젝트 편집'} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Link href="/ko/funding/creator" className="typo-caption text-gray-500 underline underline-offset-2 dark:text-gray-400">
          ← 내 프로젝트 목록
        </Link>

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">{project.title || '(제목 없음)'}</h1>
          <span className="typo-card-meta rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {REVIEW_STATUS_LABEL[project.reviewStatus] ?? project.reviewStatus}
          </span>
        </div>

        {project.reviewNote && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            운영자 메모: {project.reviewNote}
          </p>
        )}
        {notice && (
          <p className="mt-3 rounded-lg bg-gray-100 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {notice}
          </p>
        )}

        {/* 읽기 전용 구획이다 — 탭 바깥에 두어 저장 안 한 입력 이탈 가드(TABS·dirtyTabs)와
            섞이지 않게 한다. */}
        {stats && <ProjectStatsPanel stats={stats} />}

        <nav role="tablist" aria-label="편집 구획" className="mt-8 flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              onClick={() => setTab(t)}
              className={`px-4 py-2 typo-body font-medium ${
                tab === t
                  ? 'border-b-2 border-primary text-primary dark:text-primary-lighter'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </nav>

        {/*
          네 폼을 전부 항상 마운트해 두고 hidden으로만 감춘다. 예전엔 `{tab === 'x' && <Form/>}`
          조건 렌더라 탭을 옮기면 언마운트되어 로컬 상태(저장하지 않은 입력)가 그대로
          사라졌다 — 구획별 부분 저장이 이 화면의 핵심 설계인데 탭 전환이 경고 없이 그
          단위를 파괴했다(2026-09-17 리뷰 지적).
        */}
        <div className="mt-8">
          <div id="panel-basic" role="tabpanel" aria-labelledby="tab-basic" hidden={tab !== 'basic'}>
            <BasicSectionForm
              projectId={project.id}
              initial={{
                title: project.title, summary: project.summary, slug: project.slug,
                coverUrl: project.coverUrl, goalAmount: project.goalAmount,
                startAt: project.startAt, endAt: project.endAt,
              }}
              earliestStartDate={earliestStartDate}
              readOnly={ro('basic')}
              lockedFields={project.reviewStatus === 'approved'}
              onSaved={(value: BasicSectionValue) => setProject((p) => ({ ...p, ...value }))}
              onDirtyChange={onDirtyChangeBySection.basic}
            />
          </div>
          <div id="panel-story" role="tabpanel" aria-labelledby="tab-story" hidden={tab !== 'story'}>
            <StorySectionForm
              projectId={project.id}
              initial={project.content}
              readOnly={ro('story')}
              onSaved={(content: string) => setProject((p) => ({ ...p, content }))}
              onDirtyChange={onDirtyChangeBySection.story}
            />
          </div>
          <div id="panel-rewards" role="tabpanel" aria-labelledby="tab-rewards" hidden={tab !== 'rewards'}>
            <RewardSectionForm
              projectId={project.id}
              initial={project.rewards}
              readOnly={ro('rewards')}
              onSaved={(rewards: EditorReward[]) => setProject((p) => ({ ...p, rewards }))}
              onDirtyChange={onDirtyChangeBySection.rewards}
            />
          </div>
          <div id="panel-payout" role="tabpanel" aria-labelledby="tab-payout" hidden={tab !== 'payout'}>
            <PayoutSectionForm
              projectId={project.id}
              initial={payout}
              readOnly={ro('payout')}
              onSaved={setPayout}
              onDirtyChange={onDirtyChangeBySection.payout}
            />
          </div>
          <div id="panel-creator" role="tabpanel" aria-labelledby="tab-creator" hidden={tab !== 'creator'}>
            <CreatorSectionForm
              projectId={project.id}
              initial={project.creator}
              readOnly={false}
              nameLocked={nameLocked}
              onSaved={(value: EditorCreatorProfile) => setProject((p) => ({ ...p, creator: value }))}
              onDirtyChange={onDirtyChangeBySection.creator}
            />
          </div>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 dark:border-gray-700">
          {requiresTerms && (
            <label className="mb-4 flex items-start gap-2 typo-caption text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={agreedTerms}
                disabled={!canSubmitForReview}
                onChange={(e) => setAgreedTerms(e.target.checked)}
              />
              <span>
                <Link href="/ko/funding/creator-terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  개설자 약관
                </Link>
                에 동의합니다.
              </span>
            </label>
          )}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmitReview}
              disabled={!canSubmitForReview || submit.status === 'saving' || (requiresTerms && !agreedTerms)}
            >
              {submit.status === 'saving' ? '신청 중…' : '심사 신청'}
            </Button>
            {submit.status === 'success' && (
              <span className="typo-caption text-green-600 dark:text-green-400">심사를 신청했습니다.</span>
            )}
            {submit.status === 'error' && (
              <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{submit.message}</span>
            )}
          </div>
          {/* 심사 신청은 draft·changes_requested에서만 가능해 위 버튼은 submitted에서 항상
              비활성이다 — 그 자리를 대신해 submitted에서만 철회 버튼을 보여준다
              (reviewTransition.ts의 submitted --withdraw--> draft).
              철회 성공 순간 project.reviewStatus는 곧바로 'draft'로 바뀌므로, 버튼만
              그 조건에 걸면 성공 문구가 뜨기도 전에 이 블록째로 사라진다 — 그래서
              withdraw.status === 'success'일 때도 블록을 남겨 둔다(버튼만 감춘다). */}
          {(project.reviewStatus === 'submitted' || withdraw.status === 'success') && (
            <div className="mt-4 flex items-center gap-3">
              {withdraw.status !== 'success' && (
                <Button
                  variant="outline"
                  onClick={handleWithdraw}
                  disabled={withdraw.status === 'saving'}
                >
                  {withdraw.status === 'saving' ? '철회 중…' : '심사 신청 철회'}
                </Button>
              )}
              {withdraw.status === 'success' && (
                <span className="typo-caption text-green-600 dark:text-green-400">
                  심사 신청을 철회했습니다. 다시 작성한 뒤 제출해 주세요.
                </span>
              )}
              {withdraw.status === 'error' && (
                <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{withdraw.message}</span>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// 주석을 달지 않는다 — withI18nServerProps는 Props에 locale·i18nResources를 더한 타입을 돌려준다
// (pages/[locale]/funding/[slug]/pledge.tsx:36과 같은 모양).
export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  // funding의 다른 SSR 형제 페이지(creator/index·auth)와 같은 자리, 같은 방식 — 펀딩은
  // ko 전용이라 비-ko 경로는 같은 화면을 ko로 되돌린다.
  if (context.params?.locale !== 'ko') {
    return { redirect: { destination: `/ko/funding/creator/${encodeURIComponent(id)}`, permanent: false } };
  }
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };
  if (!id) return { notFound: true };

  const project = await loadProjectForCreator(auth.creatorId, id);
  if (!project) return { notFound: true };

  return {
    props: {
      project: toEditorProject(project),
      // 서버의 now로 계산한다 — 브라우저 시계로 다시 계산하지 않는 이유는 위 Props 주석 참조.
      earliestStartDate: computeEarliestStartDate(Date.now(), CREATOR_LIMITS.leadDays),
      // 편집 화면 로드 시점에 한 번만 조회한다 — 저장 경로(saveCreatorSection)는 이 값을
      // 쓰지 않고 자신의 조건을 그대로 재확인하므로, 여기서 조회를 늘려도 집행 경로의
      // 쿼리 횟수는 늘지 않는다.
      nameLocked: await isCreatorNameLocked(auth.creatorId),
      // 등록 여부·뒤 4자리·세금 유형만 돌아온다 — 원본 계좌 값은 이 함수 밖으로 나오지
      // 않는다(lib/funding/creatorProjectWrite.ts의 loadPayoutSummary).
      payout: await loadPayoutSummary(auth.creatorId),
      /**
       * 모금 현황은 이 화면의 부가 정보다 — 집계 조회가 실패했다고 편집 자체를 막지
       * 않는다(빌드·런타임 모두 DB 없이 동작해야 한다는 저장소 규칙과 같은 방향).
       * 실패하면 구획만 사라진다.
       */
      stats: await loadCreatorProjectStats(auth.creatorId, id).catch((error: unknown) => {
        console.error('[funding] 개설자 모금 현황 조회 실패:', error);
        return null;
      }),
    },
  };
});
