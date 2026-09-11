/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 관리 토큰·paymentKey·orderId가 실린다)의 이탈 링크는 next/link가
 * 아니라 문서 이동이어야 한다. 클라 전환으로 공개 페이지에 나갔다 뒤로가기 하면, 그 사이
 * mount된 gtag가 살아 있는 채로 비밀값이 붙은 URL에 돌아와 page_view를 보낸다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트:
 * tests/pages/privateLinkNavigation.test.ts
 */
import { useEffect } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';

import { confirmFundingPledge } from '../../../lib/funding/confirm';
import { trackMicroEvent } from '../../../utils/analytics';

interface SuccessProps {
  outcome: 'confirmed' | 'error';
  message?: string;
  orderNo?: string;
  /** 후원 확인·취소 링크. 메일이 실패해도 고객이 여기서 바로 받을 수 있어야 한다. */
  manageUrl?: string;
  projectSlug?: string;
  /** 확인 메일이 실제로 나갔는지. undefined면 이번 호출이 보낸 게 아니다(새로고침 등). */
  emailSent?: boolean;
}

export default function FundingSuccessPage({ outcome, message, orderNo, manageUrl, projectSlug, emailSent }: SuccessProps) {
  useEffect(() => {
    if (outcome !== 'confirmed') return;
    // 펀딩 확정 마이크로 전환 — GA4 key event로 지정 금지(utils/analytics.ts 참조,
    // 유일하게 신뢰 가능한 지표인 카톡 리드를 희석하지 않기 위함).
    trackMicroEvent('funding_pledge_paid', { component: 'funding_success', landing_slug: projectSlug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  return (
    <>
      <Head>
        <title>후원 결제 완료 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-28 sm:pt-32">
        <div className="glass-card rounded-2xl p-6 text-center sm:p-8">
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
            {/* 이 URL에는 토스 paymentKey·orderId가, manageUrl에는 관리 토큰이 실린다.
                이탈 링크를 next/link로 두면 공개 페이지로 나갔다 뒤로가기 할 때 그 사이
                mount된 gtag가 이 URL로 page_view를 보낸다 — 전부 문서 이동으로 둔다
                (lib/analytics/privatePaths.ts). */}
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
                <a href={`/ko/funding/${projectSlug}`} className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-light">
                  프로젝트로 돌아가기
                </a>
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="typo-page-title">결제를 확정하지 못했습니다</h1>
            <p className="typo-card-body mx-auto mt-3 max-w-md">{message}</p>
            <p className="typo-card-meta mx-auto mt-3 max-w-md">결제가 이뤄졌다면 자동으로 취소되거나 확정됩니다. 문의: 010-4255-7893</p>
            {/* 오류 분기에도 눌러야 할 곳이 하나는 있어야 한다 — fail.tsx와 같은 solid 버튼. */}
            <a
              href="/ko/funding"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
            >
              펀딩 목록으로 돌아가기
            </a>
          </>
        )}
        </div>
        {outcome === 'confirmed' && (
          <p className="typo-card-meta mt-6 text-center">
            <a href="/ko/funding" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-light">펀딩 목록으로</a>
          </p>
        )}
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SuccessProps> = async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/funding', permanent: false } };
  const { paymentKey, orderId, amount } = query;
  if (typeof paymentKey !== 'string' || typeof orderId !== 'string' || typeof amount !== 'string')
    return { props: { outcome: 'error', message: '잘못된 접근입니다.' } };

  const result = await confirmFundingPledge({ orderNo: orderId, paymentKey, amount: Number(amount) });
  if (!result.ok) return { props: { outcome: 'error', message: result.message } };
  return {
    props: {
      outcome: 'confirmed',
      orderNo: result.orderNo,
      manageUrl: `/ko/funding/manage/${result.orderNo}?token=${result.manageToken}`,
      projectSlug: result.projectSlug,
      ...(result.emailSent === undefined ? {} : { emailSent: result.emailSent }),
    },
  };
};
