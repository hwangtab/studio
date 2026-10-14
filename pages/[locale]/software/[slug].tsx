import Link from 'next/link';

import SEO from '../../../components/SEO';
import SoftwareOrderForm from '../../../components/software/SoftwareOrderForm';
import { buttonVariants } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../components/ui/PageHeader';
import { Panel } from '../../../components/ui/Panel';
import type { SoftwareProduct } from '../../../data/software/catalog';
import { SOFTWARE_SALES_OPEN } from '../../../data/software/policy';
import { withI18nServerProps } from '../../../lib/getStatic';
import { getPublishedSoftware, trialDaysOf } from '../../../lib/software/catalog';
import {
  formatBytes, formatList, localizedProduct, PLATFORM_LABEL, SOFTWARE_COPY, softwarePath, toSoftwareLocale, type SoftwareLocale,
} from '../../../lib/software/copy';

interface Props {
  softwareLocale: SoftwareLocale;
  product: SoftwareProduct;
  salesOpen: boolean;
}

export default function SoftwareDetailPage({ softwareLocale: locale, product, salesOpen }: Props) {
  const t = SOFTWARE_COPY[locale];
  const l = localizedProduct(product, locale);
  const latest = product.releases[0] ?? null;
  return (
    <>
      <SEO
        title={`${l.title} | ${locale === 'ko' ? '스튜디오 놀' : 'Studio NOL'}`}
        description={l.summary}
        canonical={softwarePath(locale, product.slug)}
        availableLocales={['ko', 'en']}
        robots={salesOpen ? undefined : 'noindex, follow'}
      />
      <PageShell width="wide">
        <PageHeader
          backHref={softwarePath(locale)}
          backLabel={t.backToIndex}
          title={l.title}
          lead={l.summary}
          meta={latest ? `${t.kind[product.kind]} · ${t.latest} ${latest.version}` : t.kind[product.kind]}
        />

        <div className="space-y-6">
          <div className="space-y-4 text-gray-800 dark:text-gray-200">
            {l.description.map((para, i) => <p key={i}>{para}</p>)}
          </div>

          <Panel as="section" padding="default">
            <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-gray-500 dark:text-gray-400">{t.formats}</dt>
              <dd className="text-gray-900 dark:text-white">{formatList(product.formats)}</dd>
              <dt className="text-gray-500 dark:text-gray-400">{t.platforms}</dt>
              <dd className="text-gray-900 dark:text-white">{product.platforms.map((p) => PLATFORM_LABEL[p]).join(' · ')}</dd>
              {l.requirements.length > 0 && (
                <>
                  <dt className="text-gray-500 dark:text-gray-400">{t.requirements}</dt>
                  <dd className="text-gray-900 dark:text-white"><ul className="space-y-1">{l.requirements.map((r) => <li key={r}>{r}</li>)}</ul></dd>
                </>
              )}
            </dl>
          </Panel>

          <Panel as="section" padding="default" title={t.trialHeading}>
            <p className="text-sm text-gray-700 dark:text-gray-300">{t.trialBody(trialDaysOf(product))}</p>
            {latest && latest.downloads.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {latest.downloads.map((d) => (
                  <li key={d.platform}>
                    <a href={d.url} className={buttonVariants({ variant: 'solid', size: 'md' })} rel="nofollow">
                      {t.download(PLATFORM_LABEL[d.platform])} · v{latest.version} · {formatBytes(d.sizeBytes)}
                    </a>
                    <p className="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">{t.checksum} {d.sha256}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t.noDownload}</p>
            )}
          </Panel>

          {salesOpen && locale === 'ko' && product.prices?.[0] ? (
            <Panel as="section" padding="default" title="구매">
              <SoftwareOrderForm product={product} price={product.prices[0]} />
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                이미 구매하셨나요? <Link href="/ko/software/find" className="underline">구매 내역 링크 다시 받기</Link>
              </p>
            </Panel>
          ) : (
            <Notice tone="info" title={t.salesClosedHeading}>{t.salesClosedBody}</Notice>
          )}

          {product.releases.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">{t.changelog}</h2>
              <ol className="space-y-4">
                {product.releases.map((r) => (
                  <li key={r.version}>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">v{r.version} <span className="font-normal text-gray-500 dark:text-gray-400">· {r.date}</span></p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                      {(locale === 'ko' ? r.notes : r.notesEn).map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <p className="text-sm"><Link href={softwarePath(locale)} className="text-primary hover:underline dark:text-primary-lighter">← {t.backToIndex}</Link></p>
        </div>
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, res }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const locale = toSoftwareLocale(params?.locale);
  if (!locale) return { redirect: { destination: softwarePath('en', slug || undefined), permanent: false } };
  const product = getPublishedSoftware(slug);
  if (!product) return { notFound: true };
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return { props: { softwareLocale: locale, product, salesOpen: SOFTWARE_SALES_OPEN } };
});

// 디자인 판 — lib/designEdition.ts
SoftwareDetailPage.designEdition = 'v2';
