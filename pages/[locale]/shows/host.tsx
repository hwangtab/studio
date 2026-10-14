import Link from 'next/link';
import type { GetStaticPaths, GetStaticProps } from 'next';

import CreatorLoginForm from '../../../components/funding/CreatorLoginForm';
import SEO from '../../../components/SEO';
import { PageHeader, PageShell } from '../../../components/ui/PageHeader';
import { Panel } from '../../../components/ui/Panel';
import {
  FUNDING_INDIVIDUAL_PAYOUT_NOTE,
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
} from '../../../data/pricing';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../../../lib/funding/policy';
import { buildPageStaticProps } from '../../../lib/getStatic';
import { defaultLocale } from '../../../lib/i18n';
import { MIN_LEAD_DAYS, MIN_TICKET_PRICE } from '../../../lib/shows/organizer/draft';

// 공연을 직접 올리려는 주최자에게 보이는 안내 + 로그인 링크 요청. 주최자 화면이 한국어 전용이라
// ko만 만든다(펀딩 신청 페이지와 같다). 수수료·정산 숫자는 상수에서 끌어온다 — 약관
// (organizer-terms.tsx)과 같은 출처라 갈라지지 않는다.

const TITLE = '공연 올리기';
const DESCRIPTION = '스튜디오 놀 공연 예매 페이지에 공연을 직접 등록하는 방법과 수수료·정산 안내예요.';

const STEPS = [
  '이메일로 로그인 링크를 받아요.',
  '공연 정보와 포스터를 등록해서 제출해요.',
  '운영자가 확인하고 승인·보완 요청·반려 결과를 메일로 알려 드려요.',
  '승인되면 공연 페이지가 공개되고 티켓 판매가 시작돼요.',
  '공연을 진행해요.',
  '마지막 회차가 끝나면 판매액에서 수수료를 뺀 금액을 정산해 드려요.',
];

export default function ShowsHostPage() {
  return (
    <>
      <SEO
        locale="ko"
        title={`${TITLE} | 스튜디오 놀`}
        description={DESCRIPTION}
        canonical="/ko/shows/host"
        availableLocales={['ko']}
      />
      <PageShell>
        <PageHeader title={TITLE} lead={DESCRIPTION} className="mb-8" />

        <div className="space-y-6">
          <Panel as="section" variant="outline" padding="default" title="어떤 공연을 받나요">
            <ul className="list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
              <li>소규모 공연이에요. 좌석 지정 없이 자유석으로 받아요.</li>
              <li>티켓은 1~3종까지 만들 수 있어요. 가격은 {MIN_TICKET_PRICE.toLocaleString('ko-KR')}원 이상이에요.</li>
              <li>첫 회차는 제출하는 날과 승인하는 날 모두 그날부터 {MIN_LEAD_DAYS}일이 지난 뒤여야 해요. 심사 중에 이 기간이 모자라게 되면 승인할 수 없어요.</li>
            </ul>
          </Panel>

          <Panel as="section" variant="outline" padding="default" title="진행 순서">
            <ol className="list-decimal space-y-1 pl-5 text-gray-700 dark:text-gray-300">
              {STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Panel>

          <Panel as="section" variant="outline" padding="default" title="수수료와 정산">
            <ul className="list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
              <li>
                티켓은 스튜디오 놀이 판매하고 결제도 스튜디오 놀이 받아요. 플랫폼 수수료 {FUNDING_PLATFORM_FEE_PERCENT}%와
                결제 수수료 {FUNDING_PAYMENT_FEE_PERCENT}%(둘 다 부가세 포함)를 주최자가 부담해요.
              </li>
              <li>
                정산은 마지막 회차가 끝난 날부터 영업일 {FUNDING_PAYOUT_BUSINESS_DAYS}일 이내에 보내 드리는 것이 원칙이에요.
                정산받을 계좌와 세금 처리 구분을 등록해야 보낼 수 있고, 등록이 늦으면 등록한 뒤에 보내 드려요.
              </li>
              <li>{FUNDING_INDIVIDUAL_PAYOUT_NOTE}</li>
              <li>
                회차가 취소되면 그 회차의 티켓을 산 관객에게 전액을 환불해요. 이때 결제 수수료는 주최자가 부담해요.
              </li>
            </ul>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              자세한 내용은{' '}
              <Link href="/ko/shows/organizer-terms" className="underline">공연 주최자 약관</Link>에서 확인할 수 있어요.
            </p>
          </Panel>
        </div>

        <CreatorLoginForm terms={{ href: '/ko/shows/organizer-terms', label: '공연 주최자 약관', purpose: '주최자', condition: '등록 조건' }} />
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
ShowsHostPage.designEdition = 'v2';
