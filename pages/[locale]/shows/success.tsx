/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 관리 토큰·paymentKey·orderId가 실린다)의 이탈 링크는 next/link가
 * 아니라 문서 이동이어야 한다. 근거·경로 목록: lib/analytics/privatePaths.ts,
 * 회귀 테스트: tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';

import { Button } from '../../../components/ui/Button';

import { getDb } from '../../../db/client';
import { TOSS_KEY_CHANNEL_PARAM, cancelPayment, confirmPayment, fetchPayment, tossKeyChannelFromQuery } from '../../../lib/booking/toss';
import { withI18nServerProps } from '../../../lib/getStatic';
import { confirmShowOrder } from '../../../lib/shows/confirm';
import { sendShowTicketEmail } from '../../../lib/shows/email';
import { confirmFailureMessage, SHOW_PAYMENT_ORDER_NO_PATTERN } from '../../../lib/shows/failMessages';

interface SuccessProps {
  outcome: 'confirmed' | 'error';
  message?: string;
  orderNo?: string;
  /** 티켓 관리·QR 링크. 메일이 실패하거나 주소를 안 적었어도 여기서 바로 받을 수 있어야 한다. */
  manageUrl?: string;
  /** 티켓 메일이 실제로 나갔는지. undefined면 이번 호출이 보낸 게 아니다(새로고침 등). */
  emailSent?: boolean;
  /** 주문에 이메일 주소가 있는지(없으면 메일은 처음부터 나가지 않는다). */
  hasEmail?: boolean;
}

export default function ShowSuccessPage({ outcome, message, orderNo, manageUrl, emailSent, hasEmail }: SuccessProps) {
  return (
    <>
      <Head>
        <title>{outcome === 'confirmed' ? '예매 완료' : '결제 확인 실패'} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">스튜디오 놀</p>
        {outcome === 'confirmed' ? (
          <>
            <h1 className="typo-page-title">예매가 완료되었습니다</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              주문번호 {orderNo}.
              {emailSent === true && ' 티켓 메일을 보내드렸습니다.'}
              {emailSent === false && hasEmail && ' 티켓 메일을 보내지 못했습니다 — 아래 링크를 저장해 주세요.'}
              {emailSent === false && !hasEmail && ' 이메일을 적지 않으셔서 메일은 보내지 않았습니다 — 아래 링크를 꼭 저장해 주세요.'}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              입장은 비지정석 선착순입니다. 현장에서 아래 링크의 QR 티켓을 보여 주세요.
            </p>
            {manageUrl && (
              <p className="mt-4">
                {/* 공용 Button — private→private 링크라 noreferrer 불필요(lib/analytics/privatePaths.ts). */}
                <Button asChild size="lg">
                  <a href={manageUrl}>내 티켓(QR) 열기</a>
                </Button>
              </p>
            )}
            {manageUrl && (
              <p className="mt-3 break-all text-xs text-gray-500 dark:text-gray-400">이 주소를 저장해 두세요: {manageUrl}</p>
            )}
          </>
        ) : (
          <>
            <h1 className="typo-page-title">결제를 확정하지 못했습니다</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">{message}</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">문의: 010-4255-7893</p>
          </>
        )}
        <a href="/ko" rel="noreferrer" className="mt-8 inline-block underline">홈으로</a>
      </main>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<SuccessProps>(async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { paymentKey, orderId, amount } = query;
  const amountNumber = typeof amount === 'string' ? Number(amount) : NaN;
  if (
    typeof paymentKey !== 'string' || paymentKey.length === 0 || paymentKey.length > 200 ||
    typeof orderId !== 'string' || !SHOW_PAYMENT_ORDER_NO_PATTERN.test(orderId) ||
    !Number.isInteger(amountNumber)
  )
    return { props: { outcome: 'error', message: '잘못된 접근입니다.' } };

  const result = await confirmShowOrder(
    // channel: 우리가 그린 결제수단 목록으로 연 결제는 API 개별 연동 키 쌍으로 승인한다(lib/booking/toss.ts).
    { orderNo: orderId, paymentKey, amount: amountNumber, channel: tossKeyChannelFromQuery(query[TOSS_KEY_CHANNEL_PARAM]) },
    { trustedByWebhook: false },
    { confirmPayment, fetchPayment, cancelPayment },
  );
  if (result.status !== 'confirmed' && result.status !== 'already_confirmed')
    return { props: { outcome: 'error', message: confirmFailureMessage(result) } };

  const order = await getDb().query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderId) });
  if (!order) return { props: { outcome: 'error', message: '주문을 찾지 못했습니다. 문의 010-4255-7893' } };
  // already_confirmed는 환불까지 끝난 주문의 재방문도 포함한다 — 환불된 주문을 "예매 완료"로 보이지 않게 한다.
  if (order.status !== 'paid' && order.status !== 'partially_refunded')
    return { props: { outcome: 'error', message: '이미 환불 처리된 주문입니다. 다시 예매해 주세요.' } };

  // 메일은 부가 기능이다 — 실패해도 확정 화면은 그대로 보여 준다. 선점(send_pending → send_inflight)이
  // 있어 웹훅·새로고침이 겹쳐도 한 통만 나간다. 새로고침(already_confirmed)에서는 안 나간 메일을 한 번 더
  // 시도하되, 이미 나갔으면 emailSent를 비워 "이번 호출이 보낸 게 아니다"로 둔다.
  let sent = false;
  try {
    sent = (await sendShowTicketEmail(orderId)).sent;
  } catch (error) {
    console.error('[shows-success] 티켓 메일 발송 예외', { orderNo: orderId, error });
  }
  const emailFields = result.status === 'confirmed' ? { emailSent: sent } : sent ? { emailSent: true } : {};
  return {
    props: {
      outcome: 'confirmed',
      orderNo: orderId,
      manageUrl: `/ko/shows/manage/${orderId}?token=${order.manageToken}`,
      hasEmail: order.customerEmail.trim() !== '',
      ...emailFields,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
ShowSuccessPage.designEdition = 'v2';
