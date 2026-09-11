import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { Section } from '../../components/ui/Section';
import { POLICY_COPY_BY_LOCALE } from '../../data/privacyPolicy';
import { getSiteConfig } from '../../data/siteConfig';
import { buildPageStaticProps, getCommonStaticPaths } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';

interface PrivacyPolicyProps {
  locale: Locale;
}

const PrivacyPolicyPage: NextPage<PrivacyPolicyProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const policyCopy = POLICY_COPY_BY_LOCALE[locale] || POLICY_COPY_BY_LOCALE.ko;

  return (
    <>
      <SEO
        locale={locale}
        title={`${policyCopy.title} | ${siteConfig.name}`}
        description={policyCopy.subtitle}
        robots="noindex, follow"
        canonical={`/${locale}/privacy-policy`}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('footer.privacy'), path: `/${locale}/privacy-policy` },
        ]}
      />

      <Section variant="default">
        <div className="max-w-4xl mx-auto">
          <h1 className="typo-section-title mb-4 text-gray-900 dark:text-white">{policyCopy.title}</h1>
          <p className="typo-card-body text-gray-700 dark:text-gray-300 mb-2">{policyCopy.subtitle}</p>
          <p className="typo-card-meta text-gray-500 dark:text-gray-400 mb-8">
            {policyCopy.lastUpdatedLabel}: {policyCopy.lastUpdatedValue}
          </p>

          <div className="space-y-6">
            {policyCopy.sections.map((section) => (
              <article key={section.heading} className="glass-card rounded-xl p-6">
                <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">{section.heading}</h2>
                <p className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed">{section.body}</p>
                {section.items && (
                  <ul className="typo-card-body mt-3 list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300 leading-relaxed">
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {section.processors && (
                  /* 표는 좁은 화면에서 가로 스크롤로 넘긴다 — 본문이 가로로 밀리면 안 된다. */
                  <div className="mt-3 overflow-x-auto">
                    <table className="typo-card-body w-full min-w-[32rem] border-collapse text-left text-gray-700 dark:text-gray-300">
                      <thead>
                        <tr className="border-b border-gray-300 dark:border-gray-600">
                          <th scope="col" className="py-2 pr-4 font-semibold">수탁자</th>
                          <th scope="col" className="py-2 pr-4 font-semibold">위탁 업무</th>
                          <th scope="col" className="py-2 font-semibold">위탁 항목</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.processors.map((row) => (
                          <tr key={row.name} className="border-b border-gray-200/70 last:border-0 dark:border-gray-700/70">
                            <td className="py-2 pr-4 align-top font-medium text-gray-900 dark:text-white">{row.name}</td>
                            <td className="py-2 pr-4 align-top">{row.purpose}</td>
                            <td className="py-2 align-top">{row.items}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps = async ({ params }) =>
  buildPageStaticProps(params?.locale, {}, { revalidate: 86400, i18nSections: [] });

export default PrivacyPolicyPage;
