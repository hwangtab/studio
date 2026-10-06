/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 결제 링크 slug가 실린다)의 이탈 링크는 next/link가 아니라 문서 이동이어야 한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트: tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';
import { useState } from 'react';

import { getSiteConfig } from '../../../data/siteConfig';
import { getPaymentLink } from '../../../data/paymentLinks';
import { formatPriceAmount } from '../../../data/pricing';
import { splitInclusiveAmount } from '../../../lib/booking/amounts';
import { withI18nServerProps } from '../../../lib/getStatic';
import TossPaymentWidget from '../../../components/booking/TossPaymentWidget';
import { Button } from '../../../components/ui/Button';
import { Field, TextInput } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { PageShell } from '../../../components/ui/PageHeader';
import { PriceSummary } from '../../../components/ui/PriceSummary';

interface PayLinkProps {
  slug: string;
  itemName: string;
  itemAmount: number;
  vatAmount: number;
  totalAmount: number;
}

interface CreatedOrder {
  orderNo: string;
  totalAmount: number;
  orderName: string;
}

const CONTACT_PHONE_DISPLAY = '010-4255-7893';
const CONTACT_PHONE_TEL = '01042557893';

export default function PaymentLinkPage({ slug, itemName, itemAmount, vatAmount, totalAmount }: PayLinkProps) {
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CreatedOrder | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/payment-links/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; orderNo: string; totalAmount: number; orderName: string }
        | { ok: false; message?: string }
        | null;
      if (!response.ok || !data || !data.ok) {
        setError((data && !data.ok && data.message) || '주문을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setOrder({ orderNo: data.orderNo, totalAmount: data.totalAmount, orderName: data.orderName });
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>{itemName} 결제 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="form">
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>

        <header className="mb-6 text-center">
          <h1 className="typo-page-title text-gray-900 dark:text-white">{itemName}</h1>
          <p className="mt-4 text-4xl font-bold tabular-nums text-gray-900 dark:text-white">
            {formatPriceAmount(totalAmount)}원
          </p>
          <p className="mt-1 typo-card-meta">예약금 {formatPriceAmount(totalAmount)}원 (부가세 포함)</p>
        </header>

        <PriceSummary
          className="mb-6"
          items={[{ label: itemName, amount: itemAmount }]}
          vat={vatAmount}
          total={totalAmount}
          totalLabel="결제 금액 (부가세 포함)"
        />

        {order ? (
          <section aria-labelledby="pay-widget-heading">
            <h2 id="pay-widget-heading" className="typo-card-subtitle mb-3 text-gray-900 dark:text-white">
              결제 수단 선택
            </h2>
            <TossPaymentWidget
              orderNo={order.orderNo}
              amount={order.totalAmount}
              orderName={order.orderName}
              customerName={customerName.trim()}
              customerEmail={customerEmail.trim()}
              service="deposit"
              successUrl="/ko/pay/success"
              failUrl={`/ko/pay/fail?slug=${slug}`}
            />
            <div className="mt-4 text-center">
              <Button type="button" variant="ghost" onClick={() => setOrder(null)}>
                주문자 정보 수정
              </Button>
            </div>
          </section>
        ) : (
          <section aria-labelledby="pay-form-heading">
            <h2 id="pay-form-heading" className="typo-card-subtitle mb-3 text-gray-900 dark:text-white">
              주문자 정보
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field id="customerName" label="이름" required>
                <TextInput
                  type="text"
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </Field>
              <Field id="customerPhone" label="휴대폰 번호" required>
                <TextInput
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="010-1234-5678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </Field>
              <Field id="customerEmail" label="이메일" required>
                <TextInput
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                />
              </Field>
              {error && (
                <Notice tone="error" role="alert">
                  {error}
                </Notice>
              )}
              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? '확인 중…' : '결제 수단 선택하기'}
              </Button>
            </form>
          </section>
        )}

        <p className="mt-8 text-center typo-card-meta">
          환불은 카카오톡 또는 전화로 문의해 주세요.{' '}
          <a href={kakaoUrl} target="_blank" rel="noopener noreferrer" className="underline">
            카카오톡 문의
          </a>
          {' · '}
          <a href={`tel:${CONTACT_PHONE_TEL}`} rel="noreferrer" className="underline">
            {CONTACT_PHONE_DISPLAY}
          </a>
        </p>
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<PayLinkProps>(async ({ params, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (params?.locale !== 'ko') return { notFound: true };
  const slug = params?.slug;
  const link = getPaymentLink(slug);
  if (!link || typeof slug !== 'string') return { notFound: true };
  const amounts = splitInclusiveAmount(link.totalAmount);
  return {
    props: {
      slug,
      itemName: link.itemName,
      itemAmount: amounts.itemAmount,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
PaymentLinkPage.designEdition = 'v2';
