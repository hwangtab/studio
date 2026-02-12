import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { Section } from '../../components/ui/Section';
import { getSiteConfig } from '../../data/siteConfig';
import { getCommonStaticPaths, getI18nStaticProps } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';

interface PrivacyPolicyProps {
  locale: Locale;
}

type PolicySection = {
  heading: string;
  body: string;
};

type PolicyCopy = {
  title: string;
  subtitle: string;
  lastUpdatedLabel: string;
  lastUpdatedValue: string;
  sections: PolicySection[];
};

const POLICY_COPY_BY_LOCALE: Record<Locale, PolicyCopy> = {
  ko: {
    title: '개인정보 처리방침',
    subtitle: '스튜디오 놀은 문의 접수 및 상담 응대에 필요한 최소한의 개인정보만 수집하고 안전하게 관리합니다.',
    lastUpdatedLabel: '시행일',
    lastUpdatedValue: '2026년 2월 12일',
    sections: [
      {
        heading: '1. 수집하는 개인정보 항목',
        body: '문의 양식을 통해 이름, 연락처, 이메일, 문의 내용을 수집할 수 있습니다.',
      },
      {
        heading: '2. 개인정보 이용 목적',
        body: '수집한 정보는 문의 답변, 예약 안내, 서비스 상담 및 고객 요청 처리 목적으로만 사용합니다.',
      },
      {
        heading: '3. 보유 및 이용 기간',
        body: '개인정보는 상담 완료 후 지체 없이 파기하며, 관련 법령에 보관 의무가 있는 경우에만 해당 기간 동안 보관합니다.',
      },
      {
        heading: '4. 제3자 제공 및 처리위탁',
        body: '원칙적으로 개인정보를 외부에 제공하지 않으며, 서비스 운영에 필요한 최소 범위에서만 관련 법령을 준수하여 처리합니다.',
      },
      {
        heading: '5. 이용자의 권리',
        body: '정보주체는 언제든지 개인정보 열람, 정정, 삭제를 요청할 수 있으며, 요청 시 지체 없이 조치합니다.',
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    subtitle: 'Studio NOL collects only the minimum personal data required for inquiries and consultation support.',
    lastUpdatedLabel: 'Effective date',
    lastUpdatedValue: 'February 12, 2026',
    sections: [
      {
        heading: '1. Personal data we collect',
        body: 'Through the inquiry form, we may collect your name, phone number, email address, and message content.',
      },
      {
        heading: '2. Purpose of use',
        body: 'Collected data is used only to answer inquiries, support bookings, provide consultation, and process customer requests.',
      },
      {
        heading: '3. Retention period',
        body: 'Personal data is deleted without delay after consultation is completed, except where retention is required by applicable law.',
      },
      {
        heading: '4. Third-party sharing and outsourcing',
        body: 'We do not provide personal data to third parties in principle, and process only the minimum scope required to operate services lawfully.',
      },
      {
        heading: '5. Your rights',
        body: 'You may request access, correction, or deletion of your personal data at any time, and we will respond without undue delay.',
      },
    ],
  },
  zh: {
    title: 'Privacy Policy',
    subtitle: 'Studio NOL collects only the minimum personal data required for inquiries and consultation support.',
    lastUpdatedLabel: 'Effective date',
    lastUpdatedValue: 'February 12, 2026',
    sections: [
      {
        heading: '1. Personal data we collect',
        body: 'Through the inquiry form, we may collect your name, phone number, email address, and message content.',
      },
      {
        heading: '2. Purpose of use',
        body: 'Collected data is used only to answer inquiries, support bookings, provide consultation, and process customer requests.',
      },
      {
        heading: '3. Retention period',
        body: 'Personal data is deleted without delay after consultation is completed, except where retention is required by applicable law.',
      },
      {
        heading: '4. Third-party sharing and outsourcing',
        body: 'We do not provide personal data to third parties in principle, and process only the minimum scope required to operate services lawfully.',
      },
      {
        heading: '5. Your rights',
        body: 'You may request access, correction, or deletion of your personal data at any time, and we will respond without undue delay.',
      },
    ],
  },
  es: {
    title: 'Privacy Policy',
    subtitle: 'Studio NOL collects only the minimum personal data required for inquiries and consultation support.',
    lastUpdatedLabel: 'Effective date',
    lastUpdatedValue: 'February 12, 2026',
    sections: [
      {
        heading: '1. Personal data we collect',
        body: 'Through the inquiry form, we may collect your name, phone number, email address, and message content.',
      },
      {
        heading: '2. Purpose of use',
        body: 'Collected data is used only to answer inquiries, support bookings, provide consultation, and process customer requests.',
      },
      {
        heading: '3. Retention period',
        body: 'Personal data is deleted without delay after consultation is completed, except where retention is required by applicable law.',
      },
      {
        heading: '4. Third-party sharing and outsourcing',
        body: 'We do not provide personal data to third parties in principle, and process only the minimum scope required to operate services lawfully.',
      },
      {
        heading: '5. Your rights',
        body: 'You may request access, correction, or deletion of your personal data at any time, and we will respond without undue delay.',
      },
    ],
  },
  vi: {
    title: 'Privacy Policy',
    subtitle: 'Studio NOL collects only the minimum personal data required for inquiries and consultation support.',
    lastUpdatedLabel: 'Effective date',
    lastUpdatedValue: 'February 12, 2026',
    sections: [
      {
        heading: '1. Personal data we collect',
        body: 'Through the inquiry form, we may collect your name, phone number, email address, and message content.',
      },
      {
        heading: '2. Purpose of use',
        body: 'Collected data is used only to answer inquiries, support bookings, provide consultation, and process customer requests.',
      },
      {
        heading: '3. Retention period',
        body: 'Personal data is deleted without delay after consultation is completed, except where retention is required by applicable law.',
      },
      {
        heading: '4. Third-party sharing and outsourcing',
        body: 'We do not provide personal data to third parties in principle, and process only the minimum scope required to operate services lawfully.',
      },
      {
        heading: '5. Your rights',
        body: 'You may request access, correction, or deletion of your personal data at any time, and we will respond without undue delay.',
      },
    ],
  },
  th: {
    title: 'Privacy Policy',
    subtitle: 'Studio NOL collects only the minimum personal data required for inquiries and consultation support.',
    lastUpdatedLabel: 'Effective date',
    lastUpdatedValue: 'February 12, 2026',
    sections: [
      {
        heading: '1. Personal data we collect',
        body: 'Through the inquiry form, we may collect your name, phone number, email address, and message content.',
      },
      {
        heading: '2. Purpose of use',
        body: 'Collected data is used only to answer inquiries, support bookings, provide consultation, and process customer requests.',
      },
      {
        heading: '3. Retention period',
        body: 'Personal data is deleted without delay after consultation is completed, except where retention is required by applicable law.',
      },
      {
        heading: '4. Third-party sharing and outsourcing',
        body: 'We do not provide personal data to third parties in principle, and process only the minimum scope required to operate services lawfully.',
      },
      {
        heading: '5. Your rights',
        body: 'You may request access, correction, or deletion of your personal data at any time, and we will respond without undue delay.',
      },
    ],
  },
  uz: {
    title: 'Privacy Policy',
    subtitle: 'Studio NOL collects only the minimum personal data required for inquiries and consultation support.',
    lastUpdatedLabel: 'Effective date',
    lastUpdatedValue: 'February 12, 2026',
    sections: [
      {
        heading: '1. Personal data we collect',
        body: 'Through the inquiry form, we may collect your name, phone number, email address, and message content.',
      },
      {
        heading: '2. Purpose of use',
        body: 'Collected data is used only to answer inquiries, support bookings, provide consultation, and process customer requests.',
      },
      {
        heading: '3. Retention period',
        body: 'Personal data is deleted without delay after consultation is completed, except where retention is required by applicable law.',
      },
      {
        heading: '4. Third-party sharing and outsourcing',
        body: 'We do not provide personal data to third parties in principle, and process only the minimum scope required to operate services lawfully.',
      },
      {
        heading: '5. Your rights',
        body: 'You may request access, correction, or deletion of your personal data at any time, and we will respond without undue delay.',
      },
    ],
  },
};

const PrivacyPolicyPage: NextPage<PrivacyPolicyProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const policyCopy = POLICY_COPY_BY_LOCALE[locale] || POLICY_COPY_BY_LOCALE.ko;

  return (
    <>
      <SEO
        title={`${policyCopy.title} | ${siteConfig.name}`}
        description={policyCopy.subtitle}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('footer.privacy'), path: `/${locale}/privacy-policy` },
        ]}
        includeSchema
      />

      <Section variant="default" className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="typo-section-heading mb-4 text-gray-900 dark:text-white">{policyCopy.title}</h1>
          <p className="typo-card-body text-gray-700 dark:text-gray-300 mb-2">{policyCopy.subtitle}</p>
          <p className="typo-card-meta text-gray-500 dark:text-gray-400 mb-8">
            {policyCopy.lastUpdatedLabel}: {policyCopy.lastUpdatedValue}
          </p>

          <div className="space-y-6">
            {policyCopy.sections.map((section) => (
              <article key={section.heading} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">{section.heading}</h2>
                <p className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed">{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = params?.locale || 'ko';

  return {
    props: {
      ...getI18nStaticProps(locale),
    },
    revalidate: 86400,
  };
};

export default PrivacyPolicyPage;
