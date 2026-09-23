/* eslint-disable @next/next/no-html-link-for-pages --
 * 이 페이지의 URL에는 관리 토큰(`?token=`)이 원문 그대로 실린다. 이탈 링크는 next/link가
 * 아니라 문서 이동이어야 한다 — 클라 전환으로 공개 페이지에 나갔다 뒤로가기 하면 그 사이
 * mount된 gtag가 살아 있는 채로 돌아와 토큰이 실린 이 URL을 다시 측정한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트:
 * tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';
import { useState } from 'react';

import { withI18nServerProps } from '../../../../lib/getStatic';

interface Props { token: string | null }

// 화면이 있는 페이지다(예전엔 항상 redirect만 하는 화면 없는 페이지였다). 회사 메일의
// 링크 검사기(Safe Links·Proofpoint)나 카카오톡·슬랙 미리보기 봇이 배달 시점에 이 GET
// 주소를 한 번 긁는 문제(2026-09-17 리뷰 지적)를 pages/api/funding/download.ts와 같은
// 방식으로 고친다 — 상태를 바꾸는 소진은 사람이 누른 POST에서만 일어나야 한다. 그래서
// getServerSideProps는 토큰을 **소진하지 않고** 그대로 props로 넘기기만 하고, 실제 로그인
// 소진은 아래 버튼이 부르는 pages/api/funding/creator/session.ts(POST 전용)가 맡는다.
export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  // funding의 다른 SSR 형제 페이지와 같은 자리, 같은 방식(ko 전용 → 비-ko는 ko로 되돌림).
  // 여기서는 쿼리스트링(토큰)을 반드시 그대로 들고 가야 한다 — 잃으면 이 착지 자체가
  // "링크가 만료됐거나 이미 쓰였다"로 오판돼 로그인이 깨진다. resolvedUrl은 사용자가
  // 실제로 요청한 경로+쿼리 원문이라 재조립 없이 그대로 옮긴다.
  if (context.params?.locale !== 'ko') {
    const search = context.resolvedUrl.split('?')[1];
    return { redirect: { destination: `/ko/funding/creator/auth${search ? `?${search}` : ''}`, permanent: false } };
  }
  const token = typeof context.query.token === 'string' && context.query.token ? context.query.token : null;
  return { props: { token } };
});

export default function CreatorAuth({ token }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    if (!token) return;
    // 이 URL에는 15분 유효한 원문 토큰이 실려 있다. 아래에서 어떤 결과가 나오든(성공 시
    // 대시보드로 이동, 실패 시 fetch·catch 어느 쪽이든) location.href 대입에는
    // rel="noreferrer"를 붙일 수 없고, 사이트 Referrer-Policy(strict-origin-when-cross-origin)는
    // 동일 출처 이동에 전체 URL을 리퍼러로 보낸다 — 세션 API가 401(소진 실패) 말고도
    // 403(Origin 불허)·400·500을 낼 수 있고 그 경우들에서는 토큰이 소진되지 않은 채
    // 살아 있으므로, 지우지 않으면 도착지 gtag의 page_referrer에 원문이 그대로 실린다.
    // fetch를 부르기 전에 지워 둔다 — 응답을 기다리는 동안에도 주소창에 토큰이 남아
    // 있을 이유가 없다. **지우지 말 것**: 없어 보여도 이게 유일한 방어선이다.
    window.history.replaceState(null, '', '/ko/funding/creator/auth');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/funding/creator/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        window.location.href = '/ko/funding/creator';
        return;
      }
      // 링크가 만료됐는지 이미 쓰였는지는 구분해 알리지 않는다(consumeCreatorLoginToken과
      // 같은 이유). 그리고 여기서는 아예 페이지를 떠나지 않는다 — 위 replaceState로 URL은
      // 이미 안전하지만, 이동하지 않으면 리퍼러 노출면 자체가 생기지 않는다. 다시 받고
      // 싶으면 아래 "펀딩 신청 페이지로" 링크(이미 e=link를 달고 있다)를 사람이 직접 누른다.
      //
      // 401과 그 외(5xx 등)는 다른 문구를 보여준다. session.ts는 토큰을 먼저 소진하고 나서
      // 세션을 만들기 때문에, 세션 생성이 실패하면 토큰은 이미 죽었는데 401과 같은 "만료됐거나
      // 이미 사용됨" 문구를 보여주면 개설자는 새 링크를 받아도 같은 자리에서 같은 문구를
      // 반복해서 보게 되고 원인을 알 수 없다. 5xx는 "무엇이 잘못됐는지"를 지어내지 않고
      // 일시적인 오류라고만 알린다.
      if (res.status === 401) {
        setError('링크가 만료됐거나 이미 사용되었습니다. 아래 링크로 다시 받아 주세요.');
      } else {
        setError('일시적인 오류로 로그인하지 못했습니다. 잠시 후 새 링크로 다시 시도해 주세요.');
      }
      setBusy(false);
    } catch {
      setError('연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>개설자 로그인 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        {/* 헤더·푸터가 없는 bare 화면이라(Layout의 isPrivatePaymentPage) 상호를 본문에서
            직접 밝힌다 — 탭 제목은 화면에 안 보이고, 메일 링크로 들어온 사람이 피싱과
            구별할 수 있어야 한다. */}
        <p className="typo-card-meta mb-2">스튜디오 놀</p>
        <h1 className="text-2xl font-bold">개설자 로그인</h1>
        {token ? (
          <>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              메일로 받은 링크입니다. 아래 버튼을 눌러 로그인해 주세요.
            </p>
            <button
              type="button"
              onClick={login}
              disabled={busy}
              className="mt-8 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {busy ? '로그인 중…' : '로그인하기'}
            </button>
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </>
        ) : (
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            로그인 링크가 없습니다. 이메일로 다시 받아 주세요.
          </p>
        )}
        {/* 이 페이지는 no-store·측정 제외 대상이라 next/link를 쓰지 않는다(문서 이동만
            허용 — lib/analytics/privatePaths.ts 주석 참조). 목적지는 측정 대상인 공개
            페이지라 rel="noreferrer"로 Referrer-Policy가 보내는 전체 URL 유출을 막는다. */}
        <a
          href="/ko/funding/apply?e=link"
          rel="noreferrer"
          className="mt-8 inline-block text-sm underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter"
        >
          펀딩 신청 페이지로
        </a>
      </main>
    </>
  );
}
