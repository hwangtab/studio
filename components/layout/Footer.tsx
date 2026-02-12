import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { getSiteConfig } from '../../data/siteConfig';
import { type Locale } from '../../lib/i18n';
import { Phone, Mail, MapPin } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

interface FooterProps {
  locale: Locale;
}

export const Footer = ({ locale }: FooterProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);

  return (
    <footer className="bg-gradient-to-r from-primary via-secondary to-accent text-white p-8 font-title">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          <div className="flex flex-col">
            <h3 className="typo-footer-heading mb-4">
              {siteConfig.name}
            </h3>
            <div className="h-px w-full bg-white/25 mb-4" />
            <p className="typo-footer-body text-gray-200/90 mb-4 leading-relaxed">
              {t('footer.tagline')}
            </p>
            <p className="typo-footer-meta">
              {CURRENT_YEAR} {siteConfig.name}. {t('footer.rights')}
            </p>
            <Link
              href={`/${locale}/privacy-policy`}
              className="mt-2 inline-block text-xs text-gray-200/70 hover:text-white transition-colors duration-300"
            >
              {t('footer.privacy')}
            </Link>
          </div>

          <div className="flex flex-col">
            <h3 className="typo-footer-heading mb-4">{t('footer.linksTitle')}</h3>
            <div className="h-px w-full bg-white/25 mb-4" />
            <ul className="space-y-2">
              <li><Link href={`/${locale}`} className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">{t('nav.home')}</Link></li>
              <li><Link href={`/${locale}/about`} className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">{t('nav.about')}</Link></li>
              <li><Link href={`/${locale}/contact`} className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">{t('nav.contact')}</Link></li>
            </ul>
          </div>

          <div className="flex flex-col">
            <h3 className="typo-footer-heading mb-4">{t('footer.contactTitle')}</h3>
            <div className="h-px w-full bg-white/25 mb-4" />
            <a
              href={siteConfig.contact.naverMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-start mb-2"
            >
              <MapPin className="mr-2 mt-0.5" size={16} aria-hidden="true" />
              <span className="leading-relaxed">{siteConfig.contact.address}</span>
            </a>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-start mb-2"
            >
              <Mail className="mr-2 mt-0.5" size={16} aria-hidden="true" />
              <span className="leading-relaxed">{t('footer.emailLabel')}: {siteConfig.contact.email}</span>
            </a>
            <a
              href={`tel:${siteConfig.contact.phone}`}
              className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-start"
            >
              <Phone className="mr-2 mt-0.5" size={16} aria-hidden="true" />
              <span className="leading-relaxed">{t('footer.phoneLabel')}: {siteConfig.contact.phone}</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
