/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 토스 orderId가 실린다)의 이탈 링크는 문서 이동이어야 한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트: tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';

import { Button } from '../../../components/ui/Button';
import { PageShell } from '../../../components/ui/PageHeader';
import { ResultCard } from '../../../components/ui/ResultCard';
import { getSiteConfig } from '../../../data/siteConfig';
import { withI18nServerProps } from '../../../lib/getStatic';
import { getPublishedSoftware } from '../../../lib/software/catalog';
import { normalizeSoftwareOrderNo } from '../../../lib/software/order';
import { useReportPaymentFailureOnMount } from '../../../utils/reportPaymentFailure';

/** 토스 실패 코드 → 우리 문구. 쿼리의 message는 읽지 않는다(상점 fail과 같은 이유). */
const FAIL_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨어요.',
  PAY_PROCESS_ABORTED: '결제가 끝나기 전에 창이 닫혔어요.',
  USER_CANCEL: '결제를 취소하셨어요.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했어요. 다른 카드나 결제수단으로 시도해 주세요.',
  INVALID_CARD_EXPIRATION: '카드 유효기간을 다시 확인해 주세요.',
  INVALID_STOPPED_CARD: '정지된 카드예요. 다른 결제수단으로 시도해 주세요.',
  EXCEED_MAX_DAILY_PAYMENT_COUNT: '하루 결제 가능 횟수를 넘었어요. 다른 결제수단을 이용해 주세요.',
  EXCEED_MAX_PAYMENT_AMOUNT: '결제 한도를 넘었어요. 카드사에 문의하거나 다른 결제수단을 이용해 주세요.',
  INVALID_CARD_NUMBER: '카드번호를 다시 확인해 주세요.',
  NOT_AVAILABLE_BANK: '은행 서비스 시간이 아니에요. 잠시 후 다시 시도하거나 카드·간편결제로 결제해 주세요.',
  NOT_ENOUGH_BALANCE: '계좌 잔액이 부족해요. 다른 계좌나 결제수단으로 시도해 주세요.',
};
const GENERIC_MESSAGE = '결제 진행 중 문제가 생겼어요. 카드·간편결제로 다시 시도해 주세요.';
const CODE_PATTERN = /^[A-Z0-9_]{1,60}$/;

interface Props {
  code: string | null;
  message: string;
  orderNo: string | null;
  retryHref: string | null;
}

export default function SoftwareFailPage({ code, message, orderNo, retryHref }: Props) {
  useReportPaymentFailureOnMount(orderNo, code);
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  return (
    <>
      <Head>
        <title>결제를 완료하지 못했어요 | 스튜디오 놀</title>
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
              {retryHref && <Button asChild><a href={retryHref} rel="noreferrer">다시 구매하기</a></Button>}
              <Button asChild variant="kakao"><a href={kakaoUrl} target="_blank" rel="noopener noreferrer">카카오톡으로 문의하기</a></Button>
            </>
          }
        >
          <div className="space-y-1 text-center typo-card-meta">
            {code && <p>오류 코드: {code}</p>}
            {orderNo && <p>주문번호: {orderNo}</p>}
            <p>결제가 되지 않았으니 안심하고 다시 시도해 주세요.</p>
          </div>
        </ResultCard>
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/software', permanent: false } };
  const { code, orderId, slug } = query;
  const safeCode = typeof code === 'string' && CODE_PATTERN.test(code) ? code : null;
  // 쿼리의 slug를 그대로 경로에 넣지 않는다 — 실제 공개 상품일 때만 돌아갈 주소를 만든다.
  const product = getPublishedSoftware(slug);
  return {
    props: {
      code: safeCode,
      message: (safeCode && FAIL_MESSAGES[safeCode]) || GENERIC_MESSAGE,
      orderNo: normalizeSoftwareOrderNo(orderId),
      retryHref: product ? `/ko/software/${product.slug}#buy` : null,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
SoftwareFailPage.designEdition = 'v2';
