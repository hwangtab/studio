import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { confirmBookingPayment } from '../../../lib/booking/confirm';

interface SuccessProps {
  outcome: 'confirmed' | 'error';
  message?: string;
  orderNo?: string;
}

export default function BookingSuccessPage({ outcome, message, orderNo }: SuccessProps) {
  return (
    <>
      <Head>
        <title>예약 결제 완료 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        {outcome === 'confirmed' ? (
          <>
            <h1 className="text-2xl font-bold">예약이 확정되었습니다</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              주문번호 {orderNo}. 예약 확인 메일을 보내드렸습니다 — 메일의 링크에서 예약을 확인·취소할 수 있습니다.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">결제를 확정하지 못했습니다</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">{message}</p>
            <p className="mt-2 text-sm text-gray-500">결제가 이뤄졌다면 자동으로 취소되거나 확정됩니다. 문의: 010-4255-7893</p>
          </>
        )}
        <Link href="/ko" className="mt-8 inline-block underline">홈으로</Link>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SuccessProps> = async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };
  const { paymentKey, orderId, amount } = query;
  if (typeof paymentKey !== 'string' || typeof orderId !== 'string' || typeof amount !== 'string')
    return { props: { outcome: 'error', message: '잘못된 접근입니다.' } };

  const result = await confirmBookingPayment({ orderNo: orderId, paymentKey, amount: Number(amount) });
  if (!result.ok) return { props: { outcome: 'error', message: result.message } };
  return { props: { outcome: 'confirmed', orderNo: result.orderNo } };
};
