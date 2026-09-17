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
      // 같은 이유) — 신청 페이지가 e=link 쿼리를 보고 안내 문구를 띄운다.
      window.location.href = '/ko/funding/apply?e=link';
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
      </main>
    </>
  );
}
