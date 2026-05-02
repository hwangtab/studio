import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { getSiteConfig } from '../../data/siteConfig';
import { type Locale } from '../../lib/i18n';
import { Phone, Mail, MapPin } from 'lucide-react';
import { trackLeadEvent } from '../../utils/analytics';

interface FooterProps {
  locale: Locale;
}

const LINK_CLASS = "text-[14px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] hover:text-ink dark:hover:text-on-dark transition-colors duration-300 link-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-warm dark:focus-visible:ring-offset-surface-dark-elevated";

// 푸터 링크는 보조 네비게이션이므로 prefetch 비활성화 — 초기 로드 시 다수
// 페이지 청크 prefetch를 막아 미사용 JS를 줄인다. (Next.js는 기본적으로 뷰포트 내
// 모든 Link를 prefetch함)
const FooterLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <li className="min-h-[44px] flex items-center">
    <Link href={href} prefetch={false} className={LINK_CLASS}>{children}</Link>
  </li>
);

export const Footer = ({ locale }: FooterProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-canvas-warm dark:bg-surface-dark-elevated text-ink dark:text-on-dark p-8 font-display">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          <div className="flex flex-col">
            <h3 className="font-display font-light text-display-md text-ink dark:text-on-dark mb-4">
              {siteConfig.name}
            </h3>
            <div className="h-px w-full bg-ink/10 dark:bg-white/10 mb-4" />
            <p className="text-[14px] leading-[1.6] text-ink-muted-60 dark:text-on-dark-soft mb-4 leading-relaxed">
              {t('footer.tagline')}
            </p>
            <p className="text-caption text-ink-muted-40 dark:text-on-dark-soft">
              {currentYear} {siteConfig.name}. {t('footer.rights')}
            </p>
            <Link
              href={`/${locale}/privacy-policy`}
              className="mt-2 inline-block text-xs text-ink-muted-40 hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors duration-300 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-warm dark:focus-visible:ring-offset-surface-dark-elevated"
            >
              {t('footer.privacy')}
            </Link>
          </div>

          <div className="flex flex-col">
            <h3 className="font-display font-light text-display-md text-ink dark:text-on-dark mb-4">{t('footer.linksTitle')}</h3>
            <div className="h-px w-full bg-ink/10 dark:bg-white/10 mb-4" />
            <ul className="grid grid-cols-2 gap-x-4">
              <FooterLink href={`/${locale}`}>{t('nav.home')}</FooterLink>
              <FooterLink href={`/${locale}/about`}>{t('nav.about')}</FooterLink>
              <FooterLink href={`/${locale}/portfolio`}>{t('nav.portfolio')}</FooterLink>
              <FooterLink href={`/${locale}/stories`}>{t('nav.stories')}</FooterLink>
              <FooterLink href={`/${locale}/pricing`}>{t('nav.pricing')}</FooterLink>
              <FooterLink href={`/${locale}/lesson`}>{t('nav.lesson')}</FooterLink>
              <FooterLink href={`/${locale}/practice-room`}>{t('nav.practiceRoom')}</FooterLink>
              <FooterLink href={`/${locale}/studio-info`}>{t('nav.equipment')}</FooterLink>
              <FooterLink href={`/${locale}/wedding-song`}>{t('nav.weddingSong')}</FooterLink>
              <FooterLink href={`/${locale}/voice-acting`}>{t('nav.voiceActing')}</FooterLink>
              <FooterLink href={`/${locale}/contact`}>{t('nav.contact')}</FooterLink>
            </ul>
          </div>

          <address className="flex flex-col not-italic">
            <h3 className="font-display font-light text-display-md text-ink dark:text-on-dark mb-4">{t('footer.contactTitle')}</h3>
            <div className="h-px w-full bg-ink/10 dark:bg-white/10 mb-4" />
            <a
              href={siteConfig.contact.naverMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] leading-[1.6] text-ink-muted-60 hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors duration-300 flex items-start mb-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-warm dark:focus-visible:ring-offset-surface-dark-elevated"
            >
              <MapPin className="mr-2 mt-0.5" size={16} aria-hidden="true" />
              <span className="leading-relaxed">{siteConfig.contact.address}</span>
            </a>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="text-[14px] leading-[1.6] text-ink-muted-60 hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors duration-300 flex items-start mb-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-warm dark:focus-visible:ring-offset-surface-dark-elevated"
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
              className="text-[14px] leading-[1.6] text-ink-muted-60 hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors duration-300 flex items-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-warm dark:focus-visible:ring-offset-surface-dark-elevated"
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
