import type { NextPage, GetStaticPaths, GetStaticProps } from 'next';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, User, Send, CheckCircle, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PAGE_TITLE_ANIMATION } from '../../utils/animationUtils';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import { Section } from '../../components/ui/Section';
import { getCommonStaticPaths, getCommonStaticProps } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';

interface ContactProps {
  locale: Locale;
}

const InputField = ({ icon: Icon, label, id, ...props }: any) => (
  <div className="relative mb-4">
    <label htmlFor={id} className="sr-only">{label}</label>
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
    </div>
    <input id={id} className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent" {...props} />
  </div>
);

const Contact: NextPage<ContactProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    message: '',
    company: '',
  });
  const [submitMessage, setSubmitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const siteConfig = getSiteConfig(locale);

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    const { name, phone, email, message, company } = formData;

    // Honeypot check
    if (company.trim().length > 0) {
      setIsSubmitting(false);
      return;
    }

    try {
      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

      if (!serviceId || !templateId || !publicKey) {
        setSubmitMessage(t('contact.form.error'));
        return;
      }

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            name,
            phone,
            email,
            message,
          },
        }),
      });

      if (response.ok) {
        setSubmitMessage(t('contact.form.success'));
        setFormData({ name: '', phone: '', email: '', message: '', company: '' });
      } else {
        setSubmitMessage(t('contact.form.error'));
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setSubmitMessage(t('contact.form.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title={t('contact.title')}
        description={t('contact.subtitle')}
        keywords={t('contact.seo.keywords')}
        canonical={`https://studionol.co.kr/${locale}/contact`}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.contact'), path: `/${locale}/contact` },
        ]}
      />
      <ImageHero
        {...{
          locale,
          title: t('contact.title'),
          subtitle: t('contact.subtitle'),
          backgroundImage: "/images/hardware5.jpg",
          imageAlt: t('contact.heroAlt'),
          minHeight: "min-h-[60vh]",
          overlayGradient: "from-black/50 via-black/30 to-black/50",
        }}
      />

      <Section variant="default" className="relative -mt-20 z-10 pt-0">
        <div className="grid lg:grid-cols-2 gap-8 container mx-auto px-4 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="card p-8 shadow-xl"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h2 className="typo-card-title mb-4">{t('contact.info.title')}</h2>
              <div className="space-y-4">
                <a href={siteConfig.contact.naverMapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                  <MapPin className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                  <span className="leading-relaxed">{siteConfig.contact.address}</span>
                </a>
                <a href={`tel:${siteConfig.contact.phone}`} className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                  <Phone className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                  <span className="leading-relaxed">{siteConfig.contact.phone}</span>
                </a>
                <a href={`mailto:${siteConfig.contact.email}`} className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                  <Mail className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                  <span className="leading-relaxed">{siteConfig.contact.email}</span>
                </a>
                <a href={siteConfig.contact.kakaoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                  <MessageCircle className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                  <span className="leading-relaxed">{t('actions.kakao')}</span>
                </a>
              </div>
              <div className="mt-6">
                <h3 className="typo-card-title mb-4">{t('contact.info.location')}</h3>
                <div className="mb-6">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3160.8635287891844!2d126.92362527640926!3d37.61435329999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357c977d6c9b9b61%3A0x4ba77c752231fd06!2z7Iqk7Yqc65SU7Jik64W4!5e0!3m2!1sko!2skr!4v1704364800000!5m2!1sko!2skr"
                    width="100%"
                    height="250"
                    style={{ border: 0, borderRadius: '0.5rem' }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={t('contact.info.location')}
                  ></iframe>
                </div>
              </div>
              <div className="mt-8">
                <h3 className="typo-card-title mb-4">{t('contact.info.hours')}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="dark:text-gray-300 typo-card-body">{t('contact.hours.weekdaysLabel')}</span>
                    <span className="dark:text-gray-300">{t('contact.hours.weekdaysTime')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="dark:text-gray-300 typo-card-body">{t('contact.hours.satLabel')}</span>
                    <span className="dark:text-gray-300">{t('contact.hours.satTime')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="dark:text-gray-300 typo-card-body">{t('contact.hours.sunLabel')}</span>
                    <span className="text-red-500 dark:text-red-400">{t('contact.hours.closed')}</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <p className="typo-card-body text-blue-800 dark:text-blue-300">
                    <span className="typo-card-body text-blue-900 dark:text-blue-200">{t('contact.info.parking')}:</span> {t('contact.info.parkingDetail')}
                  </p>
                  <p className="typo-card-body text-blue-800 dark:text-blue-300 mt-1">
                    <span className="typo-card-body text-blue-900 dark:text-blue-200">{t('contact.info.transport')}:</span> {t('contact.info.transportDetail')}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl"
          >
            <motion.div
              initial={{ opacity: 0, x: 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h2 className="typo-card-title mb-4">{t('contact.title')}</h2>
              {submitMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`mb-4 p-4 rounded-md flex items-center ${submitMessage === t('contact.form.success') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}
                >
                  {submitMessage === t('contact.form.success') && <CheckCircle className="mr-2" size={18} />}
                  {submitMessage}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Honeypot field */}
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="hidden"
                  autoComplete="off"
                />

                <InputField
                  icon={User}
                  id="name"
                  label={t('contact.form.name')}
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={t('contact.form.name')}
                  required
                  autoComplete="name"
                />

                <InputField
                  icon={Phone}
                  id="phone"
                  label={t('contact.form.phone')}
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={t('contact.form.phone')}
                  required
                  autoComplete="tel"
                />

                <InputField
                  icon={Mail}
                  id="email"
                  label={t('contact.form.email')}
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder={t('contact.form.email')}
                  required
                  autoComplete="email"
                />

                <div className="relative mb-6">
                  <label htmlFor="message" className="sr-only">{t('contact.form.message')}</label>
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <Send className="w-5 h-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                  </div>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={t('contact.form.message')}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent"
                    rows={8}
                    required
                  ></textarea>
                </div>

                <div className="flex flex-col gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-body-1 font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200 font-title disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('contact.form.loading')}
                      </>
                    ) : (
                      <>
                        <Send className="mr-2" size={18} />
                        {t('contact.form.submit')}
                      </>
                    )}
                  </motion.button>

                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    href={siteConfig.contact.kakaoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-body-1 text-gray-900 dark:text-gray-900 bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors duration-200 font-title"
                  >
                    <MessageCircle className="mr-2" size={18} />
                    {t('contact.form.kakao')}
                  </motion.a>
                </div>
              </form>
            </motion.div>

            <div className="mt-6 space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <h4 className="typo-card-subtitle text-blue-800 dark:text-blue-300 mb-2">{t('contact.notice.title')}</h4>
                <ul className="typo-card-body text-blue-700 dark:text-blue-400 space-y-1">
                  {(t('contact.notice.list', { returnObjects: true }) as string[])?.map && (t('contact.notice.list', { returnObjects: true }) as string[]).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                  {!(t('contact.notice.list', { returnObjects: true }) as string[])?.map && (
                    <li>Check our notices</li>
                  )}
                </ul>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="typo-card-subtitle text-gray-800 dark:text-gray-300 mb-2">{t('contact.notice.privacyTitle')}</h4>
                <p className="typo-card-body text-gray-600 dark:text-gray-400">
                  {t('contact.notice.privacyText')}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </Section>
    </>
  );
};

(Contact as any).hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = getCommonStaticProps;

export default Contact;
