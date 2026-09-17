import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

import { BasicSectionForm, type BasicSectionValue } from '../../../../components/funding/creator/BasicSectionForm';
import { CreatorSectionForm } from '../../../../components/funding/creator/CreatorSectionForm';
import { RewardSectionForm } from '../../../../components/funding/creator/RewardSectionForm';
import { StorySectionForm } from '../../../../components/funding/creator/StorySectionForm';
import { submitProject } from '../../../../components/funding/creator/api';
import {
  IDLE_SAVE_STATE, REVIEW_STATUS_LABEL, REVIEW_STATUS_NOTICE, canEditInBrowser,
  type EditorCreatorProfile, type EditorProject, type EditorReward, type SaveState,
} from '../../../../components/funding/creator/types';
import { Button } from '../../../../components/ui/Button';
import { computeEarliestStartDate, toKstDateString } from '../../../../lib/funding/creatorDateInput';
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
import { loadProjectForCreator, type CreatorProjectDetail } from '../../../../lib/funding/creatorProjectWrite';
import { CREATOR_LIMITS } from '../../../../lib/funding/creatorValidation';
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
}

/**
 * `CreatorProjectDetail` → 화면이 실제로 쓰는 `EditorProject`.
 *
 * `loadProjectForCreator`가 `fundingCreators`를 `select()`(전 컬럼)로 읽지만 화면에는
 * `{ name, contactName, phone, bio, links }` 다섯 필드만 골라 넣은 채로 돌려준다 — 이 함수는
 * 그 필드만 옮겨 담을 뿐, `taxType`·`payoutBankName`·`payoutAccount`·`payoutHolder`·`email`은
 * 애초에 `CreatorProjectDetail.creator`에 없다(data/artists/index.ts의 `toArtistCardData`와
 * 같은 자리, 같은 이유). 날짜는 KST 달력 날짜 문자열로 바꾼다(`lib/funding/creatorDateInput.ts`
 * 참조 — `Date` 그대로면 `__NEXT_DATA__` 직렬화도 안 되고, ISO 타임스탬프 그대로 두면
 * 폼이 다시 저장할 때 하루가 밀린다). 리워드는 `lockedAt`(승인 시각) 대신 화면이
 * 필요로 하는 `locked` 불리언 하나만 남긴다.
 */
const toEditorProject = (p: CreatorProjectDetail): EditorProject => ({
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

const TABS = ['basic', 'story', 'rewards', 'creator'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { basic: '기본정보', story: '스토리', rewards: '리워드', creator: '개설자 정보' };

export default function CreatorProjectEditor({ project: initial, earliestStartDate }: Props) {
  const [project, setProject] = useState<EditorProject>(initial);
  const [tab, setTab] = useState<Tab>('basic');
  const [submit, setSubmit] = useState<SaveState>(IDLE_SAVE_STATE);

  const readOnly = !canEditInBrowser(project.reviewStatus);
  const notice = REVIEW_STATUS_NOTICE[project.reviewStatus];

  const handleSubmitReview = async () => {
    setSubmit({ status: 'saving' });
    const result = await submitProject(project.id);
    if (result.ok) {
      setSubmit({ status: 'success' });
      setProject((p) => ({ ...p, reviewStatus: 'submitted' }));
    } else {
      setSubmit({ status: 'error', message: result.message });
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
              readOnly={readOnly}
              onSaved={(value: BasicSectionValue) => setProject((p) => ({ ...p, ...value }))}
            />
          </div>
          <div id="panel-story" role="tabpanel" aria-labelledby="tab-story" hidden={tab !== 'story'}>
            <StorySectionForm
              projectId={project.id}
              initial={project.content}
              readOnly={readOnly}
              onSaved={(content: string) => setProject((p) => ({ ...p, content }))}
            />
          </div>
          <div id="panel-rewards" role="tabpanel" aria-labelledby="tab-rewards" hidden={tab !== 'rewards'}>
            <RewardSectionForm
              projectId={project.id}
              initial={project.rewards}
              readOnly={readOnly}
              onSaved={(rewards: EditorReward[]) => setProject((p) => ({ ...p, rewards }))}
            />
          </div>
          <div id="panel-creator" role="tabpanel" aria-labelledby="tab-creator" hidden={tab !== 'creator'}>
            <CreatorSectionForm
              projectId={project.id}
              initial={project.creator}
              readOnly={readOnly}
              onSaved={(value: EditorCreatorProfile) => setProject((p) => ({ ...p, creator: value }))}
            />
          </div>
        </div>

        <div className="mt-12 flex items-center gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
          <Button onClick={handleSubmitReview} disabled={readOnly || submit.status === 'saving'}>
            {submit.status === 'saving' ? '신청 중…' : '심사 신청'}
          </Button>
          {submit.status === 'success' && (
            <span className="typo-caption text-green-600 dark:text-green-400">심사를 신청했습니다.</span>
          )}
          {submit.status === 'error' && (
            <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{submit.message}</span>
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
    },
  };
});
