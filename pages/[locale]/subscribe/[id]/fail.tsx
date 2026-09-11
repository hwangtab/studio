import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

interface FailProps {
  id: string;
  /** 링크는 아직 유효하므로 다시 시도할 수 있게 그대로 들고 있는다. */
  setupToken: string;
  code?: string;
  message?: string;
}

export default function SubscribeFailPage({ id, setupToken, code, message }: FailProps) {
  return (
    <>
      <Head>
        <title>카드 등록에 실패했습니다 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-lg min-w-0 max-w-full px-4 py-24 text-center">
        <h1 className="typo-page-title">카드 등록을 완료하지 못했습니다</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">{message || '카드 인증 중 문제가 발생했습니다.'}</p>
        {code && <p className="mt-2 text-sm text-gray-500">오류 코드: {code}</p>}
        <p className="mt-2 text-sm text-gray-500">아직 청구되지 않았습니다 — 안심하고 다시 시도해 주세요.</p>
        <Link
          href={`/ko/subscribe/${id}?token=${encodeURIComponent(setupToken)}`}
          className="mt-8 inline-block underline"
        >
          다시 시도하기
        </Link>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<FailProps> = async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { id } = params as { id: string };
  const { token, code, message } = query;
  if (typeof id !== 'string' || typeof token !== 'string' || token.trim() === '') {
    return { notFound: true };
  }

  return {
    props: {
      id,
      setupToken: token,
      ...(typeof code === 'string' ? { code } : {}),
      ...(typeof message === 'string' ? { message } : {}),
    },
  };
};
