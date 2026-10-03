/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 토스 orderId가 실린다)의 이탈 링크는 next/link가 아니라 문서 이동이어야
 * 한다. 근거: lib/analytics/privatePaths.ts, tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';

import { getSiteConfig } from '../../../data/siteConfig';
import { withI18nServerProps } from '../../../lib/getStatic';
import {
  SHOW_FAIL_CODE_PATTERN,
  SHOW_FAIL_GENERIC_MESSAGE,
  SHOW_FAIL_MESSAGES,
  SHOW_PAYMENT_ORDER_NO_PATTERN,
  SHOW_SLUG_PATTERN,
} from '../../../lib/shows/failMessages';
import { useReportPaymentFailureOnMount } from '../../../utils/reportPaymentFailure';

interface FailProps {
  /** 돌아갈 공연 slug. 형태 검증을 통과한 값만 온다(없으면 null → 공연 목록 대신 홈). */
  slug: string | null;
  code: string | null;
  /** 표에서 옮긴 안전한 문구. 쿼리 원문이 아니다. */
  message: string;
  orderNo: string | null;
}

export default function ShowFailPage({ slug, code, message, orderNo }: FailProps) {
  // 실패 사유는 마운트 뒤 비콘으로 남긴다 — 인증 없는 GET이 남의 주문을 덮어쓰지 않게(booking/fail과 같다).
  useReportPaymentFailureOnMount(orderNo, code);
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  return (
    <>
      <Head>
        <title>결제를 완료하지 못했습니다 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">스튜디오 놀</p>
        <h1 className="typo-page-title">결제를 완료하지 못했습니다</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">{message}</p>
        {code && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">오류 코드: {code}</p>}
        {orderNo && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">주문번호: {orderNo}</p>}
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          티켓은 발권되지 않았고 결제 정보도 저장되지 않았습니다. 잔여석이 남아 있다면 다시 예매하실 수 있습니다.
        </p>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">문의: 010-4255-7893 · hello@studionol.co.kr</p>
        {/* 카카오톡 목적지 링크 — CLAUDE.md 카카오 CTA 배색 규칙(옐로 고정). ko 전용 화면이라 분기 없음. */}
        <p className="mt-6">
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-kakao px-6 py-3 font-bold text-kakao-ink transition-colors hover:bg-kakao-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kakao-ink focus-visible:ring-offset-2 dark:focus-visible:ring-kakao"
          >
            카카오톡으로 문의하기
          </a>
        </p>
        <a href={slug ? `/ko/shows/${slug}` : '/ko'} rel="noreferrer" className="mt-4 inline-block underline">
          {slug ? '예매 페이지로 돌아가기' : '홈으로'}
        </a>
      </main>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<FailProps>(async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { code, orderId, slug } = query;
  const safeCode = typeof code === 'string' && SHOW_FAIL_CODE_PATTERN.test(code) ? code : null;
  const upperOrder = typeof orderId === 'string' ? orderId.toUpperCase() : '';
  return {
    props: {
      slug: typeof slug === 'string' && SHOW_SLUG_PATTERN.test(slug) ? slug : null,
      code: safeCode,
      message: (safeCode && SHOW_FAIL_MESSAGES[safeCode]) || SHOW_FAIL_GENERIC_MESSAGE,
      orderNo: SHOW_PAYMENT_ORDER_NO_PATTERN.test(upperOrder) ? upperOrder : null,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
ShowFailPage.designEdition = 'v2';
