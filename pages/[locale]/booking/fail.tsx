import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

interface FailProps {
  code?: string;
  message?: string;
}

export default function BookingFailPage({ code, message }: FailProps) {
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
        <Link href="/ko/booking/recording" className="mt-8 inline-block underline">
          예약 페이지로 돌아가기
        </Link>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<FailProps> = async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { code, message } = query;
  return {
    props: {
      ...(typeof code === 'string' ? { code } : {}),
      ...(typeof message === 'string' ? { message } : {}),
    },
  };
};
