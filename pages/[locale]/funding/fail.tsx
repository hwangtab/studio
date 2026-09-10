import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

interface Props { slug: string | null; message: string }
export default function FundingFailPage({ slug, message }: Props) {
  return (
    <>
      <Head><title>결제 실패 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-28 sm:pt-32">
        <div className="glass-card rounded-2xl p-6 text-center sm:p-8">
          <h1 className="typo-card-title text-gray-900 dark:text-white">결제가 완료되지 않았습니다</h1>
          <p className="typo-card-body mx-auto mt-3 max-w-md">{message}</p>
          <p className="typo-card-meta mx-auto mt-3 max-w-md">
            결제가 이뤄지지 않았으므로 청구되지 않습니다. 15분 뒤 신청이 자동 해제되며 다시 후원할 수 있습니다.
          </p>
          <Link
            href={slug ? `/ko/funding/${slug}` : '/ko/funding'}
            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
          >
            프로젝트로 돌아가기
          </Link>
        </div>
      </main>
    </>
  );
}
export const getServerSideProps: GetServerSideProps<Props> = async ({ params, query, res }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/funding', permanent: false } };
  const slug = typeof query.slug === 'string' && /^[a-z0-9-]+$/.test(query.slug) ? query.slug : null;
  const message = typeof query.message === 'string' ? query.message.slice(0, 200) : '결제창이 닫혔거나 결제가 거절되었습니다.';
  return { props: { slug, message } };
};
