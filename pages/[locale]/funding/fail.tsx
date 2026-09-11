import type { GetServerSideProps } from 'next';
import Head from 'next/head';

interface Props { slug: string | null; message: string }
export default function FundingFailPage({ slug, message }: Props) {
  return (
    <>
      <Head><title>결제 실패 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-16 sm:pt-20">
        <div className="glass-card rounded-2xl p-6 text-center sm:p-8">
          {/* 사이트 헤더를 두르지 않는 화면이라(components/Layout.tsx의 isPrivatePaymentPage)
              여기가 브랜드를 밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 어디서 온
              화면인지 알 수 있어야 한다. */}
          <p className="typo-card-meta mb-2">스튜디오 놀</p>
          <h1 className="typo-page-title">결제가 완료되지 않았습니다</h1>
          <p className="typo-card-body mx-auto mt-3 max-w-md">{message}</p>
          <p className="typo-card-meta mx-auto mt-3 max-w-md">
            결제가 이뤄지지 않았으므로 청구되지 않습니다. 15분 뒤 신청이 자동 해제되며 다시 후원할 수 있습니다.
          </p>
          {/* 이 URL에는 토스가 붙인 orderId(주문번호)가 실린다. 이탈 링크 두 가지 규칙(lib/analytics/privatePaths.ts):
              1. 문서 이동(`<a href>`) — next/link 클라 전환으로 나갔다가 뒤로가기를 누르면,
                 그 사이 mount된 gtag가 비밀값이 붙은 이 URL로 page_view를 보낸다.
              2. 공개 목적지에는 `rel="noreferrer"` — 사이트 Referrer-Policy가
                 strict-origin-when-cross-origin이라 **동일 출처 이동에는 전체 URL**을 보낸다.
                 없으면 도착지 gtag가 page_referrer에 토큰·paymentKey를 실어 보낸다.
                 private→private 링크(관리·입금 안내)는 도착지도 측정 대상이 아니라 불필요. */}
          <a
            href={slug ? `/ko/funding/${slug}` : '/ko/funding'}
            rel="noreferrer"
            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
          >
            프로젝트로 돌아가기
          </a>
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
