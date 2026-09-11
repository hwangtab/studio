import type { GetServerSideProps } from 'next';
import Head from 'next/head';

import { SESSION_PRODUCTS } from '../../../lib/booking/products';

interface FailProps {
  /** 돌아갈 예약 페이지. 검증된 값만 들어온다. */
  service: string;
  code?: string;
  message?: string;
}

export default function BookingFailPage({ code, message, service }: FailProps) {
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
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          {message || '결제 진행 중 문제가 발생했습니다.'}
        </p>
        {code && <p className="mt-2 text-sm text-gray-500">오류 코드: {code}</p>}
        <p className="mt-2 text-sm text-gray-500">예약은 확정되지 않았습니다 — 결제 정보가 저장되지 않았으니 안심하고 다시 시도해 주세요.</p>
        {/* 이탈 링크 두 가지 규칙(lib/analytics/privatePaths.ts):
            1. 문서 이동(`<a href>`) — next/link 클라 전환으로 나갔다가 뒤로가기를 누르면,
               그 사이 mount된 gtag가 비밀값이 붙은 이 URL로 page_view를 보낸다.
            2. 공개 목적지에는 `rel="noreferrer"` — 사이트 Referrer-Policy가
               strict-origin-when-cross-origin이라 **동일 출처 이동에는 전체 URL**을 보낸다.
               없으면 도착지 gtag가 page_referrer에 토큰·paymentKey를 실어 보낸다.
               private→private 링크(관리·입금 안내)는 도착지도 측정 대상이 아니라 불필요. */}
        <a href={`/ko/booking/${service}`} rel="noreferrer" className="mt-8 inline-block underline">
          {service === 'mixing-mastering' ? '주문 페이지로 돌아가기' : '예약 페이지로 돌아가기'}
        </a>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<FailProps> = async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { code, message, service } = query;
  // 쿼리값을 그대로 경로에 넣지 않는다 — 아는 서비스일 때만 쓰고 아니면 녹음으로 돌아간다.
  // 목록을 베끼지 않고 상품 정본에서 끌어온다 — 서비스가 늘면 여기도 자동으로 따라간다.
  // 믹싱·마스터링은 슬롯 없는 주문형 결제라 SESSION_PRODUCTS에 없다([service].tsx와 같은 이유로
  // 별도 분기) — 빠뜨리면 믹싱 결제 실패 고객이 녹음 예약으로 잘못 돌아간다.
  const knownServices = new Set<string>([...SESSION_PRODUCTS.map((p) => p.service as string), 'mixing-mastering']);
  const safeService = typeof service === 'string' && knownServices.has(service) ? service : 'recording';
  return {
    props: {
      service: safeService,
      ...(typeof code === 'string' ? { code } : {}),
      ...(typeof message === 'string' ? { message } : {}),
    },
  };
};
