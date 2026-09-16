/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 관리 토큰·paymentKey·orderId가 실린다)의 이탈 링크는 next/link가
 * 아니라 문서 이동이어야 한다. 클라 전환으로 공개 페이지에 나갔다 뒤로가기 하면, 그 사이
 * mount된 gtag가 살아 있는 채로 비밀값이 붙은 URL에 돌아와 page_view를 보낸다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트:
 * tests/pages/privateLinkNavigation.test.ts
 */
import { withI18nServerProps } from '../../../lib/getStatic';
import Head from 'next/head';

import BillingAuthButton from '../../../components/billing/BillingAuthButton';
import { formatPriceAmount } from '../../../data/pricing';
import { subscriptionOrderName } from '../../../lib/billing/amounts';
import { findSubscriptionForSetup } from '../../../lib/billing/service';
import { denyContractPageCaching } from '../../../lib/contracts/page-cache';
import { SUBSCRIPTION_REFUND_POLICY_LINES } from '../../../lib/booking/refund-policy';

type SetupErrorCode = 'not_found' | 'used' | 'expired' | 'invalid_state';

interface ErrorProps {
  outcome: 'error';
  code: SetupErrorCode;
}

interface OkProps {
  outcome: 'ok';
  id: string;
  setupToken: string;
  customerKey: string;
  customerName: string;
  customerEmail: string;
  productName: string;
  itemAmount: number;
  vatAmount: number;
  totalAmount: number;
  billingDay: number;
  /** 'initial'이면 등록과 동시에 첫 달치가 결제된다, 'change'면 카드만 교체된다(스펙 §6). */
  setupMode: 'initial' | 'change';
}

type SubscribeSetupProps = ErrorProps | OkProps;

const ERROR_MESSAGES: Record<SetupErrorCode, string> = {
  not_found: '유효하지 않은 링크입니다. 담당자에게 문의해 주세요. 010-4255-7893',
  used: '이미 등록된 링크입니다.',
  expired: '링크가 만료됐습니다 — 새 링크를 요청해 주세요 010-4255-7893',
  invalid_state: '지금은 카드를 등록할 수 없는 상태입니다. 010-4255-7893',
};

function PriceBreakdown({ itemAmount, vatAmount, totalAmount }: { itemAmount: number; vatAmount: number; totalAmount: number }) {
  return (
    <div className="mt-6 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-700 dark:text-gray-300">
      <p>
        상품가 {formatPriceAmount(itemAmount)}원 + VAT {formatPriceAmount(vatAmount)}원 ={' '}
        <span className="font-semibold text-gray-900 dark:text-white">
          합계 {formatPriceAmount(totalAmount)}원
        </span>
      </p>
    </div>
  );
}

function SubscribeSetupOk(props: OkProps) {
  const { id, setupToken, customerKey, customerName, customerEmail, productName, itemAmount, vatAmount, totalAmount, billingDay, setupMode } = props;

  return (
    <>
      <Head>
        <title>정기결제 카드 등록 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <main className="mx-auto max-w-lg min-w-0 max-w-full px-4 py-12 sm:py-16">
        {/* Layout이 헤더·푸터를 벗기는 화면이라(lib/analytics/privatePaths.ts) 여기가 브랜드를
            밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 피싱과 구별할 수 있어야 한다. */}
        <p className="typo-card-meta mb-2">스튜디오 놀</p>
        <h1 className="typo-page-title">정기결제 카드 등록</h1>
        <p className="mt-1 mb-8 text-sm text-gray-500 dark:text-gray-400">{customerName}님</p>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-8">
          <h2 className="typo-card-subtitle text-gray-900 dark:text-white">{productName}</h2>

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">매월 결제일</dt>
              <dd className="font-medium text-gray-900 dark:text-white">매월 {billingDay}일</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">등록 이메일</dt>
              <dd className="font-medium text-gray-900 dark:text-white break-all">{customerEmail}</dd>
            </div>
          </dl>

          <PriceBreakdown itemAmount={itemAmount} vatAmount={vatAmount} totalAmount={totalAmount} />

          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
            {setupMode === 'initial'
              ? '카드 등록과 동시에 첫 달치가 결제됩니다.'
              : '카드만 교체되며 결제되지 않습니다.'}
          </p>

          <div className="mt-6 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">해지·환불 규정</p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
              {SUBSCRIPTION_REFUND_POLICY_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {/*
            동의는 **카드 등록하기를 누르는 행위 자체**로 받는다. 체크박스를 두지 않는다 —
            예약·믹싱·펀딩 결제 화면과 같은 방식이다(#162).

            해지·환불 조건은 전자상거래법 제13조상 **고지** 의무이고, 규정 전문을 바로 위에
            펼쳐 두었다. 매월 자동 청구라는 사실과 첫 결제 시점도 그 위에 이미 적혀 있다 —
            체크 한 번이 더해 주는 것은 없고, 누르기 전에 읽어야 할 것이 화면에 다 있다.

            서버는 등록 토큰으로 이 화면을 통해 온 요청만 받는다(findSubscriptionForSetup).
          */}
          <p className="mt-6 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            카드 등록하기를 누르면 위 결제 조건과 해지·환불 규정에 동의하는 것으로 봅니다.
          </p>

          <div className="mt-6">
            <BillingAuthButton
              subscriptionId={id}
              setupToken={setupToken}
              customerKey={customerKey}
              customerName={customerName}
              customerEmail={customerEmail}
            />
          </div>
        </section>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">문의: 스튜디오 놀 010-4255-7893</p>
        {/* 이 URL에는 관리·등록 토큰이 실린다 — 이탈 링크는 문서 이동(`<a href>`)이어야 한다.
            next/link 클라 전환으로 공개 페이지에 나갔다 뒤로가기를 누르면, 그 사이 mount된
            gtag가 토큰이 붙은 이 URL로 page_view를 보낸다. 공개 목적지에는 rel="noreferrer"도
            함께 — 사이트 Referrer-Policy가 동일 출처 이동에 전체 URL을 보낸다
            (규칙 정본: lib/analytics/privatePaths.ts). */}
        <a href="/ko" rel="noreferrer" className="mt-2 inline-block text-sm text-primary dark:text-primary-lighter hover:underline">
          홈으로
        </a>
      </main>
    </>
  );
}

export default function SubscribeSetupPage(props: SubscribeSetupProps) {
  if (props.outcome === 'error') {
    return (
      <>
        <Head>
          <title>정기결제 카드 등록 | 스튜디오 놀</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <main className="mx-auto max-w-lg min-w-0 max-w-full px-4 py-24 text-center">
          <p className="typo-card-meta mb-2">스튜디오 놀</p>
          <h1 className="typo-page-title">카드를 등록할 수 없습니다</h1>
          <p className="mt-4 text-gray-600 dark:text-gray-300">{ERROR_MESSAGES[props.code]}</p>
          <a href="/ko" rel="noreferrer" className="mt-8 inline-block underline">홈으로</a>
        </main>
      </>
    );
  }
  return <SubscribeSetupOk {...props} />;
}

export const getServerSideProps = withI18nServerProps<SubscribeSetupProps>(async ({ query, res, params }) => {
  denyContractPageCaching(res);
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { id } = params as { id: string };
  const { token } = query;
  if (typeof id !== 'string' || typeof token !== 'string' || token.trim() === '') {
    return { props: { outcome: 'error', code: 'not_found' } };
  }

  const found = await findSubscriptionForSetup(id, token, new Date());
  if (!found.ok) {
    // findSubscriptionForSetup은 not_found를 토큰 불일치에도 쓴다(존재 여부를 감춘다) — 화면도 그대로 따른다.
    return { props: { outcome: 'error', code: found.code } };
  }

  const sub = found.subscription;
  return {
    props: {
      outcome: 'ok',
      id: sub.id,
      setupToken: token,
      customerKey: sub.customerKey,
      customerName: sub.customerName,
      customerEmail: sub.customerEmail,
      productName: subscriptionOrderName(sub.kind),
      itemAmount: sub.itemAmount,
      vatAmount: sub.vatAmount,
      totalAmount: sub.totalAmount,
      billingDay: sub.billingDay,
      setupMode: sub.setupMode,
    },
  };
});
