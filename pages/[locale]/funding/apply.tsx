import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetStaticPaths, GetStaticProps } from 'next';

import { FUNDING_PAYMENT_FEE_PERCENT, FUNDING_PLATFORM_FEE_PERCENT } from '../../../data/pricing';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../../../lib/funding/policy';
import { buildPageStaticProps } from '../../../lib/getStatic';
import { defaultLocale } from '../../../lib/i18n';
import { releasePipelineCopy } from '../../../data/releasePipeline';
import CreatorLoginForm from '../../../components/funding/CreatorLoginForm';
import { Notice } from '../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../components/ui/PageHeader';
import { Panel } from '../../../components/ui/Panel';

export default function FundingApply() {
  const router = useRouter();
  // 개설자 매직링크 착지(auth.tsx)가 로그인 API 실패 뒤 여기로 보내며 붙이는 쿼리다.
  // 만료됐는지 이미 쓰였는지는 구분하지 않는다(캐물을 여지를 주지 않으려는 의도가
  // creatorToken.ts부터 일관된다) — 할 일은 "다시 받기" 하나뿐이다.
  const linkExpired = router.query.e === 'link';

  return (
    <>
      <Head>
        <title>펀딩 개설 신청 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell>
        <PageHeader title="펀딩 개설 신청" className="mb-6" />
        {linkExpired && (
          <Notice tone="warning" className="mb-6">
            링크가 만료됐거나 이미 사용됐어요. 이메일을 다시 넣어 새 링크를 받아 주세요.
          </Notice>
        )}
        <div className="space-y-3 text-gray-700 dark:text-gray-300">
          <p>앨범·공연·굿즈를 만들 비용을 후원으로 모아요. 페이지는 직접 쓰고, 결제·환불·정산은 스튜디오 놀이 맡아요.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>스튜디오 놀이 판매자예요. 후원금은 스튜디오 놀이 받아 정산으로 보내 드려요.</li>
            <li>리워드의 제작과 발송은 개설자가 맡아요. 모금이 마감되면 배송 리워드를 선택한 후원자의 배송지가 개설자 화면에 열리며, 개설자는 그 정보를 발송에만 쓰고 발송을 마친 뒤 파기해야 해요.</li>
            {/* 수수료와 정산 시점은 신청 전에 알아야 한다 — 숫자는 상수에서 끌어온다
                (data/pricing.ts · lib/funding/policy.ts). 문자열로 박으면 정산 계산과 갈라진다. */}
            <li>
              정산은 모금이 끝나고 영업일 {FUNDING_PAYOUT_BUSINESS_DAYS}일 이내에 보내 드려요.
              플랫폼 수수료 {FUNDING_PLATFORM_FEE_PERCENT}%와 결제 수수료 {FUNDING_PAYMENT_FEE_PERCENT}%(둘 다 부가세 포함)를
              개설자가 부담해요.
            </li>
            <li>제출하시면 운영자가 확인하고 승인 또는 보완 요청을 메일로 알려 드려요.</li>
          </ul>
        </div>

        {/* 발매 파이프라인 3단계 — 직접 쓰기 막막한 사람을 설계 대행·발매 프로젝트로 보낸다. */}
        <Panel as="aside" variant="outline" className="mt-8" title={releasePipelineCopy.applyHelp.title}>
          <p className="text-sm text-gray-700 dark:text-gray-300">{releasePipelineCopy.applyHelp.body}</p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
            {releasePipelineCopy.applyHelp.links.map((link) => (
              <Link key={link.href} href={link.href} prefetch={false} className="text-primary underline underline-offset-2 dark:text-primary-lighter">
                {link.label}
              </Link>
            ))}
          </p>
        </Panel>

        <CreatorLoginForm terms={{ href: '/ko/funding/creator-terms', label: '개설자 약관', purpose: '개설자', condition: '개설 조건' }} />
      </PageShell>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { locale: defaultLocale } }],
  fallback: false,
});

export const getStaticProps: GetStaticProps = async () =>
  buildPageStaticProps(defaultLocale, {}, { i18nSections: [] });

// 디자인 판 — lib/designEdition.ts
FundingApply.designEdition = 'v2';
