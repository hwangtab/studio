import type { GetServerSideProps, NextPage } from 'next';
import { useTranslation } from 'react-i18next';
import SEO from '../../../components/SEO';
import { Section } from '../../../components/ui/Section';
import { getSiteConfig, hostingProvider, studioOperator } from '../../../data/siteConfig';
import { getI18nStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import { FUNDING_CREATOR_TERMS_VERSION } from '../../../lib/funding/policy';
import type { Locale } from '../../../lib/i18n';

// 펀딩 프로젝트를 직접 개설하는 아티스트(개설자)가 동의하는 약관 — 후원자가 보는
// /ko/funding/terms(통신판매 계약 조건)와는 당사자·목적이 다르다. 펀딩 페이지 전부
// ko 전용이라 비-ko 경로는 getServerSideProps에서 /ko/funding/creator-terms로
// 리다이렉트한다. 트랜잭셔널 페이지 정책(noindex + no-store)은 global-constraints 참조.

interface CreatorTermsPageProps {
  locale: Locale;
}

interface CreatorTermsSection {
  heading: string;
  body: string[];
}

export const FUNDING_CREATOR_TERMS_SECTIONS: CreatorTermsSection[] = [
  {
    heading: '제1조 (목적과 당사자)',
    body: [
      '이 약관은 스튜디오 놀(이하 "스튜디오")이 운영하는 펀딩 페이지에 개설자가 직접 프로젝트를 등록하고, 서포터의 리워드 선주문을 받는 절차와 개설자의 의무를 정합니다.',
      '판매자·통신판매업자는 스튜디오 놀입니다. 개설자는 서포터에게 제공하기로 한 리워드의 제작과 이행에 대한 책임을 집니다.',
    ],
  },
  {
    heading: '제2조 (심사)',
    body: [
      '개설자가 등록한 프로젝트는 공개되기 전에 스튜디오의 심사를 거칩니다. 스튜디오는 프로젝트를 승인하거나, 보완을 요청하거나, 반려할 수 있습니다.',
      '심사 기준은 스튜디오가 정하며, 승인·보완 요청·반려의 사유는 개설자에게 알립니다.',
    ],
  },
  {
    heading: '제3조 (승인 뒤 바뀌지 않는 것)',
    body: [
      '심사에서 승인된 프로젝트는 개설자가 더 이상 고칠 수 없습니다. 그중에서도 리워드의 주소(식별자)·금액·수량 제한 여부·배송 필요 여부, 그리고 모금 기간과 프로젝트 주소는 승인 뒤에는 어떤 경로로도 바뀌지 않습니다.',
      '가격을 바꾸거나 구성을 달리한 리워드가 필요하면 기존 리워드는 그대로 두고 새 리워드를 추가합니다.',
    ],
  },
  {
    heading: '제4조 (콘텐츠 권리 보증)',
    body: [
      '개설자는 프로젝트 등록에 사용하는 사진·음원·영상 등 콘텐츠에 대한 저작권 등 권리를 적법하게 확보했음을 보증하며, 콘텐츠에 등장하는 제3자의 초상·성명에 대해서도 필요한 동의를 받았음을 보증합니다.',
      '이 보증을 위반하여 제3자와 분쟁이 생기거나 스튜디오에 손해가 발생한 경우 그 책임은 개설자에게 있으며, 개설자는 스튜디오를 면책합니다.',
    ],
  },
  {
    heading: '제5조 (금지 콘텐츠)',
    body: [
      '개설자는 다음에 해당하는 콘텐츠를 프로젝트에 등록할 수 없습니다: 타인의 저작권·상표권 등 지식재산권을 침해하는 콘텐츠, 명예훼손·모욕에 해당하는 콘텐츠, 음란물 등 청소년에게 유해한 콘텐츠, 법령이 금지하는 물품·서비스를 리워드로 하는 콘텐츠, 그 밖에 관계 법령을 위반하는 콘텐츠.',
      '스튜디오는 금지 콘텐츠가 확인되면 심사에서 반려하거나 공개 뒤에도 프로젝트를 비공개로 전환할 수 있습니다.',
    ],
  },
  {
    heading: '제6조 (수수료와 정산)',
    body: [
      '개설자에게 지급하는 정산 금액과 수수료율, 정산 시기는 스튜디오와 개설자가 별도로 체결하는 정산 계약으로 정합니다.',
    ],
  },
  {
    heading: '제7조 (리워드 미이행에 대한 책임)',
    body: [
      '개설자가 승인된 리워드를 이행하지 못하는 경우, 서포터에게 지급해야 하는 환불의 부담은 개설자에게 있습니다.',
    ],
  },
  {
    heading: '제8조 (서포터 개인정보의 취급)',
    body: [
      '스튜디오가 리워드 발송 등을 위해 서포터의 개인정보를 개설자에게 제공하는 경우, 개설자는 그 정보를 리워드 제작·배송 목적으로만 사용하며 그 밖의 목적으로 이용하거나 제3자에게 제공할 수 없습니다.',
      '개설자는 목적을 다한 서포터 개인정보를 지체 없이 파기해야 합니다.',
    ],
  },
];

const CreatorTermsPage: NextPage<CreatorTermsPageProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig('ko');
  const title = '개설자 약관';
  const subtitle = '스튜디오 놀 펀딩 페이지에 프로젝트를 직접 개설하는 아티스트가 동의하는 약관입니다.';

  return (
    <>
      <SEO
        locale={locale}
        title={`${title} | ${siteConfig.name}`}
        description={subtitle}
        robots="noindex, nofollow"
        canonical="/ko/funding/creator-terms"
        breadcrumbs={[
          { name: t('nav.home'), path: '/ko' },
          { name: title, path: '/ko/funding/creator-terms' },
        ]}
      />

      <Section variant="default" className="pb-16 pt-28 md:pb-24 md:pt-36">
        <div className="max-w-3xl mx-auto">
          <h1 className="typo-section-title">{title}</h1>
          <p className="typo-section-lead mt-4 mb-2">{subtitle}</p>
          {/* 심사 신청 시 funding_projects.creator_terms_version에 기록되는 값과 같다 — 분쟁 시 "어느 판본에 동의했는가"를 대조한다. */}
          <p className="typo-card-meta mb-10">약관 버전: {FUNDING_CREATOR_TERMS_VERSION}</p>

          <div className="space-y-6">
            {FUNDING_CREATOR_TERMS_SECTIONS.map((section) => (
              <article key={section.heading} className="glass-card rounded-2xl p-6">
                <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed mb-2 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </article>
            ))}

            <article className="glass-card rounded-2xl p-6">
              <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">사업자 정보</h2>
              <dl className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed space-y-1">
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">상호</dt>
                  <dd>{siteConfig.name} (Studio NOL)</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">대표자</dt>
                  <dd>{studioOperator.name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">주소</dt>
                  <dd>{siteConfig.contact.address}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">연락처</dt>
                  <dd>{siteConfig.contact.phone}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">이메일</dt>
                  <dd>{siteConfig.contact.email}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">사업자등록번호</dt>
                  <dd>{siteConfig.businessRegistrationNumber}</dd>
                </div>
                {siteConfig.mailOrderSalesNumber && (
                  <div className="flex gap-2">
                    <dt className="font-semibold shrink-0">통신판매업신고</dt>
                    <dd>{siteConfig.mailOrderSalesNumber}</dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">호스팅서비스 제공자</dt>
                  <dd>{hostingProvider.name}</dd>
                </div>
              </dl>
            </article>
          </div>
        </div>
      </Section>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ params, res }) => {
  const locale = resolveLocaleParam(params?.locale);
  res.setHeader('Cache-Control', 'no-store');
  if (locale !== 'ko') {
    return { redirect: { destination: '/ko/funding/creator-terms', permanent: false } };
  }
  const { i18nResources } = getI18nStaticProps(params?.locale, []);
  return { props: { locale, i18nResources } };
};

export default CreatorTermsPage;
