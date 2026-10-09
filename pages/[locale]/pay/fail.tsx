/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 토스 orderId가 실린다)의 이탈 링크는 문서 이동이어야 한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트: tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';

import { getSiteConfig } from '../../../data/siteConfig';
import { getPaymentLink } from '../../../data/paymentLinks';
import { withI18nServerProps } from '../../../lib/getStatic';
import { useReportPaymentFailureOnMount } from '../../../utils/reportPaymentFailure';
import { Button } from '../../../components/ui/Button';
import { PageShell } from '../../../components/ui/PageHeader';
import { ResultCard } from '../../../components/ui/ResultCard';

/** 토스 실패 코드 → 우리 문구. 쿼리의 message는 읽지 않는다(booking/fail.tsx와 같은 이유). */
const FAIL_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨어요.',
  PAY_PROCESS_ABORTED: '결제가 완료되기 전에 창이 닫혔어요.',
  USER_CANCEL: '결제를 취소하셨어요.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했어요. 다른 카드나 결제수단으로 시도해 주세요.',
  INVALID_CARD_EXPIRATION: '카드 유효기간을 다시 확인해 주세요.',
  INVALID_STOPPED_CARD: '정지된 카드예요. 다른 결제수단으로 시도해 주세요.',
  EXCEED_MAX_DAILY_PAYMENT_COUNT: '하루 결제 가능 횟수를 초과했어요. 내일 다시 시도하거나 다른 결제수단을 이용해 주세요.',
  EXCEED_MAX_PAYMENT_AMOUNT: '결제 한도를 초과했어요. 카드사에 문의하거나 다른 결제수단을 이용해 주세요.',
  INVALID_CARD_NUMBER: '카드번호를 다시 확인해 주세요.',
  NOT_AVAILABLE_BANK: '은행 서비스 시간이 아니에요. 잠시 후 다시 시도해 주세요.',
};
const GENERIC_MESSAGE = '결제 진행 중 문제가 발생했어요.';
const ORDER_NO_PATTERN = /^SNB-\d{8}-[0-9A-F]{8}$/;
const CODE_PATTERN = /^[A-Z0-9_]{1,60}$/;

interface PayFailProps {
  code: string | null;
  message: string;
  orderNo: string | null;
  /** 다시 시도할 결제 링크. 유효한 slug일 때만 온다. */
  retryHref: string | null;
}

export default function PaymentLinkFailPage({ code, message, orderNo, retryHref }: PayFailProps) {
  useReportPaymentFailureOnMount(orderNo, code);
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  return (
    <>
      <Head>
        <title>결제를 완료하지 못했습니다 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="result">
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>
        <ResultCard
          tone="error"
          as="h1"
          title="결제를 완료하지 못했어요"
          description={message}
          actions={
            <>
              <Button asChild variant="kakao">
                <a href={kakaoUrl} target="_blank" rel="noopener noreferrer">
                  카카오톡으로 문의하기
                </a>
              </Button>
              {retryHref && (
                <Button asChild variant="weak">
                  <a href={retryHref} rel="noreferrer">다시 결제하기</a>
                </Button>
              )}
              <Button asChild variant="ghost">
                <a href="/ko" rel="noreferrer">
                  홈으로
                </a>
              </Button>
            </>
          }
        >
          <div className="space-y-1 text-center typo-card-meta">
            {code && <p>오류 코드: {code}</p>}
            {orderNo && <p>주문번호: {orderNo}</p>}
            <p>결제 정보가 저장되지 않았으니 안심하고 다시 시도해 주세요.</p>
            <p>문의: 010-4255-7893 · hello@studionol.co.kr</p>
          </div>
        </ResultCard>
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<PayFailProps>(async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };
  const { code, orderId, slug } = query;
  const safeCode = typeof code === 'string' && CODE_PATTERN.test(code) ? code : null;
  const safeOrderNo =
    typeof orderId === 'string' && ORDER_NO_PATTERN.test(orderId.toUpperCase()) ? orderId.toUpperCase() : null;
  // 쿼리의 slug를 그대로 경로에 넣지 않는다 — 실제 결제 링크일 때만 되돌아가는 주소를 만든다.
  const retryHref = typeof slug === 'string' && getPaymentLink(slug) ? `/ko/pay/${slug}` : null;
  return {
    props: {
      code: safeCode,
      message: (safeCode && FAIL_MESSAGES[safeCode]) || GENERIC_MESSAGE,
      orderNo: safeOrderNo,
      retryHref,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
PaymentLinkFailPage.designEdition = 'v2';
