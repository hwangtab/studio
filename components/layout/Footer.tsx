import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { getSiteConfig } from '../../data/siteConfig';
import { type Locale } from '../../lib/i18n';
import { Phone, Mail, MapPin } from '@/lib/lucide-icons';
import { trackLeadEvent } from '../../utils/analytics';

interface FooterProps {
  locale: Locale;
}

const LINK_CLASS = "typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 link-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary";

// 푸터 링크는 보조 네비게이션이므로 prefetch 비활성화 — 초기 로드 시 다수
// 페이지 청크 prefetch를 막아 미사용 JS를 줄인다. (Next.js는 기본적으로 뷰포트 내
// 모든 Link를 prefetch함)
const FooterLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <li className="min-h-[44px] flex items-center">
    <Link href={href} prefetch={false} className={LINK_CLASS}>{children}</Link>
  </li>
);

// 푸터 열 제목. 예전 푸터는 라벨 없는 2열 목록에 14개 링크를 늘어놓아 스캔이 안 됐고,
// 헤더에서 원하는 걸 못 찾은 사람을 받아주는 두 번째 그물 역할을 못 했다(2026-08-24 IA 감사).
const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <>
    <h3 className="typo-footer-heading mb-4">{children}</h3>
    <div className="h-px w-full bg-white/25 mb-4" />
  </>
);

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="typo-footer-meta uppercase tracking-wider text-white/60 mt-6 mb-2">{children}</h4>
);

export const Footer = ({ locale }: FooterProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-r from-primary via-secondary to-accent text-white p-8 font-title">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 items-start">
          <div className="flex flex-col">
            <h3 className="typo-footer-heading mb-4">
              {siteConfig.name}
            </h3>
            <div className="h-px w-full bg-white/25 mb-4" />
            <p className="typo-footer-body text-gray-200/90 mb-4 leading-relaxed">
              {t('footer.tagline')}
            </p>
            {/* ISR 캐시가 연말/연초 경계를 걸치면 SSR(캐시된 연도)과 CSR(현재 연도)이
                어긋날 수 있다. 연 1회 코스메틱 불일치이므로 전 페이지 getStaticProps 계약
                변경 대신 이 텍스트 노드에 한해 hydration 경고를 억제한다(직접 부모 요소에 적용). */}
            <p className="typo-footer-meta" suppressHydrationWarning>
              {currentYear} {siteConfig.name}. {t('footer.rights')}
            </p>
            <Link
              href={`/${locale}/privacy-policy`}
              className="mt-2 inline-block text-xs text-gray-200/70 hover:text-white transition-colors duration-300 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              {t('footer.privacy')}
            </Link>
          </div>

          <div className="flex flex-col">
            <SectionHeading>{t('footer.sections.services')}</SectionHeading>
            <ul className="flex flex-col">
              <FooterLink href={`/${locale}/practice-room`}>{t('nav.practiceRoom')}</FooterLink>
              <FooterLink href={`/${locale}/recording`}>{t('nav.recording')}</FooterLink>
              <FooterLink href={`/${locale}/mixing-mastering`}>{t('nav.mixingMastering')}</FooterLink>
              <FooterLink href={`/${locale}/voice-acting`}>{t('nav.voiceActing')}</FooterLink>
              <FooterLink href={`/${locale}/wedding-song`}>{t('nav.weddingSong')}</FooterLink>
              <FooterLink href={`/${locale}/cover-video`}>{t('nav.coverVideo')}</FooterLink>
              <FooterLink href={`/${locale}/lesson`}>{t('nav.lesson')}</FooterLink>
            </ul>
            {/* 발매 프로젝트 — nav.releaseProject 등은 하위메뉴 맥락 라벨('Overview')이라
                비-ko 푸터에선 맥락을 잃는다. 홈 pill과 동일하게 ko 전용 노출. */}
            {locale === 'ko' && (
              <>
                <SubHeading>{t('footer.sections.release')}</SubHeading>
                <ul className="flex flex-col">
                  <FooterLink href={`/${locale}/release-project`}>{t('nav.releaseProject')}</FooterLink>
                  <FooterLink href={`/${locale}/release-project/single`}>{t('nav.releaseSingle')}</FooterLink>
                  <FooterLink href={`/${locale}/release-project/ep`}>{t('nav.releaseEp')}</FooterLink>
                  <FooterLink href={`/${locale}/release-project/album`}>{t('nav.releaseAlbum')}</FooterLink>
                </ul>
              </>
            )}
          </div>

          <div className="flex flex-col">
            <SectionHeading>{t('footer.sections.studio')}</SectionHeading>
            <ul className="flex flex-col">
              <FooterLink href={`/${locale}`}>{t('nav.home')}</FooterLink>
              <FooterLink href={`/${locale}/about`}>{t('nav.about')}</FooterLink>
              <FooterLink href={`/${locale}/studio-info`}>{t('nav.equipment')}</FooterLink>
              <FooterLink href={`/${locale}/pricing`}>{t('nav.pricing')}</FooterLink>
              <FooterLink href={`/${locale}/contact`}>{t('nav.contact')}</FooterLink>
            </ul>
            <SubHeading>{t('footer.sections.content')}</SubHeading>
            <ul className="flex flex-col">
              <FooterLink href={`/${locale}/stories`}>{t('nav.stories')}</FooterLink>
              <FooterLink href={`/${locale}/portfolio`}>{t('nav.portfolio')}</FooterLink>
            </ul>
          </div>

          <address className="flex flex-col not-italic">
            <SectionHeading>{t('footer.contactTitle')}</SectionHeading>
            <a
              href={siteConfig.contact.naverMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackLeadEvent('lead_click_naver_map', {
                  locale,
                  component: 'Footer',
                  cta_id: 'footer_naver_map',
                })
              }
              className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-start mb-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              <MapPin className="mr-2 mt-0.5" size={16} aria-hidden="true" />
              <span className="leading-relaxed">{siteConfig.contact.address}</span>
            </a>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              onClick={() =>
                trackLeadEvent('lead_click_email', {
                  locale,
                  component: 'Footer',
                  cta_id: 'footer_email',
                })
              }
              className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-start mb-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              <Mail className="mr-2 mt-0.5" size={16} aria-hidden="true" />
              <span className="leading-relaxed">{t('footer.emailLabel')}: {siteConfig.contact.email}</span>
            </a>
            <a
              href={`tel:${siteConfig.contact.phone}`}
              onClick={() =>
                trackLeadEvent('lead_click_phone', {
                  locale,
                  component: 'Footer',
                  cta_id: 'footer_phone',
                })
              }
              className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              <Phone className="mr-2 mt-0.5" size={16} aria-hidden="true" />
              <span className="leading-relaxed">{t('footer.phoneLabel')}: {siteConfig.contact.phone}</span>
            </a>
          </address>
        </div>
      </div>
    </footer>
  );
};
