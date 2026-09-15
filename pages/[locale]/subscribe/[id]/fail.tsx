/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 관리 토큰·paymentKey·orderId가 실린다)의 이탈 링크는 next/link가
 * 아니라 문서 이동이어야 한다. 클라 전환으로 공개 페이지에 나갔다 뒤로가기 하면, 그 사이
 * mount된 gtag가 살아 있는 채로 비밀값이 붙은 URL에 돌아와 page_view를 보낸다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트:
 * tests/pages/privateLinkNavigation.test.ts
 */
import { withI18nServerProps } from '../../../../lib/getStatic';
import Head from 'next/head';

/**
 * 토스 카드 등록(빌링키 인증) 실패 코드 → 우리가 쓴 문구.
 *
 * 예전엔 쿼리의 `message`를 그대로 주 안내문으로 출력했다. 이 주소는 결제창이 만들지만
 * 누구나 손으로 칠 수 있고(getServerSideProps가 구독 존재 여부도 토큰 일치도 보지 않는다),
 * 그래서 우리 도메인 안에 **공격자가 고른 문장**(가짜 연락처·가짜 안내)을 띄울 수 있었다.
 * 이제 `code`만 받아 이 표로 옮기고 `message`는 읽지도 않는다 — 모르는 코드는 일반 문구로
 * 떨어진다. funding/fail.tsx·booking/fail.tsx와 같은 규칙이다.
 */
const FAIL_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '카드 등록을 취소하셨습니다.',
  PAY_PROCESS_ABORTED: '등록이 끝나기 전에 창이 닫혔습니다.',
  USER_CANCEL: '카드 등록을 취소하셨습니다.',
  REJECT_CARD_COMPANY: '카드사에서 등록을 거절했습니다. 다른 카드로 시도해 주세요.',
  INVALID_CARD_EXPIRATION: '카드 유효기간을 다시 확인해 주세요.',
  INVALID_STOPPED_CARD: '정지된 카드입니다. 다른 카드로 시도해 주세요.',
  INVALID_CARD_NUMBER: '카드번호를 다시 확인해 주세요.',
  EXCEED_MAX_AUTH_COUNT: '인증 시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  NOT_SUPPORTED_CARD_TYPE: '이 카드로는 정기결제를 등록할 수 없습니다. 다른 카드로 시도해 주세요.',
  NOT_AVAILABLE_BANK: '카드사 서비스 시간이 아닙니다. 잠시 후 다시 시도해 주세요.',
};
const GENERIC_MESSAGE = '카드 인증 중 문제가 발생했습니다.';
/** 화면에 그대로 띄워도 되는 코드 형태. 표에 없는 코드도 문의할 때 쓸 수 있게 보여준다. */
const CODE_PATTERN = /^[A-Z0-9_]{1,60}$/;

interface FailProps {
  id: string;
  /** 링크는 아직 유효하므로 다시 시도할 수 있게 그대로 들고 있는다. */
  setupToken: string;
  code: string | null;
  message: string;
}

export default function SubscribeFailPage({ id, setupToken, code, message }: FailProps) {
  return (
    <>
      <Head>
        <title>카드 등록에 실패했습니다 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <main className="mx-auto max-w-lg min-w-0 max-w-full px-4 py-24 text-center">
        {/* 사이트 헤더를 두르지 않는 화면이라(lib/analytics/privatePaths.ts의 PRIVATE_PAGE_ROUTES)
            여기가 브랜드를 밝히는 유일한 자리다. */}
        <p className="typo-card-meta mb-2">스튜디오 놀</p>
        <h1 className="typo-page-title">카드 등록을 완료하지 못했습니다</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">{message}</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">아직 청구되지 않았습니다 — 안심하고 다시 시도해 주세요.</p>
        {/* 정본 연락처를 상시 표기한다 — 예전에는 쿼리의 message가 주 안내문이라, 그 자리에
            가짜 연락처를 넣으면 화면에 우리 번호가 하나도 없었다(funding/fail.tsx와 같은 판단). */}
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">문의: 010-4255-7893 · hello@studionol.co.kr</p>
        {code && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">오류 코드: {code}</p>}
        {/* 이 URL에는 setupToken이 실린다 — 이탈 링크는 문서 이동(`<a href>`)이어야 한다
            (사유는 lib/analytics/privatePaths.ts). 목적지도 토큰이 붙는 private 화면이지만
            Referrer-Policy가 동일 출처에 전체 URL을 보내므로 rel="noreferrer"를 함께 둔다. */}
        <a
          href={`/ko/subscribe/${encodeURIComponent(id)}?token=${encodeURIComponent(setupToken)}`}
          rel="noreferrer"
          className="mt-8 inline-block underline"
        >
          다시 시도하기
        </a>
      </main>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<FailProps>(async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { id } = params as { id: string };
  const { token } = query;
  if (typeof id !== 'string' || typeof token !== 'string' || token.trim() === '') {
    return { notFound: true };
  }

  // code만 받는다. query.message는 읽지도 않는다 — 표에 없는 코드는 일반 문구로 떨어진다.
  const code = typeof query.code === 'string' && CODE_PATTERN.test(query.code) ? query.code : null;

  return {
    props: {
      id,
      setupToken: token,
      code,
      message: (code && FAIL_MESSAGES[code]) || GENERIC_MESSAGE,
    },
  };
});
