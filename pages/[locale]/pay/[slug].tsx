/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 결제 링크 slug가 실린다)의 이탈 링크는 next/link가 아니라 문서 이동이어야 한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트: tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';

import { getSiteConfig } from '../../../data/siteConfig';
import { getPaymentLink } from '../../../data/paymentLinks';
import { formatPriceAmount } from '../../../data/pricing';
import { splitInclusiveAmount } from '../../../lib/booking/amounts';
import { withI18nServerProps } from '../../../lib/getStatic';
import PaymentLinkCheckout from '../../../components/payments/PaymentLinkCheckout';
import { PageShell } from '../../../components/ui/PageHeader';
import { PriceSummary } from '../../../components/ui/PriceSummary';

interface PayLinkProps {
  slug: string;
  itemName: string;
  itemAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export default function PaymentLinkPage({ slug, itemName, itemAmount, vatAmount, totalAmount }: PayLinkProps) {
  const siteConfig = getSiteConfig('ko');
  const kakaoUrl = siteConfig.contact.kakaoUrl;
  const siteUrl = siteConfig.url;
  const description = `${itemName} ${formatPriceAmount(totalAmount)}원(부가세 포함) — 카드·간편결제 또는 계좌 입금으로 결제해요.`;
  return (
    <>
      <Head>
        <title>{`${itemName} 결제 | 스튜디오 놀`}</title>
        <meta name="robots" content="noindex, nofollow" />
        {/* 카카오톡·메신저로 링크를 보내면 미리보기가 이 태그를 읽는다. 색인은 막되 미리보기는 살린다. */}
        <meta name="description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="스튜디오 놀" />
        <meta property="og:locale" content="ko_KR" />
        <meta property="og:title" content={`${itemName} 결제 | 스튜디오 놀`} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={`${siteUrl}/images/og-default.webp`} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <PageShell width="form">
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>

        <header className="mb-6 text-center">
          <h1 className="typo-page-title text-gray-900 dark:text-white">{itemName}</h1>
          <p className="mt-4 text-4xl font-bold tabular-nums text-gray-900 dark:text-white">
            {formatPriceAmount(totalAmount)}원
          </p>
          <p className="mt-1 typo-card-meta">예약금 {formatPriceAmount(totalAmount)}원 (부가세 포함)</p>
        </header>

        <PriceSummary
          className="mb-6"
          items={[{ label: itemName, amount: itemAmount }]}
          vat={vatAmount}
          total={totalAmount}
          totalLabel="결제 금액 (부가세 포함)"
        />

        <PaymentLinkCheckout slug={slug} totalAmount={totalAmount} />

        <p className="mt-8 text-center typo-card-meta">
          환불은 카카오톡 또는 전화로 문의해 주세요.{' '}
          <a href={kakaoUrl} target="_blank" rel="noopener noreferrer" className="underline">
            카카오톡 문의
          </a>
          {' · '}
          <a href="tel:01042557893" rel="noreferrer" className="underline">
            010-4255-7893
          </a>
        </p>
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<PayLinkProps>(async ({ params, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (params?.locale !== 'ko') return { notFound: true };
  const slug = params?.slug;
  const link = getPaymentLink(slug);
  if (!link || typeof slug !== 'string') return { notFound: true };
  const amounts = splitInclusiveAmount(link.totalAmount);
  return {
    props: {
      slug,
      itemName: link.itemName,
      itemAmount: amounts.itemAmount,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
PaymentLinkPage.designEdition = 'v2';
