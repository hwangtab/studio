import type { GetServerSideProps } from 'next';
import type { NextPageWithLayout } from '../../../types';
import { useTranslation } from 'react-i18next';
import SEO from '../../../components/SEO';
import { PageHeader, PageShell } from '../../../components/ui/PageHeader';
import { getSiteConfig, hostingProvider, studioOperator } from '../../../data/siteConfig';
import { getI18nStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import {
  FUNDING_INDIVIDUAL_PAYOUT_NOTE,
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
} from '../../../data/pricing';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../../../lib/funding/policy';
import { MIN_LEAD_DAYS } from '../../../lib/shows/organizer/draft';
import { REFUND_POLICY_FOOTNOTES, refundTierLines } from '../../../lib/shows/refundPolicy';
import { SHOW_ORGANIZER_TERMS_VERSION } from '../../../lib/shows/organizer/policy';
import type { Locale } from '../../../lib/i18n';

// 공연을 직접 등록하는 주최자가 제출할 때 동의하는 약관 — 관객이 보는 공연 예매 안내와는
// 당사자·목적이 다르다. 주최자 화면이 한국어 전용이라 비-ko 경로는 /ko/shows/organizer-terms로
// 리다이렉트한다. 펀딩 개설자 약관(pages/[locale]/funding/creator-terms.tsx)과 같은 형태다.
//
// 본문을 바꾸면 lib/shows/organizer/policy.ts의 SHOW_ORGANIZER_TERMS_VERSION을 먼저 올리고
// UPDATE_SHOW_ORGANIZER_TERMS_BASELINE=1 npx jest content/showOrganizerTerms.baseline.test.ts로
// 기준선을 다시 쓴다 — show_submissions.organizer_terms_version이 "그때 이 내용에 동의했다"는 증거다.

interface OrganizerTermsPageProps {
  locale: Locale;
}

interface OrganizerTermsSection {
  heading: string;
  body: string[];
}

export const SHOW_ORGANIZER_TERMS_SECTIONS: OrganizerTermsSection[] = [
  {
    heading: '제1조 (판매자와 주최자)',
    body: [
      '이 약관은 스튜디오 놀(이하 "스튜디오")이 운영하는 공연 예매 페이지에 주최자가 직접 공연을 등록하고, 관객에게 티켓을 판매하는 절차와 주최자의 의무를 정합니다.',
      '티켓의 판매자는 스튜디오이며, 관객의 결제도 스튜디오가 받습니다. 주최자는 공연의 기획과 진행, 그리고 공연 페이지에 실리는 내용에 대한 책임을 집니다.',
    ],
  },
  {
    heading: '제2조 (심사)',
    body: [
      '주최자가 제출한 공연은 공개되기 전에 스튜디오의 심사를 거칩니다. 스튜디오는 공연을 승인하거나, 보완을 요청하거나, 반려할 수 있습니다.',
      '심사 기준은 스튜디오가 정합니다. 보완을 요청할 때는 고칠 내용을 알리며, 주최자는 안내받은 내용을 고쳐 다시 제출할 수 있습니다. 반려할 때는 그 사유를 모두 밝히지 않을 수 있습니다.',
      '반려는 되돌릴 수 없습니다. 반려된 공연은 고쳐 다시 제출할 수 없으며, 같은 공연을 다시 진행하려면 새로 등록해야 합니다.',
      `첫 회차는 제출하는 날과 승인하는 날 모두 그날부터 ${MIN_LEAD_DAYS}일이 지난 뒤여야 합니다. 심사와 티켓 판매에 필요한 기간입니다. 심사 중에 이 기간이 모자라게 되면 승인할 수 없습니다.`,
      '승인된 공연은 스튜디오의 공연 페이지에 공개됩니다. 공연 페이지의 주소는 승인할 때 스튜디오가 정합니다.',
    ],
  },
  {
    heading: '제3조 (승인 뒤에 바꿀 수 있는 것과 없는 것)',
    body: [
      '공연이 승인되면 회차 일시, 정원, 티켓 종류(이름과 가격), 장소 이름과 주소, 공연 시간, 관람 등급, 공연 페이지 주소는 주최자가 바꿀 수 없습니다. 관객이 보고 결제한 조건이기 때문입니다.',
      '이 가운데 바꿔야 하는 것이 있으면 스튜디오에 요청해 주세요. 그 변경으로 회차가 취소되면 제7조를 따릅니다.',
      '제목, 부제, 주최 이름, 소개, 포스터, 출연진, 일정 안내, 안내 사항은 승인 뒤에도 주최자가 고칠 수 있습니다. 고치면 다시 심사를 받지 않고 바로 공연 페이지에 반영되며, 스튜디오에 알림이 갑니다.',
    ],
  },
  {
    heading: '제4조 (권리 보증)',
    body: [
      '주최자는 공연 등록에 사용하는 소개 글·포스터·사진 등 콘텐츠에 대한 저작권 등 권리를 적법하게 확보했음을 보증하며, 출연진 정보와 사진을 포함해 콘텐츠에 등장하는 제3자의 초상·성명에 대해서도 필요한 동의를 받았음을 보증합니다.',
      '이 보증을 위반하여 제3자와 분쟁이 생기거나 스튜디오에 손해가 발생한 경우 그 책임은 주최자에게 있으며, 주최자는 스튜디오를 면책합니다.',
    ],
  },
  {
    heading: '제5조 (금지 내용)',
    body: [
      '주최자는 다음에 해당하는 공연이나 내용을 등록할 수 없습니다: 타인의 저작권·상표권 등 지식재산권을 침해하는 내용, 명예훼손·모욕에 해당하는 내용, 음란물 등 청소년에게 유해한 내용, 법령이 금지하는 물품·서비스를 판매하거나 제공하는 공연, 그 밖에 관계 법령을 위반하는 내용.',
      '스튜디오는 금지 내용이 확인되면 심사에서 반려하거나, 공개 뒤에도 공연을 비공개로 전환하거나 회차를 취소할 수 있습니다. 회차를 취소하는 경우에는 제7조를 따릅니다.',
    ],
  },
  {
    heading: '제6조 (수수료와 정산)',
    // 숫자는 전부 상수에서 보간한다 — 펀딩과 같은 요율이다(운영자 결정 2026-10-14). 보간하는 순간 이 조항은
    // 상수에 의존하므로 content/showOrganizerTermsHash.ts가 그 상수들도 함께 해시한다.
    body: [
      `스튜디오는 티켓 판매액에서 환불된 금액을 먼저 뺀 뒤, 그 금액을 기준으로 플랫폼 수수료 ${FUNDING_PLATFORM_FEE_PERCENT}%와 결제 수수료 ${FUNDING_PAYMENT_FEE_PERCENT}%를 빼고 나머지를 주최자에게 정산금으로 보냅니다. 두 수수료는 모두 부가가치세를 포함한 요율이며 주최자가 부담합니다.`,
      `${FUNDING_INDIVIDUAL_PAYOUT_NOTE} 세금계산서를 발행하는 사업자로 정산받는 주최자에게는 이 공제가 없으며, 그 주최자는 지급받은 정산금에 대한 세금계산서를 스튜디오 앞으로 발행해야 합니다.`,
      `정산금은 마지막 회차가 끝난 날부터 영업일 ${FUNDING_PAYOUT_BUSINESS_DAYS}일 이내에 주최자가 등록한 계좌로 보내는 것을 원칙으로 합니다. 계좌와 세금 처리 구분이 등록되어 있지 않으면 스튜디오는 정산을 보낼 수 없으며, 등록이 끝난 뒤에 보냅니다.`,
    ],
  },
  {
    heading: '제7조 (취소와 환불)',
    body: [
      // 환불표는 계산(lib/shows/refundPolicy.ts)과 같은 출처에서 만든다 — 손으로 옮겨 적으면 갈라진다.
      // 보간하므로 showOrganizerTermsHash.ts가 같은 표를 상수 블록에도 싣는다.
      '관객의 환불은 사이트의 공연 환불 규정을 따릅니다. 이 규정은 모든 공연에 같게 적용되며, 공연마다 따로 정하지 않습니다. 공연 페이지의 "취소·환불" 안내에도 같은 내용이 적혀 있습니다.',
      `관객이 환불을 신청하면 공연까지 남은 날짜에 따라 다음 비율로 환불합니다: ${refundTierLines().join(', ')}.`,
      ...REFUND_POLICY_FOOTNOTES,
      `회차가 취소되면 그 회차의 티켓을 산 관객에게 전액을 환불합니다. 이때 그 회차 결제분에 대한 결제 수수료(${FUNDING_PAYMENT_FEE_PERCENT}%)는 취소 사유와 관계없이 주최자가 부담합니다.`,
      '이 금액은 주최자의 정산금에서 빼고, 정산금이 모자라면 모자라는 금액을 주최자에게 청구합니다.',
    ],
  },
  {
    heading: '제8조 (관객 개인정보)',
    body: [
      '관객이 예매하며 입력한 개인정보는 스튜디오가 수집·보유하며, 관객의 이름과 연락처를 주최자에게 제공하지 않습니다.',
      '공연 당일의 입장 확인은 스튜디오가 발급하는 입장 확인 링크로 합니다.',
    ],
  },
];

const OrganizerTermsPage: NextPageWithLayout<OrganizerTermsPageProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig('ko');
  const title = '공연 주최자 약관';
  const subtitle = '스튜디오 놀 공연 예매 페이지에 공연을 직접 등록하는 주최자가 동의하는 약관입니다.';

  return (
    <>
      <SEO
        locale={locale}
        title={`${title} | ${siteConfig.name}`}
        description={subtitle}
        robots="noindex, nofollow"
        canonical="/ko/shows/organizer-terms"
        breadcrumbs={[
          { name: t('nav.home'), path: '/ko' },
          { name: title, path: '/ko/shows/organizer-terms' },
        ]}
      />

      <PageShell width="wide">
        {/* 제출 시 show_submissions.organizer_terms_version에 기록되는 값과 같다 — 분쟁 시 "어느 판본에 동의했는가"를 대조한다. */}
        <PageHeader title={title} lead={subtitle} meta={<span>약관 버전: {SHOW_ORGANIZER_TERMS_VERSION}</span>} />

        <div className="space-y-6">
          {SHOW_ORGANIZER_TERMS_SECTIONS.map((section) => (
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
      </PageShell>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ params, res }) => {
  const locale = resolveLocaleParam(params?.locale);
  res.setHeader('Cache-Control', 'no-store');
  if (locale !== 'ko') {
    return { redirect: { destination: '/ko/shows/organizer-terms', permanent: false } };
  }
  const { i18nResources } = getI18nStaticProps(params?.locale, []);
  return { props: { locale, i18nResources } };
};

OrganizerTermsPage.designEdition = 'v2';

export default OrganizerTermsPage;
