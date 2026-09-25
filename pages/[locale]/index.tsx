import React from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import Link from 'next/link';
import ServiceLinkPill from '../../components/ui/ServiceLinkPill';
import { ArrowRight, Award } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import SEO from '../../components/SEO';
import SectionHeading from '../../components/ui/SectionHeading';
import ImageHero, { HERO_SCRIM } from '../../components/common/ImageHero';
import ResponsiveImage from '../../components/ResponsiveImage';
import MediaGallery from '../../components/ui/MediaGallery';
import { Section } from '../../components/ui/Section';

// Below-fold 섹션은 정적 import로 유지한다(과거 next/dynamic ssr:true 코드 스플리팅에서 전환).
// 이유: 이들은 ssr:true라 서버는 완전한 HTML을 내보내지만, 클라이언트는 청크가 도착하기
// 전 하이드레이션 첫 패스에서 Loadable을 null로 렌더한다. dev 빌드는 __NEXT_DATA__에
// dynamicIds를 싣지 않아 loadableReady가 하이드레이션을 게이트하지 못하므로, null 렌더로
// 뒤따르는 형제 섹션이 밀려 hydration mismatch가 발생했다. prod에서도 loadableReady가
// 해당 청크를 하이드레이션 임계경로에 두어 스플리팅의 TBT 이득은 사실상 없다. 정적 import는
// 서버·클라이언트 트리를 항상 동일한 동기 렌더로 만들어 불일치를 근본 제거한다.
import ReviewSection from '../../components/ui/ReviewSection';
import FAQSection from '../../components/ui/FAQSection';
import ContactCTA from '../../components/common/ContactCTA';
import { getHomeData, type HomeData } from '../../data/home';
import { getPortfolioItems } from '../../data/portfolio';
import HomeReleaseStrip, { type ReleaseCover } from '../../components/home/HomeReleaseStrip';
import HomeServiceTracklist from '../../components/home/HomeServiceTracklist';
import { getFaqData } from '../../data/faq';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import { type Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

import type { NextPageWithLayout } from '../../types';

interface HomeProps {
  locale: Locale;
  homeData: HomeData;
  faqData: ReturnType<typeof getFaqData>;
  releaseCovers: ReleaseCover[];
}

const Home: NextPageWithLayout<HomeProps> = ({ locale, homeData, faqData, releaseCovers }) => {
  const { heroContent, homeServices, studioImages, seo, localeUsps, producerCredibility } = homeData;
  const { t } = useTranslation('common', { lng: locale });


  // Helper to generate locale-aware links
  const getLink = (path: string) => `/${locale}${path}`;
  // 검증된 유일 전환 채널(카카오) — 히어로 1차 CTA를 폼이 아닌 카카오 직링크로.
  const kakaoUrl = getSiteConfig(locale).contact.kakaoUrl;

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        ogImage="/images/og-studio2.webp"
        ogImageAlt={heroContent.imageAlt}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        webPageType="WebPage"
        canonical={`/${locale}`}
        faqItems={faqData}
      />

      <ImageHero
        locale={locale}
        priority
        title={
          <>
            <span className="block mb-2 text-gray-100 drop-shadow-lg">{heroContent.titlePrefix}</span>
            {/* v2: 제목 일부에만 걸린 그라디언트는 사진 위에서 강조가 아니라 얼룩으로 읽혔다
                (디자인 회의). 강조는 크기가 이미 맡고 있으니 같은 흰색으로 둔다. */}
            <span className="text-white drop-shadow-lg">
              {heroContent.titleHighlight}
            </span>
            {heroContent.titleSuffix && (
              <span className="text-gray-100 drop-shadow-lg">{heroContent.titleSuffix}</span>
            )}
          </>
        }
        subtitle={
          // \n 강제 개행이 있으면 브라우저가 text-wrap: balance를 포기해, 좁은 화면에서
          // 마지막 행이 감길 때 "시작하세요." 같은 고아 줄이 생긴다. 행별 block span으로
          // 나눠 각 행 안에서 balance가 동작하게 한다.
          heroContent.subtitle.split('\n').map((line) => (
            <span key={line} className="block">{line}</span>
          ))
        }
        backgroundImage={heroContent.backgroundImage}
        imageAlt={heroContent.imageAlt}
        minHeight="min-h-[100svh]"
        overlayGradient={HERO_SCRIM}
        ctaButtons={
          <>
            {/* prefetch={false}: hero CTA가 LCP 측정 창 안에 있어 자동 prefetch가
                portfolio.json 등 무거운 SSG 데이터(>100KB)를 끌어와 TBT/대역폭 경쟁을
                유발. hover/focus 시 prefetch는 next/link 기본 휴리스틱으로 유지된다. */}
            {/* 1차 CTA — 검증된 전환 채널(카카오톡) 직링크. GA4 90일 실질 전환은
                카카오 클릭이 전부였고 폼은 전환 0이라, 마찰 큰 폼(/contact) 대신
                카카오 오픈채팅으로 직접 연결. */}
            {/* 카카오 오픈채팅은 한국어 상담 채널이다. 비-ko 방문자가 여기로 가면 한국어
                채팅방(앱이 없으면 설치 유도)에 떨어지므로 /contact 폼으로 가른다.
                옐로도 함께 내린다 — 노란 버튼 = 카카오톡 규칙은 양방향이다. */}
            {locale === 'ko' ? (
              <a
                href={kakaoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackLeadEvent('lead_click_kakao', {
                    locale,
                    component: 'HomeHero',
                    cta_id: 'hero_primary_kakao',
                  })
                }
                className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-kakao text-kakao-ink font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-kakao-dark transition-transform duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20"
              >
                {heroContent.cta.reserve}
              </a>
            ) : (
              <Link
                href={getLink('/contact')}
                prefetch={false}
                onClick={() =>
                  trackMicroEvent('micro_click_contact', {
                    locale,
                    component: 'HomeHero',
                    cta_id: 'hero_primary_contact',
                  })
                }
                className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-primary text-white font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-primary-dark transition-transform duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20"
              >
                {heroContent.cta.reserve}
              </Link>
            )}
            {/* 2차 CTA — ko는 플래그십(/release-project), 비-ko는 포트폴리오.
                발매 허브로 갈 때만 micro_click_service를 발화한다(포트폴리오는
                서비스 페이지가 아니라 이벤트 의미를 오염시키지 않기 위해 미발화).
                배색: 이전엔 솔리드 primary였는데, 어두운 히어로 사진 위에서 채도 높은
                보라가 흰 1차 CTA보다 더 튀어 위계가 뒤집혀 있었다(검증된 전환 채널이
                시각적 2등). 1차를 카카오 옐로로 올리고 2차는 어두운 스크림 아웃라인으로
                내린다. 흰 틴트(bg-white/*) 대신 bg-black/30을 쓰는 이유는 HeaderActions와
                동일 — 흰 틴트는 배경을 밝혀 흰 글씨 대비를 오히려 떨어뜨린다. */}
            <Link
              href={getLink(heroContent.cta.secondaryLink)}
              prefetch={false}
              onClick={() => {
                if (heroContent.cta.secondaryLink === '/release-project') {
                  trackMicroEvent('micro_click_service', {
                    locale,
                    component: 'HomeHero',
                    cta_id: 'hero_secondary_release',
                    cta_target: heroContent.cta.secondaryLink,
                  });
                }
              }}
              className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-black/30 border-2 border-white/40 text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.55)] font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-black/40 hover:border-white/60 transition-transform duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20"
            >
              {heroContent.cta.secondary}
            </Link>
          </>
        }
      />

      {/* 발매작 — 히어로 바로 아래. "여기서 음반이 나온다"는 가장 강한 증거를 첫 자리에 둔다. */}
      {releaseCovers.length > 0 && (
        <Section variant="default">
          <SectionHeading
            eyebrow={t('home.v2.eyebrow.releases')}
            index="01"
            title={t('home.v2.releases.title')}
          />
          <HomeReleaseStrip
            locale={locale}
            covers={releaseCovers}
            viewAllLabel={t('home.v2.releases.viewAll')}
          />
        </Section>
      )}

      {/* 스튜디오 갤러리 섹션 */}
      <Section variant="alternate">
        <SectionHeading
          eyebrow={t('home.v2.eyebrow.studio')}
          index="02"
          title={t('home.sections.galleryTitle')}
        />
        <MediaGallery images={studioImages} locale={locale} />
      </Section>

      {/* Locale-specific USP/trust block — ko: 신뢰·전환 보강, 그 외: 외국 뮤지션 안내 */}
      {localeUsps && (
        <Section variant="default">
          <SectionHeading
            eyebrow={t('home.v2.eyebrow.why')}
            index="03"
            title={localeUsps.title}
          />
          {/* v2: 카드 세 장 대신 번호 붙은 3단. 카드 그리드에는 스크롤 모션을 걸지 않는다
              (여러 장이 동시에 레이어로 올라가 iOS 깜빡임을 되살린다 — 디자인 회의). */}
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {localeUsps.items.map((item: { heading: string; body: string }, index: number) => (
              <li key={item.heading} className="border-t-2 border-gray-950 dark:border-white pt-5">
                <span aria-hidden="true" className="block text-sm font-semibold tabular-nums text-primary dark:text-primary-lighter mb-3">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="font-title text-xl font-bold leading-snug text-gray-950 dark:text-white mb-3 break-keep">{item.heading}</h3>
                <p className="typo-card-body text-gray-600 dark:text-gray-300">{item.body}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* 프로듀서 신뢰 스트립 — 그동안 /release-project에만 있던 실적(70+ 발매작·15년 경력)을
          홈으로 승격해 첫 화면 신뢰도 보강. 수치 주장은 반드시 /author로 이어져야 한다:
          방문자가 실적을 검증할 유일한 경로이고, Person entity(utils/schema/person.ts가
          Person.url을 /author로 일원화) 쪽으로 가는 가장 강한 내부링크다. */}
      {producerCredibility && (
        <Section variant="alternate">
          <div className="max-w-4xl mx-auto text-center">
            <ResponsiveImage
              src={producerCredibility.photo.src}
              alt={producerCredibility.photo.alt}
              width={112}
              height={112}
              sizes="112px"
              containerClassName="w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden ring-1 ring-black/10 dark:ring-white/15 shadow-md"
              className="w-full h-full object-cover"
            />
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary dark:text-primary-lighter mb-2">
              <Award size={18} aria-hidden="true" />
              {producerCredibility.eyebrow}
            </div>
            <h2 className="text-heading-3 font-title mb-1">{producerCredibility.name}</h2>
            <p className="typo-card-body text-gray-600 dark:text-gray-300 mb-8 break-keep">
              {producerCredibility.tagline}
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
              {producerCredibility.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="glass-card rounded-xl p-5"
                >
                  <div className="text-3xl font-extrabold text-primary dark:text-primary-lighter tabular-nums">{stat.value}</div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 break-keep">{stat.label}</div>
                </div>
              ))}
            </div>
            <Link
              href={getLink('/author')}
              className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-primary dark:text-primary-lighter hover:underline underline-offset-4"
            >
              {producerCredibility.profileCtaLabel}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </Section>
      )}

      {/* 서비스 소개 섹션 — 트랙리스트 */}
      <Section variant="default">
        <SectionHeading
          eyebrow={t('home.v2.eyebrow.services')}
          index="04"
          title={t('home.sections.servicesTitle')}
        />
        <HomeServiceTracklist
          services={homeServices.map((service) => ({
            title: service.title,
            description: service.description,
            href: getLink(service.link),
          }))}
        />
      </Section>

      {/* 리뷰 섹션 */}
      <ReviewSection
        variant="alternate"
        locale={locale}
        eyebrow={t('home.v2.eyebrow.reviews')}
        index="05"
      />

      {/* FAQ 섹션 */}
      <FAQSection
        items={faqData}
        title={t('home.faq.title')}
        subtitle={t('home.faq.subtitle')}
        variant="default"
        eyebrow={t('home.v2.eyebrow.faq')}
        index="06"
      />

      {/* 서비스 바로가기 — 6~7개 link(ko는 발매 pill 포함)가 메인 viewport에 들어오면 next/link 기본 prefetch가
          각 페이지의 SSG JSON·청크를 동시 다운로드한다. 메인 페이지 LCP/TBT 측정 창에
          체류하는 사용자에게는 가성비 나쁜 비용이라 prefetch={false}로 차단. */}
      <Section variant="default" spacing="tight">
        <div className="flex flex-wrap justify-center gap-4">
          {/* 발매 프로젝트 pill은 ko 전용.

              예전 근거 두 개 중 하나는 사라졌다 — nav.releaseProject가 'Overview'라
              비한국어에서 맥락을 잃는다는 것은 2026-09-11 리네임('Release Project')으로
              해소됐다. 남은 이유로 게이트를 유지한다: 플래그십은 한국 인디 아티스트
              중심이고 비-ko 홈은 저트래픽이라 pill 자리를 쓸 값이 없다. */}
          {locale === 'ko' && (
            <ServiceLinkPill href={getLink('/release-project')} tone="primary">
              {t('nav.releaseProject')}
            </ServiceLinkPill>
          )}
          <ServiceLinkPill href={getLink('/practice-room')} tone="primary">
            {t('nav.practiceRoom')}
          </ServiceLinkPill>
          <ServiceLinkPill href={getLink('/mixing-mastering')} tone="primary">
            {t('nav.mixingMastering')}
          </ServiceLinkPill>
          <ServiceLinkPill href={getLink('/wedding-song')} tone="primary">
            {t('nav.weddingSong')}
          </ServiceLinkPill>
          <ServiceLinkPill href={getLink('/voice-acting')} tone="primary">
            {t('nav.voiceActing')}
          </ServiceLinkPill>
          <ServiceLinkPill href={getLink('/lesson')} tone="primary">
            {t('nav.lesson')}
          </ServiceLinkPill>
          <ServiceLinkPill href={getLink('/pricing')} tone="primary">
            {t('nav.pricing')}
          </ServiceLinkPill>
          <ServiceLinkPill href={getLink('/stories')} tone="primary">
            {t('nav.stories')}
          </ServiceLinkPill>
        </div>
      </Section>

      {/* 하단 CTA 섹션 */}
      <Section variant="alternate" spacing="loose">
        <ContactCTA
          locale={locale}
          title={
            <>
              <span className="block">{t('home.cta.titleLine1')}</span>
              <span className="block text-primary dark:text-primary-lighter">{t('home.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              <span className="block">{t('home.cta.subtitleLine1')}</span>
              <span className="block">{t('home.cta.subtitleLine2')}</span>
            </>
          }
          imageSrc="/images/hardware5.webp"
          imageAlt={heroContent.ctaImageAlt}
          primaryButtonLabel={t('home.cta.inquiry')}
          secondaryButtonLabel={t('home.cta.location')}
          headingAs="h3"
        />
      </Section>
    </div>
  );
};

Home.hasHero = true;
// 디자인 v2 시제품 — lib/designEdition.ts. 10/14까지 preview에서만 검증한다(디자인 회의).
Home.designEdition = 'v2';

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const homeData = getHomeData(locale);
  const faqData = getFaqData(locale);
  // 발매작 커버 — /release-project 디스코그래피와 같은 기준(featured). 최신순 12장.
  const releaseCovers: ReleaseCover[] = getPortfolioItems(locale)
    .filter((item) => item.featured && item.image)
    .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
    .slice(0, 12)
    .map(({ id, title, image, releaseDate }) => ({
      id,
      title,
      image: image as string,
      ...(releaseDate ? { releaseDate } : {}),
    }));

  return buildPageStaticProps(
    locale,
    {
      homeData,
      faqData,
      releaseCovers,
    },
    { revalidate: 3600, i18nSections: ['home'] }
  );
};

export default Home;
