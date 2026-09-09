import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import BankDepositGuide from '../../../../components/funding/BankDepositGuide';
import { isTokenMatch } from '../../../../lib/booking/token';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { expireStalePledges, findFundingOrderByOrderNo } from '../../../../lib/funding/service';

interface Props { orderNo: string; customerName: string; totalAmount: number; holdExpiresAt: string; status: string; manageUrl: string; projectSlug: string }

export default function DepositPage(p: Props) {
  return (
    <>
      <Head><title>무통장입금 안내 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-lg px-4 pb-24 pt-28">
        <h1 className="text-2xl font-bold">무통장입금 안내</h1>
        <div className="mt-6"><BankDepositGuide {...p} /></div>
        <p className="mt-8 text-sm">입금 확인 후 확정 메일을 보내드립니다. <Link href={p.manageUrl} className="underline">후원 확인 페이지</Link> · <Link href={`/ko/funding/${p.projectSlug}`} className="underline">프로젝트</Link></p>
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
