import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

import { logoutCreator } from '../../../../../components/funding/creator/api';
import { CreatorConsoleTabs } from '../../../../../components/funding/creator/CreatorConsoleTabs';
import { REVIEW_STATUS_LABEL } from '../../../../../components/funding/creator/types';
import { createShowSubmission } from '../../../../../components/shows/organizer/api';
import { Badge, type BadgeTone } from '../../../../../components/ui/Badge';
import { Button } from '../../../../../components/ui/Button';
import { EmptyState } from '../../../../../components/ui/EmptyState';
import { Notice } from '../../../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../../../components/ui/PageHeader';
import { authenticateCreatorRequest } from '../../../../../lib/funding/creatorAuth';
import { withI18nServerProps } from '../../../../../lib/getStatic';
import { formatShowtime } from '../../../../../lib/shows/organizer/email';
import { isShowPagePublic } from '../../../../../lib/shows/organizer/policy';
import { listSubmissionsForCreator } from '../../../../../lib/shows/organizer/submissions';

/** 공연 탭의 한 줄 — 초안 전체는 싣지 않는다(편집 화면이 따로 읽는다). */
export interface CreatorShowSummary {
  id: string;
  title: string;
  reviewStatus: string;
  showSlug: string | null;
  /** 연결된 공연의 상태 — 공개 페이지가 열린 상태에서만 링크를 띄운다(isShowPagePublic). */
  showStatus: string | null;
  /** 첫 회차를 읽기 좋은 한국어로('2026년 11월 20일(금) 19:30'). 회차가 없으면 null. */
  firstShowtimeLabel: string | null;
}

interface Props {
  shows: CreatorShowSummary[];
  /** 공연 목록을 못 읽었다(show_submissions 표 없음 등). 콘솔의 다른 탭은 그대로 쓸 수 있다. */
  loadFailed: boolean;
}

/** 심사 상태 → 배지 색. 펀딩 탭(`../index.tsx`)과 같은 표 — 페이지 모듈끼리 import하지 않으려고 복제한다. 바꾸면 둘 다 바꿀 것. */
const REVIEW_STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral', submitted: 'info', changes_requested: 'warning', approved: 'success', rejected: 'error',
};

export default function CreatorShowsHome({ shows, loadFailed }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    const result = await createShowSubmission();
    if (result.ok) {
      router.push(`/ko/funding/creator/shows/${result.id}`);
      return;
    }
    setCreateError(result.message);
    setCreating(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    const result = await logoutCreator();
    if (result.ok) {
      router.push('/ko/funding/apply');
      return;
    }
    setLogoutError(result.message);
    setLoggingOut(false);
  };

  return (
    <>
      <Head>
        <title>내 공연 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="wide">
        <PageHeader
          title="내 공연"
          meta={
            <Button type="button" variant="ghost" size="sm" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? '로그아웃 중…' : '로그아웃'}
            </Button>
          }
        />
        <CreatorConsoleTabs current="shows" />
        {logoutError && <Notice tone="error" className="mb-6">{logoutError}</Notice>}
        {loadFailed ? (
          <Notice tone="error">공연 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</Notice>
        ) : shows.length === 0 ? (
          <EmptyState title="아직 등록한 공연이 없어요." description="공연 정보를 적어 제출하면, 심사를 거쳐 예매 페이지가 열려요." />
        ) : (
          <ul className="space-y-3">
            {shows.map((s) => (
              <li key={s.id} className="glass-card rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold">{s.title || '(제목 없음)'}</span>
                  <Badge tone={REVIEW_STATUS_TONE[s.reviewStatus] ?? 'neutral'}>{REVIEW_STATUS_LABEL[s.reviewStatus] ?? s.reviewStatus}</Badge>
                </div>
                <p className="typo-card-meta mt-2">{s.firstShowtimeLabel ? `첫 회차 ${s.firstShowtimeLabel}` : '회차 미정'}</p>
                <div className="mt-3 flex gap-4">
                  <Link href={`/ko/funding/creator/shows/${s.id}`} className="text-sm underline underline-offset-2">
                    편집하기
                  </Link>
                  {s.reviewStatus === 'approved' && s.showSlug && isShowPagePublic(s.showStatus) && (
                    <Link href={`/ko/shows/${s.showSlug}`} className="text-sm underline underline-offset-2">
                      공개된 페이지 보기
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loadFailed && (
          <div className="mt-10 flex items-center gap-3">
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? '만드는 중…' : '공연 등록하기'}
            </Button>
            {createError && <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{createError}</span>}
          </div>
        )}
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  // 펀딩 탭과 같은 가드 — 콘솔은 ko 전용이고, 세션 쿠키가 로케일을 가리지 않는다.
  if (context.params?.locale !== 'ko') {
    return { redirect: { destination: '/ko/funding/creator/shows', permanent: false } };
  }
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };
  /**
   * show_submissions 표가 아직 없는 DB(마이그레이션 전)에서도 페이지는 떠야 한다 — 실패하면 안내만 보이고,
   * 펀딩·상점 탭은 이 조회와 무관하게 그대로 쓸 수 있다.
   */
  try {
    const shows = (await listSubmissionsForCreator(auth.creatorId)).map((s) => ({
      id: s.id,
      title: s.title,
      reviewStatus: s.reviewStatus,
      showSlug: s.showSlug,
      showStatus: s.showStatus,
      firstShowtimeLabel: s.firstShowtime ? formatShowtime(s.firstShowtime) : null,
    }));
    return { props: { shows, loadFailed: false } };
  } catch (error: unknown) {
    console.error('[shows] 주최자 공연 목록 조회 실패:', error);
    return { props: { shows: [], loadFailed: true } };
  }
});

// 디자인 판 — lib/designEdition.ts
CreatorShowsHome.designEdition = 'v2';
