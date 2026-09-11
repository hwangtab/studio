import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import BankDepositGuide from '../../../../components/funding/BankDepositGuide';
import { isTokenMatch } from '../../../../lib/booking/token';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { expireStalePledges, findFundingOrderByOrderNo } from '../../../../lib/funding/service';

interface Props { orderNo: string; customerName: string; totalAmount: number; holdExpiresAt: string; status: string; manageUrl: string; projectSlug: string }

export default function DepositPage(p: Props) {
  return (
    <>
      <Head><title>무통장입금 안내 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-16 sm:pt-20">
        {/* 사이트 헤더를 두르지 않는 화면이라(components/Layout.tsx의 isPrivatePaymentPage)
            여기가 브랜드를 밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 어디서 온
            화면인지 알 수 있어야 한다. */}
        <p className="typo-card-meta">스튜디오 놀</p>
        <h1 className="typo-section-title mt-1">무통장입금 안내</h1>
        <p className="typo-section-lead mt-3">아래 계좌로 기한 안에 입금하면 후원이 확정됩니다.</p>
        <div className="glass-card mt-8 rounded-2xl p-6 sm:p-8"><BankDepositGuide {...p} /></div>
        {/* 이탈 링크 두 가지 규칙(lib/analytics/privatePaths.ts):
            1. 문서 이동(`<a href>`) — next/link 클라 전환으로 나갔다가 뒤로가기를 누르면,
               그 사이 mount된 gtag가 비밀값이 붙은 이 URL로 page_view를 보낸다.
            2. 공개 목적지에는 `rel="noreferrer"` — 사이트 Referrer-Policy가
               strict-origin-when-cross-origin이라 **동일 출처 이동에는 전체 URL**을 보낸다.
               없으면 도착지 gtag가 page_referrer에 토큰·paymentKey를 실어 보낸다.
               private→private 링크(관리·입금 안내)는 도착지도 측정 대상이 아니라 불필요. */}
        <p className="typo-card-meta mt-6">
          입금 확인 후 확정 메일을 보내드립니다.{' '}
          <a href={p.manageUrl} className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">후원 확인 페이지</a>
          {' · '}
          <a href={`/ko/funding/${p.projectSlug}`} rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">프로젝트</a>
        </p>
        {/* 전자상거래법 제13조 2항 — 계약 성립 뒤 후원자가 도달하는 문서에는 청약철회·환불 조건에
            닿는 경로가 있어야 한다. 이 화면은 FundingTrustNotice를 두르지 않아 링크가 없었다. */}
        <p className="typo-card-meta mt-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link 클라 전환으로 나갔다 뒤로가기를 누르면 gtag가 토큰 붙은 이 URL로 page_view를 보낸다(위 주석). 문서 이동으로 유지한다. */}
          <a href="/ko/funding/terms" rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">펀딩 약관·청약철회·환불 규정</a>
          {' · '}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link 클라 전환으로 나갔다 뒤로가기를 누르면 gtag가 토큰 붙은 이 URL로 page_view를 보낸다(위 주석). 문서 이동으로 유지한다. */}
          <a href="/ko/privacy-policy" rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">개인정보 처리방침</a>
        </p>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  denyContractPageCaching(context.res);
  const { locale, orderNo } = context.params as { locale: string; orderNo: string };
  if (locale !== 'ko') return { redirect: { destination: '/ko/funding', permanent: false } };
  const token = context.query.token;
  if (typeof token !== 'string' || !token) return { notFound: true };
  await expireStalePledges(new Date());
  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order?.fundingPledge || !isTokenMatch(order.manageToken, token) || order.fundingPledge.paymentMethod !== 'bank_transfer') return { notFound: true };
  return { props: {
    orderNo: order.orderNo, customerName: order.customerName, totalAmount: order.totalAmount,
    holdExpiresAt: order.fundingPledge.holdExpiresAt.toISOString(), status: order.status,
    manageUrl: `/ko/funding/manage/${order.orderNo}?token=${token}`, projectSlug: order.fundingPledge.projectSlug,
  } };
};
