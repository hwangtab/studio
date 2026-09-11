/* eslint-disable @next/next/no-html-link-for-pages --
 * 이 페이지의 HTML에는 관리 토큰이 실린 manage URL이 들어간다. 이탈 링크는 next/link가
 * 아니라 문서 이동이어야 한다 — 클라 전환으로 공개 페이지에 나갔다 뒤로가기 하면 그 사이
 * mount된 gtag가 살아 있는 채로 돌아와 이 화면의 상태를 다시 측정한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트:
 * tests/pages/privateLinkNavigation.test.ts
 */
import { useEffect } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';

import { isTokenMatch } from '../../../lib/booking/token';
import { confirmFundingPledge } from '../../../lib/funding/confirm';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { trackMicroEvent } from '../../../utils/analytics';

interface SuccessProps {
  /** confirmed = 이 브라우저가 방금 확정한 후원, unknown = 확정 화면을 되살릴 근거가 없음. */
  outcome: 'confirmed' | 'unknown' | 'error';
  message?: string;
  orderNo?: string;
  /** 후원 확인·취소 링크. 메일이 실패해도 고객이 여기서 바로 받을 수 있어야 한다. */
  manageUrl?: string;
  projectSlug?: string;
  /** 확인 메일이 실제로 나갔는지(orders.notificationError 기준). */
  emailSent?: boolean;
}

/**
 * 확정 직후 세우는 단기 쿠키. `<orderNo>.<manageToken>` 한 쌍이다.
 *
 * 왜 필요한가: 토스가 돌려보내는 success URL에는 paymentKey·orderId·amount가 실려 있어
 * 측정에서 통째로 빠져 있었고(lib/analytics/privatePaths.ts), 그 결과 펀딩 퍼널이
 * **진입 100% · 결제 0%** 로 보였다. 이제 확정이 끝나면 비밀값이 없는 `?o=<주문번호>`로
 * 리다이렉트하고 그 화면에서 전환을 측정한다. 관리 토큰은 URL로 옮길 수 없으므로
 * (URL은 측정 대상이 된다) httpOnly 쿠키로 넘긴다 — 자바스크립트도, 측정 스크립트도
 * 읽지 못하고 이 경로로만 전송된다.
 *
 * 주문번호는 비밀이 아니다(확정·입금 안내 메일, 화면, 영수증에 평문). 그래서 `?o=`만으로는
 * 아무 것도 열리지 않는다 — 쿠키의 토큰이 DB의 manageToken과 맞아야 확정 화면이 나온다.
 */
const CONFIRM_COOKIE = 'fnd_confirm';
const CONFIRM_COOKIE_PATH = '/ko/funding/success';
const CONFIRM_COOKIE_MAX_AGE = 30 * 60;
const ORDER_NO_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

const buildConfirmCookie = (orderNo: string, token: string): string =>
  [
    `${CONFIRM_COOKIE}=${encodeURIComponent(`${orderNo}.${token}`)}`,
    `Path=${CONFIRM_COOKIE_PATH}`,
    `Max-Age=${CONFIRM_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join('; ');

const parseConfirmCookie = (raw: string | undefined): { orderNo: string; token: string } | null => {
  if (!raw) return null;
  const value = decodeURIComponent(raw);
  const sep = value.indexOf('.');
  if (sep <= 0 || sep === value.length - 1) return null;
  return { orderNo: value.slice(0, sep), token: value.slice(sep + 1) };
};

const PHONE = '010-4255-7893';

export default function FundingSuccessPage({ outcome, message, orderNo, manageUrl, projectSlug, emailSent }: SuccessProps) {
  useEffect(() => {
    if (outcome !== 'confirmed' || !orderNo) return;
    // 새로고침마다 다시 세지 않는다 — 이 화면은 쿠키가 살아 있는 30분 동안 몇 번이고
    // 열릴 수 있고, 그때마다 발화하면 결제 수가 부풀려진다.
    try {
      const key = `funding_pledge_paid:${orderNo}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // 프라이빗 모드·저장소 차단 — 중복 억제만 못 할 뿐 측정은 계속한다.
    }
    // 펀딩 확정 마이크로 전환 — GA4 key event로 지정 금지(utils/analytics.ts 참조,
    // 유일하게 신뢰 가능한 지표인 카톡 리드를 희석하지 않기 위함).
    trackMicroEvent('funding_pledge_paid', { component: 'funding_success', landing_slug: projectSlug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, orderNo]);

  return (
    <>
      <Head>
        <title>후원 결제 완료 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-16 sm:pt-20">
        <div className="glass-card rounded-2xl p-6 text-center sm:p-8">
        {/* 사이트 헤더를 두르지 않는 화면이라(components/Layout.tsx의 isPrivatePaymentPage)
            여기가 브랜드를 밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 어디서 온
            화면인지 알 수 있어야 한다. */}
        <p className="typo-card-meta mb-2">스튜디오 놀</p>
        {outcome === 'confirmed' ? (
          <>
            <h1 className="typo-page-title">후원이 확정되었습니다</h1>
            <p className="typo-card-body mx-auto mt-3 max-w-md">
              주문번호 {orderNo}.
              {emailSent === false
                ? ' 확인 메일을 보내지 못했습니다 — 아래 링크를 저장해 주세요.'
                : ' 후원 확인 메일을 보내드렸습니다.'}
            </p>
            {/* 관리 링크를 화면에도 띄운다. 예전엔 이 토큰이 메일에만 실려서, 메일이
                실패하면 고객이 후원을 스스로 취소할 방법이 아예 없었다. */}
            {manageUrl && (
              <p className="mt-6">
                <a
                  href={manageUrl}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
                >
                  후원 확인·취소 페이지 열기
                </a>
              </p>
            )}
            {manageUrl && (
              <p className="typo-card-meta mx-auto mt-3 max-w-md break-all">
                이 주소를 저장해 두세요: {manageUrl}
              </p>
            )}
            {projectSlug && (
              <p className="typo-card-meta mt-6">
                {/* 공개 목적지에는 rel="noreferrer" — 이 URL에 비밀값은 없지만(주문번호뿐),
                    도착지 gtag의 page_referrer에 주문번호까지 실어 보낼 이유는 없다. */}
                <a href={`/ko/funding/${projectSlug}`} rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-light">
                  프로젝트로 돌아가기
                </a>
              </p>
            )}
          </>
        ) : outcome === 'unknown' ? (
          <>
            <h1 className="typo-page-title">후원 내역을 확인해 주세요</h1>
            <p className="typo-card-body mx-auto mt-3 max-w-md">
              이 화면에서는 후원 상세를 다시 열 수 없습니다. 결제가 끝났다면 후원 확인 메일에
              후원 확인·취소 링크가 들어 있습니다.
            </p>
            <p className="typo-card-meta mx-auto mt-3 max-w-md">메일이 보이지 않으면 문의해 주세요: {PHONE}</p>
            <a
              href="/ko/funding"
              rel="noreferrer"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
            >
              펀딩 목록으로 돌아가기
            </a>
          </>
        ) : (
          <>
            <h1 className="typo-page-title">결제를 확정하지 못했습니다</h1>
            <p className="typo-card-body mx-auto mt-3 max-w-md">{message}</p>
            <p className="typo-card-meta mx-auto mt-3 max-w-md">결제가 이뤄졌다면 자동으로 취소되거나 확정됩니다. 문의: {PHONE}</p>
            {/* 오류 분기에도 눌러야 할 곳이 하나는 있어야 한다 — fail.tsx와 같은 solid 버튼. */}
            <a
              href="/ko/funding"
              rel="noreferrer"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
            >
              펀딩 목록으로 돌아가기
            </a>
          </>
        )}
        </div>
        {outcome === 'confirmed' && (
          <p className="typo-card-meta mt-6 text-center">
            <a href="/ko/funding" rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-light">펀딩 목록으로</a>
          </p>
        )}
      </main>
    </>
  );
}

/**
 * 두 가지 요청을 받는다.
 *
 * 1. **토스가 돌려보낸 승인 URL**(`paymentKey`·`orderId`·`amount`) — 확정하고, 쿠키를 세우고,
 *    비밀값 없는 `?o=<주문번호>`로 리다이렉트한다. 화면은 그리지 않는다.
 * 2. **리다이렉트된 화면**(`?o=`) — 쿠키의 토큰이 주문의 manageToken과 맞을 때만 확정 화면을
 *    그린다. 새로고침해도 confirm을 다시 부르지 않으므로(승인 URL이 아니다) 멱등하다.
 *    뒤로가기로 1의 URL에 돌아가면 confirm이 다시 돌지만, `confirmFundingPledge`가 paid
 *    주문에 **올바른 paymentKey**를 요구하므로 진짜 고객만 통과해 같은 자리로 되돌아온다.
 */
export const getServerSideProps: GetServerSideProps<SuccessProps> = async ({ query, req, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/funding', permanent: false } };

  const { paymentKey, orderId, amount } = query;
  if (typeof paymentKey === 'string' && typeof orderId === 'string' && typeof amount === 'string') {
    const result = await confirmFundingPledge({ orderNo: orderId, paymentKey, amount: Number(amount) });
    if (!result.ok) return { props: { outcome: 'error', message: result.message } };
    res.setHeader('Set-Cookie', buildConfirmCookie(result.orderNo, result.manageToken));
    return { redirect: { destination: `/ko/funding/success?o=${encodeURIComponent(result.orderNo)}`, permanent: false } };
  }

  const requested = typeof query.o === 'string' && ORDER_NO_PATTERN.test(query.o) ? query.o.toUpperCase() : null;
  if (!requested) return { props: { outcome: 'error', message: '잘못된 접근입니다.' } };

  const cookie = parseConfirmCookie(req.cookies?.[CONFIRM_COOKIE]);
  // 쿠키가 없거나 다른 주문의 것이면 DB를 아예 조회하지 않는다 — 주문번호만 아는 제3자가
  // 주문의 존재 여부를 떠볼 수 있는 경로를 만들지 않는다.
  if (!cookie || cookie.orderNo.toUpperCase() !== requested) return { props: { outcome: 'unknown' } };
  const order = await findFundingOrderByOrderNo(requested);
  if (!order || !isTokenMatch(order.manageToken, cookie.token)) return { props: { outcome: 'unknown' } };
  return {
    props: {
      outcome: 'confirmed',
      orderNo: order.orderNo,
      manageUrl: `/ko/funding/manage/${order.orderNo}?token=${order.manageToken}`,
      projectSlug: order.fundingPledge?.projectSlug ?? '',
      // notificationError는 확정 메일 결과다 — null이면 발송 성공, 문자열이면 실패이거나
      // 아직 발송 전(confirm.ts의 send_pending 센티널)이다. 둘 다 "링크를 저장하세요"가 맞다.
      emailSent: order.notificationError === null,
    },
  };
};
