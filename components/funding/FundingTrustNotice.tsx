import Link from 'next/link';
import { getSiteConfig, studioOperator } from '../../data/siteConfig';
import ResponsiveImage from '../ResponsiveImage';
import { Panel } from '../ui/Panel';
import type { FundingLang } from '../../lib/funding/translatedSlugs';

export default function FundingTrustNotice({ lang = 'ko' }: { lang?: FundingLang }) {
  const cfg = getSiteConfig('ko');
  if (lang === 'en') {
    // 영문판 — 판매자·사업자 정보는 같고, 약관이 한국어 문서뿐이라는 것을 링크 문구에 밝힌다.
    return (
      <Panel padding="default" title="Seller">
        <div className="space-y-2 text-xs leading-6 text-gray-600 dark:text-gray-300">
          <p>
            Seller: Studio NOL (owner {studioOperator.name}) · Business registration no. {cfg.businessRegistrationNumber}
            {cfg.mailOrderSalesNumber ? ` · Mail-order sales registration ${cfg.mailOrderSalesNumber}` : ''}
          </p>
          <p>A pledge is a pre-order of rewards (a mail-order sale), not a donation. Production goes ahead with whatever is raised, even if the goal is not reached (Keep-it-All).</p>
        </div>
        <p className="mt-4 border-t border-gray-200 pt-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
          <Link href="/ko/funding/terms" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">Funding terms, cancellation and refunds (Korean)</Link>
          {' · '}
          <Link href="/en/privacy-policy" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">Privacy policy</Link>
        </p>
      </Panel>
    );
  }
  return (
    <Panel padding="default" title="판매자 정보">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 ring-1 ring-black/10 dark:ring-white/15">
          <ResponsiveImage
            src="/images/email-logo.webp"
            alt="스튜디오 놀 로고"
            width={280}
            height={72}
            sizes="56px"
            containerClassName="w-full h-full"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="space-y-2 text-xs leading-6 text-gray-600 dark:text-gray-300">
          <p>
            판매자: 스튜디오 놀 (대표 {studioOperator.name}) · 사업자등록번호 {cfg.businessRegistrationNumber}
            {cfg.mailOrderSalesNumber ? ` · 통신판매업 신고 ${cfg.mailOrderSalesNumber}` : ''}
          </p>
          <p>펀딩은 리워드 선주문 형태의 통신판매 계약이며 기부가 아닙니다. 목표 미달 시에도 모금액으로 제작을 진행합니다(Keep-it-All).</p>
        </div>
      </div>
      <p className="mt-4 border-t border-gray-200 pt-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
        <Link href="/ko/funding/terms" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">펀딩 약관·청약철회·환불 규정</Link>
        {' · '}
        <Link href="/ko/privacy-policy" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">개인정보 처리방침</Link>
      </p>
    </Panel>
  );
}
