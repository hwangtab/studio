import Link from 'next/link';

import SEO from '../../../components/SEO';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader, PageShell } from '../../../components/ui/PageHeader';
import { Panel } from '../../../components/ui/Panel';
import type { SoftwareProduct } from '../../../data/software/catalog';
import { SOFTWARE_SALES_OPEN } from '../../../data/software/policy';
import { withI18nServerProps } from '../../../lib/getStatic';
import { listPublishedSoftware } from '../../../lib/software/catalog';
import { formatList, localizedProduct, SOFTWARE_COPY, softwarePath, toSoftwareLocale, type SoftwareLocale } from '../../../lib/software/copy';

interface Props {
  softwareLocale: SoftwareLocale;
  products: SoftwareProduct[];
  indexable: boolean;
}

export default function SoftwareIndexPage({ softwareLocale: locale, products, indexable }: Props) {
  const t = SOFTWARE_COPY[locale];
  return (
    <>
      <SEO
        title={t.seoIndexTitle}
        description={t.seoIndexDescription}
        canonical={softwarePath(locale)}
        availableLocales={['ko', 'en']}
        robots={indexable ? undefined : 'noindex, follow'}
      />
      <PageShell width="wide">
        <PageHeader title={t.indexTitle} lead={t.indexLead} />
        {products.length === 0 ? (
          <EmptyState titleAs="h2" title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <ul className="space-y-4">
            {products.map((p) => {
              const l = localizedProduct(p, locale);
              return (
                <li key={p.slug}>
                  <Panel as="section" padding="default">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      <Link href={softwarePath(locale, p.slug)} className="hover:underline">{l.title}</Link>
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.kind[p.kind]} · {formatList(p.formats)}</p>
                    <p className="mt-2 text-gray-700 dark:text-gray-300">{l.summary}</p>
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, res }) => {
  const locale = toSoftwareLocale(params?.locale);
  if (!locale) return { redirect: { destination: softwarePath('en'), permanent: false } };
  const products = listPublishedSoftware();
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  // 팔고 있을 때만 색인한다 — 준비 중인 빈 페이지가 검색에 잡히지 않게(상점과 같다).
  return { props: { softwareLocale: locale, products, indexable: SOFTWARE_SALES_OPEN && products.length > 0 } };
});

// 디자인 판 — lib/designEdition.ts
SoftwareIndexPage.designEdition = 'v2';
