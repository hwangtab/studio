import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { confirmBookingPayment } from '../../../lib/booking/confirm';
import { getSiteConfig } from '../../../data/siteConfig';

interface SuccessProps {
  outcome: 'confirmed' | 'error';
  message?: string;
  orderNo?: string;
  /** 예약 확인·취소 링크. 메일이 실패해도 고객이 여기서 바로 받을 수 있어야 한다. */
  manageUrl?: string;
  /** 확인 메일이 실제로 나갔는지. undefined면 이번 호출이 보낸 게 아니다(새로고침 등). */
  emailSent?: boolean;
  /** 세션 예약 완료 화면과 믹싱 주문 접수 화면의 문구를 가른다. */
  orderType?: 'session' | 'mixing';
}

export default function BookingSuccessPage({ outcome, message, orderNo, manageUrl, emailSent, orderType }: SuccessProps) {
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  const isMixing = orderType === 'mixing';

  return (
    <>
      <Head>
        <title>{isMixing ? '주문 접수 완료' : '예약 결제 완료'} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        {outcome === 'confirmed' ? (
          <>
            <h1 className="typo-page-title">{isMixing ? '주문이 접수되었습니다' : '예약이 확정되었습니다'}</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              주문번호 {orderNo}.
              {emailSent === false
                ? ' 확인 메일을 보내지 못했습니다 — 아래 링크를 저장해 주세요.'
                : isMixing
                  ? ' 확인 메일을 보내드렸습니다.'
                  : ' 예약 확인 메일을 보내드렸습니다.'}
            </p>
            {isMixing && (
              <>
                <p className="mt-4 text-gray-600 dark:text-gray-300">
                  이 메일에 회신으로 파일(구글 드라이브·WeTransfer 링크)을 보내주시면 작업을
                  시작합니다. 카카오톡 오픈채팅으로 보내셔도 됩니다.
                </p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  납기: 파일 확인 후 3~7영업일
                </p>
                {/* 카카오톡 목적지 링크 — CLAUDE.md 카카오 CTA 배색 규칙(옐로 고정). */}
                <p className="mt-4">
                  <a
                    href={kakaoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-kakao px-6 py-3 font-bold text-kakao-ink transition-colors hover:bg-kakao-dark"
                  >
                    카카오톡으로 파일 보내기
                  </a>
                </p>
              </>
            )}
            {/* 관리 링크를 화면에도 띄운다. 예전엔 이 토큰이 메일에만 실려서, 메일이
                실패하면 고객이 예약을 스스로 취소할 방법이 아예 없었다. */}
            {manageUrl && (
              <p className="mt-4">
                <Link
                  href={manageUrl}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-primary-dark"
                >
                  {isMixing ? '주문 확인·취소 페이지 열기' : '예약 확인·취소 페이지 열기'}
                </Link>
              </p>
            )}
            {manageUrl && (
              <p className="mt-3 break-all text-xs text-gray-500">
                이 주소를 저장해 두세요: {manageUrl}
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="typo-page-title">결제를 확정하지 못했습니다</h1>
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
  return {
    props: {
      outcome: 'confirmed',
      orderNo: result.orderNo,
      manageUrl: `/ko/booking/manage/${result.orderNo}?token=${result.manageToken}`,
      ...(result.emailSent === undefined ? {} : { emailSent: result.emailSent }),
      orderType: result.orderType,
    },
  };
};
