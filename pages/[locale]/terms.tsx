import type { GetServerSideProps, NextPage } from 'next';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { Section } from '../../components/ui/Section';
import { getSiteConfig, studioOperator } from '../../data/siteConfig';
import { getI18nStaticProps, resolveLocaleParam } from '../../lib/getStatic';
import { REFUND_POLICY_LINES } from '../../lib/booking/refund-policy';
import type { Locale } from '../../lib/i18n';

// ko 전용 페이지 — 예약 퍼널(lib/booking/*)이 ko 전용이라 약관·환불규정도 ko에만 존재한다.
// 다른 로케일 경로는 getServerSideProps에서 /ko/terms로 리다이렉트한다.
// getStaticProps는 build-time prerendering 중 redirect를 반환할 수 없다(Next.js 제약 —
// "redirect can not be returned from getStaticProps during prerendering") — booking/[service].tsx와
// 동일하게 getServerSideProps를 쓴다.

interface TermsPageProps {
  locale: Locale;
}

interface TermsSection {
  heading: string;
  body: string;
}

const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: '1. 예약 성립',
    body: '온라인 예약은 결제가 완료된 시점에 확정됩니다. 결제 전 슬롯 선점은 임시 상태이며, 정해진 시간 안에 결제가 완료되지 않으면 자동으로 해제됩니다.',
  },
  {
    heading: '2. 이용',
    body: '예약자는 예약한 시간 동안 스튜디오를 이용하며, 현장 안내에 따라 장비와 공간을 안전하게 사용해 주셔야 합니다. 안내를 따르지 않아 발생한 장비 손상이나 사고에 대한 책임은 이용자에게 있습니다.',
  },
  {
    heading: '3. 취소 및 환불',
    body: '예약 취소는 예약 확인 페이지에서 직접 진행할 수 있으며, 취소 시점에 따라 아래 환불 규정이 적용됩니다.',
  },
];

const TermsPage: NextPage<TermsPageProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const title = '이용약관';
  const subtitle = '스튜디오 놀 온라인 예약의 예약 성립, 이용, 취소·환불 규정과 사업자 정보를 안내합니다.';

  return (
    <>
      <SEO
        locale={locale}
        title={`${title} | ${siteConfig.name}`}
        description={subtitle}
        robots="noindex, follow"
        canonical="/ko/terms"
        breadcrumbs={[
          { name: t('nav.home'), path: '/ko' },
          { name: title, path: '/ko/terms' },
        ]}
      />

      <Section variant="default" className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="typo-section-title mb-4 text-gray-900 dark:text-white">{title}</h1>
          <p className="typo-card-body text-gray-700 dark:text-gray-300 mb-2">{subtitle}</p>
          <p className="typo-card-meta text-gray-500 dark:text-gray-400 mb-8">시행일: 2026년 8월 25일</p>

          <div className="space-y-6">
            {TERMS_SECTIONS.map((section) => (
              <article key={section.heading} className="glass-card rounded-xl p-6">
                <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">{section.heading}</h2>
                <p className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed">{section.body}</p>
              </article>
            ))}

            <article className="glass-card rounded-xl p-6">
              <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">환불 규정</h2>
              <ul className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed list-disc pl-5 space-y-1">
                {REFUND_POLICY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-6 text-sm">
                <Link href="/ko/funding/terms" className="underline">
                  펀딩(리워드 선주문) 약관 보기
                </Link>
              </p>
            </article>

            <article className="glass-card rounded-xl p-6">
              <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">사업자 정보</h2>
              <dl className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed space-y-1">
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">상호</dt>
                  <dd>{siteConfig.name} (Studio NOL)</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">대표자</dt>
                  <dd>{studioOperator.name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">주소</dt>
                  <dd>{siteConfig.contact.address}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">연락처</dt>
                  <dd>{siteConfig.contact.phone}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">이메일</dt>
                  <dd>{siteConfig.contact.email}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">사업자등록번호</dt>
                  <dd>{siteConfig.businessRegistrationNumber}</dd>
                </div>
                {siteConfig.mailOrderSalesNumber && (
                  <div className="flex gap-2">
                    <dt className="font-semibold shrink-0">통신판매업신고</dt>
                    <dd>{siteConfig.mailOrderSalesNumber}</dd>
                  </div>
                )}
              </dl>
            </article>
          </div>
        </div>
      </Section>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  if (locale !== 'ko') {
    return { redirect: { destination: '/ko/terms', permanent: false } };
  }
  const { i18nResources } = getI18nStaticProps(params?.locale, []);
  return { props: { locale, i18nResources } };
};

export default TermsPage;
