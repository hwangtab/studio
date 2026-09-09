import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

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
        <h1 className="text-2xl font-bold">결제를 완료하지 못했습니다</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          {message || '결제 진행 중 문제가 발생했습니다.'}
        </p>
        {code && <p className="mt-2 text-sm text-gray-500">오류 코드: {code}</p>}
        <p className="mt-2 text-sm text-gray-500">예약은 확정되지 않았습니다 — 결제 정보가 저장되지 않았으니 안심하고 다시 시도해 주세요.</p>
        <Link href={`/ko/booking/${service}`} className="mt-8 inline-block underline">
          {service === 'mixing-mastering' ? '주문 페이지로 돌아가기' : '예약 페이지로 돌아가기'}
        </Link>
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
