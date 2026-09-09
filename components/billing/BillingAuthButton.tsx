import { useEffect, useState } from 'react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

import { Button } from '../ui/Button';

interface Props {
  subscriptionId: string;
  setupToken: string;
  customerKey: string;
  customerName: string;
  customerEmail: string;
  /** 동의 체크가 끝나기 전에는 버튼을 눌러도 인증창을 열지 않는다. */
  disabled?: boolean;
}

/**
 * 토스 빌링(자동결제) 카드 등록 버튼.
 *
 * 위젯 결제(TossPaymentWidget)와 달리 결제수단 UI를 렌더링하지 않는다 — 클릭 시
 * `requestBillingAuth`가 카드 인증창을 직접 띄운다. clientKey는 빌링 전용 env
 * (`NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY`)로, 위젯 키와 섞으면 안 된다(스펙 §9).
 */
export default function BillingAuthButton({
  subscriptionId,
  setupToken,
  customerKey,
  customerName,
  customerEmail,
  disabled,
}: Props) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payment, setPayment] = useState<Awaited<ReturnType<Awaited<ReturnType<typeof loadTossPayments>>['payment']>> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const clientKey = process.env.NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY;
        if (!clientKey) throw new Error('결제 설정이 없습니다.');
        const toss = await loadTossPayments(clientKey);
        const p = toss.payment({ customerKey });
        if (!cancelled) {
          setPayment(p);
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '결제 모듈을 불러오지 못했습니다.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerKey]);

  const handleClick = async () => {
    if (!payment) return;
    setSubmitting(true);
    setError(null);
    try {
      const origin = window.location.origin;
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: `${origin}/ko/subscribe/${subscriptionId}/success?token=${encodeURIComponent(setupToken)}`,
        failUrl: `${origin}/ko/subscribe/${subscriptionId}/fail?token=${encodeURIComponent(setupToken)}`,
        customerEmail,
        customerName,
      });
    } catch {
      // 사용자가 인증창을 닫은 경우 등 — SDK가 자체 안내하므로 여기서는 제출 상태만 되돌린다.
      setSubmitting(false);
    }
  };

  if (error) {
    return <p role="alert" className="text-red-600 text-sm">{error}</p>;
  }

  return (
    <Button type="button" onClick={handleClick} disabled={!ready || disabled || submitting} fullWidth>
      {submitting ? '카드 인증창 여는 중...' : '카드 등록하기'}
    </Button>
  );
}
