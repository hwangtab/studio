/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 토스 orderId가 실린다)의 이탈 링크는 next/link가 아니라 문서 이동이어야
 * 한다. 근거: lib/analytics/privatePaths.ts, tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';

import { Button } from '../../../components/ui/Button';
import { PageShell } from '../../../components/ui/PageHeader';
import { ResultCard } from '../../../components/ui/ResultCard';

import { getSiteConfig } from '../../../data/siteConfig';
import { withI18nServerProps } from '../../../lib/getStatic';
import {
  SHOW_FAIL_CODE_PATTERN,
  SHOW_FAIL_GENERIC_MESSAGE,
  SHOW_FAIL_GENERIC_MESSAGE_EN,
  SHOW_FAIL_MESSAGES,
  SHOW_FAIL_MESSAGES_EN,
  SHOW_PAYMENT_ORDER_NO_PATTERN,
  SHOW_SLUG_PATTERN,
} from '../../../lib/shows/failMessages';
import { useReportPaymentFailureOnMount } from '../../../utils/reportPaymentFailure';
import { fallbackShowLocale, SHOW_CONTACT_PHONE_INTL, toShowLocale, type ShowLocale } from '../../../lib/shows/i18n';

interface FailProps {
  /** 돌아갈 공연 slug. 형태 검증을 통과한 값만 온다(없으면 null → 공연 목록 대신 홈). */
  slug: string | null;
  code: string | null;
  /** 표에서 옮긴 안전한 문구. 쿼리 원문이 아니다. */
  message: string;
  orderNo: string | null;
  locale: ShowLocale;
}

export default function ShowFailPage({ slug, code, message, orderNo, locale }: FailProps) {
  // 실패 사유는 마운트 뒤 비콘으로 남긴다 — 인증 없는 GET이 남의 주문을 덮어쓰지 않게(booking/fail과 같다).
  useReportPaymentFailureOnMount(orderNo, code);
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  if (locale === 'en') {
    // 영어 화면 — 카카오톡 버튼을 두지 않는다(카카오 CTA 규칙: 비-ko는 목적지가 /contact 폼). 메일·전화로 안내한다.
    return (
      <>
        <Head>
          <title>Payment not completed | Studio NOL</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <PageShell width="result">
          <p className="typo-card-meta mb-4 text-center">Studio NOL</p>
          <ResultCard
            tone="error"
            title="Payment was not completed"
            description={message}
            actions={
              <Button asChild variant="weak">
                <a href={slug ? `/en/shows/${slug}` : '/en'} rel="noreferrer">
                  {slug ? 'Back to the booking page' : 'Home'}
                </a>
              </Button>
            }
          >
            <div className="space-y-1 text-center typo-card-meta">
              {code && <p>Error code: {code}</p>}
              {orderNo && <p>Order number: {orderNo}</p>}
              <p>No ticket was issued and no payment details were saved. If seats remain, you can book again.</p>
              <p>Contact: {SHOW_CONTACT_PHONE_INTL} · hello@studionol.co.kr</p>
            </div>
          </ResultCard>
        </PageShell>
      </>
    );
  }
  return (
    <>
      <Head>
        <title>결제를 완료하지 못했습니다 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="result">
        {/* 사이트 헤더를 두르지 않는 화면이라 여기가 브랜드를 밝히는 유일한 자리다(privateLinkNavigation.test.ts). */}
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>
        <ResultCard
          tone="error"
          title="결제를 완료하지 못했습니다"
          description={message}
          actions={
            <>
              {/* 카카오톡 목적지 링크 — CLAUDE.md 카카오 CTA 배색 규칙(옐로 고정). ko 전용 분기라 분기 없음. */}
              <Button asChild variant="kakao">
                <a href={kakaoUrl} target="_blank" rel="noopener noreferrer">카카오톡으로 문의하기</a>
              </Button>
              <Button asChild variant="weak">
                <a href={slug ? `/ko/shows/${slug}` : '/ko'} rel="noreferrer">
                  {slug ? '예매 페이지로 돌아가기' : '홈으로'}
                </a>
              </Button>
            </>
          }
        >
          <div className="space-y-1 text-center typo-card-meta">
            {code && <p>오류 코드: {code}</p>}
            {orderNo && <p>주문번호: {orderNo}</p>}
            <p>티켓은 발권되지 않았고 결제 정보도 저장되지 않았습니다. 잔여석이 남아 있다면 다시 예매하실 수 있습니다.</p>
            <p>문의: 010-4255-7893 · hello@studionol.co.kr</p>
          </div>
        </ResultCard>
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<FailProps>(async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  const locale = toShowLocale(params?.locale);
  if (!locale) return { redirect: { destination: `/${fallbackShowLocale(params?.locale)}`, permanent: false } };
  const table = locale === 'en' ? SHOW_FAIL_MESSAGES_EN : SHOW_FAIL_MESSAGES;
  const generic = locale === 'en' ? SHOW_FAIL_GENERIC_MESSAGE_EN : SHOW_FAIL_GENERIC_MESSAGE;

  const { code, orderId, slug } = query;
  const safeCode = typeof code === 'string' && SHOW_FAIL_CODE_PATTERN.test(code) ? code : null;
  const upperOrder = typeof orderId === 'string' ? orderId.toUpperCase() : '';
  return {
    props: {
      slug: typeof slug === 'string' && SHOW_SLUG_PATTERN.test(slug) ? slug : null,
      code: safeCode,
      message: (safeCode && table[safeCode]) || generic,
      orderNo: SHOW_PAYMENT_ORDER_NO_PATTERN.test(upperOrder) ? upperOrder : null,
      locale,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
ShowFailPage.designEdition = 'v2';
