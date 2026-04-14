import type { NextApiRequest, NextApiResponse } from 'next';
import { locales, defaultLocale, type Locale } from '../../lib/i18n-config';
import { getSiteConfig } from '../../data/siteConfig';

const shortcutLabels: Record<Locale, { contact: string; contactShort: string; contactDesc: string; pricing: string; pricingShort: string; pricingDesc: string }> = {
  ko: { contact: '문의하기', contactShort: '문의', contactDesc: '스튜디오 예약 및 문의', pricing: '가격 안내', pricingShort: '가격', pricingDesc: '레코딩·연습실 가격 확인' },
  en: { contact: 'Contact', contactShort: 'Contact', contactDesc: 'Studio booking & inquiries', pricing: 'Pricing', pricingShort: 'Pricing', pricingDesc: 'Recording & practice room pricing' },
  zh: { contact: '联系我们', contactShort: '联系', contactDesc: '工作室预约与咨询', pricing: '价格', pricingShort: '价格', pricingDesc: '录音·练习室价格查询' },
  es: { contact: 'Contacto', contactShort: 'Contacto', contactDesc: 'Reservas y consultas del estudio', pricing: 'Precios', pricingShort: 'Precios', pricingDesc: 'Precios de grabación y sala de práctica' },
  vi: { contact: 'Liên hệ', contactShort: 'Liên hệ', contactDesc: 'Đặt phòng & liên hệ studio', pricing: 'Bảng giá', pricingShort: 'Giá', pricingDesc: 'Giá phòng thu & phòng tập' },
  th: { contact: 'ติดต่อ', contactShort: 'ติดต่อ', contactDesc: 'จองและสอบถามสตูดิโอ', pricing: 'ราคา', pricingShort: 'ราคา', pricingDesc: 'ราคาห้องบันทึกเสียงและห้องซ้อม' },
  uz: { contact: 'Aloqa', contactShort: 'Aloqa', contactDesc: 'Studiya band qilish va so\'rovlar', pricing: 'Narxlar', pricingShort: 'Narxlar', pricingDesc: 'Yozuv va mashg\'ulot xonasi narxlari' },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawLocale = (req.query.locale as string) || defaultLocale;
  const locale: Locale = locales.includes(rawLocale as Locale) ? (rawLocale as Locale) : defaultLocale;
  const config = getSiteConfig(locale);
  const labels = shortcutLabels[locale];

  const manifest = {
    name: config.name,
    short_name: config.name,
    description: config.description,
    id: `/${locale}/`,
    start_url: `/${locale}/`,
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'browser'],
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#6d28d9',
    lang: locale,
    dir: 'ltr',
    categories: ['music', 'entertainment', 'business'],
    prefer_related_applications: false,
    screenshots: [
      { src: '/images/studio2.webp', sizes: '1280x720', form_factor: 'wide', type: 'image/webp', label: 'Studio NOL Main Console' },
      { src: '/images/hardware1.webp', sizes: '1280x720', form_factor: 'wide', type: 'image/webp', label: 'Studio NOL Hardware' },
      { src: '/images/studio1.webp', sizes: '1280x720', form_factor: 'narrow', type: 'image/webp', label: 'Studio NOL Overview' },
    ],
    shortcuts: [
      {
        name: labels.contact,
        short_name: labels.contactShort,
        description: labels.contactDesc,
        url: `/${locale}/contact`,
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: labels.pricing,
        short_name: labels.pricingShort,
        description: labels.pricingDesc,
        url: `/${locale}/pricing`,
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.status(200).json(manifest);
}
