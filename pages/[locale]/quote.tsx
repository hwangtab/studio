import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import SEO from '../../components/SEO';
import { Section } from '../../components/ui/Section';
import QuoteWizard from '../../components/quote/QuoteWizard';
import { getSiteConfig } from '../../data/siteConfig';
import { buildPageStaticProps } from '../../lib/getStatic';
import { defaultLocale } from '../../lib/i18n';

/**
 * 견적 요청서 — ko 전용 도구 페이지(전략 축 A, 2026-09-26).
 *
 * 색인하지 않는다(noindex, follow): 답에 따라 결과가 바뀌는 계산 화면이라 검색 결과에 걸려도
 * 보여 줄 본문이 없다. 예약 화면과 같은 취급이다. 사이트맵 제외는 noindexStaticRoutes.json,
 * 다른 로케일 404는 lib/koOnlyRoutes.ts가 맡는다.
 */
const QuotePage: NextPage = () => {
  const siteConfig = getSiteConfig('ko');
  return (
    <>
      <SEO
        locale="ko"
        title={`견적 요청서 — 질문 몇 개로 예상 비용 바로 보기 | ${siteConfig.name}`}
        description="녹음·믹싱·발매·축가·연습실까지, 필요한 것을 고르면 예상 비용이 바로 나옵니다. 요약을 복사해 카카오톡으로 보내면 상담이 이어집니다."
        robots="noindex, follow"
        canonical="/ko/quote"
      />
      <Section variant="default">
        <div className="max-w-3xl mx-auto mb-10 text-center">
          <h1 className="typo-section-title mb-4 text-gray-900 dark:text-white">견적 요청서</h1>
          <p className="typo-card-body text-gray-700 dark:text-gray-300">
            질문 몇 개에 답하면 예상 비용이 바로 나옵니다. 가격은 사이트에 공개한 정가 그대로이고,
            이름이나 연락처는 묻지 않습니다.
          </p>
        </div>
        <QuoteWizard kakaoUrl={siteConfig.contact.kakaoUrl} />
      </Section>
    </>
  );
};

// ko 전용 — 다른 로케일은 정적 파일이 없어 404다(lib/koOnlyRoutes.ts 규칙에 등록).
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { locale: defaultLocale } }],
  fallback: false,
});

export const getStaticProps: GetStaticProps = async () => buildPageStaticProps(defaultLocale, {}, { revalidate: 86400, i18nSections: [] });

export default QuotePage;
