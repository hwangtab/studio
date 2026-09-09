import { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

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
  const [agreed, setAgreed] = useState(false);

  return (
    <>
      <Head>
        <title>정기결제 카드 등록 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <main className="mx-auto max-w-lg min-w-0 max-w-full px-4 py-12 sm:py-16">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">정기결제 카드 등록</h1>
        <p className="mt-1 mb-8 text-sm text-gray-500 dark:text-gray-400">{customerName}님</p>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{productName}</h2>

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

          <label className="mt-6 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>위 결제 조건과 해지·환불 규정에 동의합니다.</span>
          </label>

          <div className="mt-6">
            <BillingAuthButton
              subscriptionId={id}
              setupToken={setupToken}
              customerKey={customerKey}
              customerName={customerName}
              customerEmail={customerEmail}
              disabled={!agreed}
            />
          </div>
        </section>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">문의: 스튜디오 놀 010-4255-7893</p>
        <Link href="/ko" className="mt-2 inline-block text-sm text-primary hover:underline">
          홈으로
        </Link>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">카드를 등록할 수 없습니다</h1>
          <p className="mt-4 text-gray-600 dark:text-gray-300">{ERROR_MESSAGES[props.code]}</p>
          <Link href="/ko" className="mt-8 inline-block underline">홈으로</Link>
        </main>
      </>
    );
  }
  return <SubscribeSetupOk {...props} />;
}

export const getServerSideProps: GetServerSideProps<SubscribeSetupProps> = async ({ query, res, params }) => {
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
};
