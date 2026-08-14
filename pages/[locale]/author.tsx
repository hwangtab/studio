import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Award, ExternalLink, Music } from '@/lib/lucide-icons';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import ResponsiveImage from '../../components/ResponsiveImage';
import { Section } from '../../components/ui/Section';
import SectionHeading from '../../components/ui/SectionHeading';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getAuthorProfile } from '../../data/authorProfile';
import { generatePersonProfileSchema } from '../../utils/schema';
import type { NextPageWithLayout } from '../../types';

// Below-fold CTA — code-splitting (about.tsx와 동일 패턴)
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));

interface AuthorPageProps {
  locale: Locale;
}

// 운영자 프로필 페이지 — 스토리 실명 바이라인의 착지점이자 Person entity(#person-hwang)의
// 크롤 가능한 홈. article/releaseProject JSON-LD의 Person.url이 이 페이지를 가리킨다.
const AuthorPage: NextPageWithLayout<AuthorPageProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const profile = getAuthorProfile(locale);
  const getLink = (path: string) => `/${locale}${path}`;

  const personSchema = React.useMemo(
    () => generatePersonProfileSchema(siteConfig.url, locale, profile.schemaDescription),
    [siteConfig.url, locale, profile.schemaDescription]
  );

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={profile.seo.title}
        description={profile.seo.description}
        keywords={profile.seo.keywords}
        ogImage="/images/og-recording15.webp"
        ogImageAlt={profile.heroAlt}
        ogImageWidth={1200}
        ogImageHeight={630}
        canonical={`/${locale}/author`}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: profile.name, path: `/${locale}/author` },
        ]}
        includeSchema
        webPageType="ProfilePage"
        webPageMainEntityId={`${siteConfig.url}/#person-hwang`}
        schema={[personSchema]}
      />

      <ImageHero
        locale={locale}
        priority
        title={profile.name}
        // 인물 사진은 히어로 안 아바타로. 배경(studio1)은 그대로 두고 사람을 얹어야
        // "프로필 페이지에 얼굴이 없다"와 "스튜디오 사진에 인물 alt가 붙어 있다"가 함께 풀린다.
        // priority는 주지 않는다 — preload 예산은 LCP인 배경 이미지 몫이고, eager로 충분히 이르다.
        aboveTitle={
          <ResponsiveImage
            src={profile.photo.src}
            alt={profile.photo.alt}
            width={128}
            height={128}
            sizes="128px"
            loading="eager"
            containerClassName="w-32 h-32 rounded-full overflow-hidden ring-2 ring-white/70 shadow-lg"
            className="w-full h-full object-cover"
          />
        }
        subtitle={
          <div className="mt-4 space-y-1 text-lg opacity-90">
            <p>{profile.jobTitle}</p>
            <p className="text-base">{profile.tagline}</p>
          </div>
        }
        backgroundImage="/images/studio1.webp"
        imageAlt={profile.heroAlt}
        minHeight="min-h-[50vh]"
        overlayGradient="from-black/70 via-black/40 to-black/70"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: profile.name, path: `/${locale}/author` },
        ]}
      />

      <Section variant="default">
        <SectionHeading icon={Music} title={profile.headings.about} className="mb-8" />
        <div className="max-w-3xl space-y-5">
          {profile.intro.map((paragraph) => (
            <p key={paragraph} className="typo-card-body leading-relaxed text-gray-700 dark:text-gray-200">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {profile.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-gray-200 p-6 text-center dark:border-gray-700"
            >
              <p className="text-3xl font-bold text-primary">{stat.value}</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{stat.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section variant="alternate">
        <SectionHeading icon={Award} title={profile.headings.award} className="mb-8" />
        {/* 목록 형식 — 수상 한 건을 문장으로 늘여 쓰면 자랑으로 읽히고, 연도별로 늘어놓으면 이력으로 읽힌다. */}
        <ul className="max-w-3xl space-y-3">
          {profile.awards.map((award) => (
            <li
              key={`${award.year}-${award.title}-${award.work}`}
              className="flex flex-col gap-1 border-l-2 border-primary/40 pl-4 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <span className="text-sm font-semibold tabular-nums text-primary sm:w-14 sm:flex-shrink-0">
                {award.year}
              </span>
              <span className="text-gray-900 dark:text-gray-50">
                {award.title}
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">〈{award.work}〉</span>
              </span>
            </li>
          ))}
        </ul>

        {/* 작업 연보 — 음반을 앞에, 기획·전시·축제를 뒤에. 녹음을 의뢰하러 온 사람은 앞부분만
            보고 판단하고, 더 궁금한 사람이 아래까지 읽는다. 배경 설명은 넣지 않는다(작품명·연도·역할만). */}
        <h3 className="mt-12 mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
          {profile.headings.credits}
        </h3>
        {([
          { label: profile.headings.creditAlbums, items: profile.credits.albums },
          { label: profile.headings.creditProjects, items: profile.credits.projects },
        ] as const).map((group) => (
          <div key={group.label} className="mb-8 max-w-3xl last:mb-0">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {group.label}
            </h4>
            <ul className="space-y-2">
              {group.items.map((credit) => (
                <li
                  key={`${credit.year}-${credit.title}`}
                  className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400 sm:w-24 sm:flex-shrink-0">
                    {credit.year}
                  </span>
                  <span className="break-keep text-gray-800 dark:text-gray-100">
                    {credit.title}
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{credit.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <h3 className="mt-12 mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
          {profile.headings.expertise}
        </h3>
        <ul className="flex max-w-3xl flex-wrap gap-2">
          {profile.expertise.map((item) => (
            <li
              key={item}
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200"
            >
              {item}
            </li>
          ))}
        </ul>

        <h3 className="mt-12 mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
          {profile.headings.profiles}
        </h3>
        <ul className="space-y-2">
          {profile.externalProfiles.map((external) => (
            <li key={external.url}>
              <a
                href={external.url}
                target="_blank"
                rel="me noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink size={16} aria-hidden="true" />
                {external.label}
              </a>
            </li>
          ))}
        </ul>

        {profile.pressCoverage.length > 0 && (
          <>
            <h3 className="mt-12 mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
              {profile.headings.press}
            </h3>
            <ul className="space-y-3">
              {profile.pressCoverage.map((article) => (
                <li key={article.url}>
                  {/* rel에 me를 넣지 않는다 — 본인이 운영하는 프로필이 아니라 제3자 보도다. */}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-start gap-2 text-primary hover:underline"
                  >
                    <ExternalLink size={16} className="mt-1 flex-shrink-0" aria-hidden="true" />
                    <span>
                      {article.title}
                      <span className="block text-sm text-gray-500 dark:text-gray-400">
                        {article.meta}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section variant="default">
        <SectionHeading icon={ArrowRight} title={profile.headings.work} className="mb-8" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {profile.workLinks.map((work) => (
            <Link
              key={work.href}
              href={getLink(work.href)}
              className="group rounded-lg border border-gray-200 p-6 transition-colors hover:border-primary dark:border-gray-700"
            >
              <p className="flex items-center justify-between font-semibold text-gray-900 dark:text-gray-50">
                {work.title}
                <ArrowRight
                  size={18}
                  aria-hidden="true"
                  className="text-primary transition-transform group-hover:translate-x-1"
                />
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {work.description}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      <Section variant="alternate" className="py-16">
        <ContactCTA
          locale={locale}
          title={
            <>
              {profile.cta.titleLine1}<br />
              <span className="text-primary">{profile.cta.titleHighlight}</span>
            </>
          }
          subtitle={profile.cta.subtitle}
          imageSrc="/images/studio2.webp"
          imageAlt={profile.cta.imageAlt}
          headingAs="h3"
        />
      </Section>
    </div>
  );
};

AuthorPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<AuthorPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  return buildPageStaticProps(locale, {}, { revalidate: 86400, i18nSections: ['contact'] });
};

export default AuthorPage;
