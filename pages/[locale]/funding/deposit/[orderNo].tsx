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
      <main className="mx-auto max-w-xl px-4 pb-24 pt-28 sm:pt-32">
        <h1 className="typo-section-title">무통장입금 안내</h1>
        <p className="typo-section-lead mt-3">아래 계좌로 기한 안에 입금하면 후원이 확정됩니다.</p>
        <div className="glass-card mt-8 rounded-2xl p-6 sm:p-8"><BankDepositGuide {...p} /></div>
        {/* 이탈 링크는 문서 이동(`<a href>`) — next/link 클라 전환으로 나갔다가 뒤로가기를
            누르면 그 사이 mount된 gtag가 ?token=이 실린 이 URL로 page_view를 보낸다
            (lib/analytics/privatePaths.ts). */}
        <p className="typo-card-meta mt-6">
          입금 확인 후 확정 메일을 보내드립니다.{' '}
          <a href={p.manageUrl} className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-light">후원 확인 페이지</a>
          {' · '}
          <a href={`/ko/funding/${p.projectSlug}`} className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-light">프로젝트</a>
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
