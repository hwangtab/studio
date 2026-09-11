import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { createSubscription, copyToClipboard } from '../../../components/admin/subscriptionActions';
import { Button } from '../../../components/ui/Button';
import { Field, TextInput } from '../../../components/ui/Field';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatPriceAmount } from '../../../data/pricing';
import { subscriptionAmounts } from '../../../lib/billing/amounts';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
  return { props: {} };
};

// 청구액은 subscriptionAmounts 하나에서만 온다 — 레슨은 VAT 포함(35만원이 최종액),
// 연습실은 VAT 별도라 규칙이 다르다. 여기서 다시 계산하면 둘이 어긋난다.
const lessonAmounts = subscriptionAmounts('lesson');

export default function NewLessonSubscriptionPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [billingDay, setBillingDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (customerName.trim() === '' || customerPhone.trim() === '' || customerEmail.trim() === '') {
      setError('이름·전화번호·이메일을 모두 입력해 주세요.');
      return;
    }
    if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
      setError('결제일은 1~31 사이의 정수여야 합니다.');
      return;
    }

    setBusy(true);
    const result = await createSubscription({
      kind: 'lesson',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      billingDay,
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.message ?? '구독 생성에 실패했습니다.');
      return;
    }

    setSetupUrl(result.setupUrl ?? null);
  };

  return (
    <>
      <Head>
        <title>레슨 구독 만들기 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-lg mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">레슨 구독 만들기</h1>
            <Link href="/admin/subscriptions" passHref>
              <Button light variant="outline">목록으로</Button>
            </Link>
          </div>

          <p className="mb-4 text-sm text-gray-500">
            연습실 구독은 여기서 만들지 않습니다. 서명 완료된 계약 상세 화면에서 &ldquo;정기결제 링크
            만들기&rdquo;를 눌러 주세요.
          </p>

          {setupUrl ? (
            <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 text-green-900 rounded-lg text-sm">
                구독이 생성되고 카드 등록 안내 메일을 발송했습니다.
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">카드 등록 링크</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs">
                    {setupUrl}
                  </code>
                  <Button light variant="outline" onClick={() => copyToClipboard(setupUrl)}>
                    복사
                  </Button>
                </div>
                <p className="mt-2 text-xs text-gray-500">카톡으로 보내는 것이 주 채널입니다.</p>
              </div>
              <div className="flex gap-3">
                <Button light onClick={() => router.push('/admin/subscriptions')}>목록으로</Button>
                <Button light
                  variant="outline"
                  onClick={() => {
                    setSetupUrl(null);
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerEmail('');
                    setBillingDay(1);
                  }}
                >
                  하나 더 만들기
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-4">
              <p className="text-sm text-gray-600">
                프로듀싱 레슨 월정액: {formatPriceAmount(lessonAmounts.totalAmount)}원 (VAT 포함)
              </p>

              <Field id="customer-name" label="이름" className={lightOnlyField}>
                <TextInput
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  light className="text-sm"
                />
              </Field>
              <Field id="customer-phone" label="전화번호" className={lightOnlyField}>
                <TextInput
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  light className="text-sm"
                />
              </Field>
              <Field id="customer-email" label="이메일" className={lightOnlyField}>
                <TextInput
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  light className="text-sm"
                />
              </Field>
              <Field id="billing-day" label="결제일 (매월 1~31일)" className={lightOnlyField}>
                <TextInput
                  type="number"
                  min={1}
                  max={31}
                  value={billingDay}
                  onChange={(e) => setBillingDay(Number(e.target.value))}
                  light className="text-sm"
                />
              </Field>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button light type="submit" disabled={busy} fullWidth>
                {busy ? '생성 중...' : '구독 생성 + 등록 링크 발송'}
              </Button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
