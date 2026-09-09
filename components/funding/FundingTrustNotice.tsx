import Link from 'next/link';
import { getSiteConfig, studioOperator } from '../../data/siteConfig';

export default function FundingTrustNotice() {
  const cfg = getSiteConfig('ko');
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-xs leading-6 text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
      <p>
        판매자: 스튜디오 놀 (대표 {studioOperator.name}) · 사업자등록번호 {cfg.businessRegistrationNumber}
        {cfg.mailOrderSalesNumber ? ` · 통신판매업 신고 ${cfg.mailOrderSalesNumber}` : ''}
      </p>
      <p>후원은 리워드 선주문 형태의 통신판매 계약이며 기부가 아닙니다. 목표 미달 시에도 모금액으로 제작을 진행합니다(Keep-it-All).</p>
      <p>
        <Link href="/ko/funding/terms" className="underline">펀딩 약관·청약철회·환불 규정</Link>
        {' · '}
        <Link href="/ko/privacy-policy" className="underline">개인정보 처리방침</Link>
      </p>
    </div>
  );
}
