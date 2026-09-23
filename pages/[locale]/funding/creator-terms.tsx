import type { GetServerSideProps, NextPage } from 'next';
import { useTranslation } from 'react-i18next';
import SEO from '../../../components/SEO';
import { Section } from '../../../components/ui/Section';
import { getSiteConfig, hostingProvider, studioOperator } from '../../../data/siteConfig';
import { getI18nStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
} from '../../../data/pricing';
import { FUNDING_CREATOR_TERMS_VERSION, FUNDING_PAYOUT_BUSINESS_DAYS } from '../../../lib/funding/policy';
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
      '심사 기준은 스튜디오가 정하며, 보완을 요청하거나 반려하는 경우에는 그 사유를 개설자에게 알립니다.',
      '반려는 되돌릴 수 없습니다. 반려된 프로젝트는 더 이상 고쳐 다시 심사를 받을 수 없으며, 같은 내용으로 다시 진행하려면 프로젝트를 새로 등록해야 합니다. 보완 요청은 이와 달리 개설자가 안내받은 내용을 고쳐 다시 제출할 수 있습니다.',
      '스튜디오는 작성중이거나 심사 대기 중이거나 보완 요청을 받은 채로 방치된 프로젝트를 정리(보관)할 수 있습니다. 보관은 반려와 마찬가지로 되돌릴 수 없으며, 그 사유를 개설자에게 알립니다.',
    ],
  },
  {
    heading: '제3조 (승인 뒤에도 바뀌는 것과 바뀌지 않는 것)',
    body: [
      '심사에서 승인된 프로젝트도 제목·소개 요약·표지 이미지·본문은 다시 심사를 받지 않고 계속 고칠 수 있습니다. 재심사를 거치지 않는 경로이므로 고치면 스튜디오에 알림이 가지만, 같은 프로젝트를 짧은 시간 안에 여러 번 고치면 그 안의 나머지 수정에는 알림이 가지 않습니다.',
      '그중에서도 프로젝트 주소(슬러그)·목표 금액·모금 기간(시작일·종료일)은 승인 뒤에는 어떤 경로로도 바뀌지 않습니다. 서포터는 후원 확인 페이지에서 프로젝트 주소로 후원 내역을 찾고, 목표 금액과 모금 기간은 이미 후원한 서포터가 보고 결정한 조건이기 때문입니다.',
      '리워드는 승인과 함께 제목·설명·이미지·금액·수량 제한 여부·배송 필요 여부·예상 전달 시기를 포함해 통째로 잠기며, 승인 뒤에는 어떤 항목도 고치거나 지울 수 없습니다. 설명까지 잠그는 이유는 리워드가 서포터가 보고 결제한 약속이기 때문입니다 — 내용이 바뀌면 서포터 약관 제8조의 "표시·광고와 다르게 이행"에 해당할 수 있습니다.',
      '리워드는 심사를 신청하기 전(작성 중이거나 보완 요청을 받은 상태)에만 고치거나 더하거나 지울 수 있습니다. 승인 뒤에는 기존 리워드를 고치는 것뿐 아니라 새 리워드를 추가하는 것도 개설자 화면에서 할 수 없으므로, 가격과 구성은 심사를 신청하기 전에 확정해 주세요.',
      '개설자 계정 정보(소개·연락처·링크)는 프로젝트가 아니라 개설자 계정에 속한 정보이므로, 프로젝트 승인 여부와 무관하게 언제든 고칠 수 있습니다. 다만 이름은 예외입니다 — 승인된 프로젝트가 하나라도 있고 지금 이름이 가입 시 자동으로 채워진 값(이메일 주소의 @ 앞부분)과 다르면, 그 개설자의 이름은 더 이상 바꿀 수 없습니다. 프로젝트 상세 화면에 판매자 표시와 함께 그대로 노출되는 값이라, 승인 뒤 바뀌지 않는 것들과 같은 이유로 잠급니다. 지금 이름이 그 자동 채움 값과 같다면 아직 설정하지 않은 것으로 보아 이 잠금은 적용되지 않습니다.',
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
    // 숫자는 전부 상수에서 보간한다 — 문자열로 박으면 계산(lib/funding/payout.ts)과 갈라진다.
    // 보간하는 순간 이 조항은 상수에 의존하므로, content/creatorTermsHash.ts의
    // serializeCreatorTerms()가 그 상수들도 함께 해시한다.
    // 문장 순서는 computeFundingPayout의 계산 순서와 같아야 한다:
    // netGross = gross − refund → 수수료 → 원천징수.
    // 조건을 단정하지 않는다 — recordFundingPayout이 거부하는 사유가 셋이고
    // (not_closed·no_payout_account·no_tax_type), 그중 둘이 개설자가 등록해야 풀린다.
    body: [
      '모금이 끝나면 스튜디오는 개설자에게 정산금을 보냅니다. 정산금은 서포터가 결제한 후원금에서 환불된 금액을 먼저 뺀 뒤, 그 금액을 기준으로 아래 수수료와 원천징수세액을 뺀 나머지입니다.',
      `플랫폼 수수료는 ${FUNDING_PLATFORM_FEE_PERCENT}%, 결제 수수료는 ${FUNDING_PAYMENT_FEE_PERCENT}%이며 둘 다 부가가치세를 포함한 요율입니다. 두 수수료 모두 개설자가 부담하며, 환불을 먼저 뺀 금액을 기준으로 계산합니다. 다만 스튜디오가 계좌로 직접 받아 수기로 등록한 후원금에는 결제 대행을 거치지 않았으므로 결제 수수료를 매기지 않습니다.`,
      `개설자의 세금 처리 구분이 원천징수인 경우, 수수료를 뺀 금액에서 사업소득 원천징수세액 ${FUNDING_WITHHOLDING_PERCENT}%(소득세와 지방소득세)를 떼고 보냅니다. 세금계산서를 발행하는 사업자로 등록한 개설자에게는 원천징수하지 않으며, 그 개설자는 지급받은 정산금에 대한 세금계산서를 스튜디오 앞으로 발행해야 합니다.`,
      '정산을 받으려면 개설자가 개설자 화면에 은행명·계좌번호·예금주와 세금 처리 구분을 모두 등록해야 합니다. 이 정보는 프로젝트가 승인된 뒤에 등록할 수 있습니다.',
      `정산금은 위 정산 정보가 모두 등록되어 있는 경우, 모금이 끝난 날부터 영업일 ${FUNDING_PAYOUT_BUSINESS_DAYS}일 이내에 보내는 것을 원칙으로 합니다. 등록되지 않은 항목이 있으면 스튜디오는 정산을 보낼 수 없으며, 등록이 끝난 뒤에 보냅니다.`,
      '정산 금액을 확정할 때와 실제로 보낼 때 각각 그 내역을 개설자에게 메일로 알립니다. 내역에는 모금액, 플랫폼 수수료, 결제 수수료, 실지급액과 확정 후원 건수가 담기며, 환불이나 원천징수가 있으면 그 금액도 함께 적습니다.',
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
      '서포터가 후원하며 입력한 개인정보는 스튜디오가 수집·보유합니다. 그중 배송 리워드의 발송에 필요한 항목만, 모금이 마감된 뒤에 개설자에게 제공합니다. 모금 기간 중에는 제공하지 않습니다 — 마감 전에는 서포터가 후원을 취소할 수 있어 받는 분과 주소가 계속 바뀌기 때문입니다.',
      '배송 목록으로 제공하는 항목은 다음뿐입니다: 받는 분 이름, 연락처, 우편번호, 주소, 상세주소, 배송 메모, 그리고 그 후원의 리워드 이름·수량·발송 상태·택배사·운송장번호. 서포터의 이메일 주소, 결제 금액, 결제수단, 주문번호, 응원 메시지는 배송 목록에 담기지 않습니다. 다만 서포터가 명단 공개에 동의한 경우 그 이름과 응원 메시지는 프로젝트 페이지에 공개되므로, 개설자도 그 화면에서 볼 수 있습니다 — 이는 이 조가 말하는 배송 목록 제공과는 다른 경로입니다.',
      '배송이 필요한 리워드의 후원만 제공합니다. 배송이 없는 리워드와 환불·취소된 후원은 목록에 나오지 않습니다.',
      '개설자는 제공받은 정보를 그 프로젝트 리워드의 발송과 그에 따른 배송 문의 응대에만 사용할 수 있습니다. 그 밖의 목적으로 이용하거나, 제3자에게 다시 제공하거나, 다른 프로젝트의 홍보·연락에 재사용할 수 없습니다.',
      '개설자는 리워드 발송을 마친 뒤 제공받은 정보를 지체 없이 파기해야 합니다. 화면에서 내려받은 배송 목록 파일과 그 사본, 인쇄한 배송 라벨이 모두 여기에 포함됩니다. 스튜디오가 보관하는 기록의 파기는 스튜디오가 개인정보 처리방침이 정한 기간에 따라 처리하므로, 개설자가 할 일은 자신이 가진 사본을 없애는 것입니다.',
      '배송 리워드의 발송 주체는 개설자입니다. 개설자는 개설자 화면에서 후원 건마다 발송 상태(미발송·준비중·발송완료·수령완료)와 택배사·운송장번호를 직접 기록해야 하며, 서포터는 후원 확인 화면에서 그 발송 상태를 보고, 스튜디오는 발송 상태와 함께 택배사·운송장번호까지 봅니다. 택배사·운송장번호는 서포터 화면과 안내 메일에는 나오지 않습니다. 발송 상태를 마지막으로 바꾼 주체가 누구인지는 시스템에 기록으로 남습니다.',
      '서포터에 대한 판매자로서의 계약상 책임은 이 조와 관계없이 스튜디오가 집니다(제1조). 개설자가 이 조를 위반하여 서포터나 제3자에게 손해가 발생한 경우 그 책임은 개설자에게 있으며, 개설자는 스튜디오를 면책합니다.',
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
