import MarkdownRenderer from '../MarkdownRenderer';
import ImageHero, { HERO_SCRIM_STRONG } from '../common/ImageHero';
import { Section } from '../ui/Section';
import FundingProgress from './FundingProgress';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Notice } from '../ui/Notice';
import RewardCard from './RewardCard';
import BackerWall from './BackerWall';
import SupporterTicker from './SupporterTicker';
import FundingTrustNotice from './FundingTrustNotice';
import { formatPriceAmount } from '../../data/pricing';
import { getSiteConfig } from '../../data/siteConfig';
// `mergeRewardRemaining`은 `shape.ts`에서 직접 가져온다 — `lib/funding/projects.ts`는
// 최상위에서 node:fs·node:path를 실행하는 서버 전용 모듈이라(FUNDING_DIR), 이 컴포넌트가
// 거기서 런타임 값을 가져가면 그 모듈 전체가 클라이언트 번들에 끌려 들어가 빌드가
// 깨진다(2026-09-17 재리뷰 지적). 타입만 쓰는 아래 import는 컴파일 시 지워지므로 안전하다.
import { mergeRewardRemaining } from '../../lib/funding/shape';
import type { FundingProject, FundingReward, ProjectState } from '../../lib/funding/projects';
import type { FundingLang } from '../../lib/funding/translatedSlugs';

const STATE_LABEL: Record<FundingLang, Record<ProjectState, string>> = {
  ko: { live: '진행 중', upcoming: '오픈 예정', closed: '마감', draft: '' },
  en: { live: 'Live', upcoming: 'Opening soon', closed: 'Closed', draft: '' },
};

/** 영문판의 문의 주소 — 해외에서 후원하려는 사람이 쓸 곳. */
const STUDIO_EMAIL = 'hello@studionol.co.kr';

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
  /**
   * 히어로 "펀딩하기" — 결제 화면을 바로 연다(리워드 없이 연 결제 모달). 없으면 /pledge 링크로
   * 이동한다. 모든 "펀딩하기"가 같은 결제 화면에 닿게 하는 통일 규칙(2026-09-29).
   */
  onPledge?: () => void;
  onSelectReward?: (reward: FundingReward) => void;
  /** 공개에 동의한 후원자 명단(공개 페이지의 폴링 결과). */
  backers?: string[];
  /** 명단에 이름이 오르지 않는 후원 건수 — BackerWall이 그만큼 "익명"을 잇는다. */
  anonymousBackers?: number;
  /** 후원자가 남긴 응원 메시지(공개 페이지의 폴링 결과). */
  messages?: { name: string; message: string; at: number }[];
  /** 메시지가 올 것을 알지만 아직 폴링 전인가 — 응원 메시지 칸 자리를 미리 잡는다. */
  messagesPending?: boolean;
  /**
   * 화면 언어. 번역본이 있는 프로젝트(lib/funding/translatedSlugs.ts)만 en으로 그린다. en은 글자만 바뀌는 것이
   * 아니라 **후원 동선이 다르다** — 결제·약관·배송이 한국 기준이라 리워드 모달을 열지 않고 한국어 결제 화면으로
   * 보내며, 그 사실과 해외 후원 문의처를 리워드 위에 밝힌다.
   */
  lang?: FundingLang;
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
  onPledge,
  backers = [],
  anonymousBackers = 0,
  messages = [],
  messagesPending = false,
  lang = 'ko',
}: ProjectDetailViewProps) {
  const en = lang === 'en';
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
        locale={lang}
        priority
        overlayGradient={HERO_SCRIM_STRONG}
        backgroundImage={project.heroImage ?? project.cover}
        imageAlt=""
        title={project.title}
        subtitle={
          <>
            {/*
              알약(상태·모금액)을 요약 **위**, 제목 바로 아래에 둔다. 요약 뒤에 두면 모바일에서
              화면 밖이거나 하단 고정 "펀딩하기" 바(MobileStickyCta) 뒤에 가려진다(2026-09-28
              실측: iPhone 13에서 알약 하단 621px인데 고정 바가 그 위를 덮고, iPhone SE 568px
              화면에서는 아예 밖). 첫 화면에 "이만큼 모였다"를 싣는 것이 이 알약의 일이다.
              현황을 아직 모르면(미리보기·집계 전) 예전처럼 목표를 적는다.
            */}
            <span className="mb-6 flex flex-wrap justify-center gap-2">
              {STATE_LABEL[lang][state] && <Badge tone="onImage" size="md">{STATE_LABEL[lang][state]}</Badge>}
              <Badge tone="onImage" size="md">
                {en
                  ? interactive && status
                    ? <><span className="font-semibold tabular-nums">₩{formatPriceAmount(status.pledgedAmount)}</span> raised · {percent}%</>
                    : <>Goal ₩{formatPriceAmount(project.goalAmount)}</>
                  : interactive && status
                    ? <><span className="font-semibold tabular-nums">{formatPriceAmount(status.pledgedAmount)}원</span> 모금 · {percent}%</>
                    : <>목표 {formatPriceAmount(project.goalAmount)}원</>}
              </Badge>
            </span>
            {project.summary}
          </>
        }
        ctaButtons={
          canPledge ? (
            // 카카오가 아닌 목적지이므로 옐로를 쓰지 않는다(CLAUDE.md 카카오 CTA 규칙).
            // <lg에서는 MobileStickyCta가 상시 떠 있어 같은 버튼이 한 화면에 둘이 된다.
            // 공용 Button — 모달·결제 화면·모바일 하단 바의 주 버튼과 같은 크기·모서리. 사진 위라
            // 포커스 링만 흰색으로 바꾼다. 스크롤이 아니라 결제 화면을 연다(onPledge).
            <Button asChild size="lg" className="hidden lg:inline-flex focus-visible:ring-white/80 focus-visible:ring-offset-black/40">
              <a
                href={en ? '#rewards' : `/ko/funding/${project.slug}/pledge`}
                onClick={(e) => {
                  if (!onPledge || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onPledge();
                }}
              >
                {en ? 'Back this project' : '펀딩하기'}
              </a>
            </Button>
          ) : null
        }
      />

      {/*
        본문(왼쪽)과 리워드 패널(오른쪽)을 나란히 둔다. 패널은 데스크톱에서 sticky라 본문을
        읽는 내내 리워드가 화면에 남는다. 모금 현황은 본문 컬럼 맨 위에 있다(아래 주석).
      */}
      <Section className="pb-28 pt-16 lg:pb-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="min-w-0">
            {statusError && (
              <Notice tone="error" className="mb-6">{en ? 'Could not load the campaign status. Please reload the page.' : '현황을 불러오지 못했습니다. 새로고침해 주세요.'}</Notice>
            )}
            {/*
              모금 현황은 히어로 바로 아래, 본문 컬럼 맨 위에 둔다(saf-2026과 같은 배치,
              2026-09-28 운영자 결정). 예전엔 오른쪽 패널 맨 위였는데, <lg에서는 그 패널이
              본문이 **다 끝난 뒤에** 쌓여 모바일 방문자는 모금액·달성률을 사실상 못 봤다.
              데스크톱에서 스크롤 내내 보이던 것은 잃지만, 첫 화면에서 "이만큼 모였다"가
              보이는 쪽이 후원 결정에 더 크다. 오른쪽 패널은 리워드만 남아 짧아진다.
            */}
            <div className="glass-card mb-10 rounded-2xl p-5 sm:p-6">
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
                  lang={lang}
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
            {/*
              순환 카드는 모금 현황 바로 아래, 본문 폭에 둔다. Section 전체 폭으로 빼면
              데스크톱에서 오른쪽 리워드 패널이 카드 높이만큼 아래로 밀린다.

              space-y-10이 카드와 본문 사이 간격을 준다. 메시지가 없으면 SupporterTicker가
              DOM에 아무것도 남기지 않으므로 article이 첫 자식이 되어 빈 여백조차 생기지
              않는다 — 래퍼에 mb를 주면 그 경우 빈 간격만 남는다.
            */}
            <div className="space-y-10">
              <SupporterTicker messages={messages} pending={messagesPending} lang={lang} />
              <article className="prose prose-lg max-w-none dark:prose-invert">
                <MarkdownRenderer content={project.content} locale={lang} />
              </article>
            </div>
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
              <BackerWall names={backers} anonymousCount={anonymousBackers} messages={messages} lang={lang} />
              <FundingTrustNotice lang={lang} />
            </div>
          </div>

          <aside id="rewards" className="scroll-mt-20 lg:sticky lg:top-24">
            {/* 여기에 표지 썸네일을 두지 않는다. `cover`는 프로젝트의 얼굴(행사 포스터)이지
                리워드의 얼굴이 아니다 — 리워드 이미지는 각 리워드가 `image`로 갖는다. */}
            <h2 className="typo-card-title text-gray-900 dark:text-white">{en ? 'Rewards' : '리워드'}</h2>
            <p className="typo-card-meta mt-1">{en ? 'What you receive for each pledge amount.' : '펀딩 금액에 따라 돌려드릴 구성입니다.'}</p>
            {en && (
              <Notice tone="info" className="mt-4">
                Checkout is in Korean, with Korean payment methods, and rewards ship within South Korea only.
                To back the album from abroad, write to <a href={`mailto:${STUDIO_EMAIL}?subject=${encodeURIComponent(project.title)}`} className="underline underline-offset-2">{STUDIO_EMAIL}</a>.
              </Notice>
            )}
            <div className="mt-4 space-y-4">
              {project.rewards.map((r) => (
                <RewardCard
                  key={r.id}
                  reward={r}
                  remaining={rewardRemaining[r.id]}
                  pledgeHref={`/ko/funding/${project.slug}/pledge?reward=${encodeURIComponent(r.id)}`}
                  canPledge={canPledge}
                  // 영문판은 모달(한국어 결제 위젯)을 띄우지 않고 한국어 결제 화면으로 간다 — 버튼에 그 사실을 적는다.
                  onSelect={canPledge && !en ? onSelectReward : undefined}
                  lang={lang}
                  pledgeLabel={en ? 'Back this (Korean checkout)' : undefined}
                />
              ))}
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
