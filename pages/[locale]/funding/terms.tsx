import type { GetServerSideProps, NextPage } from 'next';
import { useTranslation } from 'react-i18next';
import SEO from '../../../components/SEO';
import { Section } from '../../../components/ui/Section';
import { getSiteConfig, studioOperator } from '../../../data/siteConfig';
import { getI18nStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import { PRIVACY_RETENTION_TEXT } from '../../../lib/funding/policy';
import type { Locale } from '../../../lib/i18n';

// 펀딩(리워드 선주문) 전용 약관 — /ko/terms의 예약 이용약관과 별개다.
// 펀딩 페이지 전부 ko 전용이라 비-ko 경로는 getServerSideProps에서 /ko/funding/terms로
// 리다이렉트한다. 트랜잭셔널 페이지 정책(noindex + no-store)은 global-constraints 참조.

interface FundingTermsPageProps {
  locale: Locale;
}

interface FundingTermsSection {
  heading: string;
  body: string[];
}

export const FUNDING_TERMS_SECTIONS: FundingTermsSection[] = [
  { heading: '제1조 (목적)', body: ['이 약관은 스튜디오 놀(이하 "스튜디오")이 운영하는 펀딩 페이지에서 후원자가 리워드를 선주문하는 거래의 조건과 절차, 당사자의 권리·의무를 정합니다.'] },
  { heading: '제2조 (정의)', body: ['"프로젝트"는 스튜디오가 제작하는 음반·콘텐츠의 제작비를 모으기 위해 개설한 펀딩 페이지를 말합니다.', '"리워드"는 후원 금액에 따라 스튜디오가 제공하기로 정한 재화 또는 용역(CD, 굿즈, 디지털 음원, 감사 메일 등)입니다.', '"후원"은 후원자가 리워드를 선택하고 대금을 결제하여 리워드 선주문 계약을 체결하는 행위입니다.'] },
  { heading: '제3조 (후원의 법적 성격)', body: ['후원은 전자상거래 등에서의 소비자보호에 관한 법률에 따른 통신판매 계약이며, 기부가 아닙니다.', '스튜디오는 기부금영수증을 발급하지 않으며 후원금은 세액공제 대상이 아닙니다. 페이지의 "후원"·"응원" 표현은 리워드 선주문을 뜻합니다.'] },
  { heading: '제4조 (사업자 정보)', body: ['판매자·통신판매업자는 스튜디오 놀입니다. 상호·대표자·사업자등록번호·통신판매업 신고번호·주소·연락처는 이 페이지 하단과 사이트 푸터에 표시합니다.'] },
  { heading: '제5조 (후원 신청과 결제)', body: ['후원은 리워드·수량·후원자 정보·배송지(배송 리워드에 한함)를 입력하고 결제를 완료한 때 성립합니다.', '온라인 결제는 결제 대기 15분, 무통장입금은 12시간 안에 완료되어야 하며 기한이 지나면 신청이 자동 해제됩니다.', '한정 수량 리워드는 온라인 결제로만 후원할 수 있습니다.'] },
  { heading: '제6조 (후원금의 집행)', body: ['프로젝트는 Keep-it-All 방식입니다. 목표 금액에 미달하더라도 모금액으로 제작을 진행하며, 목표 미달을 이유로 후원이 취소되지 않습니다.', '제작이 불가능해진 경우 스튜디오는 후원자에게 고지하고 후원금 전액을 환불합니다.'] },
  { heading: '제7조 (리워드의 제공)', body: ['리워드의 예상 전달 시기는 제작 계획에 따른 예정이며, 지연이 예상되면 스튜디오는 후원자에게 이메일로 고지합니다.', '배송 리워드는 후원자가 입력한 배송지로 발송하며, 배송지 오류로 인한 반송·재발송 비용은 후원자가 부담합니다.'] },
  { heading: '제8조 (청약철회의 권리 및 기간)', body: ['후원자는 프로젝트 마감 전이고 리워드 발송 준비가 시작되기 전이면 후원 확인 페이지에서 언제든 후원을 취소하고 전액 환불받을 수 있습니다.', '리워드를 받은 날부터 7일 이내에 청약철회할 수 있습니다. 리워드가 표시·광고 내용과 다르거나 계약 내용과 다르게 이행된 경우 리워드를 받은 날부터 3개월 이내, 그 사실을 안 날부터 30일 이내에 청약철회할 수 있습니다.'] },
  { heading: '제9조 (청약철회의 제한)', body: ['후원자의 책임 있는 사유로 리워드가 멸실·훼손된 경우, 사용으로 가치가 현저히 감소한 경우, 복제가 가능한 음원·영상의 포장을 훼손한 경우에는 청약철회가 제한됩니다.', '후원자 요청에 따라 개별 제작(각인·이름 인쇄 등)되는 리워드는 청약철회가 제한된다는 사실을 리워드 설명에 표시하고 후원자의 동의를 받은 경우 청약철회가 제한됩니다.'] },
  { heading: '제10조 (환불)', body: ['환불은 청약철회 접수일부터 3영업일 이내에 처리합니다. 온라인 결제는 결제 수단으로 취소하며, 무통장입금은 후원자가 알려준 계좌로 송금합니다.', '리워드를 받은 뒤 청약철회하는 경우 리워드 반환에 드는 비용은 후원자가 부담합니다. 다만 리워드가 표시·광고와 다른 경우에는 스튜디오가 부담합니다.'] },
  { heading: '제11조 (환불 지연에 대한 배상)', body: ['스튜디오가 환불을 지연한 경우 전자상거래법이 정하는 지연배상금을 지급합니다.'] },
  { heading: '제12조 (후원자의 의무)', body: ['후원자는 정확한 이름·연락처·이메일·배송지를 입력해야 하며, 무통장입금 시 입금자명을 후원 신청 이름과 같게 해야 합니다.', '타인의 정보를 도용하거나 결제 수단을 부정하게 사용해서는 안 됩니다.'] },
  { heading: '제13조 (개인정보의 처리)', body: [`스튜디오는 후원 확정·리워드 발송·고객 응대 목적으로 후원자의 이름·연락처·이메일·배송지를 수집하며, ${PRIVACY_RETENTION_TEXT} 보관한 뒤 파기합니다. 전자상거래법 등 법령이 더 긴 보존을 요구하는 거래 기록은 그 기간 동안 보관합니다.`, '후원자 명단 공개에 동의한 후원자의 이름은 프로젝트 페이지에 표시되며, 동의는 후원 확인 페이지 또는 문의로 철회할 수 있습니다.'] },
  { heading: '제14조 (면책)', body: ['천재지변·전쟁·배송사 사정 등 스튜디오의 통제를 벗어난 사유로 리워드 제공이 지연된 경우 그 기간 동안 책임을 지지 않습니다. 다만 그 사실을 후원자에게 고지합니다.'] },
  { heading: '제15조 (분쟁 해결)', body: ['후원과 관련한 분쟁은 스튜디오와 후원자가 성실히 협의하여 해결하며, 협의가 어려우면 한국소비자원 등 분쟁조정기구의 조정을 받을 수 있습니다.'] },
  { heading: '제16조 (준거법 및 문의처)', body: ['이 약관은 대한민국 법을 따르며, 분쟁의 관할은 민사소송법에 따릅니다.', '문의: hello@studionol.co.kr · 010-4255-7893'] },
];

const FundingTermsPage: NextPage<FundingTermsPageProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig('ko');
  const title = '펀딩 약관';
  const subtitle = '스튜디오 놀 펀딩(리워드 선주문)의 통신판매 조건, 청약철회·환불 규정과 사업자 정보를 안내합니다.';

  return (
    <>
      <SEO
        locale={locale}
        title={`${title} | ${siteConfig.name}`}
        description={subtitle}
        robots="noindex, nofollow"
        canonical="/ko/funding/terms"
        breadcrumbs={[
          { name: t('nav.home'), path: '/ko' },
          { name: title, path: '/ko/funding/terms' },
        ]}
      />

      <Section variant="default" className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="typo-section-title mb-4 text-gray-900 dark:text-white">{title}</h1>
          <p className="typo-card-body text-gray-700 dark:text-gray-300 mb-8">{subtitle}</p>

          <div className="space-y-6">
            {FUNDING_TERMS_SECTIONS.map((section) => (
              <article key={section.heading} className="glass-card rounded-xl p-6">
                <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed mb-2 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </article>
            ))}

            <article className="glass-card rounded-xl p-6">
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
    return { redirect: { destination: '/ko/funding/terms', permanent: false } };
  }
  const { i18nResources } = getI18nStaticProps(params?.locale, []);
  return { props: { locale, i18nResources } };
};

export default FundingTermsPage;
