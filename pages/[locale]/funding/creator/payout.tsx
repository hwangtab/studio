import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { logoutCreator } from '../../../../components/funding/creator/api';
import { CreatorConsoleTabs } from '../../../../components/funding/creator/CreatorConsoleTabs';
import { PayoutSectionForm } from '../../../../components/funding/creator/PayoutSectionForm';
import type { EditorPayoutSummary } from '../../../../components/funding/creator/types';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { Notice } from '../../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../../components/ui/PageHeader';
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
import { hasApprovedEngagement } from '../../../../lib/funding/creatorEligibility';
import { loadPayoutSummary } from '../../../../lib/funding/creatorProjectWrite';
import { withI18nServerProps } from '../../../../lib/getStatic';
import { beforePopStateForScroll } from '../../../../lib/routeScroll';

interface Props {
  /** 정산 정보를 받아도 되는 계정인가 — 승인된 펀딩·공연·상점 중 하나(`hasApprovedEngagement`). */
  eligible: boolean;
  /**
   * 등록 상태 요약. 자격이 없으면 `null`(읽지도 않는다).
   * **계좌·주민등록번호의 평문·암호문은 여기 없다** — 등록 여부와 계좌 뒤 4자리뿐이다. props는 `__NEXT_DATA__`로
   * 페이지 HTML에 그대로 실린다(`lib/funding/creatorProjectWrite.ts`의 `CreatorPayoutSummary` 주석).
   */
  payout: EditorPayoutSummary | null;
}

const UNSAVED_CHANGES_MESSAGE = '저장하지 않은 변경이 있어요. 지금 나가면 그 내용이 사라져요. 계속할까요?';

export default function CreatorPayoutPage({ eligible, payout: initialPayout }: Props) {
  const router = useRouter();
  const [payout, setPayout] = useState(initialPayout);
  const [dirty, setDirty] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // 저장 뒤 서버 값을 다시 읽으면(아래 refresh) props가 바뀐다 — 국세청 상태처럼 화면이 추측하지 않는 값을 갈아 끼운다.
  useEffect(() => { setPayout(initialPayout); }, [initialPayout]);

  // 이탈 가드 — 공연 편집(`shows/[id].tsx`)과 같은 세 겹(새로고침·닫기 / 앱 안 이동 / 뒤로가기).
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
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
    return () => { router.beforePopState(beforePopStateForScroll); };
  }, [dirty, router]);

  const handleSaved = (next: EditorPayoutSummary) => {
    setPayout(next);
    // 같은 주소로 다시 읽어 서버가 실제로 저장한 상태(국세청 조회 결과 등)로 맞춘다. 주소가 같아 이탈 가드는 지나간다.
    router.replace(router.asPath, undefined, { scroll: false }).catch(() => {});
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
        <title>정산 정보 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="wide">
        <PageHeader
          title="정산 정보"
          meta={
            <Button type="button" variant="ghost" size="sm" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? '로그아웃 중…' : '로그아웃'}
            </Button>
          }
        />
        <CreatorConsoleTabs current="payout" />
        {logoutError && <Notice tone="error" className="mb-6">{logoutError}</Notice>}
        {eligible && payout ? (
          <div className="max-w-2xl">
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              정산 정보는 계정에 한 벌이라 펀딩·공연·상점 정산에 함께 쓰여요.
            </p>
            <PayoutSectionForm initial={payout} onSaved={handleSaved} onDirtyChange={setDirty} />
          </div>
        ) : (
          <EmptyState
            title="아직 정산 정보를 넣을 수 없어요."
            description="펀딩 프로젝트·공연·상점 중 하나가 승인되면 이곳에서 정산 계좌와 세금 정보를 등록할 수 있어요."
          />
        )}
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  // 다른 콘솔 탭과 같은 가드 — 콘솔은 ko 전용이다.
  if (context.params?.locale !== 'ko') {
    return { redirect: { destination: '/ko/funding/creator/payout', permanent: false } };
  }
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };

  // 반려될 신청서에 계좌·주민번호를 미리 받지 않는다 — 자격이 없으면 요약도 읽지 않는다(저장 API도 같은 판정으로 막는다).
  if (!(await hasApprovedEngagement(auth.creatorId))) {
    return { props: { eligible: false, payout: null } };
  }
  return { props: { eligible: true, payout: await loadPayoutSummary(auth.creatorId) } };
});

// 디자인 판 — lib/designEdition.ts
CreatorPayoutPage.designEdition = 'v2';
