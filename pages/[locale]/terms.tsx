import type { GetServerSideProps } from 'next';
import type { NextPageWithLayout } from '../../types';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { Section } from '../../components/ui/Section';
import { getSiteConfig, studioOperator } from '../../data/siteConfig';
import { getI18nStaticProps, resolveLocaleParam } from '../../lib/getStatic';
import {
  MIXING_REFUND_POLICY_LINES,
  PRACTICE_ROOM_REFUND_POLICY_LINES,
  PRESS_REFUND_POLICY_LINES,
  REFUND_POLICY_LINES,
  SUBSCRIPTION_REFUND_POLICY_LINES,
  ARTIST_SUPPORT_REFUND_POLICY_LINES,
} from '../../lib/booking/refund-policy';
import type { Locale } from '../../lib/i18n';
import { SHOP_SALES_OPEN } from '../../data/shop/policy';
import { SOFTWARE_SALES_OPEN } from '../../data/software/policy';
import { SOFTWARE_TERMS_SECTIONS } from '../../lib/software/policyCopy';
import {
  SHOP_DIGITAL_RULES,
  SHOP_PREORDER_MIX_NOTE,
  SHOP_PREORDER_TERMS_NOTE,
  SHOP_REFUND_RULES,
  SHOP_SELLER_NOTE,
  shopShippingNote,
} from '../../lib/shop/policyCopy';

// ko 전용 페이지 — 예약 퍼널(lib/booking/*)이 ko 전용이라 약관·환불규정도 ko에만 존재한다.
// 다른 로케일 경로는 getServerSideProps에서 /ko/terms로 리다이렉트한다.
// getStaticProps는 build-time prerendering 중 redirect를 반환할 수 없다(Next.js 제약 —
// "redirect can not be returned from getStaticProps during prerendering") — booking/[service].tsx와
// 동일하게 getServerSideProps를 쓴다.

interface TermsPageProps {
  locale: Locale;
}

interface TermsSection {
  heading: string;
  body: string;
}

const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: '1. 예약 성립',
    body:
      '온라인 예약은 결제가 완료된 시점에 확정됩니다. 카드·간편결제의 결제 전 슬롯 선점은 임시 상태이며, 정해진 시간 안에 결제가 완료되지 않으면 자동으로 해제됩니다. ' +
      '계좌 입금(무통장)을 고르시면 안내 화면과 메일에 적힌 계좌로 입금하신 금액을 스튜디오가 확인한 때 예약·주문이 확정되고, 확인되면 메일로 알려 드립니다. 입금하실 때 보내는 분 이름은 신청하신 분 성함으로 해 주세요. ' +
      '입금을 기다리는 동안 그 시간대는 다른 분이 예약할 수 없게 잡아 두며, 안내한 입금 기한이 지나도 자동으로 취소하지 않습니다. 입금 전에는 예약 확인 페이지에서 신청을 취소할 수 있습니다. 이용 시작까지 2시간이 남지 않은 예약은 계좌 입금을 받지 않습니다.',
  },
  {
    heading: '2. 이용',
    body: '예약자는 예약한 시간 동안 스튜디오를 이용하며, 현장 안내에 따라 장비와 공간을 안전하게 사용해 주셔야 합니다. 안내를 따르지 않아 발생한 장비 손상이나 사고에 대한 책임은 이용자에게 있습니다.',
  },
  {
    heading: '3. 취소 및 환불',
    body:
      '예약 취소는 예약 확인 페이지에서 직접 진행할 수 있으며, 취소 시점에 따라 아래 환불 규정이 적용됩니다. ' +
      '카드·간편결제는 결제 수단으로 환불되고, 계좌 입금으로 결제하신 경우에는 취소하실 때 적어 주신 환불 계좌(은행·계좌번호·예금주)로 접수일부터 3영업일 이내에 보내 드립니다. 환불 계좌는 정확히 적어 주세요.',
  },
  {
    heading: '4. 음원 발매 홍보',
    body:
      '음원 발매 홍보는 심사를 거쳐 수주 여부를 정하며, 심사를 통과한 뒤 어떤 성격의 매체 몇 곳에 발송할지를 확정해 안내드린 시점에 계약이 성립합니다. ' +
      '자료 확인 단계에서 수정은 2회까지 반영하고, 사실 관계 정정은 횟수에 포함하지 않습니다. ' +
      '기사 게재·라디오 송출·플레이리스트 수록은 매체가 정하는 일이므로 보장하지 않으며, 스튜디오 놀이 책임지는 범위는 발송 전에 확정해 안내한 실행량과 그 결과를 담은 리포트입니다.',
  },
];

const TermsPage: NextPageWithLayout<TermsPageProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const title = '이용약관';
  const subtitle = '스튜디오 놀 온라인 예약과 음원 발매 홍보의 계약 성립, 이용, 취소·환불 규정과 사업자 정보를 안내합니다.';

  return (
    <>
      <SEO
        locale={locale}
        title={`${title} | ${siteConfig.name}`}
        description={subtitle}
        robots="noindex, follow"
        canonical="/ko/terms"
        breadcrumbs={[
          { name: t('nav.home'), path: '/ko' },
          { name: title, path: '/ko/terms' },
        ]}
      />

      <Section variant="default" className="pb-16 pt-28 md:pb-24 md:pt-36">
        <div className="max-w-4xl mx-auto">
          <h1 className="typo-section-title">{title}</h1>
          <p className="typo-section-lead mt-4 mb-2">{subtitle}</p>
          <p className="typo-card-meta mb-10">시행일: 2026년 10월 4일</p>

          <div className="space-y-6">
            {TERMS_SECTIONS.map((section) => (
              <article key={section.heading} className="glass-card rounded-2xl p-6">
                <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">{section.heading}</h2>
                <p className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed">{section.body}</p>
              </article>
            ))}

            <article id="refund" className="glass-card scroll-mt-24 rounded-2xl p-6">
              <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">환불 규정</h2>
              <ul className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed list-disc pl-5 space-y-1">
                {REFUND_POLICY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>

            <article className="glass-card rounded-2xl p-6">
              <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">환불 규정 — 음악연습실 시간제 예약</h2>
              <ul className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed list-disc pl-5 space-y-1">
                {PRACTICE_ROOM_REFUND_POLICY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>

            <article className="glass-card rounded-2xl p-6">
              <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">환불 규정 — 믹싱·마스터링 주문</h2>
              <ul className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed list-disc pl-5 space-y-1">
                {MIXING_REFUND_POLICY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>

            <article className="glass-card rounded-2xl p-6">
              <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">환불 규정 — 음원 발매 홍보</h2>
              <ul className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed list-disc pl-5 space-y-1">
                {PRESS_REFUND_POLICY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>

            {/* 상품 판매(음반·굿즈·디지털) — 상점 화면과 같은 문구(lib/shop/policyCopy.ts)를 읽는다. 판매를 열 때(SHOP_SALES_OPEN)만 보인다. */}
            {SHOP_SALES_OPEN && (
              <article id="shop" className="glass-card scroll-mt-24 rounded-2xl p-6">
                <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">상품 판매 — 음반·굿즈·디지털 상품</h2>
                <div className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed space-y-4">
                  <section>
                    <h3 className="font-semibold">판매 주체</h3>
                    <p>{SHOP_SELLER_NOTE}</p>
                  </section>
                  <section>
                    <h3 className="font-semibold">배송</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>{shopShippingNote()}</li>
                      <li>{SHOP_PREORDER_TERMS_NOTE}</li>
                      <li>{SHOP_PREORDER_MIX_NOTE}</li>
                    </ul>
                  </section>
                  <section>
                    <h3 className="font-semibold">실물 상품의 청약철회·교환·반품</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {SHOP_REFUND_RULES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3 className="font-semibold">디지털 상품</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {SHOP_DIGITAL_RULES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </section>
                </div>
              </article>
            )}

            {/* 소프트웨어 라이선스 — 구매 폼·구매 내역·환불 판정과 같은 약속(lib/software/policyCopy.ts). 판매를 열 때(SOFTWARE_SALES_OPEN)만 보인다. */}
            {SOFTWARE_SALES_OPEN && (
              <article id="software" className="glass-card scroll-mt-24 rounded-2xl p-6">
                <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">소프트웨어(플러그인·앱) 라이선스</h2>
                <div className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed space-y-4">
                  {SOFTWARE_TERMS_SECTIONS.map((section) => (
                    <section key={section.heading}>
                      <h3 className="font-semibold">{section.heading}</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        {section.lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </article>
            )}

            <article className="glass-card rounded-2xl p-6">
              <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">환불 규정 — 정기결제(연습실 월 이용료·프로듀싱 레슨)</h2>
              <ul className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed list-disc pl-5 space-y-1">
                {SUBSCRIPTION_REFUND_POLICY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>

            <article className="glass-card rounded-2xl p-6">
              <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">환불 규정 — 아티스트 구독(월 후원 멤버십)</h2>
              <ul className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed list-disc pl-5 space-y-1">
                {ARTIST_SUPPORT_REFUND_POLICY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="typo-card-body mt-4">
                <Link href="/ko/funding/terms" className="text-primary dark:text-primary-lighter underline underline-offset-2">
                  펀딩(리워드 선주문) 약관 보기
                </Link>
              </p>
            </article>

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
              </dl>
            </article>
          </div>
        </div>
      </Section>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  if (locale !== 'ko') {
    return { redirect: { destination: '/ko/terms', permanent: false } };
  }
  const { i18nResources } = getI18nStaticProps(params?.locale, []);
  return { props: { locale, i18nResources } };
};

TermsPage.designEdition = 'v2';

export default TermsPage;
