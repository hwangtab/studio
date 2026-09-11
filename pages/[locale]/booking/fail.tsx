import type { GetServerSideProps } from 'next';
import Head from 'next/head';

import { getSiteConfig } from '../../../data/siteConfig';
import { SESSION_PRODUCTS } from '../../../lib/booking/products';

/**
 * 토스 실패 코드 → 우리가 쓴 문구.
 *
 * 예전엔 쿼리의 `message`를 검증 없이 그대로 출력했다. 실패 URL은 결제창이 만들지만
 * 주소는 누구나 손으로 칠 수 있으므로, 우리 도메인·우리 레이아웃 안에 **공격자가 고른
 * 문장**(가짜 연락처·가짜 안내)을 띄울 수 있었고, message가 비어 있으면 안내조차 없었다.
 * pages/[locale]/funding/fail.tsx가 같은 문제를 이미 이렇게 풀어 뒀다 — `code`만 받아
 * 이 표로 옮기고 `message`는 버린다. 두 표는 같은 토스페이먼츠 결제창 실패 코드를 쓴다.
 */
const FAIL_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨습니다.',
  PAY_PROCESS_ABORTED: '결제가 완료되기 전에 창이 닫혔습니다.',
  USER_CANCEL: '결제를 취소하셨습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다. 다른 카드나 결제수단으로 시도해 주세요.',
  INVALID_CARD_EXPIRATION: '카드 유효기간을 다시 확인해 주세요.',
  INVALID_STOPPED_CARD: '정지된 카드입니다. 다른 결제수단으로 시도해 주세요.',
  EXCEED_MAX_DAILY_PAYMENT_COUNT: '하루 결제 가능 횟수를 초과했습니다. 내일 다시 시도하거나 다른 결제수단을 이용해 주세요.',
  EXCEED_MAX_PAYMENT_AMOUNT: '결제 한도를 초과했습니다. 카드사에 문의하거나 다른 결제수단을 이용해 주세요.',
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: '이 카드로는 선택하신 할부 개월 수를 쓸 수 없습니다.',
  INVALID_CARD_NUMBER: '카드번호를 다시 확인해 주세요.',
  NOT_AVAILABLE_BANK: '은행 서비스 시간이 아닙니다. 잠시 후 다시 시도해 주세요.',
};
/**
 * 화면에 그대로 띄워도 되는 주문번호 형태 — 토스가 실패 URL에 `orderId`로 실어 보낸다.
 *
 * 왜 보여주는가: 결제가 실패하면 고객이 문의를 하는데, 댈 수 있는 식별자가 화면에 없었다.
 * 주소창에는 이미 들어 있으니 새로 노출되는 정보는 없고, 주문번호만으로는 아무 데도
 * 접근하지 못한다(확정 멱등 분기가 amount + paymentKey 일치를 함께 요구한다 — PR #56).
 * 형태를 좁게 검증해, 임의 문자열이 우리 레이아웃 안에 렌더되는 경로를 만들지 않는다.
 */
const ORDER_NO_PATTERN = /^(SNB|FND)-(M-)?\d{8}-[0-9A-F]{8}$/;
const GENERIC_MESSAGE = '결제 진행 중 문제가 발생했습니다.';
/** 화면에 그대로 보여도 되는 코드 형태. 표에 없는 코드도 문의할 때 쓸 수 있게 보여준다. */
const CODE_PATTERN = /^[A-Z0-9_]{1,60}$/;

interface FailProps {
  /** 돌아갈 예약 페이지. 검증된 값만 들어온다. */
  service: string;
  code: string | null;
  /** 표에서 옮긴 안전한 문구. 쿼리 원문이 아니다. */
  message: string;
  /** 문의할 때 댈 주문번호. 형태 검증을 통과한 값만 온다. */
  orderNo: string | null;
}

export default function BookingFailPage({ code, message, orderNo, service }: FailProps) {
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  return (
    <>
      <Head>
        <title>결제를 완료하지 못했습니다 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        {/* 사이트 헤더를 두르지 않는 화면이라(components/Layout.tsx의 isPrivatePaymentPage)
            여기가 브랜드를 밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 어디서 온
            화면인지 알 수 있어야 한다. */}
        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">스튜디오 놀</p>
        <h1 className="typo-page-title">결제를 완료하지 못했습니다</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">{message}</p>
        {code && <p className="mt-2 text-sm text-gray-500">오류 코드: {code}</p>}
        {orderNo && <p className="mt-1 text-sm text-gray-500">주문번호: {orderNo}</p>}
        <p className="mt-2 text-sm text-gray-500">예약은 확정되지 않았습니다 — 결제 정보가 저장되지 않았으니 안심하고 다시 시도해 주세요.</p>
        {/* 정본 연락처를 상시 표기한다 — message가 비거나 알 수 없는 코드여도 기댈 곳이
            화면에 있어야 한다(funding/fail.tsx와 같은 이유). */}
        <p className="mt-3 text-sm text-gray-500">문의: 010-4255-7893 · hello@studionol.co.kr</p>
        {/* 카카오톡 목적지 링크 — CLAUDE.md 카카오 CTA 배색 규칙(옐로 고정). 이 페이지는
            ko 전용(아래 getServerSideProps가 비-ko를 /ko로 리다이렉트)이라 분기가 필요 없다. */}
        <p className="mt-6">
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-kakao px-6 py-3 font-bold text-kakao-ink transition-colors hover:bg-kakao-dark"
          >
            카카오톡으로 문의하기
          </a>
        </p>
        {/* 이탈 링크 두 가지 규칙(lib/analytics/privatePaths.ts):
            1. 문서 이동(`<a href>`) — next/link 클라 전환으로 나갔다가 뒤로가기를 누르면,
               그 사이 mount된 gtag가 비밀값이 붙은 이 URL로 page_view를 보낸다.
            2. 공개 목적지에는 `rel="noreferrer"` — 사이트 Referrer-Policy가
               strict-origin-when-cross-origin이라 **동일 출처 이동에는 전체 URL**을 보낸다.
               없으면 도착지 gtag가 page_referrer에 토큰·paymentKey를 실어 보낸다.
               private→private 링크(관리·입금 안내)는 도착지도 측정 대상이 아니라 불필요. */}
        <a href={`/ko/booking/${service}`} rel="noreferrer" className="mt-4 inline-block underline">
          {service === 'mixing-mastering' ? '주문 페이지로 돌아가기' : '예약 페이지로 돌아가기'}
        </a>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<FailProps> = async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { code, orderId, service } = query;
  // 쿼리값을 그대로 경로에 넣지 않는다 — 아는 서비스일 때만 쓰고 아니면 녹음으로 돌아간다.
  // 목록을 베끼지 않고 상품 정본에서 끌어온다 — 서비스가 늘면 여기도 자동으로 따라간다.
  // 믹싱·마스터링은 슬롯 없는 주문형 결제라 SESSION_PRODUCTS에 없다([service].tsx와 같은 이유로
  // 별도 분기) — 빠뜨리면 믹싱 결제 실패 고객이 녹음 예약으로 잘못 돌아간다.
  const knownServices = new Set<string>([...SESSION_PRODUCTS.map((p) => p.service as string), 'mixing-mastering']);
  const safeService = typeof service === 'string' && knownServices.has(service) ? service : 'recording';
  // code만 받는다. query.message는 읽지도 않는다 — 표에 없는 코드는 일반 문구로 떨어진다.
  const safeCode = typeof code === 'string' && CODE_PATTERN.test(code) ? code : null;
  // 토스가 실어 보내는 orderId — 문의용 식별자로만 쓴다(형태를 벗어나면 버린다).
  const safeOrderNo =
    typeof orderId === 'string' && ORDER_NO_PATTERN.test(orderId.toUpperCase())
      ? orderId.toUpperCase()
      : null;
  return {
    props: {
      service: safeService,
      code: safeCode,
      message: (safeCode && FAIL_MESSAGES[safeCode]) || GENERIC_MESSAGE,
      orderNo: safeOrderNo,
    },
  };
};
