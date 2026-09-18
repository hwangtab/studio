import MarkdownRenderer from '../MarkdownRenderer';
import ImageHero, { HERO_SCRIM_STRONG } from '../common/ImageHero';
import { Section } from '../ui/Section';
import FundingProgress from './FundingProgress';
import RewardCard from './RewardCard';
import BackerWall from './BackerWall';
import FundingTrustNotice from './FundingTrustNotice';
import { formatPriceAmount } from '../../data/pricing';
import { getSiteConfig } from '../../data/siteConfig';
// `mergeRewardRemaining`은 `shape.ts`에서 직접 가져온다 — `lib/funding/projects.ts`는
// 최상위에서 node:fs·node:path를 실행하는 서버 전용 모듈이라(FUNDING_DIR), 이 컴포넌트가
// 거기서 런타임 값을 가져가면 그 모듈 전체가 클라이언트 번들에 끌려 들어가 빌드가
// 깨진다(2026-09-17 재리뷰 지적). 타입만 쓰는 아래 import는 컴파일 시 지워지므로 안전하다.
import { mergeRewardRemaining } from '../../lib/funding/shape';
import type { FundingProject, FundingReward, ProjectState } from '../../lib/funding/projects';

const STATE_LABEL: Record<ProjectState, string> = { live: '진행 중', upcoming: '오픈 예정', closed: '마감', draft: '' };

export interface ProjectDetailViewProps {
  project: FundingProject;
  state: ProjectState;
  /**
   * 공개 페이지의 폴링 결과. 마운트 직후(fetch 응답 전)에는 null일 수 있다 — 그때는
   * `FundingProgress`가 "모금 현황 집계 중…"을 보여준다. **미리보기 표시 여부는 이 값이
   * 아니라 `interactive`로 갈린다** — status만으로 가르면 공개 페이지의 정적 HTML(SSG,
   * fetch 전)에 "미리보기" 문구가 그대로 박힌다.
   */
  status?: { pledgedAmount: number; backerCount: number } | null;
  /** 후원 버튼과 실제 모금 현황을 그릴지. 미리보기는 false — 진행률 자리에 "미리보기" 표시를 낸다. */
  interactive: boolean;
  /**
   * 마운트 후에만 값을 준다(D-day). 렌더 본문에서 `new Date()`를 부르면 서버(빌드·요청
   * 시각)와 클라이언트 값이 달라 하이드레이션 불일치가 난다 — 공개 페이지가 이 시계를
   * 관리해서 넘긴다. 없으면(기본값 null) D-day를 비운다(미리보기는 실시간 시계가 필요 없다).
   */
  now?: Date | null;
  /** 공개 페이지의 상태 폴링이 실패했을 때. 미리보기는 폴링하지 않으므로 기본 false. */
  statusError?: boolean;
  /** 리워드별 남은 수량(공개 페이지의 폴링 결과). 없으면 파일의 총 수량을 그대로 쓴다. */
  remaining?: Record<string, number | null>;
  /** 리워드 카드 클릭 시 모달을 여는 콜백(공개 페이지 전용). `interactive`가 false면 쓰이지 않는다. */
  onSelectReward?: (reward: FundingReward) => void;
  /** 공개에 동의한 후원자 명단(공개 페이지의 폴링 결과). */
  backers?: string[];
  /** 후원자가 남긴 응원 메시지(공개 페이지의 폴링 결과). */
  messages?: { name: string; message: string; at: number }[];
}

/**
 * 펀딩 상세의 히어로·본문·리워드 합성.
 *
 * 공개 페이지(`pages/[locale]/funding/[slug]/index.tsx`)와 개설자 미리보기
 * (`pages/[locale]/funding/creator/[id]/preview.tsx`)가 이 컴포넌트를 함께 쓴다.
 * SEO 메타·구조화 데이터·상태 폴링(`useFundingStatus`)·후원 CTA(리워드 모달·모바일
 * 고정 바)는 각 페이지에 남아 있다 — 미리보기에는 있으면 안 되는 것들이다.
 */
export default function ProjectDetailView({
  project,
  state,
  status = null,
  interactive,
  now = null,
  statusError = false,
  remaining,
  onSelectReward,
  backers = [],
  messages = [],
}: ProjectDetailViewProps) {
  const canPledge = interactive && state === 'live';
  const rewardRemaining = mergeRewardRemaining(project.rewards, remaining);
  const mailOrderSalesNumber = getSiteConfig('ko').mailOrderSalesNumber;

  // pages/api/funding/[slug]/status.ts와 같은 식(Math.floor, 클램프 없음)이어야 공개
  // 페이지의 숫자가 폴링 응답의 percent와 한 픽셀도 어긋나지 않는다 — 목표 초과 달성이면
  // 100을 넘는 값을 그대로 보여야 "137%"가 "100%"로 잘리지 않는다(막대 폭만 FundingProgress가
  // 안에서 100으로 클램프한다).
  const percent = status ? Math.floor((status.pledgedAmount / project.goalAmount) * 100) : 0;

  return (
    <>
      {/*
        히어로는 사이트 공용 `ImageHero`를 그대로 쓴다(스크림 2단계·font-hero·투명 헤더가
        여기 묶여 있다). **정렬도 기본값(가운데)을 따른다** — `textAlign`을 넘기는 페이지는
        이 사이트에 하나도 없다.

        스크림만 STRONG으로 올린다. 짐작이 아니라 실측이다(ImageHero.tsx:27 — "짐작하지
        말고 재 볼 것"): 가운데 글씨 자리의 평균 휘도가 128/255이고, 그 안을 가로지르는
        LP의 밝은 띠는 167/255다. 기본 HERO_SCRIM으로는 그 띠가 3.8:1까지 떨어져 AA(4.5:1)
        에도 못 미친다. STRONG이면 글씨 자리 8.7:1, 밝은 띠 5.9:1로 둘 다 목표(6:1) 위다.
        배경을 갈아 끼우면 다시 잴 것.
      */}
      <ImageHero
        locale="ko"
        priority
        overlayGradient={HERO_SCRIM_STRONG}
        backgroundImage={project.heroImage ?? project.cover}
        imageAlt=""
        title={project.title}
        subtitle={
          <>
            {project.summary}
            <span className="mt-6 flex flex-wrap justify-center gap-2">
              {STATE_LABEL[state] && (
                <span className="inline-block rounded-full border border-white/40 bg-black/30 px-4 py-1.5 text-sm">
                  {STATE_LABEL[state]}
                </span>
              )}
              <span className="inline-block rounded-full border border-white/40 bg-black/30 px-4 py-1.5 text-sm">
                목표 {formatPriceAmount(project.goalAmount)}원
              </span>
            </span>
          </>
        }
        ctaButtons={
          canPledge ? (
            // 카카오가 아닌 목적지이므로 옐로를 쓰지 않는다(CLAUDE.md 카카오 CTA 규칙).
            // <lg에서는 FundingMobileCta가 상시 떠 있어 같은 버튼이 한 화면에 둘이 된다.
            <a
              href="#rewards"
              className="hidden h-14 lg:inline-flex items-center justify-center rounded-xl bg-primary px-8 text-lg font-bold text-white shadow-md transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
            >
              펀딩하기
            </a>
          ) : null
        }
      />

      {/*
        본문(왼쪽)과 펀딩 패널(오른쪽)을 나란히 둔다. 패널은 데스크톱에서 sticky라 본문을
        읽는 내내 모금 현황과 리워드가 화면에 남는다.
      */}
      <Section className="pb-28 pt-16 lg:pb-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="min-w-0">
            {statusError && (
              <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                현황을 불러오지 못했습니다. 새로고침해 주세요.
              </p>
            )}
            <article className="prose prose-lg max-w-none dark:prose-invert">
              <MarkdownRenderer content={project.content} locale="ko" />
            </article>
            {/*
              전자상거래법상 판매자(스튜디오 놀)와 개설자를 구분해 표시한다(펀딩 약관
              제4조 — "개설자가 있는 프로젝트는 그 사실과 개설자를 프로젝트 페이지에
              함께 표시합니다"). 마크다운 프로젝트(project.creator === null, 스튜디오가
              직접 연 것)는 아무것도 표시하지 않는다 — 지금 화면 그대로다.
            */}
            {project.creator && (
              <p className="typo-card-meta mt-4 text-gray-600 dark:text-gray-300">
                개설자 {project.creator.name} · 판매자 스튜디오 놀
                {mailOrderSalesNumber ? ` (통신판매업 신고 ${mailOrderSalesNumber})` : ''}
              </p>
            )}
            <div className="mt-12 space-y-8">
              <BackerWall names={backers} messages={messages} />
              <FundingTrustNotice />
            </div>
          </div>

          <aside id="rewards" className="scroll-mt-20 lg:sticky lg:top-24">
            <div className="glass-card rounded-2xl p-5 sm:p-6">
              {interactive ? (
                // 공개 페이지는 status가 아직 null이어도(마운트 직후, fetch 응답 전) 항상
                // FundingProgress를 그린다 — 폴링 대기·실패는 그 컴포넌트가 이미
                // "모금 현황 집계 중…"으로 다룬다. 여기서 status===null을 "미리보기"로
                // 잘못 읽으면 정적 HTML(SSG)에 "미리보기" 문구가 그대로 박힌다(마운트 전에는
                // status가 항상 null이다).
                <FundingProgress
                  goalAmount={project.goalAmount}
                  endAt={project.endAt}
                  now={now}
                  data={status ? { raisedAmount: status.pledgedAmount, backerCount: status.backerCount, percent, state } : null}
                />
              ) : (
                // 미리보기는 실제 모금액이 없다 — "모금 현황 집계 중…"(폴링 실패/대기)과
                // 헷갈리지 않도록 다른 문구를 낸다.
                <div className="min-h-[120px]" aria-live="polite">
                  <p className="typo-card-meta">미리보기 — 공개되면 실제 모금 현황이 여기 표시됩니다.</p>
                  <div
                    className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                    role="progressbar"
                    aria-label="펀딩 달성률"
                    aria-valuenow={0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full rounded-full bg-primary/40" style={{ width: '0%' }} />
                  </div>
                </div>
              )}
            </div>
            {/* 여기에 표지 썸네일을 두지 않는다. `cover`는 프로젝트의 얼굴(행사 포스터)이지
                리워드의 얼굴이 아니다 — 리워드 이미지는 각 리워드가 `image`로 갖는다. */}
            <h2 className="typo-card-title mt-8 text-gray-900 dark:text-white">리워드</h2>
            <p className="typo-card-meta mt-1">펀딩 금액에 따라 돌려드릴 구성입니다.</p>
            <div className="mt-4 space-y-4">
              {project.rewards.map((r) => (
                <RewardCard
                  key={r.id}
                  reward={r}
                  remaining={rewardRemaining[r.id]}
                  pledgeHref={`/ko/funding/${project.slug}/pledge?reward=${encodeURIComponent(r.id)}`}
                  canPledge={canPledge}
                  onSelect={canPledge ? onSelectReward : undefined}
                />
              ))}
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
